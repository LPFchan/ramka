import { expect, test } from './support/test';
import { PHOTOS_APP, morphSettled, openLightbox, zoomSettled } from './support/lightbox';

/**
 * Right-to-left navigation.
 *
 * This is the spec that has to exist in a real browser rather than jsdom,
 * because the whole RTL implementation rests on a CSSOM detail jsdom does not
 * model: an RTL scroller reports `scrollLeft` as `0` at its inline-start (right)
 * edge and runs *negative* to `-(scrollWidth - clientWidth)`. The unit suite
 * mocks that sign convention, so it proves the library is self-consistent — only
 * a browser proves the convention itself is right, and that Chromium, WebKit and
 * Gecko agree on it.
 */

const RTL_APP = '/examples/lightbox/photos-app-rtl';
const RTL_DOCS = '/docs/lightbox/rtl';

const slides = '[data-ramka-slides]';

/** Physical `scrollLeft` of the slides viewport. */
async function scrollLeft(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(
    (selector) => document.querySelector(selector)!.scrollLeft,
    slides,
  );
}

test.describe('rtl', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(RTL_APP);
    await openLightbox(page);
  });

  test('renders the viewport right-to-left', async ({ page }) => {
    // The premise of every other assertion here. If the page were LTR the
    // negative-scroll expectations below would be vacuously wrong rather than
    // failing for the reason under test.
    const direction = await page.evaluate(
      (selector) => getComputedStyle(document.querySelector(selector)!).direction,
      slides,
    );
    expect(direction).toBe('rtl');
  });

  test('mirrors the arrow keys', async ({ page }) => {
    const viewport = page.locator(slides);
    const counter = page.locator('[data-ramka-counter]');

    await expect(viewport).toHaveAttribute('data-active-index', '0');
    await expect(counter).toHaveText('1 of 48');

    // ArrowLeft moves visually left, which in RTL is *forward* through the
    // gallery — the mirror image of the LTR carousel spec.
    await page.keyboard.press('ArrowLeft');
    await expect(viewport).toHaveAttribute('data-active-index', '1');
    await expect(viewport).toHaveAttribute('data-direction', 'forward');
    await expect(counter).toHaveText('2 of 48');

    await page.keyboard.press('ArrowRight');
    await expect(viewport).toHaveAttribute('data-active-index', '0');
    await expect(viewport).toHaveAttribute('data-direction', 'backward');
    await expect(counter).toHaveText('1 of 48');
  });

  test('scrolls into the negative range as it advances', async ({ page }) => {
    // Slide 0 sits at the inline-start edge, which is scrollLeft 0 in both
    // directions. Advancing then walks *negative*, and each step is one
    // viewport width. Getting this sign wrong is the failure mode the whole
    // inline coordinate layer exists to prevent.
    expect(await scrollLeft(page)).toBe(0);

    await page.keyboard.press('ArrowLeft');
    await expect(page.locator(slides)).toHaveAttribute('data-active-index', '1');

    const atOne = await scrollLeft(page);
    expect(atOne).toBeLessThan(0);

    await page.keyboard.press('ArrowLeft');
    await expect(page.locator(slides)).toHaveAttribute('data-active-index', '2');

    const atTwo = await scrollLeft(page);
    // Uniform full-bleed slides: step twice, travel twice as far.
    expect(atTwo).toBeLessThan(atOne);
    expect(Math.abs(atTwo)).toBeCloseTo(Math.abs(atOne) * 2, 0);
  });

  test('returns to the inline-start edge at index 0', async ({ page }) => {
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator(slides)).toHaveAttribute('data-active-index', '2');
    expect(await scrollLeft(page)).toBeLessThan(0);

    await page.keyboard.press('Home');
    await expect(page.locator(slides)).toHaveAttribute('data-active-index', '0');
    // Exactly 0, not "close to" — the clamp has to land on the edge or the
    // first slide would sit slightly off-centre forever.
    expect(await scrollLeft(page)).toBe(0);
  });

  test('keeps the active slide centred in the viewport', async ({ page }) => {
    // The end-to-end invariant, independent of any scroll bookkeeping: whatever
    // the numbers say, the active item is what the user sees.
    const offsetFromMidline = () =>
      page.evaluate((selector) => {
        const viewport = document.querySelector(selector)!;
        const active = document.querySelector('[data-ramka-item][data-active]');
        if (!active) return null;
        const v = viewport.getBoundingClientRect();
        const a = active.getBoundingClientRect();
        return Math.abs(a.left + a.width / 2 - (v.left + v.width / 2));
      }, slides);

    for (let index = 1; index <= 4; index++) {
      await page.keyboard.press('ArrowLeft');
      await expect(page.locator(slides)).toHaveAttribute('data-active-index', String(index));

      const offset = await offsetFromMidline();
      expect(offset).not.toBeNull();
      // Within a pixel or two of the midline, allowing for sub-pixel snap
      // rounding (the three engines each round the gap differently).
      expect(offset!).toBeLessThan(2);
    }
  });

  test('advances the thumbnail strip in index order', async ({ page }) => {
    const strip = page.locator('[data-ramka-thumbnail-strip-track]');
    if ((await strip.count()) === 0) {
      test.skip(true, 'this skin mounts no thumbnail strip at this viewport');
    }

    const translateAt = () =>
      page.evaluate(() => {
        const track = document.querySelector('[data-ramka-thumbnail-strip-track]');
        if (!track) return null;
        return new DOMMatrix(getComputedStyle(track).transform).e;
      });

    expect(await translateAt()).toBeCloseTo(0, 0);

    await page.keyboard.press('ArrowLeft');
    await expect(page.locator(slides)).toHaveAttribute('data-active-index', '1');
    await page.waitForTimeout(600); // scrub duration

    // The track pulls the active thumb onto the midline, which in RTL means
    // translating *positively* — the opposite of LTR.
    const atOne = await translateAt();
    expect(atOne!).toBeGreaterThan(0);

    // Translation sign alone can be right while the midline padding is wrong,
    // so assert the invariant a viewer actually sees: the active thumb is
    // centred on the strip. jsdom can't model this — it silently ignores the
    // CSSOM shorthand/longhand interaction that once wiped the padding.
    const centring = await page.evaluate(() => {
      const root = document.querySelector('[data-ramka-thumbnail-strip]');
      const active = document.querySelector('[role="tab"][data-active]');
      if (!root || !active) return null;
      const rootRect = root.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      return {
        midline: rootRect.left + rootRect.width / 2,
        thumbCentre: activeRect.left + activeRect.width / 2,
      };
    });
    expect(centring).not.toBeNull();
    expect(centring!.thumbCentre).toBeCloseTo(centring!.midline, 0);
  });
});

