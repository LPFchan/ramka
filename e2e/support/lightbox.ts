import type { Locator, Page } from '@playwright/test';

/**
 * A production-safe gallery: real skin, a grid of triggers to morph from, and
 * Zoom, Counter and Close all mounted. The `/debug/*` pages have richer
 * self-verifying panels but call `notFound()` outside development, so they are
 * unreachable from the build these tests run against.
 */
export const PHOTOS_APP = '/examples/lightbox/photos-app';

/**
 * Blocks until no morph is in flight.
 *
 * This is the wait that matters, and it is not the same as waiting for the
 * lightbox to be open. `data-open` lands when React commits — roughly 30ms in —
 * while the morph runs for another ~380ms after that. Asserting geometry or
 * reading a transform in between samples a half-played animation, which is
 * exactly the kind of test that passes locally and fails on a loaded CI box.
 */
export async function morphSettled(page: Page): Promise<void> {
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-ramka-view-transition'));
}

/** Opens the gallery at `index` and waits for the open morph to finish. */
export async function openLightbox(page: Page, index = 0): Promise<Locator> {
  const trigger = page.locator('[data-ramka-trigger]').nth(index);
  await trigger.click();
  await page.locator('[data-ramka-content]').waitFor({ state: 'attached' });
  await morphSettled(page);
  return trigger;
}

/**
 * The zoom host of the *active* slide.
 *
 * Scoping to `[data-active]` is not optional: Slides preloads neighbours, so
 * several zoom hosts are mounted at once and a bare `[data-ramka-zoom]` matches
 * all of them.
 */
export function activeZoom(page: Page): Locator {
  return page.locator('[data-ramka-item][data-active] [data-ramka-zoom]');
}

export type Transform = { scale: number; x: number; y: number };

/**
 * The transform the zoom engine has actually applied.
 *
 * Read off the zoom host's child rather than the image: the engine transforms
 * that wrapper and leaves the `<img>` itself untouched.
 */
export async function zoomTransform(page: Page): Promise<Transform> {
  return page.evaluate(() => {
    const el = document.querySelector('[data-ramka-item][data-active] [data-ramka-zoom] > *');
    if (!el) throw new Error('no active zoom host child');
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return { scale: m.a, x: m.e, y: m.f };
  });
}

/**
 * Blocks until the zoom transform stops changing, and returns it.
 *
 * The zoom-in button animates toward its target, so a gesture that starts
 * mid-animation is arbitrating against a moving image and may be read as
 * something other than a pan. Waiting for the transform to hold still for a few
 * consecutive samples is engine-agnostic — the animation is driven on
 * `requestAnimationFrame`, so `getAnimations()` cannot see it.
 */
export async function zoomSettled(page: Page, timeoutMs = 5_000): Promise<Transform> {
  const deadline = Date.now() + timeoutMs;
  let previous = await zoomTransform(page);
  let stableFor = 0;

  while (Date.now() < deadline) {
    await page.waitForTimeout(60);
    const current = await zoomTransform(page);
    const same =
      Math.abs(current.scale - previous.scale) < 0.001 &&
      Math.abs(current.x - previous.x) < 0.5 &&
      Math.abs(current.y - previous.y) < 0.5;
    stableFor = same ? stableFor + 1 : 0;
    previous = current;
    // Three quiet samples: one can land inside a spring's slow tail.
    if (stableFor >= 3) return current;
  }

  throw new Error(`zoom transform never settled within ${timeoutMs}ms`);
}

/** Phases the library published on `<html>`, with timings. */
export type MorphPhase = { phase: string | null; at: number };

declare global {
  interface Window {
    __ramkaMorphPhases?: MorphPhase[];
  }
}

/**
 * Starts recording morph phases. Install after navigating, then read with
 * {@link morphPhases}.
 *
 * Phases are transient — `opening` is set and removed within about 400ms — so
 * polling from the test side would miss them. An in-page observer catches every
 * edge with a timestamp, which also lets a test prove the morph *animated*
 * rather than snapping straight to its end state.
 */
export async function recordMorphPhases(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__ramkaMorphPhases = [];
    new MutationObserver(() => {
      window.__ramkaMorphPhases!.push({
        phase: document.documentElement.getAttribute('data-ramka-view-transition'),
        at: performance.now(),
      });
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-ramka-view-transition'],
    });
  });
}

export async function morphPhases(page: Page): Promise<MorphPhase[]> {
  return page.evaluate(() => window.__ramkaMorphPhases ?? []);
}

/** How long a phase stayed on `<html>`, or `null` if it never ran or is still running. */
export function phaseDuration(phases: MorphPhase[], phase: string): number | null {
  const start = phases.findIndex((p) => p.phase === phase);
  if (start === -1) return null;
  const end = phases.slice(start + 1).find((p) => p.phase !== phase);
  return end ? end.at - phases[start]!.at : null;
}

/** Drags with enough intermediate moves for the gesture layer to see velocity. */
export async function dragBy(
  page: Page,
  from: { x: number; y: number },
  delta: { x: number; y: number },
  steps = 12,
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + delta.x, from.y + delta.y, { steps });
  await page.mouse.up();
}

/** Centre of a locator, for gesture origins. */
export async function centreOf(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('element has no box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
