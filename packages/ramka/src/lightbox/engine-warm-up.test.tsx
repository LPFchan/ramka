import { render, screen, fireEvent } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LightboxContent } from './lightbox-content';
import { LightboxPortal } from './lightbox-portal';
import { LightboxRoot } from './lightbox-root';
import { LightboxTrigger } from './lightbox-trigger';
import { scheduleWarmUp, WARM_UP_FALLBACK_DELAY_MS } from './schedule-warm-up';

/**
 * When the engines are warmed matters as much as whether they are: requesting
 * them from a mount effect put a normal-priority fetch and its evaluation in
 * the same window as hydration and the LCP image. Nothing in the main suite
 * pins the timing (it passes with the warm-up disabled entirely), so it is
 * pinned here.
 */

const loaders = vi.hoisted(() => ({
  zoom: vi.fn(),
  morph: vi.fn(),
}));

vi.mock('./lightbox-zoom-loader', () => ({
  prefetchZoomRuntime: loaders.zoom,
  loadZoomRuntime: () => new Promise(() => {}),
  getZoomRuntimeSync: () => null,
}));

vi.mock('./lightbox-morph-loader', () => ({
  prefetchMorphRuntime: loaders.morph,
  loadMorphRuntime: () => new Promise(() => {}),
  getMorphRuntimeSync: () => null,
}));

/**
 * Captures idle callbacks instead of running them, so tests drive the timing.
 * Honours cancellation the way the browser does, so a cancelled warm-up really
 * does not run.
 */
function stubIdleCallback() {
  const scheduled = new Map<number, () => void>();
  let nextHandle = 0;
  const requestIdleCallback = vi.fn((cb: () => void) => {
    nextHandle += 1;
    scheduled.set(nextHandle, cb);
    return nextHandle;
  });
  const cancelIdleCallback = vi.fn((handle: number) => {
    scheduled.delete(handle);
  });
  Object.defineProperty(window, 'requestIdleCallback', {
    value: requestIdleCallback,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, 'cancelIdleCallback', {
    value: cancelIdleCallback,
    writable: true,
    configurable: true,
  });
  return {
    requestIdleCallback,
    cancelIdleCallback,
    runIdle: () => [...scheduled.values()].forEach((cb) => cb()),
  };
}

function removeIdleCallback() {
  delete (window as unknown as Record<string, unknown>).requestIdleCallback;
  delete (window as unknown as Record<string, unknown>).cancelIdleCallback;
}

function TestLightbox({ viewTransition = true }: { viewTransition?: boolean } = {}) {
  return (
    <LightboxRoot viewTransition={viewTransition}>
      <LightboxTrigger index={0} data-testid="trigger">
        Open
      </LightboxTrigger>
      <LightboxPortal>
        <LightboxContent aria-label="Test lightbox">Content</LightboxContent>
      </LightboxPortal>
    </LightboxRoot>
  );
}

beforeEach(() => {
  loaders.zoom.mockClear();
  loaders.morph.mockClear();
});

afterEach(() => {
  removeIdleCallback();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('engine warm-up timing', () => {
  it('does not warm anything while the page is hydrating', () => {
    stubIdleCallback();

    render(<TestLightbox />);

    // The whole point: no fetch competing with the LCP image.
    expect(loaders.zoom).not.toHaveBeenCalled();
    expect(loaders.morph).not.toHaveBeenCalled();
  });

  it('warms once the browser reports idle', () => {
    const { requestIdleCallback, runIdle } = stubIdleCallback();

    render(<TestLightbox />);
    expect(requestIdleCallback).toHaveBeenCalled();
    runIdle();

    expect(loaders.zoom).toHaveBeenCalled();
  });

  it('bounds the idle wait with a timeout, so an always-busy page still warms', () => {
    const { requestIdleCallback } = stubIdleCallback();

    render(<TestLightbox />);

    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), {
      timeout: expect.any(Number),
    });
  });

  it('cancels the pending warm-up when Root unmounts first', () => {
    const { cancelIdleCallback, runIdle } = stubIdleCallback();

    const { unmount } = render(<TestLightbox />);
    unmount();

    expect(cancelIdleCallback).toHaveBeenCalled();
    // A gallery that left the page should not fetch engines for itself.
    runIdle();
    expect(loaders.zoom).not.toHaveBeenCalled();
  });

  it('falls back to a short timer where requestIdleCallback is missing', () => {
    // Safari only shipped requestIdleCallback in 18.2.
    removeIdleCallback();
    vi.useFakeTimers();

    render(<TestLightbox />);
    expect(loaders.zoom).not.toHaveBeenCalled();

    vi.advanceTimersByTime(WARM_UP_FALLBACK_DELAY_MS);

    expect(loaders.zoom).toHaveBeenCalled();
  });

  it('skips the morph engine when view transitions are off', () => {
    const { runIdle } = stubIdleCallback();

    render(<TestLightbox viewTransition={false} />);
    runIdle();

    expect(loaders.zoom).toHaveBeenCalled();
    expect(loaders.morph).not.toHaveBeenCalled();
  });
});

describe('intent warm-up on Trigger', () => {
  beforeEach(() => {
    stubIdleCallback();
  });

  it('warms on hover, well before the click', () => {
    render(<TestLightbox />);

    fireEvent.pointerEnter(screen.getByTestId('trigger'));

    // Hover buys a few hundred ms over pointerdown's ~50-150ms.
    expect(loaders.zoom).toHaveBeenCalled();
    expect(loaders.morph).toHaveBeenCalled();
  });

  it('warms on focus, so keyboard users do not open on a cold chunk', () => {
    render(<TestLightbox />);

    fireEvent.focus(screen.getByTestId('trigger'));

    expect(loaders.zoom).toHaveBeenCalled();
    expect(loaders.morph).toHaveBeenCalled();
  });

  it('still warms on pointerdown', () => {
    render(<TestLightbox />);

    fireEvent.pointerDown(screen.getByTestId('trigger'));

    expect(loaders.zoom).toHaveBeenCalled();
    expect(loaders.morph).toHaveBeenCalled();
  });

  it('does not warm the morph engine when the consumer disabled view transitions', () => {
    render(<TestLightbox viewTransition={false} />);

    fireEvent.pointerEnter(screen.getByTestId('trigger'));

    expect(loaders.zoom).toHaveBeenCalled();
    expect(loaders.morph).not.toHaveBeenCalled();
  });
});

describe('scheduleWarmUp', () => {
  it('runs the task on idle', () => {
    const { runIdle } = stubIdleCallback();
    const task = vi.fn();

    scheduleWarmUp(task);
    expect(task).not.toHaveBeenCalled();
    runIdle();

    expect(task).toHaveBeenCalledOnce();
  });

  it('drops the task when cancelled before idle arrives', () => {
    const { cancelIdleCallback, runIdle } = stubIdleCallback();
    const task = vi.fn();

    scheduleWarmUp(task)();

    expect(cancelIdleCallback).toHaveBeenCalled();
    runIdle();
    expect(task).not.toHaveBeenCalled();
  });

  it('clears its fallback timer on cancel', () => {
    removeIdleCallback();
    vi.useFakeTimers();
    const task = vi.fn();

    scheduleWarmUp(task)();
    vi.advanceTimersByTime(WARM_UP_FALLBACK_DELAY_MS * 5);

    expect(task).not.toHaveBeenCalled();
  });
});
