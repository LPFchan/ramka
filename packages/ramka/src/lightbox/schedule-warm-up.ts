/**
 * Scheduling for the lazily-loaded engine warm-ups (morph, zoom).
 *
 * These used to be requested straight from an effect on Root mount, which put
 * a normal-priority module fetch — and the evaluation that follows it — in the
 * same window as hydration and the LCP image. On a product page the LCP element
 * is usually the very image the lightbox is attached to, so the warm-up
 * competed with the thing it exists to make look good.
 *
 * Idle instead, but with a bounded timeout: "never idle" is a real state on a
 * busy page and the warm-up still has to happen, because a cold chunk when
 * `Lightbox.Zoom` mounts means the placeholder renders first and the engine
 * swap remounts Media mid-open. The intent warm-ups on Trigger (hover, focus,
 * pointerdown) cover anyone who interacts before this fires.
 */

/**
 * Upper bound handed to `requestIdleCallback`. Long enough to clear hydration
 * and the LCP paint on a slow device, short enough that an idle-starved page
 * still warms well before a user can plausibly reach the gallery.
 */
const WARM_UP_IDLE_TIMEOUT_MS = 1000;

/**
 * Delay used where `requestIdleCallback` is missing (Safari only shipped it in
 * 18.2). Not idle-aware, but it clears the synchronous hydration burst, which
 * is the part that actually hurts.
 */
const WARM_UP_FALLBACK_DELAY_MS = 200;

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/**
 * Run `task` once the page is idle. Returns a cancel function, so a Root that
 * unmounts before the warm-up fires doesn't fetch chunks for a gallery that is
 * no longer on the page.
 */
function scheduleWarmUp(task: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const idleWindow = window as IdleWindow;
  if (typeof idleWindow.requestIdleCallback === 'function') {
    const handle = idleWindow.requestIdleCallback(task, { timeout: WARM_UP_IDLE_TIMEOUT_MS });
    return () => idleWindow.cancelIdleCallback?.(handle);
  }

  const handle = window.setTimeout(task, WARM_UP_FALLBACK_DELAY_MS);
  return () => window.clearTimeout(handle);
}

export { scheduleWarmUp, WARM_UP_IDLE_TIMEOUT_MS, WARM_UP_FALLBACK_DELAY_MS };
