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

/**
 * Waits for the lightbox to reach a resting state after an open or close.
 *
 * `morphSettled` alone is not enough, because "no morph is running" is also
 * true *before* one starts. On Android Blink the library deliberately defers
 * the transition until the URL-bar snapshot root stops moving — up to 1.5s — so
 * a bare absence check returns immediately and every later assertion races a
 * morph that has not begun. Desktop only got away with it because there the
 * attribute lands before Content attaches.
 *
 * So: wait for a morph to start and finish, or for the grace period to pass
 * with none started, which is the correct outcome on the reduced-motion,
 * low-end and no-View-Transition paths.
 */
export async function morphIdle(page: Page, sinceIndex = 0, graceMs = 3_000): Promise<void> {
  const deadline = Date.now() + graceMs;

  while (Date.now() < deadline) {
    const started = (await morphPhases(page)).slice(sinceIndex).some((p) => p.phase !== null);
    if (started) {
      await morphSettled(page);
      return;
    }
    await page.waitForTimeout(50);
  }

  await morphSettled(page);
}

/** Opens the gallery at `index` and waits for the open to finish settling. */
export async function openLightbox(page: Page, index = 0): Promise<Locator> {
  await ensureMorphRecorder(page);
  const sinceIndex = (await morphPhases(page)).length;

  const trigger = page.locator('[data-ramka-trigger]').nth(index);
  await trigger.click();
  await page.locator('[data-ramka-content]').waitFor({ state: 'attached' });
  await morphIdle(page, sinceIndex);
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
    __ramkaMorphObserved?: boolean;
    __ramkaCompositedSeen?: string[];
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
    window.__ramkaMorphObserved = true;
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

/** The WAAPI composited path — every engine except WebKit. */
export const COMPOSITED_WAAPI = 'data-ramka-vt-composited';
/** The WebKit path, which carries its animations as generated CSS instead. */
export const COMPOSITED_CSS = 'data-ramka-vt-composited-css';

/**
 * Records which composited-morph path engaged.
 *
 * The composited morph is the default engine, and it publishes a *different*
 * root attribute per platform: WebKit gets generated CSS animations because
 * accelerated animations on a fresh view-transition pseudo tree are unreliable
 * there, everything else gets WAAPI. Without this, a silent fall back to the
 * stock morph — or WebKit quietly taking the WAAPI path — looks identical to
 * success, because the phase log only says a transition ran.
 *
 * Both attributes are transient, set for the morph's duration and removed
 * after, so this has to be an in-page observer rather than a poll. Install
 * before opening.
 */
export async function recordCompositedPath(page: Page): Promise<void> {
  await page.evaluate(
    ([waapi, css]) => {
      window.__ramkaCompositedSeen = [];
      const el = document.documentElement;
      new MutationObserver(() => {
        for (const attr of [waapi!, css!]) {
          if (el.hasAttribute(attr) && !window.__ramkaCompositedSeen!.includes(attr)) {
            window.__ramkaCompositedSeen!.push(attr);
          }
        }
      }).observe(el, { attributes: true, attributeFilter: [waapi!, css!] });
    },
    [COMPOSITED_WAAPI, COMPOSITED_CSS],
  );
}

export async function compositedPathsSeen(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__ramkaCompositedSeen ?? []);
}

/**
 * Installs the recorder only if this page has none, so helpers can depend on it
 * without resetting the log a spec is in the middle of asserting on.
 */
async function ensureMorphRecorder(page: Page): Promise<void> {
  const present = await page.evaluate(() => window.__ramkaMorphObserved === true);
  if (!present) await recordMorphPhases(page);
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

/**
 * Drags with a real touch sequence.
 *
 * Needed because the gestures that matter most are touch-only by design — pull
 * to dismiss ignores anything whose `pointerType` is not `touch` — and
 * Playwright's `touchscreen` fixture can only tap. Dispatching the sequence
 * means CDP, so this is Chromium-only; specs that use it live under
 * `mobile/touch/`, which the WebKit projects do not run.
 *
 * Each move is a separate frame, as a real finger would produce. Sending them
 * back to back collapses them into one frame, and a gesture with no
 * intermediate positions reads as a teleport rather than a drag.
 */
export async function touchDrag(
  page: Page,
  from: { x: number; y: number },
  delta: { x: number; y: number },
  steps = 14,
): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
    });

  await send('touchStart', from.x, from.y);
  for (let i = 1; i <= steps; i++) {
    await send('touchMove', from.x + (delta.x * i) / steps, from.y + (delta.y * i) / steps);
    await page.waitForTimeout(8);
  }
  await send('touchEnd', from.x + delta.x, from.y + delta.y);
  await cdp.detach();
}
