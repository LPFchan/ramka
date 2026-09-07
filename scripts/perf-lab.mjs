/**
 * Perf-lab runner: measures lightbox open/close cost on an element-heavy page
 * across Chromium and WebKit, including per-suspect ablations.
 *
 * Prereqs:
 *   NEXT_PUBLIC_PERF_LAB=1 pnpm test:e2e:build   (production build incl. /debug/perf-lab)
 *   pnpm --filter docs start --port 3106          (or pass PERF_LAB_URL)
 *
 * Usage:
 *   node scripts/perf-lab.mjs [--browsers=webkit,chromium] [--cycles=5]
 *
 * Results print as a markdown table; raw JSON lands in perf-lab-results.json.
 */

import { chromium, webkit, firefox } from '@playwright/test';
import fs from 'node:fs';

const BASE = process.env.PERF_LAB_URL ?? 'http://127.0.0.1:3106';
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const CYCLES = Number(args.cycles ?? 5);
const BROWSERS = String(args.browsers ?? 'chromium,webkit').split(',');

/** Scenario matrix. Every URL renders 1500 tiles unless stated otherwise. */
const SCENARIOS = [
  { id: 'baseline-1500', query: 'n=1500' },
  { id: 'small-page-100', query: 'n=100' },
  { id: 'gallery-30', query: 'n=1500&gallery=30' },
  { id: 'ablate-adopt', query: 'n=1500&ablate=adopt' },
  { id: 'ablate-rootvars', query: 'n=1500&ablate=rootvars' },
  { id: 'ablate-userselect', query: 'n=1500&ablate=userselect' },
  { id: 'ablate-all-styles', query: 'n=1500&ablate=adopt,rootvars,userselect' },
  { id: 'ablate-vt-snapshot', query: 'n=1500&ablate=vt' },
  { id: 'morph-off', query: 'n=1500&morph=off' },
  // Mintlify / PR #80 shape: a tiny gallery on a page with ~16k inert link
  // elements — page-DOM-driven costs isolated from gallery-size costs.
  { id: 'links16k-baseline', query: 'n=4&links=15000', tile: 2 },
  { id: 'links16k-adopt', query: 'n=4&links=15000&ablate=adopt', tile: 2 },
  { id: 'links16k-rootvars', query: 'n=4&links=15000&ablate=rootvars', tile: 2 },
  { id: 'links16k-userselect', query: 'n=4&links=15000&ablate=userselect', tile: 2 },
  { id: 'links16k-isolation', query: 'n=4&links=15000&ablate=isolation', tile: 2 },
  {
    id: 'links16k-all-styles',
    query: 'n=4&links=15000&ablate=adopt,rootvars,userselect,isolation',
    tile: 2,
  },
  { id: 'links16k-vt', query: 'n=4&links=15000&ablate=vt', tile: 2 },
  { id: 'links16k-scrolllock', query: 'n=4&links=15000&ablate=scrolllock', tile: 2 },
  {
    id: 'links16k-everything',
    query: 'n=4&links=15000&ablate=adopt,rootvars,userselect,isolation,scrolllock',
    tile: 2,
  },
];

const median = (xs) => {
  const s = [...xs].filter((x) => x !== null && Number.isFinite(x)).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};

const launchers = { chromium, webkit, firefox };

