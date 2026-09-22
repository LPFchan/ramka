'use client';

import { prefetchMorphRuntime } from './lightbox-morph-loader';
import { prefetchPullRuntime } from './lightbox-pull-loader';
import { prefetchZoomRuntime } from './lightbox-zoom-loader';

/**
 * One-time idle prefetch of the lazy viewer runtimes (zoom, pull and — when
 * view transitions are enabled — morph).
 *
 * The hover/focus/pointerdown warm-up in Lightbox.Trigger is usually enough,
 * but it loses the race on a cold HTTP cache: a chunk still in flight at open
 * time gets fetched and evaluated inside the click→first-frame window, so the
 * first open starts visibly later than every other one (localhost probe:
 * ~50ms of the pre-`ready` long task plus the fetch round-trips; more on a
 * real network). On Gecko it is worse than latency: the composited morph
 * resolves its replacement animations synchronously there (see the anchoring
 * note in vt-composited-morph.ts), so main-thread work before the first paint
 * is *skipped out of the morph* rather than waited out. Fetching at first
 * idle makes the first open as warm as every later one.
 *
 * Scheduled once per page no matter how many Roots mount (a feed renders
 * hundreds); the loaders additionally memoize, so double-invocation is
 * harmless. The morph runtime is gated on any Root wanting view transitions —
 * if the first Root has them disabled and a later one doesn't, the later call
 * still schedules the morph fetch.
 */

let viewerScheduled = false;
let morphScheduled = false;

/** requestIdleCallback with a deadline, or a small timeout where unsupported (Safari). */
function whenIdle(run: () => void): void {
  if (typeof window === 'undefined') return;
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => run(), { timeout: 1500 });
  } else {
    window.setTimeout(run, 300);
  }
}

function scheduleRuntimeIdlePrefetch(options: { viewTransition: boolean }): void {
  if (typeof window === 'undefined') return;
  if (!viewerScheduled) {
    viewerScheduled = true;
    whenIdle(() => {
      prefetchZoomRuntime();
      prefetchPullRuntime();
    });
  }
  if (options.viewTransition && !morphScheduled) {
    morphScheduled = true;
    whenIdle(prefetchMorphRuntime);
  }
}

/** Test-only: allow re-scheduling within one module registry. */
function resetRuntimeIdlePrefetchForTests(): void {
  viewerScheduled = false;
  morphScheduled = false;
}

export { scheduleRuntimeIdlePrefetch, resetRuntimeIdlePrefetchForTests };
