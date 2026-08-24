// Verifies the zoom-prefetch gate, in both directions, against a real bundler.
//
// The gate is a module-level flag set when `lightbox-zoom.tsx` is evaluated.
// The package declares `"sideEffects": false`, which licenses a bundler to drop
// import-time side effects, so "does the signal survive tree-shaking" is not a
// question to answer by reading the code.
//
// For each scenario this reports whether the zoom runtime is reachable at all
// (statically or lazily) and whether the gate is armed, plus the eager payload.

import * as esbuild from 'esbuild';
import { rollup } from 'rollup';
import { gzipSync } from 'node:zlib';
import { writeFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve as resolvePath } from 'node:path';

const repoRoot = resolvePath(import.meta.dirname, '..');

const LIB = process.argv[2] ?? join(repoRoot, 'packages/ramka/dist/lightbox/lightbox.js');

const SCENARIOS = {
  'gallery, no Zoom': `import * as Lightbox from 'LIB';
    export default [Lightbox.Root, Lightbox.Trigger, Lightbox.Portal, Lightbox.Content,
                    Lightbox.Slides, Lightbox.Slide, Lightbox.Item, Lightbox.Media,
                    Lightbox.Close, Lightbox.Next, Lightbox.Previous];`,
  'same gallery + Zoom': `import * as Lightbox from 'LIB';
    export default [Lightbox.Root, Lightbox.Trigger, Lightbox.Portal, Lightbox.Content,
                    Lightbox.Slides, Lightbox.Slide, Lightbox.Item, Lightbox.Media,
                    Lightbox.Close, Lightbox.Next, Lightbox.Previous, Lightbox.Zoom];`,
  'whole namespace': `import * as Lightbox from 'LIB'; export default Object.values(Lightbox);`,
};

const isExternal = (id) =>
  ['react', 'react-dom', 'react/jsx-runtime'].includes(id) || id.startsWith('@base-ui/');

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

const base = '/tmp/zoom-gate-probe';
rmSync(base, { recursive: true, force: true });

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

  // Walk static edges only; import() edges stay lazy.
  const byName = new Map(chunks.map((c) => [c.fileName, c]));
  const eager = new Set([entry.fileName]);
  for (let changed = true; changed; ) {
    changed = false;
    for (const n of [...eager]) {
      for (const imp of byName.get(n).imports ?? []) {
        if (byName.has(imp) && !eager.has(imp)) {
          eager.add(imp);
          changed = true;
        }
      }
    }
  }

  const eagerCode = [...eager].map((n) => byName.get(n).code).join('\n');
  const { code: min } = await esbuild.transform(eagerCode, {
    minify: true,
    format: 'esm',
    target: 'es2020',
  });

  const modules = new Set(chunks.flatMap((c) => Object.keys(c.modules ?? {})));
  const has = (needle) => [...modules].some((m) => m.includes(needle));

  // The gate is armed iff the eager code still contains the assignment that
  // `requestZoomRuntime()` performs, under whatever names the minifier chose.
  const armed = /\bfunction \w+\(\)\{\w+=!0\}/.test(min) && /\w+\(\);/.test(min);

  const lazyChunks = chunks.filter((c) => !eager.has(c.fileName));
  const zoomChunk = lazyChunks.find((c) =>
    Object.keys(c.modules ?? {}).some((m) => m.includes('lightbox-zoom-runtime')),
  );
  let zoomChunkGz = 0;
  if (zoomChunk) {
    const { code: zmin } = await esbuild.transform(zoomChunk.code, {
      minify: true,
      format: 'esm',
      target: 'es2020',
    });
    zoomChunkGz = gzipSync(Buffer.from(zmin), { level: 9 }).length;
  }

  return {
    label,
    zoomPartBundled: has('lightbox-zoom.js'),
    armed,
    eagerGz: gzipSync(Buffer.from(min), { level: 9 }).length,
    zoomChunkGz,
  };
}

const kb = (n) => `${(n / 1024).toFixed(1)}K`;
const rows = [];
for (const [label, code] of Object.entries(SCENARIOS)) rows.push(await probe(label, code));

console.log('Zoom prefetch gate (Rollup, treeshake moduleSideEffects: false)\n');
console.log(
  `${'scenario'.padEnd(22)}${'Zoom in bundle'.padEnd(16)}${'gate armed'.padEnd(13)}${'eager gz'.padEnd(11)}zoom chunk gz`,
);
for (const r of rows) {
  console.log(
    r.label.padEnd(22) +
      String(r.zoomPartBundled).padEnd(16) +
      String(r.armed).padEnd(13) +
      kb(r.eagerGz).padEnd(11) +
      (r.zoomChunkGz ? kb(r.zoomChunkGz) : '—'),
  );
}

// A gallery without Zoom must not emit the engine chunk at all, and every
// bundle that does contain Zoom must keep the arming call — that is the part
// `"sideEffects": false` could legally have thrown away.
const [noZoom, withZoom, namespace] = rows;
const checks = [
  ['no-Zoom gallery leaves Zoom out of the bundle', noZoom.zoomPartBundled === false],
  ['no-Zoom gallery emits no engine chunk', noZoom.zoomChunkGz === 0],
  ['no-Zoom gallery leaves the gate disarmed', noZoom.armed === false],
  ['Zoom gallery keeps the arming call', withZoom.armed === true],
  ['Zoom gallery still emits the engine chunk', withZoom.zoomChunkGz > 0],
  ['whole-namespace consumer keeps the arming call', namespace.armed === true],
];

console.log('');
for (const [name, pass] of checks) console.log(`  ${pass ? 'ok  ' : 'FAIL'}  ${name}`);
const ok = checks.every(([, pass]) => pass);
console.log(`\n${ok ? 'PASS' : 'FAIL'} — engine chunk avoided for non-zoom galleries: ${kb(withZoom.zoomChunkGz)} gz`);
process.exit(ok ? 0 : 1);
