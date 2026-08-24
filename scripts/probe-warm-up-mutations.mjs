// Revert each warm-up-timing change and confirm engine-warm-up.test.tsx catches
// it. The main suite does not (it passes with the warm-up disabled entirely),
// which is why these tests exist at all.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pkg = path.join(root, 'packages/ramka');
const file = (p) => path.join(pkg, 'src/lightbox', p);

const MUTATIONS = [
  {
    name: 'warm eagerly on mount again (pre-change behaviour)',
    path: file('lightbox-root.tsx'),
    find: /React\.useEffect\(\n      \(\) =>\n        scheduleWarmUp\(\(\) => \{\n([\s\S]*?)\n        \}\),\n      \[viewTransition\],\n    \);/,
    replace: (m, body) =>
      `React.useEffect(() => {\n${body.replace(/^ {4}/gm, '')}\n    }, [viewTransition]);`,
  },
  {
    name: 'drop the hover warm-up',
    path: file('lightbox-trigger.tsx'),
    find: '          onPointerEnter: warmEngines,\n',
    replace: '',
  },
  {
    name: 'drop the focus warm-up',
    path: file('lightbox-trigger.tsx'),
    find: '          onFocus: warmEngines,\n',
    replace: '',
  },
  {
    name: 'drop the pointerdown warm-up',
    path: file('lightbox-trigger.tsx'),
    find: '          onPointerDown: warmEngines,\n',
    replace: '',
  },
  {
    name: 'remove the idle timeout bound',
    path: file('schedule-warm-up.ts'),
    find: 'idleWindow.requestIdleCallback(task, { timeout: WARM_UP_IDLE_TIMEOUT_MS })',
    replace: 'idleWindow.requestIdleCallback(task)',
  },
  {
    name: 'never cancel a pending warm-up',
    path: file('schedule-warm-up.ts'),
    find: 'return () => idleWindow.cancelIdleCallback?.(handle);',
    replace: 'return () => {};',
  },
];

function run() {
  try {
    execFileSync(
      'npx',
      [
        'vitest',
        'run',
        'src/lightbox/engine-warm-up.test.tsx',
        '--reporter=json',
        '--outputFile=/tmp/warm-up-mutation.json',
      ],
      { cwd: pkg, stdio: 'ignore' },
    );
  } catch {
    // Failure is the expected outcome.
  }
  const report = JSON.parse(fs.readFileSync('/tmp/warm-up-mutation.json', 'utf8'));
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
    if (!originals.has(m.path)) originals.set(m.path, original);
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
