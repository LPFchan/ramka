import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { prefetchMorphRuntime } from './lightbox-morph-loader';
import { prefetchPullRuntime } from './lightbox-pull-loader';
import { prefetchZoomRuntime } from './lightbox-zoom-loader';
import {
  resetRuntimeIdlePrefetchForTests,
  scheduleRuntimeIdlePrefetch,
} from './lightbox-runtime-prefetch';

vi.mock('./lightbox-morph-loader', () => ({ prefetchMorphRuntime: vi.fn() }));
vi.mock('./lightbox-pull-loader', () => ({ prefetchPullRuntime: vi.fn() }));
vi.mock('./lightbox-zoom-loader', () => ({ prefetchZoomRuntime: vi.fn() }));

/**
 * The idle prefetch exists so a cold first open doesn't fetch+evaluate the
 * viewer chunks inside the transition window — the VT animation clock starts
 * at pseudo-tree creation, so late chunk work skips the morph's first frames
 * rather than delaying it. See lightbox-runtime-prefetch.ts.
 *
 * jsdom has no requestIdleCallback, so these tests exercise the setTimeout
 * fallback path (which is also what Safari runs).
 */
describe('scheduleRuntimeIdlePrefetch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetRuntimeIdlePrefetchForTests();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('prefetches zoom, pull and morph at idle when view transitions are on', () => {
    scheduleRuntimeIdlePrefetch({ viewTransition: true });
    expect(prefetchZoomRuntime).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(prefetchZoomRuntime).toHaveBeenCalledTimes(1);
    expect(prefetchPullRuntime).toHaveBeenCalledTimes(1);
    expect(prefetchMorphRuntime).toHaveBeenCalledTimes(1);
  });

  it('skips the morph runtime when view transitions are off', () => {
    scheduleRuntimeIdlePrefetch({ viewTransition: false });
    vi.runAllTimers();
    expect(prefetchZoomRuntime).toHaveBeenCalledTimes(1);
    expect(prefetchPullRuntime).toHaveBeenCalledTimes(1);
    expect(prefetchMorphRuntime).not.toHaveBeenCalled();
  });

  it('schedules once per page, however many Roots mount', () => {
    // A feed mounts hundreds of Roots; the fetch must not be re-scheduled.
    for (let i = 0; i < 50; i++) scheduleRuntimeIdlePrefetch({ viewTransition: true });
    vi.runAllTimers();
    expect(prefetchZoomRuntime).toHaveBeenCalledTimes(1);
    expect(prefetchMorphRuntime).toHaveBeenCalledTimes(1);
  });

  it('adds the morph fetch when a later Root enables view transitions', () => {
    // First Root has morphs disabled — only the viewer runtimes go out.
    scheduleRuntimeIdlePrefetch({ viewTransition: false });
    vi.runAllTimers();
    expect(prefetchMorphRuntime).not.toHaveBeenCalled();

    // A later Root wants morphs: its runtime still gets an idle fetch.
    scheduleRuntimeIdlePrefetch({ viewTransition: true });
    vi.runAllTimers();
    expect(prefetchMorphRuntime).toHaveBeenCalledTimes(1);
    expect(prefetchZoomRuntime).toHaveBeenCalledTimes(1);
  });
});
