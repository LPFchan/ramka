// Break the zoom handover in the ways it could plausibly regress and confirm
// zoom-engine-swap.test.tsx catches each. The point is to show those tests
// guard a property — the subtree survives handover, and the engine is live
// afterwards — rather than the shape of the implementation that happened to
// satisfy it when they were written.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pkg = path.join(root, 'packages/ramka');
const file = (p) => path.join(pkg, 'src/lightbox', p);

const MUTATIONS = [
  {
    // The regression itself: anything that gives the subtree a new identity when
    // the engine arrives, whether that's a component type swap (the original
    // bug) or a key change (this).
    name: 'remount the subtree on handover',
    path: file('lightbox-zoom.tsx'),
    find: '      <div\n        ref={wrapperRef}',
    replace: "      <div\n        key={Engine ? 'engine' : 'placeholder'}\n        ref={wrapperRef}",
  },
  {
    name: 'never forward pose commits to the shell',
    path: file('lightbox-zoom-runtime.tsx'),
    find: 'React.useEffect(() => controller.subscribeCommit(publish), [controller, publish]);',
    replace: 'React.useEffect(() => {}, [controller, publish]);',
  },
  {
    name: 'never hand the controls up',
    path: file('lightbox-zoom-runtime.tsx'),
    find: '    store.publish({ pose: next, controls: controlsRef.current });',
    replace: '    void next;',
  },
  {
    name: 'leave the transform wrapper unattached',
    path: file('lightbox-zoom-runtime.tsx'),
    find: '    controller.attach(wrapperRef.current);',
    replace: '    controller.attach(null);',
  },
];

function run() {
  try {
    execFileSync(
      'npx',
      [
        'vitest',
        'run',
        'src/lightbox/zoom-engine-swap.test.tsx',
        '--reporter=json',
        '--outputFile=/tmp/zoom-swap-mutation.json',
      ],
      { cwd: pkg, stdio: 'ignore' },
    );
  } catch {
    // Failure is the expected outcome.
  }
  const report = JSON.parse(fs.readFileSync('/tmp/zoom-swap-mutation.json', 'utf8'));
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
