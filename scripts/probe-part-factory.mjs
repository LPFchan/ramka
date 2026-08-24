// Upper bound on what improvement #8 (a shared factory for the trivial parts)
// could save.
//
// Bundles the eight boilerplate-heavy parts the way a consumer does (Rollup,
// imports hoisted, minified, gzipped), then measures the same bundle with the
// per-part skeleton textually removed. The second number is a *floor* a factory
// can only approach, never beat: it deletes the forwardRef wrapper, the fixed
// half of the useRender call, the defaultTagName tail and the displayName
// assignment while charging nothing for the config object that would replace
// them, nor for the factory module itself.

import * as esbuild from 'esbuild';
import { rollup } from 'rollup';
import { gzipSync } from 'node:zlib';
import { existsSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const distDir = path.join(repoRoot, 'packages/ramka/dist');

const PARTS = [
  ['Close', 'close'],
  ['Slide', 'slide'],
  ['Counter', 'counter'],
  ['ZoomIn', 'zoom-in'],
  ['ZoomOut', 'zoom-out'],
  ['Next', 'next'],
  ['Previous', 'previous'],
  ['Caption', 'caption'],
];

// tsup with `bundle: false` leaves relative specifiers extensionless in a few
// spots; resolve them the way a bundler would.
const bundlerResolve = {
  name: 'bundler-resolve',
  resolveId(source, importer) {
    if (!source.startsWith('.') || !importer) return null;
    const base = path.resolve(path.dirname(importer), source);
    for (const candidate of [
      base,
      `${base}.js`,
      `${base}.mjs`,
      path.join(base, 'index.js'),
    ]) {
      if (existsSync(candidate) && !candidate.endsWith(path.sep)) return candidate;
    }
    return null;
  },
};

const entry = `
${PARTS.map(([name, file]) => `import { Lightbox${name} } from '${distDir}/lightbox/lightbox-${file}.js';`).join('\n')}
export default [${PARTS.map(([name]) => `Lightbox${name}`).join(', ')}];
`;

const virtualEntry = {
  name: 'virtual-entry',
  resolveId: (id) => (id === '\0entry' ? id : null),
  load: (id) => (id === '\0entry' ? entry : null),
};

const build = await rollup({
  input: '\0entry',
  external: (id) => id === 'react' || id === 'react-dom' || id.startsWith('@base-ui/react'),
  plugins: [virtualEntry, bundlerResolve],
  onwarn: () => {},
});
const { output } = await build.generate({ format: 'esm' });
const bundled = output.map((chunk) => chunk.code ?? '').join('\n');

const { code: minified } = await esbuild.transform(bundled, {
  minify: true,
  format: 'esm',
  target: 'es2020',
});

const measure = (source) => ({
  min: Buffer.byteLength(source),
  gz: gzipSync(Buffer.from(source), { level: 9 }).length,
});

// The skeleton a factory would hoist, matched against minified text — deleting
// it leaves unparseable JS, and gzip is all we need from here.
const SKELETON = [
  // `React.forwardRef(function LightboxClose(props, forwardedRef) {`
  /\w+\.forwardRef\(function\s*\w*\(\w+,\w+\)\{/g,
  // `const { render, ...elementProps } = props,`
  /const\{render:\w+(?:,\w+:\w+)*,\.\.\.\w+\}=\w+[,;]/g,
  // `return useRender({ render, ref: forwardedRef,`
  /return \w+\(\{render:\w+,ref:\w+,/g,
  // `defaultTagName: 'button' })`
  /defaultTagName:"\w+"\}\)/g,
  // `LightboxClose.displayName = 'LightboxClose';`
  /\w+\.displayName="\w+";/g,
];

let stripped = minified;
let removals = 0;
for (const pattern of SKELETON) {
  stripped = stripped.replace(pattern, () => {
    removals += 1;
    return '';
  });
}

const before = measure(minified);
const after = measure(stripped);

console.log(`Eight trivial parts, bundled as a consumer sees them (Rollup, hoisted imports):`);
console.log(`  as shipped today      ${String(before.min).padStart(5)} min   ${String(before.gz).padStart(5)} gz`);
console.log(`  skeleton deleted      ${String(after.min).padStart(5)} min   ${String(after.gz).padStart(5)} gz   (${removals} sites removed)`);
console.log(
  `  floor for a factory   ${String(before.min - after.min).padStart(5)} min   ${String(before.gz - after.gz).padStart(5)} gz   <- best case, factory's own cost not yet charged`,
);
