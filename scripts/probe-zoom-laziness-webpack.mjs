// Companion to probe-zoom-laziness.mjs: same question, asked of webpack.
//
// Worth asking twice. Webpack reads `"sideEffects": false` from package.json
// itself, and its rule ("skip a module when none of its exports are used") is
// not Rollup's ("top-level statements are pure"). The two also split chunks
// differently, so "the engine is a separate chunk under Rollup" does not imply
// the same under webpack — and webpack is what Next consumers actually get.
//
// Minification is off so this can grep for real symbols instead of pattern-
// matching mangled output. Tree-shaking is left on, since that is the
// behaviour under test.

import { writeFileSync, mkdirSync, rmSync, readFileSync, readdirSync, globSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import { createRequire } from 'node:module';

const repoRoot = resolvePath(import.meta.dirname, '..');
const require = createRequire(join(repoRoot, 'scripts/'));

const [nextDir] = globSync('node_modules/.pnpm/next@*/node_modules/next', { cwd: repoRoot });
if (!nextDir) throw new Error('next not found under node_modules/.pnpm');
const webpackModule = require(join(repoRoot, nextDir, 'dist/compiled/webpack/webpack.js'));
// `init()` populates the real exports on the module object.
webpackModule.init();
const { webpack } = webpackModule;

const LIB = JSON.stringify(resolvePath(repoRoot, 'packages/ramka/dist/lightbox/lightbox.js'));
const GALLERY = `Lightbox.Root, Lightbox.Trigger, Lightbox.Portal, Lightbox.Content,
  Lightbox.Slides, Lightbox.Slide, Lightbox.Item, Lightbox.Media,
  Lightbox.Close, Lightbox.Next, Lightbox.Previous`;

const SCENARIOS = {
  'gallery, no Zoom': `import * as Lightbox from ${LIB};\nexport default [${GALLERY}];`,
  'same gallery + Zoom': `import * as Lightbox from ${LIB};\nexport default [${GALLERY}, Lightbox.Zoom];`,
};

const base = '/tmp/zoom-laziness-webpack';
rmSync(base, { recursive: true, force: true });

const run = (config) =>
  new Promise((res, rej) => {
    webpack(config, (err, stats) => {
      if (err) return rej(err);
      if (stats.hasErrors()) {
        return rej(new Error(stats.toJson().errors.map((e) => e.message).join('\n')));
      }
      res(stats);
    });
  });

async function probe(label, source) {
  const dir = join(base, label.replace(/\W+/g, '_'));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'app.js'), source);

  await run({
    mode: 'production',
    entry: join(dir, 'app.js'),
    output: {
      path: join(dir, 'out'),
      library: { type: 'module' },
      chunkFormat: 'module',
      // Keep the `/*!*** ./path ***!*/` module banners, which production mode
      // drops — they are how this probe tells which source modules survived.
      pathinfo: true,
    },
    experiments: { outputModule: true },
    externals: { react: 'react', 'react-dom': 'react-dom', 'react/jsx-runtime': 'react/jsx-runtime' },
    externalsType: 'module',
    optimization: { minimize: false, sideEffects: true, usedExports: true },
    performance: false,
    stats: 'errors-only',
  });

  const outDir = join(dir, 'out');
  // `experiments.outputModule` emits .mjs, not .js.
  const files = readdirSync(outDir).filter((f) => /\.m?js$/.test(f));
  const code = Object.fromEntries(files.map((f) => [f, readFileSync(join(outDir, f), 'utf8')]));
  const entryFile = files.find((f) => /^main\./.test(f));
  if (!entryFile) throw new Error(`no entry chunk among: ${files.join(', ')}`);

  // A chunk that merely *reaches* the engine still names it, inside the
  // argument comment webpack writes next to the chunk-loading call:
  //   __webpack_require__.e(/*! import() */ 513)
  // Only a chunk that actually contains the module gets the `pathinfo` banner
  // (`!*** ./path ***!`), so that is what distinguishes holding from pointing.
  const engineIn = (contents) => /!\*{3}[^\n]*lightbox-zoom-runtime\.js/.test(contents);

  return {
    label,
    zoomPartBundled: /lightbox-zoom\.js/.test(Object.values(code).join('\n')),
    engineEager: engineIn(code[entryFile]),
    engineChunked: Object.entries(code).some(([f, c]) => f !== entryFile && engineIn(c)),
  };
}

const rows = [];
for (const [label, src] of Object.entries(SCENARIOS)) rows.push(await probe(label, src));

console.log('webpack 5 (as shipped by Next), production tree-shaking, minify off\n');
console.log(`${'scenario'.padEnd(22)}${'Zoom bundled'.padEnd(15)}${'engine eager'.padEnd(14)}engine in its own chunk`);
for (const r of rows) {
  console.log(
    r.label.padEnd(22) +
      String(r.zoomPartBundled).padEnd(15) +
      String(r.engineEager).padEnd(14) +
      String(r.engineChunked),
  );
}

const [noZoom, withZoom] = rows;
const checks = [
  ['no-Zoom gallery leaves lightbox-zoom.js out', noZoom.zoomPartBundled === false],
  ['the engine never lands in the entry chunk', !noZoom.engineEager && !withZoom.engineEager],
  ['the engine gets its own chunk once Zoom is used', withZoom.engineChunked === true],
];
console.log('');
for (const [name, pass] of checks) console.log(`  ${pass ? 'ok  ' : 'FAIL'}  ${name}`);

// Same trade as the Rollup probe records: the prefetch is unconditional, so
// webpack emits the engine chunk for a non-zoom gallery too.
console.log(
  `\nKnown cost: the engine chunk is emitted without Zoom as well (${noZoom.engineChunked}),` +
    `\nbecause Root and Trigger call prefetchZoomRuntime() unconditionally.`,
);

const ok = checks.every(([, pass]) => pass);
console.log(`\n${ok ? 'PASS' : 'FAIL'} — engine kept out of webpack's entry chunk`);
process.exit(ok ? 0 : 1);
