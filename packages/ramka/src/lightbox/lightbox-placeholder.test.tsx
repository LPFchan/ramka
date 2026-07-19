import { render, fireEvent, act } from '@testing-library/react';
import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { LightboxContent } from './lightbox-content';
import { LightboxItem } from './lightbox-item';
import { LightboxItemGroup } from './lightbox-item-group';
import { LightboxRoot } from './lightbox-root';
import { LightboxTrigger } from './lightbox-trigger';

// ---------------------------------------------------------------------------
// jsdom doesn't load images. Stub complete/naturalWidth/currentSrc so tests can
// drive load state deterministically (mirrors lightbox-image.test.tsx).
// ---------------------------------------------------------------------------

let defaultComplete = false;
const savedDescriptors: Record<string, PropertyDescriptor | undefined> = {};

function installImageStubs() {
  for (const key of ['complete', 'naturalWidth', 'currentSrc'] as const) {
    savedDescriptors[key] = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, key);
  }
  Object.defineProperty(HTMLImageElement.prototype, 'complete', {
    configurable: true,
    get(this: HTMLImageElement & { __complete?: boolean }) {
      return this.__complete ?? defaultComplete;
    },
  });
  Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', {
    configurable: true,
    get(this: HTMLImageElement & { __naturalWidth?: number }) {
      return this.__naturalWidth ?? (defaultComplete ? 200 : 0);
    },
  });
  Object.defineProperty(HTMLImageElement.prototype, 'currentSrc', {
    configurable: true,
    get(this: HTMLImageElement & { __currentSrc?: string }) {
      return this.__currentSrc ?? this.getAttribute('src') ?? '';
    },
  });
}

function restoreImageStubs() {
  for (const key of ['complete', 'naturalWidth', 'currentSrc'] as const) {
    const desc = savedDescriptors[key];
    if (desc) Object.defineProperty(HTMLImageElement.prototype, key, desc);
  }
}

// Advance a few animation frames (flushing microtasks between each). Covers the
// placeholder's deferred restore, which waits on BOTH the image paint (decode()
// + two rAFs) and the open-transition settle (an rAF + a microtask).
async function flushFrames(count = 4) {
  for (let i = 0; i < count; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(() => new Promise<void>((r) => requestAnimationFrame(() => r())));
  }
}

// Fire `load`, then flush enough frames for the placeholder's gated restore to
// run: the destination image must be painted (decode + two rAFs) AND the open
// transition must have settled. Neither is synchronous with `load`.
async function simulateLoad(img: HTMLImageElement) {
  const withState = img as HTMLImageElement & { __complete?: boolean; __naturalWidth?: number };
  withState.__complete = true;
  withState.__naturalWidth = 200;
  act(() => {
    fireEvent.load(img);
  });
  await flushFrames();
}

beforeEach(() => {
  defaultComplete = false;
  installImageStubs();

  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }
  if (!Element.prototype.getAnimations) {
    Element.prototype.getAnimations = vi.fn(() => []);
  } else {
    vi.spyOn(Element.prototype, 'getAnimations').mockReturnValue([]);
  }
});

// Controllable View Transition: the open morph stays pending until
// `resolveFinished()` is called, so we can assert the placeholder gate.
function mockViewTransitionAPI() {
  let resolveFinished!: () => void;
  const finishedPromise = new Promise<void>((r) => {
    resolveFinished = r;
  });
  const startViewTransition = vi.fn((callback: () => void | Promise<void>) => {
    const result = callback();
    if (result && typeof (result as Promise<void>).then === 'function') {
      (result as Promise<void>).catch(vi.fn());
    }
    return { finished: finishedPromise };
  });
  Object.defineProperty(document, 'startViewTransition', {
    value: startViewTransition,
    writable: true,
    configurable: true,
  });
  return { startViewTransition, resolveFinished: () => resolveFinished() };
}

function cleanupViewTransitionAPI() {
  delete (document as unknown as Record<string, unknown>).startViewTransition;
  document.documentElement.removeAttribute('data-lightbox-view-transition');
}

afterEach(() => {
  restoreImageStubs();
  cleanupViewTransitionAPI();
  vi.restoreAllMocks();
});

function itemImg(): HTMLImageElement {
  const el = document.querySelector<HTMLImageElement>('[data-lightbox-item] img');
  if (!el) throw new Error('item image not found');
  return el;
}

