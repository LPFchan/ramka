import { expect, test } from './support/test';
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

  test('advances on a horizontal trackpad scroll', async ({ page, browserName }) => {
    // `mouse.wheel` with a horizontal delta kills Playwright's WebKit process,
    // and the failure lands on whatever test runs next. Vertical wheel is fine
    // there — the ctrl+wheel zoom test uses it — so this is scoped as narrowly
    // as the bug is. Chromium and Firefox both cover the path.
    test.skip(browserName === 'webkit', 'horizontal mouse.wheel segfaults Playwright WebKit');

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

/**
 * A real window resize. Viewport emulation (`page.setViewportSize`) does not
 * reproduce this: the browser's own re-centring `scroll` and `scrollend` after
 * the relayout have to reach the scroller before its ResizeObserver runs, which
 * is the order the HTML rendering steps give them in a real window.
 */
test('carousel keeps the active slide while the window is resized', async ({
  browser,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'resizes the window through the DevTools protocol');

  // No emulated viewport: the page is sized by its window. The runner merges
  // the project's device preset in, so its scale factor is unset explicitly.
  const context = await browser.newContext({ viewport: null, deviceScaleFactor: undefined });
  try {
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    const { windowId } = await cdp.send('Browser.getWindowForTarget');
    const resizeTo = (width: number, height: number) =>
      cdp.send('Browser.setWindowBounds', { windowId, bounds: { width, height } });
    await resizeTo(1280, 800);

    await page.goto(PHOTOS_APP);
    await openLightbox(page, 20);
    const slides = page.locator('[data-ramka-slides]');
    await expect(slides).toHaveAttribute('data-active-index', '20');

    // Every index the carousel passes through, not just where it ends up.
    await slides.evaluate((element) => {
      const seen: string[] = [];
      (window as unknown as { activeIndexes: string[] }).activeIndexes = seen;
      new MutationObserver(() => seen.push(element.dataset.activeIndex ?? '')).observe(element, {
        attributeFilter: ['data-active-index'],
      });
    });

    // In steps, the way a window drag delivers it.
    for (const [width, height] of [
      [1180, 800],
      [1060, 700],
      [940, 600],
      [1060, 700],
      [1280, 800],
    ]) {
      await resizeTo(width!, height!);
      await page.waitForTimeout(150);
    }

    await expect(slides).toHaveAttribute('data-active-index', '20');
    expect(
      await page.evaluate(() => (window as unknown as { activeIndexes: string[] }).activeIndexes),
    ).toEqual([]);
  } finally {
    await context.close();
  }
});
