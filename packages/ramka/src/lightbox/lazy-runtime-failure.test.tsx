import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LightboxContent } from './lightbox-content';
import { LightboxPortal } from './lightbox-portal';
import { LightboxRoot } from './lightbox-root';
import { LightboxTrigger } from './lightbox-trigger';
import { resetVtTouchGuardForTesting } from './vt-touch-guard';

/**
 * The morph, zoom and pull engines are separate chunks, so a deploy landing
 * mid-session, an offline moment or a blocked CDN can make them unavailable
 * after the page is already interactive. This file pins what happens then:
 * the lightbox still opens, and the loader does not remember the failure.
 *
 * Isolated in its own file because a poisoned module registry and the loaders'
 * module-level caches would leak into unrelated tests.
 */

const morphChunk = vi.hoisted(() => ({ attempts: 0 }));

// Every import of the morph runtime fails, as a 404'd chunk would.
vi.mock('./lightbox-morph-runtime', () => {
  morphChunk.attempts += 1;
  throw new Error('Loading chunk lightbox-morph-runtime failed');
});

const flushMicrotasks = () => act(async () => undefined);

function TestLightbox() {
  return (
    <LightboxRoot viewTransition>
      <LightboxTrigger index={0} data-testid="trigger">
        Open
      </LightboxTrigger>
      <LightboxPortal>
        <LightboxContent data-testid="content" aria-label="Test lightbox">
          Content
        </LightboxContent>
      </LightboxPortal>
    </LightboxRoot>
  );
}

/** Present so `useVT` is true and the morph path is the one under test. */
function mockViewTransitionAPI() {
  const startViewTransition = vi.fn((callback: () => void | Promise<void>) => {
    const result = callback();
    if (result && typeof (result as Promise<void>).then === 'function') {
      (result as Promise<void>).catch(vi.fn());
    }
    return { finished: new Promise<void>(() => {}), ready: new Promise<void>(() => {}) };
  });
  Object.defineProperty(document, 'startViewTransition', {
    value: startViewTransition,
    writable: true,
    configurable: true,
  });
  return startViewTransition;
}

beforeEach(() => {
  morphChunk.attempts = 0;
  if (!Element.prototype.getAnimations) {
    Element.prototype.getAnimations = vi.fn(() => []);
  } else {
    vi.spyOn(Element.prototype, 'getAnimations').mockReturnValue([]);
  }
  // The warning is the documented signal, not noise to assert on every test.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  delete (document as unknown as Record<string, unknown>).startViewTransition;
  document.documentElement.removeAttribute('data-ramka-view-transition');
  vi.restoreAllMocks();
  resetVtTouchGuardForTesting();
});

describe('a lazy engine chunk that fails to load', () => {
  it('still opens the lightbox when the morph runtime is unavailable', async () => {
    const startViewTransition = mockViewTransitionAPI();
    render(<TestLightbox />);

    fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();

    // The commit lives on the non-view-transition path, so before the fallback
    // existed a missing chunk swallowed the open entirely — a dead click.
    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it('still closes the lightbox afterwards', async () => {
    mockViewTransitionAPI();
    render(<TestLightbox />);

    fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();
    expect(screen.getByTestId('content')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByTestId('content'), { key: 'Escape' });

    // The close path waits out consumer exit animations before unmounting.
    await waitFor(() => expect(screen.queryByTestId('content')).not.toBeInTheDocument());
  });

  it('warns once in development about the degraded open', async () => {
    mockViewTransitionAPI();
    render(<TestLightbox />);

    fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('view-transition runtime failed to load'),
      expect.any(Error),
    );
  });

  it('does not leave the failure as an unhandled rejection', async () => {
    // Vitest fails the run on unhandled rejections, so reaching the end of this
    // test is the assertion: the mount-time and pointerdown warm-ups both go
    // through prefetch*, which swallows.
    mockViewTransitionAPI();
    render(<TestLightbox />);
    fireEvent.pointerDown(screen.getByTestId('trigger'));
    await flushMicrotasks();
    await flushMicrotasks();

    expect(morphChunk.attempts).toBeGreaterThan(0);
  });
});

describe('loader memoization after a failure', () => {
  it('does not remember the rejection, so a later open can retry', async () => {
    vi.resetModules();
    const { loadMorphRuntime } = await import('./lightbox-morph-loader');

    const first = loadMorphRuntime();
    await expect(first).rejects.toThrow();
    const second = loadMorphRuntime();
    await expect(second).rejects.toThrow();

    // A memoized rejection would hand the identical promise back forever,
    // disabling the morph for the rest of the page's life. A fresh promise
    // means a fresh attempt (whether it reaches the network is the bundler's
    // call — webpack refetches, native ESM may serve the cached failure).
    expect(second).not.toBe(first);
    expect(morphChunk.attempts).toBeGreaterThan(0);
  });

  it('keeps the same behaviour for the zoom loader', async () => {
    vi.resetModules();
    vi.doMock('./lightbox-zoom-runtime', () => {
      throw new Error('Loading chunk lightbox-zoom-runtime failed');
    });
    const { loadZoomRuntime } = await import('./lightbox-zoom-loader');

    const first = loadZoomRuntime();
    await expect(first).rejects.toThrow();
    const second = loadZoomRuntime();
    await expect(second).rejects.toThrow();

    expect(second).not.toBe(first);
    vi.doUnmock('./lightbox-zoom-runtime');
  });
});
