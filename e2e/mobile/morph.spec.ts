import { expect, test } from '../support/test';
import {
  COMPOSITED_CSS,
  COMPOSITED_WAAPI,
  PHOTOS_APP,
  compositedPathsSeen,
  morphIdle,
  morphPhases,
  phaseDuration,
  recordCompositedPath,
  recordMorphPhases,
} from '../support/lightbox';

/**
 * The morph at a mobile viewport, with touch enabled.
 *
 * Not a duplicate of the desktop run. The library branches on the platform in
 * ways only this configuration reaches:
 *
 * - On the Pixel 7 project, `isAndroidBlinkSnapshotRoot()` becomes true, which
 *   is what makes close hold the overlay mounted until `finished` and makes open
 *   wait for the URL-bar settle. On desktop Chromium that gate is false, so
 *   none of that code runs.
 * - On the iPhone project, WebKit reports `GestureEvent` *and* touch, which is
 *   the combination the Safari paths key on.
 *
 * What this cannot reach is stated plainly, because it is the residual risk:
 * these are emulated viewports in automation builds, not devices. There is no
 * real URL bar to collapse, so the iOS Safari address-bar interaction that
 * `vt-touch-guard` exists to defeat is not reproducible here, and neither is
 * real Android Blink compositing. Those need a device.
 */
test.describe('mobile morph', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PHOTOS_APP);
    await recordMorphPhases(page);
  });

  test('morphs on tap and settles', async ({ page }) => {
    // `tap` rather than `click`: on a touch device the open is driven by a real
    // touch sequence, and the trigger's own touch handling is part of the path.
    await page.locator('[data-ramka-trigger]').first().tap();
    await page.locator('[data-ramka-content]').waitFor({ state: 'attached' });
    // On Android Blink the transition is deliberately deferred until the URL-bar
    // snapshot root settles, so the morph may not have started yet.
    await morphIdle(page);

    const phases = await morphPhases(page);
    expect(phases.map((p) => p.phase)).toEqual(['opening', null]);
    expect(phaseDuration(phases, 'opening')).toBeGreaterThan(80);

    const content = page.locator('[data-ramka-content]');
    await expect(content).toHaveAttribute('data-open', '');
    await expect(content).toHaveAttribute('aria-modal', 'true');
    await expect(page.locator('[style*="lightbox-morph"]')).toHaveCount(0);
  });

  test('takes the composited path its platform is meant to take', async ({ page, browserName }) => {
    // The clearest statement of the platform split this project pair exists for:
    // the iPhone arm must take WebKit's generated-CSS path and the Pixel arm the
    // WAAPI one, on the same page, from the same tap.
    await recordCompositedPath(page);
    await page.locator('[data-ramka-trigger]').first().tap();
    await page.locator('[data-ramka-content]').waitFor({ state: 'attached' });
    await morphIdle(page);

    const expected = browserName === 'webkit' ? COMPOSITED_CSS : COMPOSITED_WAAPI;
    const seen = await compositedPathsSeen(page);
    expect(seen).toContain(expected);
    expect(seen).not.toContain(browserName === 'webkit' ? COMPOSITED_WAAPI : COMPOSITED_CSS);
  });

  test('reverses the morph and cleans up when closed', async ({ page }) => {
    await page.locator('[data-ramka-trigger]').first().tap();
    await page.locator('[data-ramka-content]').waitFor({ state: 'attached' });
    await morphIdle(page);
    const afterOpen = (await morphPhases(page)).length;

    // The Close button, since the zoom controls and thumbnails are hidden at
    // this viewport and there is no keyboard on a phone.
    await page.locator('[data-ramka-close]').tap();
    await page.locator('[data-ramka-content]').waitFor({ state: 'detached' });
    await morphIdle(page, afterOpen);

    const phases = await morphPhases(page);
    expect(phases.map((p) => p.phase)).toEqual(['opening', null, 'closing', null]);
    expect(phaseDuration(phases, 'closing')).toBeGreaterThan(80);

    // On Android Blink the overlay is held mounted until the transition
    // finishes, so a leaked overlay or scroll lock would show up here.
    await expect(page.locator('html')).not.toHaveAttribute('style', /overflow:\s*hidden/);
    await expect(page.locator('[data-ramka-portal]')).toHaveCount(0);
  });

  test('skips the morph under prefers-reduced-motion but still opens', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await recordMorphPhases(page);

    await page.locator('[data-ramka-trigger]').first().tap();
    await expect(page.locator('[data-ramka-content]')).toHaveAttribute('data-open', '');
    expect(await morphPhases(page)).toEqual([]);
  });
});
