// The published package needs its own LICENSE: `npm publish` packs from
// packages/ramka, so the root file never reaches the tarball, and a GPL artifact
// that conveys no license text does not satisfy GPL section 4.
//
// It is a committed copy rather than one generated at build time, because the
// two failure modes are not equally survivable. A copy can drift, which this
// script turns into a failed check on the pull request that caused it. A
// generated file can be *absent* — reorder the build, run tsup directly, pack a
// fresh clone — and nothing says so, least of all a diff, since the file would
// be gitignored. Drift is loud; absence is silent.

import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(repoRoot, 'LICENSE');
const copies = [join(repoRoot, 'packages', 'ramka', 'LICENSE')];

const expected = readFileSync(source);
let failed = false;

for (const copy of copies) {
  const where = relative(repoRoot, copy);
  let actual;
  try {
    actual = readFileSync(copy);
  } catch {
    console.error(`check-license-copies: ${where} is missing — copy LICENSE there.`);
    failed = true;
    continue;
  }
  if (!actual.equals(expected)) {
    console.error(`check-license-copies: ${where} differs from LICENSE — copy it again.`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log(`check-license-copies: ok — ${copies.length} copy in sync with LICENSE`);
