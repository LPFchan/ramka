// Diffs two built copies of the library and writes the PR comment body.
//
// Usage:
//   node scripts/size-report.mjs --head <dist/lightbox/lightbox.js>
//                                [--base <dist/lightbox/lightbox.js>]
//                                [--markdown out.md] [--json out.json]
//
// CI builds both sides and runs *this* copy of the script against both, so a
// change to the measurement never shows up as a change in size. `--base` is
// optional: a branch whose base predates the script still gets a report, just
// without deltas.
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve as resolvePath } from 'node:path';
import { SCENARIOS, LAZY_SCENARIO, measureScenario, repoRoot } from './lib/consumer-size.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};

// Scenarios are bundled from a scratch directory, so a relative entry would
// resolve against that instead of the caller's cwd — and silently measure an
// empty module rather than failing.
const abs = (p) => (p ? resolvePath(process.cwd(), p) : undefined);
const head = abs(flag('head'));
const base = abs(flag('base'));
if (!head) {
  console.error('size-report.mjs: --head is required');
  process.exit(1);
}
if (!existsSync(head)) {
  console.error(`size-report.mjs: no such file: ${head}\n  Did the build run?`);
  process.exit(1);
}
const haveBase = Boolean(base && existsSync(base));

const tmpBase = '/tmp/size-report';
rmSync(tmpBase, { recursive: true, force: true });

async function measureAll(entry, side) {
  const scenarios = {};
  for (const [label, code] of Object.entries(SCENARIOS)) {
    scenarios[label] = await measureScenario({ entry, code, tag: `${side}-${label}`, tmpBase });
  }
  return scenarios;
}

// A build that resolved to nothing still bundles cleanly, it just yields an
// empty module — which would read as a spectacular size win. Nothing about the
// library can plausibly ship the whole surface in under 5 KB, so treat that as
// a broken measurement rather than a result.
const FLOOR = 5 * 1024;
function assertResolved(results, side, entry) {
  const gz = results[LAZY_SCENARIO].gz;
  if (gz < FLOOR) {
    console.error(
      `size-report.mjs: ${side} measured ${gz} B for every part, which cannot be right.\n` +
        `  Entry: ${entry}\n` +
        '  The entry probably resolved to an empty module — check that it points at\n' +
        '  dist/lightbox/lightbox.js in a completed build.',
    );
    process.exit(1);
  }
}

const headResults = await measureAll(head, 'head');
assertResolved(headResults, 'head', head);
const baseResults = haveBase ? await measureAll(base, 'base') : null;
if (baseResults) assertResolved(baseResults, 'base', base);

// The export shape only misbehaves on esbuild and only for consumers, so the
// byte totals above cannot reveal it. Fold the existing guard in as a row.
function exportShape() {
  try {
    const out = execFileSync('node', [join(repoRoot, 'scripts/probe-export-shape.mjs')], {
      encoding: 'utf8',
    });
    return /^FAIL/m.test(out) ? 'fail' : 'pass';
  } catch {
    return 'fail';
  }
}

const KB = 1024;
const fmt = (n) => `${(n / KB).toFixed(1)} KB`;

function delta(baseBytes, headBytes) {
  if (baseBytes == null) return 'new';
  const d = headBytes - baseBytes;
  if (d === 0) return '–';
  const sign = d > 0 ? '+' : '−';
  const mag = Math.abs(d);
  const size = mag < 100 ? `${mag} B` : fmt(mag);
  const pct = baseBytes === 0 ? '' : ` (${sign}${((mag / baseBytes) * 100).toFixed(1)}%)`;
  return `${sign}${size}${pct}`;
}

const rows = Object.keys(SCENARIOS).map((label) => ({
  label,
  base: baseResults?.[label]?.gz ?? null,
  head: headResults[label].gz,
}));

// Match lazy chunks by label; a renamed or newly split chunk shows as "new".
const lazyRows = headResults[LAZY_SCENARIO].lazyChunks.map((c) => ({
  label: c.label,
  base: baseResults?.[LAZY_SCENARIO]?.lazyChunks.find((b) => b.label === c.label)?.gz ?? null,
  head: c.gz,
}));

const shape = exportShape();

const table = (title, list) =>
  [
    `| ${title} | Base | Head | Δ |`,
    '| --- | --: | --: | --: |',
    ...list.map(
      (r) => `| ${r.label} | ${r.base == null ? '—' : fmt(r.base)} | ${fmt(r.head)} | ${delta(r.base, r.head)} |`,
    ),
  ].join('\n');

const changed = rows.filter((r) => r.base != null && r.base !== r.head);
const headline = !haveBase
  ? 'No baseline for this branch, so this is an absolute reading rather than a diff.'
  : changed.length === 0
    ? 'No change to what a consumer ships.'
    : `${changed.length} of ${rows.length} scenarios changed.`;

const markdown = `<!-- ramka-size -->
### Bundle size

${headline}

What a consumer actually ships, gzipped, after tree-shaking — measured with Rollup, \`react\` and \`@base-ui/*\` external. Lazily \`import()\`ed engine chunks are excluded from these totals and listed separately.

${table('Scenario', rows)}

<details>
<summary>Lazy engine chunks — fetched on intent, not on load</summary>

${table('Chunk', lazyRows)}

</details>

Export shape: **${shape === 'pass' ? 'pass' : 'FAIL'}** — ${
  shape === 'pass'
    ? 'the flat module still tree-shakes identically on esbuild and Rollup.'
    : 'a package-owned namespace crept back in between the parts and the consumer, which silently costs esbuild users every unused part. See `scripts/probe-export-shape.mjs`.'
}
`;

const json = {
  base: haveBase ? base : null,
  head,
  exportShape: shape,
  scenarios: Object.fromEntries(
    Object.keys(SCENARIOS).map((label) => [label, { base: baseResults?.[label] ?? null, head: headResults[label] }]),
  ),
  lazyChunks: lazyRows,
};

const markdownOut = flag('markdown');
const jsonOut = flag('json');
if (markdownOut) writeFileSync(markdownOut, markdown);
if (jsonOut) writeFileSync(jsonOut, `${JSON.stringify(json, null, 2)}\n`);
if (!markdownOut && !jsonOut) console.log(markdown);

// Comment-only for now: the report is informational, and a structural
// regression in the export shape is already a hard failure in its own probe.
if (shape === 'fail') process.exitCode = 1;
