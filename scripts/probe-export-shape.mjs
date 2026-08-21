// Guards the export shape of the public API.
//
// ramka publishes its parts as a flat module (`ramka/lightbox`) and lets the
// consumer name the namespace: `import * as Lightbox from 'ramka/lightbox'`.
// The obvious alternative — hand out a ready-made namespace so people can
// write `import { Lightbox } from 'ramka'` — reads identically at the call
// site and costs real bytes, because once the namespace object is built
// *inside* the package esbuild can no longer tell which members a consumer
// touched and retains every part.
//
// Rollup resolves both shapes precisely, which is what makes this regression
// so easy to ship unnoticed: the number only moves on esbuild-based bundlers
// (Vite dev, Remix, and anything else on esbuild).
//
// The rejected shapes are reconstructed here in /tmp rather than imported from
// the package, so this keeps measuring the tradeoff after the package stopped
// offering them.

import { gzipSync } from 'node:zlib';
import { writeFileSync, mkdirSync, rmSync, existsSync, statSync, readFileSync } from 'node:fs';
import { join, dirname, resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = resolvePath(import.meta.dirname, '..');
const FLAT = join(repoRoot, 'packages/ramka/dist/lightbox/lightbox.js');
const dep = (rel) => pathToFileURL(join(repoRoot, 'node_modules/.pnpm', rel)).href;

const esbuild = await import(dep('esbuild@0.28.1/node_modules/esbuild/lib/main.js'));
const { rollup } = await import(dep('rollup@4.60.4/node_modules/rollup/dist/es/rollup.js'));

const PARTS = ['Root', 'Trigger', 'Portal', 'Content', 'Item', 'Media'];

const base = '/tmp/export-shape-probe';
rmSync(base, { recursive: true, force: true });
mkdirSync(base, { recursive: true });

// Rejected shape 1: package re-exports the namespace (`export * as`).
const REEXPORT_ENTRY = join(base, 'reexport-entry.js');
writeFileSync(REEXPORT_ENTRY, `export * as Lightbox from '${FLAT}';\n`);

// Rejected shape 2: package builds the namespace itself, then exports it.
// Semantically identical to shape 1; bundlers track the two differently, so it
// is worth measuring rather than assuming.
const IMPORT_STAR_ENTRY = join(base, 'import-star-entry.js');
writeFileSync(IMPORT_STAR_ENTRY, `import * as Lightbox from '${FLAT}';\nexport { Lightbox };\n`);

const VARIANTS = {
  // What ramka publishes.
  "shipped: import * as Lightbox from 'ramka/lightbox'": `
    import * as Lightbox from '${FLAT}';
    export default [${PARTS.map((p) => `Lightbox.${p}`).join(', ')}];
  `,
  // Same module, named imports — for anyone who prefers them.
  'shipped: flat named imports': `
    import { ${PARTS.join(', ')} } from '${FLAT}';
    export default [${PARTS.join(', ')}];
  `,
  'rejected: package re-exports namespace': `
    import { Lightbox } from '${REEXPORT_ENTRY}';
    export default [${PARTS.map((p) => `Lightbox.${p}`).join(', ')}];
  `,
  'rejected: package exports namespace object': `
    import { Lightbox } from '${IMPORT_STAR_ENTRY}';
    export default [${PARTS.map((p) => `Lightbox.${p}`).join(', ')}];
  `,
};

const isExternal = (id) =>
  ['react', 'react-dom', 'react/jsx-runtime'].includes(id) || id.startsWith('@base-ui/');

const resolver = {
  name: 'relative-resolver',
  resolveId(source, importer) {
    if (!importer || !source.startsWith('.')) return null;
    const abs = resolvePath(dirname(importer), source);
    for (const c of [abs, `${abs}.js`, `${abs}.mjs`, join(abs, 'index.js')]) {
      if (existsSync(c) && statSync(c).isFile()) return c;
    }
    return null;
  },
};

const gz = (src) => gzipSync(Buffer.from(src), { level: 9 }).length;

const reachable = (names, importsOf) => {
  const seen = new Set(names);
  for (let changed = true; changed; ) {
    changed = false;
    for (const n of [...seen]) {
      for (const imp of importsOf(n)) {
        if (!seen.has(imp)) {
          seen.add(imp);
          changed = true;
        }
      }
    }
  }
  return [...seen];
};

async function viaRollup(entry) {
  const bundle = await rollup({
    input: entry,
    external: isExternal,
    plugins: [resolver],
    treeshake: { moduleSideEffects: false },
    onwarn: () => {},
  });
  const { output } = await bundle.generate({ format: 'es' });
  await bundle.close();
  const chunks = new Map(output.filter((c) => c.type === 'chunk').map((c) => [c.fileName, c]));
  const entryName = [...chunks.values()].find((c) => c.isEntry).fileName;
  const eager = reachable([entryName], (n) => (chunks.get(n).imports ?? []).filter((i) => chunks.has(i)));
  // Minify per chunk: concatenating first would collide top-level symbols.
  const parts = [];
  for (const name of eager) {
    const { code } = await esbuild.transform(chunks.get(name).code, {
      minify: true,
      format: 'esm',
      target: 'es2020',
    });
    parts.push(code);
  }
  return gz(parts.join('\n'));
}

async function viaEsbuild(entry, outdir) {
  const { metafile } = await esbuild.build({
    entryPoints: [entry],
    outdir,
    bundle: true,
    splitting: true,
    format: 'esm',
    target: 'es2020',
    minify: true,
    metafile: true,
    logLevel: 'silent',
    external: ['react', 'react-dom', 'react/*', 'react-dom/*', '@base-ui/*'],
  });
  const outputs = metafile.outputs;
  const entryOut = Object.keys(outputs).find((k) => outputs[k].entryPoint);
  const eager = reachable([entryOut], (n) =>
    (outputs[n]?.imports ?? [])
      .filter((i) => i.kind === 'import-statement' && outputs[i.path])
      .map((i) => i.path),
  );
  return gz(eager.map((n) => readFileSync(join(repoRoot, n), 'utf8')).join('\n'));
}

const kb = (n) => (n / 1024).toFixed(1);

console.log(`Eager payload for a ${PARTS.length}-part gallery (${PARTS.join('/')}), KB gzipped.\n`);
console.log('consumer writes'.padEnd(52) + 'Rollup'.padStart(9) + 'esbuild'.padStart(9));
console.log('-'.repeat(70));

const results = {};
for (const [label, code] of Object.entries(VARIANTS)) {
  const dir = join(base, label.replace(/\W+/g, '_'));
  mkdirSync(dir, { recursive: true });
  const entry = join(dir, 'entry.js');
  writeFileSync(entry, code);
  const r = await viaRollup(entry);
  const e = await viaEsbuild(entry, join(dir, 'out'));
  results[label] = { rollup: r, esbuild: e };
  console.log(label.padEnd(52) + kb(r).padStart(9) + kb(e).padStart(9));
}

// The property that matters: the shipped shape must not make esbuild pay more
// than Rollup. Allow a little slack for the two bundlers' differing output.
const shipped = results["shipped: import * as Lightbox from 'ramka/lightbox'"];
const overhead = shipped.esbuild / shipped.rollup;
console.log();
if (overhead > 1.15) {
  console.log(
    `FAIL esbuild pays ${((overhead - 1) * 100).toFixed(0)}% more than Rollup for the shipped shape.\n` +
      '     Something re-introduced a package-owned namespace between the parts and the consumer.',
  );
  process.exitCode = 1;
} else {
  console.log(`PASS shipped shape costs the same on both bundlers (esbuild/Rollup = ${overhead.toFixed(2)}).`);
}
