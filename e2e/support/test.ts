import { test as base } from '@playwright/test';

/**
 * The suite's `test`, with one piece of environment normalisation: the page
 * reports hardware above the library's low-end thresholds.
 *
 * This is not a workaround for a library bug — it is the opposite. The morph is
 * gated behind `isLowEndDevice()`, which reads `navigator.hardwareConcurrency`
 * and `deviceMemory`, and GitHub's Linux runners report fewer than four cores.
 * The library therefore correctly classifies CI as a low-end device and skips
 * the morph entirely, so without this every morph assertion on CI compared
 * against an empty phase log — passing locally on an 18-core laptop and failing
 * on the runner, for a reason that has nothing to do with the change under test.
 *
 * Declaring capable hardware puts the full-featured path under test on any
 * runner size. The low-end path is not lost: `low-end-device.spec.ts` covers
 * both sides of the threshold and imports Playwright's `test` directly so it
 * can set its own values.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      // `configurable` so a spec can still override these afterwards.
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        configurable: true,
        get: () => 8,
      });
      Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => 8 });
    });
    await use(page);
  },
});

export { expect } from '@playwright/test';
