import { expect, test } from '@playwright/test';
import { PHOTOS_APP, activeZoom, centreOf, morphSettled, openLightbox, touchDrag } from '../../support/lightbox';

/**
 * Pull to dismiss — touch-only by design: the handler returns immediately
 * unless `event.pointerType === 'touch'`, so no mouse test can reach it. That
 * makes CDP the only way in, and Chromium the only project that runs this file.
 *
 * Until now this gesture had no automated coverage at any level: jsdom cannot
 * produce a pointer stream with positions, and the desktop suite cannot produce
 * touch.
 */
test.describe('pull to dismiss', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PHOTOS_APP);
    await openLightbox(page);
  });

  test('dismisses on a long downward pull', async ({ page }) => {
    const centre = await centreOf(activeZoom(page));
    const content = page.locator('[data-ramka-content]');

    await touchDrag(page, centre, { x: 0, y: 320 });

    await content.waitFor({ state: 'detached' });
    await morphSettled(page);
    await expect(page.locator('html')).not.toHaveAttribute('style', /overflow:\s*hidden/);
  });

  test('snaps back when the pull is too short to dismiss', async ({ page }) => {
    const centre = await centreOf(activeZoom(page));
    const content = page.locator('[data-ramka-content]');

    // Short of the dismiss threshold: the viewer has to come back rather than
    // sit part-way down the screen, which is the failure users would notice.
    await touchDrag(page, centre, { x: 0, y: 60 });

    await expect(content).toHaveAttribute('data-open', '');
    // The transient pull markers are cleared once it settles.
    await expect(content).not.toHaveAttribute('data-pull-dismissing');
    await expect(async () => {
      expect(await content.getAttribute('data-pull-snapping')).toBeNull();
    }).toPass({ timeout: 5_000 });
  });

  test('does not start a pull while the carousel is being swiped', async ({ page }) => {
    const centre = await centreOf(activeZoom(page));
    const slides = page.locator('[data-ramka-slides]');

    // A mostly-horizontal drag with vertical noise in it is a swipe. If
    // pull-to-dismiss also claimed the gesture, the viewer would slide down —
    // or close outright — while the track scrolls sideways.
    await touchDrag(page, centre, { x: -Math.round(centre.x * 1.6), y: 40 });

    // Staying open is the assertion that matters; which slide it landed on is
    // the swipe's business, and a fling can legitimately carry it further.
    await expect(page.locator('[data-ramka-content]')).toHaveAttribute('data-open', '');
    await expect(slides).not.toHaveAttribute('data-active-index', '0');
    await expect(page.locator('[data-ramka-content]')).not.toHaveAttribute('data-pull-dismissing');
  });
});
