// Bundles packages/ramka with esbuild (same externals as tsup) and reports
// per-source-module byte contribution, split by eager vs lazily-loaded chunk.
import * as esbuild from 'esbuild';
import { gzipSync } from 'node:zlib';

const result = await esbuild.build({
  entryPoints: ['packages/ramka/src/index.ts'],
  bundle: true,
  splitting: true,
  format: 'esm',
  target: 'es2020',
  minify: true,
  outdir: '/tmp/ramka-analyze',
  external: ['react', 'react-dom', 'react/jsx-runtime', '@base-ui/react/*'],
  metafile: true,
  write: true,
  jsx: 'automatic',
  logLevel: 'error',
});

const meta = result.metafile;

// Which output is the entry, and which outputs are reachable only via import()?
const entryOut = Object.keys(meta.outputs).find((o) => meta.outputs[o].entryPoint);
const eager = new Set([entryOut]);
let changed = true;
while (changed) {
  changed = false;
  for (const [out, info] of Object.entries(meta.outputs)) {
    if (!eager.has(out)) continue;
    for (const imp of info.imports ?? []) {
      if (imp.kind === 'import-statement' && !eager.has(imp.path)) {
        eager.add(imp.path);
        changed = true;
      }
    }
  }
}

const perModule = new Map();
let eagerBytes = 0;
let lazyBytes = 0;

for (const [out, info] of Object.entries(meta.outputs)) {
  if (out.endsWith('.map')) continue;
  const isEager = eager.has(out);
  if (isEager) eagerBytes += info.bytes;
  else lazyBytes += info.bytes;
  for (const [inputPath, { bytesInOutput }] of Object.entries(info.inputs ?? {})) {
    const key = inputPath.replace('packages/ramka/src/', '');
    const cur = perModule.get(key) ?? { eager: 0, lazy: 0 };
    cur[isEager ? 'eager' : 'lazy'] += bytesInOutput;
    perModule.set(key, cur);
  }
}

const rows = [...perModule.entries()]
  .map(([file, v]) => ({ file, ...v, total: v.eager + v.lazy }))
  .sort((a, b) => b.total - a.total);

const pad = (s, n) => String(s).padStart(n);
console.log('minified bytes attributed to each source module\n');
console.log(`${pad('eager', 8)}${pad('lazy', 8)}${pad('total', 8)}  module`);
for (const r of rows) {
  if (r.total < 200) continue;
  console.log(`${pad(r.eager || '', 8)}${pad(r.lazy || '', 8)}${pad(r.total, 8)}  ${r.file}`);
}

console.log('\n--- chunk summary ---');
for (const [out, info] of Object.entries(meta.outputs)) {
  if (out.endsWith('.map')) continue;
  console.log(
    `${eager.has(out) ? 'EAGER' : 'lazy '}  ${pad(info.bytes, 7)} min  ${pad(
      gzipSync(Buffer.from((await import('node:fs')).readFileSync(out)), { level: 9 }).length,
      6,
    )} gz  ${out.replace('/tmp/ramka-analyze/', '')}`,
  );
}
console.log(`\nEAGER total min = ${eagerBytes}   lazy total min = ${lazyBytes}`);