/**
 * The morph's view-transition snapshots, which only exist mid-transition and so
 * are unreachable from jsdom (no `startViewTransition`) *and* from a screenshot
 * (the pseudo tree is not in the DOM).
 *
 * The composited morph replaces the snapshots' `width/height: 100%` with their
 * intrinsic captured size and counter-transforms them from the group's physical
 * top-left. A definite size against the UA's `inset: 0` is over-constrained,
 * and CSS drops one inset according to the containing block's direction — so
 * under `rtl` the snapshots anchored to the group's *right* edge while the
 * transforms still assumed the left, displacing `old` by the full
 * trigger↔destination width difference.
 */
test.describe('rtl morph', () => {
  /**
   * Run `start` and probe the `old` snapshot's used `left` while the morph is in
   * flight. `left` is the property over-constraint resolution flips, and the
   * counter transforms are computed from it being the physical `0`.
   *
   * Polled from the test rather than recorded by an in-page `requestAnimationFrame`
   * loop: a passive frame recorder is starved when the page is backgrounded by
   * parallel workers, which silently yielded zero samples for a whole phase.
   */
  async function anchorDuring(
    page: import('@playwright/test').Page,
    start: () => Promise<void>,
  ): Promise<{ left: string; width: string } | null> {
    await start();
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const probe = await page.evaluate(() => {
        const cs = getComputedStyle(
          document.documentElement,
          '::view-transition-old(lightbox-morph)',
        );
        // No live pseudo tree answers with initial values (`auto`), so a
        // resolved box is what marks a real in-flight snapshot.
        return cs.width.endsWith('px') ? { left: cs.left, width: cs.width } : null;
      });
      if (probe) return probe;
    }
    return null;
  }

  test('anchors the morph snapshots to the physical left edge', async ({ page }) => {
    await page.goto(RTL_APP);

    // Pre-fix these read the group's width minus the snapshot's — ~739px on
    // open, ~-739px on close.
    const opening = await anchorDuring(page, () =>
      page.locator('[data-ramka-trigger]').nth(3).click(),
    );
    expect(opening, 'no live snapshot seen during the open morph').not.toBeNull();
    expect(opening!.left).toBe('0px');

    await page.locator('[data-ramka-content][data-open]').waitFor();
    await morphSettled(page);

    const closing = await anchorDuring(page, () => page.keyboard.press('Escape'));
    expect(closing, 'no live snapshot seen during the close morph').not.toBeNull();
    expect(closing!.left).toBe('0px');
  });
});

