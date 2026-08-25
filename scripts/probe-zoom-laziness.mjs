// Checks how the zoom engine is split out, against a real bundler.
//
// The zoom engine is the largest single piece of the library — bigger than the
// entire eager payload of a typical gallery — so the thing worth pinning is
// that it never lands in the eager graph. `"sideEffects": false` and a dynamic
// import are what keep it out, and neither is something to verify by reading
// the code: a stray static import anywhere in the reachable graph pulls the
// whole engine forward, and nothing about the source would look different.
//
// A note on what this does NOT check, because the previous version of this
// probe got it wrong for its whole life. There is no "gate" that arms zoom
// prefetching. `Lightbox.Root` and `Lightbox.Trigger` call
// `prefetchZoomRuntime()` unconditionally, so the engine chunk is emitted and
// fetched even by galleries that never use `Lightbox.Zoom`. That is a
// deliberate trade — gestures are live as early as the network allows — and it
// is reported below as a cost rather than asserted as a failure. If it ever
// becomes conditional, the "known cost" line is the one to update.

import * as esbuild from 'esbuild';
import { rollup } from 'rollup';
import { gzipSync } from 'node:zlib';
import { writeFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve as resolvePath } from 'node:path';

const repoRoot = resolvePath(import.meta.dirname, '..');

const LIB = process.argv[2] ?? join(repoRoot, 'packages/ramka/dist/lightbox/lightbox.js');

const GALLERY = `Lightbox.Root, Lightbox.Trigger, Lightbox.Portal, Lightbox.Content,
  Lightbox.Slides, Lightbox.Slide, Lightbox.Item, Lightbox.Media,
  Lightbox.Close, Lightbox.Next, Lightbox.Previous`;

const SCENARIOS = {
  'gallery, no Zoom': `import * as Lightbox from 'LIB'; export default [${GALLERY}];`,
  'same gallery + Zoom': `import * as Lightbox from 'LIB'; export default [${GALLERY}, Lightbox.Zoom];`,
  'whole namespace': `import * as Lightbox from 'LIB'; export default Object.values(Lightbox);`,
};

const isExternal = (id) => ['react', 'react-dom', 'react/jsx-runtime'].includes(id);

const resolverPlugin = {
  name: 'relative-resolver',
  resolveId(source, importer) {
    if (!importer || !source.startsWith('.')) return null;
    const abs = resolvePath(dirname(importer), source);
    for (const c of [abs, `${abs}.js`, `${abs}.cjs`, `${abs}.mjs`, join(abs, 'index.js')]) {
      if (existsSync(c) && statSync(c).isFile()) return c;
    }
    return null;
  },
};

const base = '/tmp/zoom-laziness-probe';
rmSync(base, { recursive: true, force: true });

const gz = (code) => gzipSync(Buffer.from(code), { level: 9 }).length;
const minify = async (code) =>
  (await esbuild.transform(code, { minify: true, format: 'esm', target: 'es2020' })).code;

