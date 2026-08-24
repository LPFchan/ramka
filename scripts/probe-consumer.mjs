// Measures what a real consumer pays for a given built copy of ramka.
//
// Usage: node scripts/probe-consumer.mjs <label>=<path/to/dist/lightbox/lightbox.js> ...
//
// Point it at the flat parts module — the one published as `@ramka/react/lightbox` —
// and mirror how consumers import it (`import * as Lightbox`). Measuring a
// namespace re-exported by the package instead would inflate the esbuild
// numbers for reasons that have nothing to do with the code under test; see
// probe-export-shape.mjs.
//
// For each consumer scenario it reports the *eager* payload (entry chunk plus
// everything statically reachable from it); the lazily `import()`ed engine
// chunks are excluded because they are only fetched on demand.
//
// Scenarios and the measurement itself live in lib/consumer-size.mjs, shared
// with size-report.mjs so the PR comment can never disagree with this table.
import { rmSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { SCENARIOS, measureScenario } from './lib/consumer-size.mjs';

// Absolute, because scenarios are bundled from a scratch directory: a relative
// entry resolves to nothing there and quietly measures an empty module.
const targets = process.argv.slice(2).map((a) => {
  const i = a.indexOf('=');
  return { label: a.slice(0, i), entry: resolvePath(process.cwd(), a.slice(i + 1)) };
});
if (!targets.length) {
  console.error('usage: probe-consumer.mjs <label>=<dist/lightbox/lightbox.js> ...');
  process.exit(1);
}

const tmpBase = '/tmp/consumer-probe';
rmSync(tmpBase, { recursive: true, force: true });

const kb = (n) => (n / 1024).toFixed(1);
const width = 19;

console.log('Rollup consumer — eager payload, min / gzip (lazy engine chunks excluded)\n');
console.log(`${'scenario'.padEnd(26)}${targets.map((t) => t.label.padEnd(width)).join('')}`);
for (const [label, code] of Object.entries(SCENARIOS)) {
  const cells = [];
  for (const t of targets) {
    const r = await measureScenario({ entry: t.entry, code, tag: `${t.label}-${label}`, tmpBase });
    cells.push(`${kb(r.min)}K / ${kb(r.gz)}K`.padEnd(width));
  }
  console.log(`${label.padEnd(26)}${cells.join('')}`);
}