/**
 * Zoom is the one subsystem that must NOT mirror. Navigating a gallery is
 * travel through an ordered list, so it follows the reading direction; panning
 * a zoomed image is direct manipulation of a 2D surface, so ArrowRight moves
 * right the way it does on a map. The arrow keys serve both, and the mirroring
 * added for navigation sits one branch away from the pan handler.
 */
test.describe('rtl zoom', () => {
  /** Zoom in, press a horizontal arrow, and report the pan it produced. */
  async function arrowPanDelta(page: import('@playwright/test').Page, app: string) {
    await page.goto(app);
    await openLightbox(page);
    await page.locator('[data-ramka-zoom-in]').click();
    const before = await zoomSettled(page);
    expect(before.scale).toBeGreaterThan(1.5);

    await page.keyboard.press('ArrowRight');
    const after = await zoomSettled(page);
    return { dx: after.x - before.x, scale: after.scale, before };
  }

  test('pans physically rather than mirroring, and does not navigate', async ({ page }) => {
    const ltr = await arrowPanDelta(page, PHOTOS_APP);
    const rtl = await arrowPanDelta(page, RTL_APP);

    // Both directions must move the image the same way. Asserting the sign
    // against each other (rather than against a hard-coded one) states the
    // invariant without depending on the engine's pan-sign convention.
    expect(Math.abs(ltr.dx)).toBeGreaterThan(10);
    expect(Math.sign(rtl.dx)).toBe(Math.sign(ltr.dx));
    expect(rtl.dx).toBeCloseTo(ltr.dx, 0);

    // The arrow panned the image, so it must not have moved the carousel.
    await expect(page.locator(slides)).toHaveAttribute('data-active-index', '0');
    expect(rtl.scale).toBeCloseTo(rtl.before.scale, 1);
  });

  test('keeps the advancing key panning while zoomed', async ({ page }) => {
    await page.goto(RTL_APP);
    await openLightbox(page);
    await page.locator('[data-ramka-zoom-in]').click();
    const before = await zoomSettled(page);
    expect(before.scale).toBeGreaterThan(1.5);

    // ArrowLeft is the key that *advances* an RTL gallery, so it is the one at
    // risk of slipping past the pan branch into the mirrored navigation branch
    // below it. While zoomed it must still pan.
    await page.keyboard.press('ArrowLeft');
    const after = await zoomSettled(page);

    expect(Math.abs(after.x - before.x)).toBeGreaterThan(10);
    await expect(page.locator(slides)).toHaveAttribute('data-active-index', '0');
  });

  test('releases the zoom when a navigation key does get through', async ({ page }) => {
    await page.goto(RTL_APP);
    await openLightbox(page);
    await page.locator('[data-ramka-zoom-in]').click();
    expect((await zoomSettled(page)).scale).toBeGreaterThan(1.5);

    // `End` is deliberately not swallowed by the zoom layer, so it is the
    // navigation route that stays available while zoomed (see zoom.spec.ts).
    await page.keyboard.press('End');

    await expect(page.locator(slides)).toHaveAttribute('data-active-index', '47');
    await expect(page.locator('[data-ramka-content]')).not.toHaveAttribute('data-zoomed');
    expect((await zoomSettled(page)).scale).toBeCloseTo(1, 1);
  });
});

