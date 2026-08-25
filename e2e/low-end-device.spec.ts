import { expect, test } from '@playwright/test';
import { PHOTOS_APP, morphPhases, recordMorphPhases } from './support/lightbox';

/**
 * The low-end fallback, which skips the morph on constrained hardware.
 *
 * Worth a test of its own because no browser project reaches it: the gate reads
 * `navigator.deviceMemory` and `hardwareConcurrency`, and every runner — the
 * emulated Pixel 7 included, which reports the host's 18 cores — looks like a
 * fast desktop. The branch that real budget Android phones take was therefore
 * the only morph path with no coverage at all.
 *
 * Overriding the two hints is the whole point rather than a shortcut: they are
 * the only inputs, so a page that reports low values *is* a low-end device as
 * far as the library is concerned.
 */
test.describe('low-end device', () => {
  test('skips the morph below the hardware thresholds', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 1 });
    });
    await page.goto(PHOTOS_APP);
    await recordMorphPhases(page);

    await page.locator('[data-ramka-trigger]').first().click();
    await expect(page.locator('[data-ramka-content]')).toHaveAttribute('data-open', '');

    // No View Transition is started, so nothing is ever published on <html>.
    expect(await morphPhases(page)).toEqual([]);

    // The point of the fallback is that it still works, not just that it is
    // quiet: closing has to tear down cleanly without a transition either.
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-ramka-content]')).toHaveCount(0);
    expect(await morphPhases(page)).toEqual([]);
    await expect(page.locator('html')).not.toHaveAttribute('style', /overflow:\s*hidden/);
  });

  test('still morphs just above the thresholds', async ({ page }) => {
    // Guards the other side of the boundary. Without this, a gate that returned
    // `true` unconditionally would look identical to a working one.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    });
    await page.goto(PHOTOS_APP);
    await recordMorphPhases(page);

    await page.locator('[data-ramka-trigger]').first().click();
    await page.locator('[data-ramka-content]').waitFor({ state: 'attached' });

    await expect(async () => {
      expect((await morphPhases(page)).map((p) => p.phase)).toEqual(['opening', null]);
    }).toPass({ timeout: 5_000 });
  });
});
