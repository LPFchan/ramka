// Companion to probe-zoom-gate.mjs: checks the arming call against webpack.
//
// Worth checking separately. Webpack reads `"sideEffects": false` from
// package.json itself, and its rule ("skip a module when none of its exports
// are used") is not Rollup's ("top-level statements are pure"). Either could
// legally discard `requestZoomRuntime()` at the top of lightbox-zoom.tsx, which
// would silently un-arm the prefetch for consumers who do use Zoom.
//
// Minification is off so the check can grep for the real symbol instead of
// pattern-matching mangled output. Tree-shaking (sideEffects / usedExports) is
// left on, since that is the behaviour under test.
//
// Uses the webpack Next ships, so this reflects what a Next consumer gets.

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

const base = '/tmp/zoom-gate-webpack';
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
  const all = Object.values(code).join('\n');

  return {
    label,
    zoomPartBundled: /lightbox-zoom\.js/.test(all),
    // A *call*, not the declaration — `function requestZoomRuntime()` survives
    // as dead code in the no-Zoom bundle and would match a naive pattern.
    armingCallKept: /(?<!function\s)requestZoomRuntime\(\)/.test(all),
    engineChunkEmitted: Object.entries(code).some(
      ([f, c]) => f !== entryFile && /LightboxZoomEngine/.test(c),
    ),
  };
}

const rows = [];
for (const [label, src] of Object.entries(SCENARIOS)) rows.push(await probe(label, src));

console.log('webpack 5 (as shipped by Next), production tree-shaking, minify off\n');
console.log(`${'scenario'.padEnd(22)}${'Zoom bundled'.padEnd(15)}${'arming kept'.padEnd(14)}engine chunk emitted`);
for (const r of rows) {
  console.log(
    r.label.padEnd(22) +
      String(r.zoomPartBundled).padEnd(15) +
      String(r.armingCallKept).padEnd(14) +
      String(r.engineChunkEmitted),
  );
}

const [noZoom, withZoom] = rows;
const checks = [
  ['no-Zoom gallery leaves lightbox-zoom.js out', noZoom.zoomPartBundled === false],
  ['no-Zoom gallery leaves the gate disarmed', noZoom.armingCallKept === false],
  ['Zoom gallery keeps the arming call', withZoom.armingCallKept === true],
];
console.log('');
for (const [name, pass] of checks) console.log(`  ${pass ? 'ok  ' : 'FAIL'}  ${name}`);
const ok = checks.every(([, pass]) => pass);
console.log(
  `\n${ok ? 'PASS' : 'FAIL'} — note: webpack may still *emit* the engine chunk for a non-zoom` +
    `\ngallery (it does not constant-fold the flag across modules the way Rollup does).` +
    `\nWhat matters is that it is never fetched — lightbox-zoom-loader.test.ts covers that.`,
);
process.exit(ok ? 0 : 1);
