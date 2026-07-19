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

async function simulateLoad(img: HTMLImageElement) {
  const withState = img as HTMLImageElement & { __complete?: boolean; __naturalWidth?: number };
  withState.__complete = true;
  withState.__naturalWidth = 200;
  // The placeholder is intentionally NOT cleared synchronously on `load`: it's
  // deferred behind decode() + two animation frames so mobile Safari has
  // composited the full-res <img> before we pull the background out from under
  // it. Run those rAFs synchronously here so the cleared state is observable.
  const raf = vi
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  await act(async () => {
    fireEvent.load(img);
    // Flush the decode().then microtask (when decode exists in the env).
    await Promise.resolve();
    await Promise.resolve();
  });
  raf.mockRestore();
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

afterEach(() => {
  restoreImageStubs();
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