async function probe(label, code) {
  const dir = join(base, label.replace(/\W+/g, '_'));
  mkdirSync(dir, { recursive: true });
  const app = join(dir, 'app.js');
  writeFileSync(app, code.replaceAll('LIB', LIB));

  const bundle = await rollup({
    input: app,
    external: isExternal,
    plugins: [resolverPlugin],
    treeshake: { moduleSideEffects: false },
    onwarn: () => {},
  });
  const { output } = await bundle.generate({ format: 'es' });
  await bundle.close();

  const chunks = output.filter((c) => c.type === 'chunk');
  const entry = chunks.find((c) => c.isEntry);

  // Walk static edges only; import() edges are the split points under test.
  const byName = new Map(chunks.map((c) => [c.fileName, c]));
  const eager = new Set([entry.fileName]);
  for (let changed = true; changed; ) {
    changed = false;
    for (const name of [...eager]) {
      for (const imported of byName.get(name).imports ?? []) {
        if (byName.has(imported) && !eager.has(imported)) {
          eager.add(imported);
          changed = true;
        }
      }
    }
  }

  const modulesOf = (names) =>
    new Set(names.flatMap((n) => Object.keys(byName.get(n).modules ?? {})));
  const eagerModules = modulesOf([...eager]);
  const has = (set, needle) => [...set].some((m) => m.includes(needle));

  const lazyChunks = chunks.filter((c) => !eager.has(c.fileName));
  const engineChunk = lazyChunks.find((c) =>
    Object.keys(c.modules ?? {}).some((m) => m.includes('lightbox-zoom-runtime')),
  );

  return {
    label,
    // The `Lightbox.Zoom` part itself — small, and should tree-shake away.
    zoomPartEager: has(eagerModules, 'lightbox-zoom.js'),
    // The engine. Must never be eager, in any scenario.
    engineEager: has(eagerModules, 'lightbox-zoom-runtime'),
    engineChunkGz: engineChunk ? gz(await minify(engineChunk.code)) : 0,
    eagerGz: gz(await minify([...eager].map((n) => byName.get(n).code).join('\n'))),
  };
}

const kb = (n) => `${(n / 1024).toFixed(1)}K`;
const rows = [];
for (const [label, code] of Object.entries(SCENARIOS)) rows.push(await probe(label, code));

console.log('Zoom engine splitting (Rollup, treeshake moduleSideEffects: false)\n');
console.log(
  `${'scenario'.padEnd(22)}${'Zoom part eager'.padEnd(17)}${'engine eager'.padEnd(14)}${'eager gz'.padEnd(11)}engine chunk gz`,
);
for (const r of rows) {
  console.log(
    r.label.padEnd(22) +
      String(r.zoomPartEager).padEnd(17) +
      String(r.engineEager).padEnd(14) +
      kb(r.eagerGz).padEnd(11) +
      (r.engineChunkGz ? kb(r.engineChunkGz) : '—'),
  );
}

const [noZoom, withZoom, namespace] = rows;

// Adding `Lightbox.Zoom` should cost only the part that wires it up. If the
// engine ever leaks into the eager graph this delta jumps by roughly its whole
// gzipped size, so the bound is deliberately far below that.
const ZOOM_PART_EAGER_BUDGET = 4 * 1024;
const zoomPartCost = withZoom.eagerGz - noZoom.eagerGz;

const checks = [
  ['a gallery without Zoom tree-shakes the Zoom part away', noZoom.zoomPartEager === false],
  ['a gallery with Zoom does pull the Zoom part in', withZoom.zoomPartEager === true],
  ['the engine stays lazy without Zoom', noZoom.engineEager === false],
  ['the engine stays lazy with Zoom', withZoom.engineEager === false],
  ['the engine stays lazy for a whole-namespace consumer', namespace.engineEager === false],
  ['the engine is split into its own chunk', withZoom.engineChunkGz > 0],
  [
    `adding Zoom costs ${kb(zoomPartCost)} eager, under the ${kb(ZOOM_PART_EAGER_BUDGET)} budget`,
    zoomPartCost > 0 && zoomPartCost < ZOOM_PART_EAGER_BUDGET,
  ],
];

console.log('');
for (const [name, pass] of checks) console.log(`  ${pass ? 'ok  ' : 'FAIL'}  ${name}`);

// Not a pass/fail: Root and Trigger prefetch unconditionally, so this is paid
// by galleries that cannot use it. Deliberate, but worth printing every run.
console.log(
  `\nKnown cost: a gallery without Zoom still emits and fetches the engine` +
    ` (${kb(noZoom.engineChunkGz)} gz),\nbecause Root and Trigger call prefetchZoomRuntime() unconditionally.`,
);

const ok = checks.every(([, pass]) => pass);
console.log(`\n${ok ? 'PASS' : 'FAIL'} — engine kept out of the eager payload: ${kb(withZoom.engineChunkGz)} gz`);
process.exit(ok ? 0 : 1);
