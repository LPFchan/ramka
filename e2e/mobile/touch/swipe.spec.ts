import { expect, test } from '@playwright/test';
import { PHOTOS_APP, activeZoom, centreOf, openLightbox, touchDrag } from '../../support/lightbox';

/**
 * Swiping the carousel with a finger, at a phone viewport — the gesture the
 * majority of real usage is, and the one the desktop suite can only approximate
 * with a trackpad scroll.
 *
 * Chromium-only, because the touch sequence goes over CDP.
 */
test.describe('touch swipe', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PHOTOS_APP);
    await openLightbox(page);
  });

  test('advances to the next slide', async ({ page }) => {
    const centre = await centreOf(activeZoom(page));
    // Past the snap midpoint rather than relying on a fling: a velocity-
    // dependent swipe changes outcome when a loaded runner collapses the moves
    // into one frame.
    await touchDrag(page, centre, { x: -Math.round(centre.x * 1.6), y: 0 });

    await expect(page.locator('[data-ramka-slides]')).toHaveAttribute('data-active-index', '1');
    await expect(page.locator('[data-ramka-counter]')).toHaveText('2 of 48');
  });

  test('goes back on a swipe the other way', async ({ page }) => {
    const centre = await centreOf(activeZoom(page));
    await touchDrag(page, centre, { x: -Math.round(centre.x * 1.6), y: 0 });
    await expect(page.locator('[data-ramka-slides]')).toHaveAttribute('data-active-index', '1');

    await touchDrag(page, centre, { x: Math.round(centre.x * 1.6), y: 0 });
    await expect(page.locator('[data-ramka-slides]')).toHaveAttribute('data-active-index', '0');
    await expect(page.locator('[data-ramka-slides]')).toHaveAttribute('data-direction', 'backward');
  });
});
