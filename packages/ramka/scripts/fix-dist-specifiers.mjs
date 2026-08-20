// The build preserves one output module per source module (tsup `bundle: false`)
// so consumers can tree-shake unused parts. esbuild copies relative import
// specifiers through verbatim, which leaves them extensionless — fine for
// bundlers, but invalid for native Node ESM, and in the CJS build a bare
// `require('./x')` would resolve to the sibling ESM `x.js` instead of `x.cjs`.
//
// `tsc` leaves specifiers alone in declaration files for the same reason.
//
// This rewrites every relative specifier to an explicit path. Resolution
// prefers a sibling file over a directory index, since dist contains both
// `lightbox/lightbox.*` and `lightbox/index.*`.
//
// Idempotent: specifiers that already carry an extension are left alone.
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const DIST = resolve(import.meta.dirname, '../dist');

/** `from '...'`, `import('...')`, `export ... from '...'`, `require('...')`. */
const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)(['"])(\.[^'"]*)\2/g;
const ALREADY_EXPLICIT = /\.(js|cjs|mjs|json|css)$/;

/**
 * How to resolve and how to spell a relative specifier, per importing file.
 * A `.cjs` module must reach for `.cjs` siblings; `.js` is ESM because the
 * package sets `"type": "module"`. Declarations resolve against `.d.ts` but
 * are written as `.js`, which is how TypeScript maps a specifier to the
 * declaration beside it.
 */
function dialect(file) {
  if (file.endsWith('.d.ts')) return { lookup: '.d.ts', write: '.js' };
  if (file.endsWith('.cjs')) return { lookup: '.cjs', write: '.cjs' };
  return { lookup: '.js', write: '.js' };
}

function collect(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) collect(path, out);
    else if (/(\.d\.ts|\.js|\.cjs)$/.test(entry.name)) out.push(path);
  }
  return out;
}

const isFile = (p) => existsSync(p) && statSync(p).isFile();

const files = collect(DIST);
const unresolved = [];
let rewritten = 0;
let filesTouched = 0;

for (const file of files) {
  const { lookup, write } = dialect(file);
  const source = readFileSync(file, 'utf8');

  const next = source.replace(SPECIFIER, (match, prefix, quote, specifier) => {
    if (ALREADY_EXPLICIT.test(specifier)) return match;
    const abs = resolve(dirname(file), specifier);
    let fixed;
    if (isFile(abs + lookup)) fixed = specifier + write;
    else if (isFile(join(abs, `index${lookup}`))) fixed = `${specifier}/index${write}`;
    else {
      unresolved.push({ file, specifier });
      return match;
    }
    rewritten += 1;
    return `${prefix}${quote}${fixed}${quote}`;
  });

  if (next !== source) {
    writeFileSync(file, next);
    filesTouched += 1;
  }
}

if (unresolved.length > 0) {
  console.error('fix-dist-specifiers: could not resolve these relative imports:');
  for (const { file, specifier } of unresolved) {
    console.error(`  ${file.replace(`${DIST}/`, '')} -> ${specifier}`);
  }
  process.exit(1);
}

console.log(`fix-dist-specifiers: rewrote ${rewritten} specifier(s) across ${filesTouched} of ${files.length} file(s)`);
