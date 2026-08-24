// Throwaway verification: mutate vt-composited-morph.ts one guard at a time and
// confirm the new test file actually catches each break. Green tests that pass
// against a broken implementation are worse than no tests.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const src = path.join(root, 'packages/ramka/src/lightbox/vt-composited-morph.ts');
const original = fs.readFileSync(src, 'utf8');

const MUTATIONS = [
  {
    // The ladder's whole premise: validate everything BEFORE touching state, so
    // a bail leaves a working stock morph. Cancelling up front breaks every bail.
    name: 'cancel the UA animation before validating',
    find: '  if (!uaAnim || !uaAnim.effect) return;',
    replace: '  if (!uaAnim || !uaAnim.effect) return;\n  uaAnim.cancel();',
  },
  {
    name: 'accept rotated/skewed matrices',
    find: 'if (Math.abs(b) > AXIS_EPS || Math.abs(c) > AXIS_EPS || a <= 0 || d <= 0) return null;',
    replace: 'if (a <= 0 || d <= 0) return null;',
  },
  {
    name: 'treat `none`/empty transform as identity (the Safari 18 corner bug)',
    find: '  const v = value.trim();\n',
    replace: "  const v = value.trim();\n  if (v === '' || v === 'none') return { sx: 1, sy: 1, tx: 0, ty: 0 };\n",
  },
  {
    name: 'leave the UA group animation running instead of cancelling it',
    find: '  uaAnim.cancel();',
    replace: '  // uaAnim.cancel();',
  },
  {
    name: 'skip the rollback when pseudo-element WAAPI throws',
    find: '      for (const a of created) a.cancel();\n      docEl.removeAttribute(COMPOSITED_ATTR);\n      uaAnim.currentTime = 0;\n      uaAnim.play();\n      return;',
    replace: '      return;',
  },
  {
    name: 'skip the rollback when the end-geometry fallback fails',
    find: '      uaAnim.currentTime = 0;\n      uaAnim.play();\n      return;\n    }\n  }',
    replace: '      return;\n    }\n  }',
  },
  {
    name: 'animate the snapshots on crossfade morphs too',
    find: '  const isCrossfade = docEl.hasAttribute(LightboxDocumentDataAttributes.crossfade);',
    replace: '  const isCrossfade = false;',
  },
  {
    name: 'drop the seamless handover seek',
    find: '    if (uaElapsed > 0) {\n      for (const a of created) {\n        a.currentTime = uaElapsed;\n      }\n    }',
    replace: '    if (false) {\n      for (const a of created) {\n        a.currentTime = uaElapsed;\n      }\n    }',
  },
  {
    name: 'forget to tear down on finish',
    find: '  transition.finished.finally(() => {\n    for (const a of created) a.cancel();\n    docEl.removeAttribute(COMPOSITED_ATTR);\n    docEl.removeAttribute(COMPOSITED_CSS_ATTR);\n    styleEl?.remove();\n  });',
    replace: '  void transition.finished;',
  },
  {
    name: 'use WAAPI on WebKit',
    find: '  const useCssAnimations = isWebKit();',
    replace: '  const useCssAnimations = false;',
  },
  {
    name: 'ignore the ?vtstock opt-out',
    find: '  if (!isCompositedMorphEnabled()) return;',
    replace: '  if (false) return;',
  },
  {
    name: 'accept a zero-length UA animation',
    find: '  if (!Number.isFinite(uaDuration) || uaDuration <= 0) return;',
    replace: '  if (false) return;',
  },
  {
    name: 'reuse one @keyframes name for every transition',
    find: '    const id = ++cssAnimationSeq;',
    replace: '    const id = 1;',
  },
];

function runTests() {
  try {
    execFileSync(
      'npx',
      [
        'vitest',
        'run',
        'src/lightbox/vt-composited-morph.test.ts',
        '--reporter=json',
        '--outputFile=/tmp/morph-mutation.json',
      ],
      { cwd: path.join(root, 'packages/ramka'), stdio: 'ignore' },
    );
  } catch {
    // Non-zero exit is the expected outcome for a mutation.
  }
  const report = JSON.parse(fs.readFileSync('/tmp/morph-mutation.json', 'utf8'));
  const failed = report.testResults
    .flatMap((f) => f.assertionResults ?? [])
    .filter((t) => t.status === 'failed')
    .map((t) => t.fullName ?? t.title);
  return failed;
}

let allCaught = true;
try {
  for (const mutation of MUTATIONS) {
    if (!original.includes(mutation.find)) {
      console.log(`SETUP FAIL  ${mutation.name} — pattern not found`);
      allCaught = false;
      continue;
    }
    fs.writeFileSync(src, original.replace(mutation.find, mutation.replace));
    const failed = runTests();
    if (failed.length === 0) {
      console.log(`SURVIVED    ${mutation.name}`);
      allCaught = false;
    } else {
      console.log(`caught (${String(failed.length).padStart(2)})  ${mutation.name}`);
      for (const name of failed) console.log(`              ↳ ${name}`);
    }
  }
} finally {
  fs.writeFileSync(src, original);
}

console.log(allCaught ? '\nAll mutations caught.' : '\nSome mutations survived.');
process.exit(allCaught ? 0 : 1);