async function runScenario(browserName, scenario) {
  const browser = await launchers[browserName].launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  // Same normalisation as e2e/support/test.ts: keep isLowEndDevice() false.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => 8 });
  });

  const tile = scenario.tile ?? 12;
  await page.goto(`${BASE}/debug/perf-lab?${scenario.query}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-perf-ready]');
  await page.waitForSelector(`[data-perf-tile="${tile}"]`);
  await page.waitForTimeout(600); // let hydration + lazy decode settle

  const cyclesDone = () => page.evaluate(() => window.__perfLab?.cycles.length ?? 0);

  // warmup + measured cycles. The first open pays the lazy morph-runtime
  // import; it is excluded from stats but recorded.
  const total = CYCLES + 1;
  for (let i = 0; i < total; i++) {
    const before = await cyclesDone();
    await page.click(`[data-perf-tile="${tile}"]`);
    await page.waitForFunction(
      (n) => (window.__perfLab?.cycles.length ?? 0) >= n,
      before + 1,
      { timeout: 8000 },
    );
    await page.waitForTimeout(250);
    const afterOpen = await cyclesDone();
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      (n) => (window.__perfLab?.cycles.length ?? 0) >= n,
      afterOpen + 1,
      { timeout: 8000 },
    );
    await page.waitForTimeout(350);
  }

  const cycles = await page.evaluate(() => window.__perfLab?.cycles ?? []);
  await browser.close();

  // Drop the warmup pair (first open + first close).
  const opens = cycles.filter((c) => c.kind === 'open').slice(1);
  const closes = cycles.filter((c) => c.kind === 'close').slice(1);
  const agg = (list) => ({
    prepMs: median(list.map((c) => c.prepMs)),
    oldCaptureMs: median(list.map((c) => c.oldCaptureMs)),
    updateMs: median(list.map((c) => c.updateMs)),
    newCaptureMs: median(list.map((c) => c.newCaptureMs)),
    inputToReadyMs: median(list.map((c) => c.inputToReadyMs)),
    maxRafGapMs: median(list.map((c) => c.maxRafGapMs)),
    slowReadMs: median(list.map((c) => c.slowReadMs)),
    n: list.length,
  });
  return { open: agg(opens), close: agg(closes), raw: cycles };
}

const activeScenarios = args.filter
  ? SCENARIOS.filter((s) => s.id.includes(String(args.filter)))
  : SCENARIOS;

const results = [];
for (const browserName of BROWSERS) {
  for (const scenario of activeScenarios) {
    process.stdout.write(`${browserName} ${scenario.id} … `);
    try {
      const r = await runScenario(browserName, scenario);
      results.push({ browser: browserName, scenario: scenario.id, ...r });
      console.log(
        `open input→ready ${r.open.inputToReadyMs?.toFixed(0)}ms (gap ${r.open.maxRafGapMs}ms), ` +
          `close gap ${r.close.maxRafGapMs}ms`,
      );
    } catch (err) {
      console.log(`FAILED: ${err.message.split('\n')[0]}`);
      results.push({ browser: browserName, scenario: scenario.id, error: String(err) });
    }
  }
}

fs.writeFileSync(
  new URL('../perf-lab-results.json', import.meta.url),
  JSON.stringify(results, null, 2),
);

const fmt = (v) => (v === null || v === undefined ? '—' : `${Math.round(v)}`);
console.log('\n## Open (medians, ms)\n');
console.log(
  '| browser | scenario | input→vtCall | old snap | update | new snap | input→READY | max rAF gap | slow reads |',
);
console.log('|---|---|---|---|---|---|---|---|---|');
for (const r of results) {
  if (r.error) continue;
  const o = r.open;
  console.log(
    `| ${r.browser} | ${r.scenario} | ${fmt(o.prepMs)} | ${fmt(o.oldCaptureMs)} | ${fmt(o.updateMs)} | ${fmt(o.newCaptureMs)} | **${fmt(o.inputToReadyMs)}** | ${fmt(o.maxRafGapMs)} | ${fmt(o.slowReadMs)} |`,
  );
}
console.log('\n## Close (medians, ms)\n');
console.log(
  '| browser | scenario | input→vtCall | old snap | update | new snap | input→READY | max rAF gap | slow reads |',
);
console.log('|---|---|---|---|---|---|---|---|---|');
for (const r of results) {
  if (r.error) continue;
  const c = r.close;
  console.log(
    `| ${r.browser} | ${r.scenario} | ${fmt(c.prepMs)} | ${fmt(c.oldCaptureMs)} | ${fmt(c.updateMs)} | ${fmt(c.newCaptureMs)} | **${fmt(c.inputToReadyMs)}** | ${fmt(c.maxRafGapMs)} | ${fmt(c.slowReadMs)} |`,
  );
}
console.log('\nRaw data: perf-lab-results.json');
