// Measures minified + gzipped size of each built ESM chunk in packages/ramka/dist.
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { join } from 'node:path';
const { transform } = await import(
  new URL(
    './node_modules/.pnpm/esbuild@0.28.1/node_modules/esbuild/lib/main.js',
    import.meta.url.replace(/scripts\/[^/]+$/, ''),
  ).href
);

const dist = process.argv[2] ?? 'packages/ramka/dist';
const files = readdirSync(dist)
  .filter((f) => f.endsWith('.js'))
  .sort();

let totalMin = 0;
const rows = [];
const minified = [];

for (const f of files) {
  const raw = readFileSync(join(dist, f), 'utf8');
  const { code } = await transform(raw, {
    minify: true,
    format: 'esm',
    target: 'es2020',
    loader: 'js',
  });
  minified.push(code);
  totalMin += Buffer.byteLength(code);
  rows.push({
    file: f,
    raw: Buffer.byteLength(raw),
    min: Buffer.byteLength(code),
    gz: gzipSync(code, { level: 9 }).length,
    br: brotliCompressSync(Buffer.from(code)).length,
  });
}

rows.sort((a, b) => b.min - a.min);
const pad = (s, n) => String(s).padStart(n);
console.log(`${pad('raw', 8)}${pad('min', 9)}${pad('min+gz', 9)}${pad('min+br', 9)}  file`);
for (const r of rows) {
  console.log(`${pad(r.raw, 8)}${pad(r.min, 9)}${pad(r.gz, 9)}${pad(r.br, 9)}  ${r.file}`);
}
const all = minified.join('\n');
console.log(
  `\nTOTAL  min=${totalMin}  min+gz=${gzipSync(all, { level: 9 }).length}  min+br=${brotliCompressSync(Buffer.from(all)).length}`,
);
