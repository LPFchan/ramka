import { expect, test } from '@playwright/test';
import { PHOTOS_APP, activeZoom, centreOf, dragBy, openLightbox, zoomSettled, zoomTransform } from './support/lightbox';

/**
 * Zoom and pan. The engine is loaded lazily and drives a real transform from
 * real pointer events, so none of this is observable in jsdom — there is no
 * layout to read a scale off, and no compositor to pan against.
 *
 * Every transform read here goes through {@link zoomSettled} rather than a bare
 * poll. The engine animates on `requestAnimationFrame`, so a poll that happens
 * to fire early sees a frame partway to the target and compares it against the
 * wrong number.
 */
test.describe('zoom', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PHOTOS_APP);
    await openLightbox(page);
  });

  test('is bounded at rest', async ({ page }) => {
    await expect(page.locator('[data-ramka-zoom-out]')).toBeDisabled();
    await expect(page.locator('[data-ramka-zoom-in]')).toBeEnabled();
    await expect(activeZoom(page)).not.toHaveAttribute('data-zoom');
    expect((await zoomTransform(page)).scale).toBeCloseTo(1, 2);
  });

  test('scales the active image and marks the state', async ({ page }) => {
    await page.locator('[data-ramka-zoom-in]').click();

    await expect(activeZoom(page)).toHaveAttribute('data-zoom', '');
    await expect(page.locator('[data-ramka-content]')).toHaveAttribute('data-zoomed', '');
    await expect(page.locator('[data-ramka-zoom-out]')).toBeEnabled();

    expect((await zoomSettled(page)).scale).toBeGreaterThan(1.5);

    // Zoomed panning has to own the pointer, or the browser scrolls the
    // carousel underneath instead of moving the image.
    await expect(activeZoom(page)).toHaveCSS('touch-action', 'none');
  });

  test('pans a zoomed image with a drag', async ({ page }) => {
    // Covers the gesture layer: a drag has to translate the image, by the
    // distance dragged, without changing the scale.
    //
    // It does not cover the neighbouring failure where the image starts the
    // browser's own native drag instead — that needs `draggable={false}`, which
    // consumers set rather than the library. Verified by removing it from this
    // gallery, and the test still passed: synthetic mouse events do not initiate
    // native drag-and-drop, so no Playwright test can reach that path.
    await page.locator('[data-ramka-zoom-in]').click();
    const before = await zoomSettled(page);
    expect(before.scale).toBeGreaterThan(1.5);

    await dragBy(page, await centreOf(activeZoom(page)), { x: -140, y: 0 });

    const after = await zoomSettled(page);
    expect(after.x).toBeLessThan(before.x - 20);

    // Panning moves the image; it must not change how far it is zoomed.
    expect(after.scale).toBeCloseTo(before.scale, 1);
  });

  test('pans with the arrow keys instead of navigating while zoomed', async ({ page }) => {
    await page.locator('[data-ramka-zoom-in]').click();
    const before = await zoomSettled(page);
    expect(before.scale).toBeGreaterThan(1.5);

    await page.keyboard.press('ArrowRight');
    const after = await zoomSettled(page);

    // Keyboard pan is the only way to reach the edges of a zoomed image without
    // a pointer, so it is the accessible path, not a convenience.
    expect(Math.abs(after.x - before.x)).toBeGreaterThan(10);

    // Same slide: the arrow moved the image, not the carousel.
    await expect(page.locator('[data-ramka-slides]')).toHaveAttribute('data-active-index', '0');
  });

  test('resets when navigating to another slide', async ({ page }) => {
    await page.locator('[data-ramka-zoom-in]').click();
    await expect(activeZoom(page)).toHaveAttribute('data-zoom', '');

    // Arrows pan while zoomed, so navigate by a route that is not swallowed by
    // the zoom gesture layer.
    await page.locator('[data-ramka-thumbnail]').nth(1).click();

    await expect(page.locator('[data-ramka-slides]')).toHaveAttribute('data-active-index', '1');
    await expect(page.locator('[data-ramka-content]')).not.toHaveAttribute('data-zoomed');
    await expect(page.locator('[data-ramka-zoom-out]')).toBeDisabled();
    expect((await zoomSettled(page)).scale).toBeCloseTo(1, 1);
  });

  test('zooms toward the pointer on ctrl+wheel', async ({ page }) => {
    const zoom = activeZoom(page);
    const box = (await zoom.boundingBox())!;
    // Off-centre on purpose: a focal-point zoom must keep the point under the
    // cursor put, which a naive centre-anchored scale would not.
    const point = { x: box.x + box.width * 0.25, y: box.y + box.height * 0.5 };

    await page.mouse.move(point.x, point.y);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -400);
    await page.keyboard.up('Control');

    const after = await zoomSettled(page);
    expect(after.scale).toBeGreaterThan(1.1);
    // Anchoring left of centre has to push the image right.
    expect(after.x).toBeGreaterThan(0);
  });
});