/**
 * Thumbnail clicks are a separate entry into `navigate` from the arrow keys,
 * and the one that starts from the strip's own mirrored geometry — a thumb
 * resolved by the wrong index would still look plausible mid-strip.
 */
test.describe('rtl thumbnail selection', () => {
  test('activates the clicked thumbnail, not its mirror', async ({ page }) => {
    await page.goto(RTL_APP);
    await openLightbox(page);

    const tabs = page.locator('[role="tab"]');
    if ((await tabs.count()) === 0) {
      test.skip(true, 'this skin mounts no thumbnail strip at this viewport');
    }

    // Index 5 is far enough from both ends that an off-by-mirror lands on a
    // different, existing thumb rather than clamping to an edge and passing.
    await tabs.nth(5).click();

    await expect(page.locator(slides)).toHaveAttribute('data-active-index', '5');
    await expect(page.locator('[data-ramka-item][data-active]')).toHaveAttribute(
      'data-index',
      '5',
    );
    await expect(tabs.nth(5)).toHaveAttribute('data-active', '');
  });
});

/**
 * The imperative API under RTL, on the RTL guide page — which doubles as the
 * proof that `dir` on Root crosses the portal boundary. These docs are an LTR
 * page and the demo compensates in no way, so the viewer can only come out RTL
 * if the prop reached the portal host by itself.
 *
 * `open`/`goTo` take indices, and indices do not mirror. The risk is not the
 * handle itself (it holds no geometry) but that it reaches the same navigation
 * path the arrow keys use, so an index has to resolve to the same photo in
 * either direction.
 */
test.describe('rtl imperative api', () => {
  test('opens and navigates by index in an RTL viewer on an LTR page', async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'warning' || msg.type() === 'error') warnings.push(msg.text());
    });

    await page.goto(RTL_DOCS);
    await page.getByRole('button', { name: 'פתיחת הגלריה' }).click();

    const viewport = page.locator(slides);
    await expect(viewport).toBeVisible();

    // The prop crossed the portal: an LTR document, an RTL viewer. Compared as
    // computed direction because the docs never set a `dir` attribute at all —
    // LTR is the inherited default, not something written down.
    const [documentDir, viewerDir] = await page.evaluate(
      (s) => [
        getComputedStyle(document.documentElement).direction,
        getComputedStyle(document.querySelector(s)!).direction,
      ],
      slides,
    );
    expect(documentDir).toBe('ltr');
    expect(viewerDir).toBe('rtl');
    await expect(page.locator('[data-ramka-portal]')).toHaveAttribute('dir', 'rtl');

    // `open(0)` is the first photo, which RTL parks at the inline-start edge.
    await expect(viewport).toHaveAttribute('data-active-index', '0');
    expect(await scrollLeft(page)).toBe(0);

    // `goTo(3)` is the 4th photo in either direction. Reached by travelling
    // left, so physical scroll has to have gone negative to get there.
    await page.locator('[data-rtl-goto="3"]').click();
    await expect(viewport).toHaveAttribute('data-active-index', '3');
    expect(await scrollLeft(page)).toBeLessThan(0);
    await expect(page.locator('[data-ramka-item][data-active]')).toHaveAttribute('data-index', '3');

    await page.locator('[data-rtl-goto="0"]').click();
    await expect(viewport).toHaveAttribute('data-active-index', '0');
    expect(await scrollLeft(page)).toBe(0);

    // The `dir` prop and the CSS direction agree, so the library's development
    // mismatch warning must stay silent — the assertion that the documented
    // scoped-portal recipe is actually correct, not merely working by luck.
    expect(warnings.filter((w) => w.includes('[ramka]'))).toEqual([]);
  });
});
