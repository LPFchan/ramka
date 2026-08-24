// Throwaway: revert each lazy-chunk-failure fix and confirm the new tests catch it.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pkg = path.join(root, 'packages/ramka');
const file = (p) => path.join(pkg, 'src/lightbox', p);

const MUTATIONS = [
  {
    name: 'drop the morph-failure fallback (pre-fix behaviour)',
    path: file('lightbox-root.tsx'),
    find: /void loadMorphRuntime\(\)\.then\(startMorph, \(error: unknown\) => \{[\s\S]*?\n            \}\);/,
    replace: 'void loadMorphRuntime().then(startMorph);',
  },
  {
    name: 'memoize the rejection again (pre-fix behaviour)',
    path: file('lightbox-morph-loader.ts'),
    find: '      pending = null;\n      throw error;',
    replace: '      throw error;',
  },
];

function run() {
  try {
    execFileSync(
      'npx',
      [
        'vitest',
        'run',
        'src/lightbox/lazy-runtime-failure.test.tsx',
        '--reporter=json',
        '--outputFile=/tmp/lazy-mutation.json',
      ],
      { cwd: pkg, stdio: 'ignore' },
    );
  } catch {
    // Failure is the expected outcome.
  }
  const report = JSON.parse(fs.readFileSync('/tmp/lazy-mutation.json', 'utf8'));
  return report.testResults
    .flatMap((f) => f.assertionResults ?? [])
    .filter((t) => t.status === 'failed')
    .map((t) => t.fullName ?? t.title);
}

const originals = new Map();
let ok = true;
try {
  for (const m of MUTATIONS) {
    const original = fs.readFileSync(m.path, 'utf8');
    originals.set(m.path, original);
    const mutated = original.replace(m.find, m.replace);
    if (mutated === original) {
      console.log(`SETUP FAIL  ${m.name} — pattern not found`);
      ok = false;
      continue;
    }
    fs.writeFileSync(m.path, mutated);
    const failed = run();
    fs.writeFileSync(m.path, original);
    if (failed.length === 0) {
      console.log(`SURVIVED    ${m.name}`);
      ok = false;
    } else {
      console.log(`caught (${failed.length})   ${m.name}`);
      for (const n of failed) console.log(`              ↳ ${n}`);
    }
  }
} finally {
  for (const [p, original] of originals) fs.writeFileSync(p, original);
}

console.log(ok ? '\nAll mutations caught.' : '\nSome mutations survived.');
process.exit(ok ? 0 : 1);
