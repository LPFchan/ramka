import { expect, test } from '@playwright/test';
import { PHOTOS_APP, activeZoom, centreOf, openLightbox } from './support/lightbox';

/**
 * Carousel navigation. The interesting half is the drag: the track is a native
 * scroll-snap scroller driven by pointer events, and neither the scrolling nor
 * the snap exists in jsdom.
 */
test.describe('carousel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PHOTOS_APP);
    await openLightbox(page);
  });

  test('moves with the arrow keys and reports position', async ({ page }) => {
    const slides = page.locator('[data-ramka-slides]');
    const counter = page.locator('[data-ramka-counter]');

    await expect(slides).toHaveAttribute('data-active-index', '0');
    await expect(counter).toHaveText('1 of 48');

    await page.keyboard.press('ArrowRight');
    await expect(slides).toHaveAttribute('data-active-index', '1');
    await expect(slides).toHaveAttribute('data-direction', 'forward');
    await expect(counter).toHaveText('2 of 48');

    await page.keyboard.press('ArrowLeft');
    await expect(slides).toHaveAttribute('data-active-index', '0');
    await expect(slides).toHaveAttribute('data-direction', 'backward');
    await expect(counter).toHaveText('1 of 48');
  });

  test('loops backward past the first slide', async ({ page }) => {
    // This gallery sets `loop`, so going back from 0 lands on the last slide.
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[data-ramka-slides]')).toHaveAttribute('data-active-index', '47');
    await expect(page.locator('[data-ramka-counter]')).toHaveText('48 of 48');
  });

  test('keeps every slide box but mounts only a window of items', async ({ page }) => {
    // The scroller needs all 48 boxes or the scroll length — and therefore the
    // snap positions — would be wrong. The expensive part, the items, is
    // windowed around the active index.
    await expect(page.locator('[data-ramka-slide]')).toHaveCount(48);

    const mounted = await page.locator('[data-ramka-item]').count();
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(48);

    // Exactly one active item, and it is the one the scroller reports.
    await expect(page.locator('[data-ramka-item][data-active]')).toHaveCount(1);
    await expect(page.locator('[data-ramka-item][data-active]')).toHaveAttribute('data-index', '0');
  });

  test('marks inactive slides inert so they are skipped by tabbing', async ({ page }) => {
    const inactive = page.locator('[data-ramka-item]:not([data-active])').first();
    await expect(inactive).toHaveAttribute('inert', /.*/);
    await expect(page.locator('[data-ramka-item][data-active]')).not.toHaveAttribute('inert');
  });
});
