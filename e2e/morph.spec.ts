import { expect, test } from './support/test';
import {
  COMPOSITED_CSS,
  COMPOSITED_WAAPI,
  PHOTOS_APP,
  compositedPathsSeen,
  morphPhases,
  morphSettled,
  openLightbox,
  phaseDuration,
  recordCompositedPath,
  recordMorphPhases,
} from './support/lightbox';

/**
 * The trigger → item morph, which the unit suite cannot reach: jsdom has no
 * `startViewTransition`, so every assertion there stops at "we called it".
 */
test.describe('open and close morph', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PHOTOS_APP);
    await recordMorphPhases(page);
  });

  test('animates the trigger into a modal dialog and settles', async ({ page }) => {
    await openLightbox(page);

    const phases = await morphPhases(page);
    expect(phases.map((p) => p.phase)).toEqual(['opening', null]);

    // A morph that snapped straight to its end state would produce the same two
    // phases, so pin that it actually spent time animating. The real duration is
    // ~380ms; the floor is low enough to survive a slow machine.
    expect(phaseDuration(phases, 'opening')).toBeGreaterThan(80);

    const content = page.locator('[data-ramka-content]');
    await expect(content).toHaveAttribute('data-open', '');
    await expect(content).toHaveAttribute('role', 'dialog');
    await expect(content).toHaveAttribute('aria-modal', 'true');

    // The morph leaves no group name behind. A leaked name makes the *next*
    // transition capture the wrong element, which stays invisible until someone
    // opens the lightbox twice. Scoped to the library's own group: this page
    // also names its toolbar and grid, and those are the app's to keep.
    await expect(page.locator('[style*="lightbox-morph"]')).toHaveCount(0);

    // Scroll lock, held only while open.
    await expect(page.locator('html')).toHaveAttribute('style', /overflow:\s*hidden/);
  });

  test("upgrades to the composited morph on this engine's path", async ({ page, browserName }) => {
    // The composited morph is the default engine, not an experiment, and it
    // takes a different route per platform. Asserting only that "a transition
    // ran" would pass if it silently fell back to the stock morph, or if WebKit
    // took the WAAPI path it is specifically kept off.
    await recordCompositedPath(page);
    await openLightbox(page);

    const expected = browserName === 'webkit' ? COMPOSITED_CSS : COMPOSITED_WAAPI;
    const rejected = browserName === 'webkit' ? COMPOSITED_WAAPI : COMPOSITED_CSS;

    const seen = await compositedPathsSeen(page);
    expect(seen).toContain(expected);
    expect(seen).not.toContain(rejected);

    // Transient by design: a leaked attribute keeps the injected pseudo-element
    // overrides live and changes how the *next* transition renders.
    await expect(page.locator('html')).not.toHaveAttribute(expected, '');
  });

  test('falls back to the stock morph when the composited upgrade is off', async ({ page }) => {
    // `?vtstock` is the library's own A/B escape hatch, and the stock path is a
    // deliberate control arm rather than dead code — so it is worth covering on
    // its own terms. It also proves the assertions above discriminate: if the
    // composited upgrade never engaged anywhere, they would pass vacuously and
    // this test would be indistinguishable from the default.
    await page.goto(`${PHOTOS_APP}?vtstock`);
    await recordMorphPhases(page);
    await recordCompositedPath(page);

    await openLightbox(page);

    // Still a real morph — the upgrade is what is disabled, not the transition.
    expect((await morphPhases(page)).map((p) => p.phase)).toEqual(['opening', null]);
    expect(await compositedPathsSeen(page)).toEqual([]);
    await expect(page.locator('[data-ramka-content]')).toHaveAttribute('data-open', '');
  });

  test('reverses the morph on Escape and cleans up after itself', async ({ page }) => {
    const trigger = await openLightbox(page);

    await page.keyboard.press('Escape');
    await page.locator('[data-ramka-content]').waitFor({ state: 'detached' });
    await morphSettled(page);

    const phases = await morphPhases(page);
    expect(phases.map((p) => p.phase)).toEqual(['opening', null, 'closing', null]);
    expect(phaseDuration(phases, 'closing')).toBeGreaterThan(80);

    // Scroll lock released — a stuck `overflow: hidden` leaves the whole page
    // unscrollable, which is the worst possible thing to ship.
    await expect(page.locator('html')).not.toHaveAttribute('style', /overflow:\s*hidden/);

    // The morph publishes its geometry, radius and timing as custom properties
    // on <html> and clears them on settle. A leaked one is silent until the next
    // transition reads a stale start radius or duration from it.
    const leaked = await page.evaluate(() =>
      [...document.documentElement.style].filter(
        (p) => p.startsWith('--lightbox-morph') || p.startsWith('--lightbox-vt'),
      ),
    );
    expect(leaked).toEqual([]);

    // Focus goes back where it came from, not to <body>.
    await expect(trigger).toBeFocused();
  });

  test('skips the morph under prefers-reduced-motion but still opens', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await recordMorphPhases(page);

    await page.locator('[data-ramka-trigger]').first().click();
    await expect(page.locator('[data-ramka-content]')).toHaveAttribute('data-open', '');

    // Not "a faster morph" — no View Transition is started at all, so nothing
    // ever lands on <html>.
    expect(await morphPhases(page)).toEqual([]);

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-ramka-content]')).toHaveCount(0);
    expect(await morphPhases(page)).toEqual([]);
  });

  test('morphs again on a second open', async ({ page }) => {
    await openLightbox(page, 0);
    await page.keyboard.press('Escape');
    await page.locator('[data-ramka-content]').waitFor({ state: 'detached' });
    await morphSettled(page);

    // Re-opening from a different trigger is where leaked morph state shows up.
    await openLightbox(page, 3);

    const phases = (await morphPhases(page)).map((p) => p.phase);
    expect(phases).toEqual(['opening', null, 'closing', null, 'opening', null]);
    await expect(page.locator('[data-ramka-content]')).toHaveAttribute('data-open', '');
    await expect(page.locator('[data-ramka-item][data-active]')).toHaveAttribute('data-index', '3');
  });
});
