import { expect, test } from '@playwright/test';
import { PHOTOS_APP, activeZoom, centreOf, openLightbox } from '../support/lightbox';

/**
 * Gestures that Playwright can only drive in Chromium. The WebKit project
 * ignores this whole directory — see `playwright.config.ts` for why it is a
 * directory rather than a per-test skip.
 *
 * Neither exclusion is a statement about the library: both gestures work in
 * Safari. They are limits of the automation tool.
 *
 * - A touch swipe needs a real touch sequence, and the `touchscreen` fixture can
 *   only tap. Dispatching the sequence means CDP, which WebKit does not speak.
 * - `mouse.wheel` segfaults Playwright's WebKit build: the browser process dies
 *   and the *next* test fails to launch one, which is a confusing way to lose an
 *   unrelated spec.
 */
test.describe('chromium-only gestures', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PHOTOS_APP);
    await openLightbox(page);
  });

  test('advances on a touch swipe', async ({ page }) => {
    const centre = await centreOf(activeZoom(page));
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x, y: centre.y }],
      });

    // Travel past the snap midpoint rather than relying on a fling. A shorter,
    // faster swipe also works in a browser, but it makes the outcome depend on
    // the velocity estimate — and under a loaded CI box the moves collapse into
    // one frame, so the estimate changes and the test starts flaking.
    await touch('touchStart', centre.x);
    for (let i = 1; i <= 14; i++) {
      await touch('touchMove', centre.x - i * 50);
      // Let each move land in its own frame, as a real finger would.
      await page.waitForTimeout(8);
    }
    await touch('touchEnd', centre.x - 700);

    await expect(page.locator('[data-ramka-slides]')).toHaveAttribute('data-active-index', '1');
    await expect(page.locator('[data-ramka-counter]')).toHaveText('2 of 48');
  });

  test('advances on a horizontal trackpad scroll', async ({ page }) => {
    // The track is a native scroll-snap scroller, so the desktop gesture is a
    // horizontal scroll rather than a mouse drag — and what is under test is the
    // library's scroll→index mapping plus its fling detection, neither of which
    // exists without a real scroller.
    //
    // Comfortably past the snap midpoint: a delta that only just clears it
    // lands differently depending on how the browser rounds the gap.
    const centre = await centreOf(activeZoom(page));
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.wheel(1_000, 0);

    await expect(page.locator('[data-ramka-slides]')).toHaveAttribute('data-active-index', '1');
    await expect(page.locator('[data-ramka-counter]')).toHaveText('2 of 48');
  });
});