function clickTrigger(testid: string) {
  fireEvent.click(document.querySelector(`[data-testid="${testid}"]`)!);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('render-fn placeholder wiring (triggerImageRef -> imageRef)', () => {
  it('paints the trigger image as the destination background and clears it on load', async () => {
    render(
      <LightboxRoot>
        <LightboxTrigger index={0} data-testid="trigger">
          {({ triggerImageRef }) => <img ref={triggerImageRef} src="/thumb.jpg" alt="thumb" />}
        </LightboxTrigger>
        <LightboxContent aria-label="viewer">
          <LightboxItemGroup>
            <LightboxItem index={0}>
              {({ imageRef }) => (
                <img ref={imageRef} src="/full.jpg" alt="full" className="object-contain" />
              )}
            </LightboxItem>
          </LightboxItemGroup>
        </LightboxContent>
      </LightboxRoot>,
    );

    clickTrigger('trigger');

    const img = itemImg();
    expect(img.style.backgroundImage).toContain('/thumb.jpg');

    await simulateLoad(img);
    expect(img.style.backgroundImage).toBe('');
  });

  it('defers clearing the placeholder until after the image paints (Safari flash fix)', async () => {
    render(
      <LightboxRoot>
        <LightboxTrigger index={0} data-testid="trigger">
          {({ triggerImageRef }) => <img ref={triggerImageRef} src="/thumb.jpg" alt="thumb" />}
        </LightboxTrigger>
        <LightboxContent aria-label="viewer">
          <LightboxItemGroup>
            <LightboxItem index={0}>
              {({ imageRef }) => <img ref={imageRef} src="/full.jpg" alt="full" />}
            </LightboxItem>
          </LightboxItemGroup>
        </LightboxContent>
      </LightboxRoot>,
    );

    clickTrigger('trigger');
    const img = itemImg();
    expect(img.style.backgroundImage).toContain('/thumb.jpg');

    // Fire `load` WITHOUT flushing the deferred frames. The placeholder must
    // still be painted — clearing it here (before the full-res <img> composites)
    // is exactly the mobile-Safari blank-flash regression this guards against.
    const withState = img as HTMLImageElement & { __complete?: boolean; __naturalWidth?: number };
    withState.__complete = true;
    withState.__naturalWidth = 200;
    act(() => {
      fireEvent.load(img);
    });
    expect(img.style.backgroundImage).toContain('/thumb.jpg');

    // Once the deferred decode + animation frames run, the placeholder clears.
    await simulateLoad(img);
    expect(img.style.backgroundImage).toBe('');
  });

  it('holds the placeholder until the open transition finishes, even after the image paints', async () => {
    const { resolveFinished } = mockViewTransitionAPI();

    render(
      <LightboxRoot viewTransition>
        <LightboxTrigger index={0} data-testid="trigger">
          {({ triggerImageRef }) => <img ref={triggerImageRef} src="/thumb.jpg" alt="thumb" />}
        </LightboxTrigger>
        <LightboxContent aria-label="viewer">
          <LightboxItemGroup>
            <LightboxItem index={0}>
              {({ imageRef }) => <img ref={imageRef} src="/full.jpg" alt="full" />}
            </LightboxItem>
          </LightboxItemGroup>
        </LightboxContent>
      </LightboxRoot>,
    );

    clickTrigger('trigger');
    const img = itemImg();
    expect(img.style.backgroundImage).toContain('/thumb.jpg');

    // The full-res image loads AND paints while the open morph is still running.
    // The placeholder must stay — pulling it mid-transition flashes on Safari.
    const withState = img as HTMLImageElement & { __complete?: boolean; __naturalWidth?: number };
    withState.__complete = true;
    withState.__naturalWidth = 200;
    act(() => {
      fireEvent.load(img);
    });
    await flushFrames();
    expect(img.style.backgroundImage).toContain('/thumb.jpg');

    // Only once the open transition finishes does the placeholder clear.
    await act(async () => resolveFinished());
    expect(img.style.backgroundImage).toBe('');
  });

  it('does nothing when the destination image is already loaded (cache hit)', () => {
    defaultComplete = true;

    render(
      <LightboxRoot>
        <LightboxTrigger index={0} data-testid="trigger">
          {({ triggerImageRef }) => <img ref={triggerImageRef} src="/thumb.jpg" alt="thumb" />}
        </LightboxTrigger>
        <LightboxContent aria-label="viewer">
          <LightboxItemGroup>
            <LightboxItem index={0}>
              {({ imageRef }) => <img ref={imageRef} src="/full.jpg" alt="full" />}
            </LightboxItem>
          </LightboxItemGroup>
        </LightboxContent>
      </LightboxRoot>,
    );

    clickTrigger('trigger');
    expect(itemImg().style.backgroundImage).toBe('');
  });

  it('sources the placeholder only from triggerImageRef, excluding a +N overlay', () => {
    render(
      <LightboxRoot>
        <LightboxTrigger index={0} data-testid="trigger">
          {({ triggerImageRef }) => (
            <div className="relative">
              <img ref={triggerImageRef} src="/thumb.jpg" alt="thumb" />
              <div className="absolute inset-0">+3</div>
            </div>
          )}
        </LightboxTrigger>
        <LightboxContent aria-label="viewer">
          <LightboxItemGroup>
            <LightboxItem index={0}>
              {({ imageRef }) => <img ref={imageRef} src="/full.jpg" alt="full" />}
            </LightboxItem>
          </LightboxItemGroup>
        </LightboxContent>
      </LightboxRoot>,
    );

    clickTrigger('trigger');
    expect(itemImg().style.backgroundImage).toContain('/thumb.jpg');
  });

  it('uses the CLICKED trigger image when two triggers share an index', () => {
    render(
      <LightboxRoot>
        <LightboxTrigger index={0} data-testid="trigger-a">
          {({ triggerImageRef }) => <img ref={triggerImageRef} src="/a.jpg" alt="a" />}
        </LightboxTrigger>
        <LightboxTrigger index={0} data-testid="trigger-b">
          {({ triggerImageRef }) => <img ref={triggerImageRef} src="/b.jpg" alt="b" />}
        </LightboxTrigger>
        <LightboxContent aria-label="viewer">
          <LightboxItemGroup>
            <LightboxItem index={0}>
              {({ imageRef }) => <img ref={imageRef} src="/full.jpg" alt="full" />}
            </LightboxItem>
          </LightboxItemGroup>
        </LightboxContent>
      </LightboxRoot>,
    );

    // Click the FIRST trigger even though the index-keyed map holds the second.
    clickTrigger('trigger-a');

    const bg = itemImg().style.backgroundImage;
    expect(bg).toContain('/a.jpg');
    expect(bg).not.toContain('/b.jpg');
  });

  it('morphElementRef: both the trigger and the item register without touching consumer DOM', () => {
    render(
      <LightboxRoot>
        <LightboxTrigger index={0} data-testid="trigger">
          {({ triggerImageRef, morphElementRef }) => (
            <div ref={morphElementRef} data-testid="trigger-morph">
              <img ref={triggerImageRef} src="/thumb.jpg" alt="thumb" />
            </div>
          )}
        </LightboxTrigger>
        <LightboxContent aria-label="viewer">
          <LightboxItemGroup>
            <LightboxItem index={0}>
              {({ imageRef, morphElementRef }) => (
                <div ref={morphElementRef} data-testid="item-morph">
                  <img ref={imageRef} src="/full.jpg" alt="full" />
                </div>
              )}
            </LightboxItem>
          </LightboxItemGroup>
        </LightboxContent>
      </LightboxRoot>,
    );

    clickTrigger('trigger');

    // Both sides are registry-based now — neither pollutes consumer DOM with a
    // marker attribute.
    expect(document.querySelector('[data-testid="trigger-morph"]')).not.toHaveAttribute(
      'data-lightbox-morph',
    );
    expect(document.querySelector('[data-testid="item-morph"]')).not.toHaveAttribute(
      'data-lightbox-morph',
    );
  });

  it('warns in dev when a trigger has no triggerImageRef and the item image is unloaded', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <LightboxRoot>
        {/* plain children: no triggerImageRef attached */}
        <LightboxTrigger index={0} data-testid="trigger">
          <img src="/thumb.jpg" alt="thumb" />
        </LightboxTrigger>
        <LightboxContent aria-label="viewer">
          <LightboxItemGroup>
            <LightboxItem index={0}>
              {({ imageRef }) => <img ref={imageRef} src="/full.jpg" alt="full" />}
            </LightboxItem>
          </LightboxItemGroup>
        </LightboxContent>
      </LightboxRoot>,
    );

    clickTrigger('trigger');

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('index=0'));
  });
});
