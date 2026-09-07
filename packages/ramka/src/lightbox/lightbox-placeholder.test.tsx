import { render, fireEvent, act } from '@testing-library/react';
import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { LightboxContent } from './lightbox-content';
import { LightboxPortal } from './lightbox-portal';
import { LightboxItem } from './lightbox-item';
import { LightboxMedia } from './lightbox-media';
import { SlidesHost } from './lightbox-slides-test-utils';
import { stubConstructedSheets } from './lightbox-style-sheets-test-utils';
import { LightboxRoot } from './lightbox-root';
import { LightboxTrigger } from './lightbox-trigger';
import { LightboxZoom } from './lightbox-zoom';

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
  document.documentElement.removeAttribute('data-ramka-view-transition');
}

afterEach(() => {
  restoreImageStubs();
  cleanupViewTransitionAPI();
  vi.restoreAllMocks();
});

function itemImg(): HTMLImageElement {
  const el = document.querySelector<HTMLImageElement>('[data-ramka-item] img');
  if (!el) throw new Error('item image not found');
  return el;
}

function clickTrigger(testid: string) {
  fireEvent.click(document.querySelector(`[data-testid="${testid}"]`)!);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('render-fn placeholder wiring (Trigger imageRef -> Item imageRef)', () => {
  it('paints the trigger image as the destination background and clears it on load', async () => {
    render(
      <LightboxRoot>
        <LightboxTrigger index={0} data-testid="trigger">
          {({ imageRef }) => <img ref={imageRef} src="/thumb.jpg" alt="thumb" />}
        </LightboxTrigger>
        <LightboxPortal>
          <LightboxContent aria-label="viewer">
            <SlidesHost>
              <LightboxItem index={0}>
                {({ imageRef }) => <img ref={imageRef} src="/full.jpg" alt="full" className="object-contain" />}
              </LightboxItem>
            </SlidesHost>
          </LightboxContent>
        </LightboxPortal>
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
          {({ imageRef }) => <img ref={imageRef} src="/thumb.jpg" alt="thumb" />}
        </LightboxTrigger>
        <LightboxPortal>
          <LightboxContent aria-label="viewer">
            <SlidesHost>
              <LightboxItem index={0}>
                {({ imageRef }) => <img ref={imageRef} src="/full.jpg" alt="full" />}
              </LightboxItem>
            </SlidesHost>
          </LightboxContent>
        </LightboxPortal>
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
    const { loadMorphRuntime } = await import('./lightbox-morph-loader');
    await loadMorphRuntime();
    const { resolveFinished } = mockViewTransitionAPI();

    render(
      <LightboxRoot viewTransition>
        <LightboxTrigger index={0} data-testid="trigger">
          {({ imageRef }) => <img ref={imageRef} src="/thumb.jpg" alt="thumb" />}
        </LightboxTrigger>
        <LightboxPortal>
          <LightboxContent aria-label="viewer">
            <SlidesHost>
              <LightboxItem index={0}>
                {({ imageRef }) => <img ref={imageRef} src="/full.jpg" alt="full" />}
              </LightboxItem>
            </SlidesHost>
          </LightboxContent>
        </LightboxPortal>
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

  it('paints the matching trigger when navigating past the preload window', () => {
    function Harness() {
      const [value, setValue] = React.useState(0);
      return (
        <LightboxRoot value={value} onValueChange={setValue}>
          <LightboxTrigger index={0} data-testid="trigger-0">
            {({ imageRef }) => <img ref={imageRef} src="/thumb-0.jpg" alt="0" />}
          </LightboxTrigger>
          <LightboxTrigger index={1} data-testid="trigger-1">
            {({ imageRef }) => <img ref={imageRef} src="/thumb-1.jpg" alt="1" />}
          </LightboxTrigger>
          <LightboxTrigger index={2} data-testid="trigger-2">
            {({ imageRef }) => <img ref={imageRef} src="/thumb-2.jpg" alt="2" />}
          </LightboxTrigger>
          <button type="button" data-testid="jump" onClick={() => setValue(2)}>
            jump
          </button>
          <LightboxPortal>
            <LightboxContent aria-label="viewer">
              <SlidesHost preload={0}>
                <LightboxItem index={0}>
                  {({ imageRef }) => <img ref={imageRef} src="/full-0.jpg" alt="0" />}
                </LightboxItem>
                <LightboxItem index={1}>
                  {({ imageRef }) => <img ref={imageRef} src="/full-1.jpg" alt="1" />}
                </LightboxItem>
                <LightboxItem index={2}>
                  {({ imageRef }) => <img ref={imageRef} src="/full-2.jpg" alt="2" />}
                </LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>
      );
    }

    render(<Harness />);
    clickTrigger('trigger-0');
    expect(itemImg().style.backgroundImage).toContain('/thumb-0.jpg');

    fireEvent.click(document.querySelector('[data-testid="jump"]')!);

    const jumped = itemImg();
    expect(jumped.getAttribute('src')).toBe('/full-2.jpg');
    expect(jumped.style.backgroundImage).toContain('/thumb-2.jpg');
    expect(jumped.style.backgroundImage).not.toContain('/thumb-0.jpg');
  });

  it('does nothing when the destination image is already loaded (cache hit)', () => {
    defaultComplete = true;

    render(
      <LightboxRoot>
        <LightboxTrigger index={0} data-testid="trigger">
          {({ imageRef }) => <img ref={imageRef} src="/thumb.jpg" alt="thumb" />}
        </LightboxTrigger>
        <LightboxPortal>
          <LightboxContent aria-label="viewer">
            <SlidesHost>
              <LightboxItem index={0}>
                {({ imageRef }) => <img ref={imageRef} src="/full.jpg" alt="full" />}
              </LightboxItem>
            </SlidesHost>
          </LightboxContent>
        </LightboxPortal>
      </LightboxRoot>,
    );

    clickTrigger('trigger');
    expect(itemImg().style.backgroundImage).toBe('');
  });

  it('sources the placeholder only from Trigger imageRef, excluding a +N overlay', () => {
    render(
      <LightboxRoot>
        <LightboxTrigger index={0} data-testid="trigger">
          {({ imageRef }) => (
            <div className="relative">
              <img ref={imageRef} src="/thumb.jpg" alt="thumb" />
              <div className="absolute inset-0">+3</div>
            </div>
          )}
        </LightboxTrigger>
        <LightboxPortal>
          <LightboxContent aria-label="viewer">
            <SlidesHost>
              <LightboxItem index={0}>
                {({ imageRef }) => <img ref={imageRef} src="/full.jpg" alt="full" />}
              </LightboxItem>
            </SlidesHost>
          </LightboxContent>
        </LightboxPortal>
      </LightboxRoot>,
    );

    clickTrigger('trigger');
    expect(itemImg().style.backgroundImage).toContain('/thumb.jpg');
  });

  it('uses the CLICKED trigger image when two triggers share an index', () => {
    render(
      <LightboxRoot>
        <LightboxTrigger index={0} data-testid="trigger-a">
          {({ imageRef }) => <img ref={imageRef} src="/a.jpg" alt="a" />}
        </LightboxTrigger>
        <LightboxTrigger index={0} data-testid="trigger-b">
          {({ imageRef }) => <img ref={imageRef} src="/b.jpg" alt="b" />}
        </LightboxTrigger>
        <LightboxPortal>
          <LightboxContent aria-label="viewer">
            <SlidesHost>
              <LightboxItem index={0}>
                {({ imageRef }) => <img ref={imageRef} src="/full.jpg" alt="full" />}
              </LightboxItem>
            </SlidesHost>
          </LightboxContent>
        </LightboxPortal>
      </LightboxRoot>,
    );

    // Click the FIRST trigger even though the index-keyed map holds the second.
    clickTrigger('trigger-a');

    const bg = itemImg().style.backgroundImage;
    expect(bg).toContain('/a.jpg');
    expect(bg).not.toContain('/b.jpg');
  });

  it('morphRef: both the trigger and the item register without touching consumer DOM', () => {
    render(
      <LightboxRoot>
        <LightboxTrigger index={0} data-testid="trigger">
          {({ imageRef, morphRef }) => (
            <div ref={morphRef} data-testid="trigger-morph">
              <img ref={imageRef} src="/thumb.jpg" alt="thumb" />
            </div>
          )}
        </LightboxTrigger>
        <LightboxPortal>
          <LightboxContent aria-label="viewer">
            <SlidesHost>
              <LightboxItem index={0}>
                {({ imageRef, morphRef }) => (
                  <div ref={morphRef} data-testid="item-morph">
                    <img ref={imageRef} src="/full.jpg" alt="full" />
                  </div>
                )}
              </LightboxItem>
            </SlidesHost>
          </LightboxContent>
        </LightboxPortal>
      </LightboxRoot>,
    );

    clickTrigger('trigger');

    // Both sides are registry-based now — neither pollutes consumer DOM with a
    // marker attribute.
    expect(document.querySelector('[data-testid="trigger-morph"]')).not.toHaveAttribute('data-ramka-morph');
    expect(document.querySelector('[data-testid="item-morph"]')).not.toHaveAttribute('data-ramka-morph');
  });

  it('warns in dev when a Trigger has no imageRef and the item image is unloaded', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <LightboxRoot>
        {/* plain children: no imageRef attached */}
        <LightboxTrigger index={0} data-testid="trigger">
          <img src="/thumb.jpg" alt="thumb" />
        </LightboxTrigger>
        <LightboxPortal>
          <LightboxContent aria-label="viewer">
            <SlidesHost>
              <LightboxItem index={0}>
                {({ imageRef }) => <img ref={imageRef} src="/full.jpg" alt="full" />}
              </LightboxItem>
            </SlidesHost>
          </LightboxContent>
        </LightboxPortal>
      </LightboxRoot>,
    );

    clickTrigger('trigger');

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('index=0'));
  });
});

describe('Lightbox.Media (morph + placeholder host)', () => {
  function stubBox(size = 400) {
    const w = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    const h = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => size,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => size,
    });
    return () => {
      if (w) Object.defineProperty(HTMLElement.prototype, 'clientWidth', w);
      if (h) Object.defineProperty(HTMLElement.prototype, 'clientHeight', h);
    };
  }

  it('auto-discovers img and paints placeholder without Item imageRef', () => {
    render(
      <LightboxRoot>
        <LightboxTrigger index={0} data-testid="trigger">
          {({ imageRef }) => <img ref={imageRef} src="/thumb.jpg" alt="thumb" />}
        </LightboxTrigger>
        <LightboxPortal>
          <LightboxContent aria-label="viewer">
            <SlidesHost>
              <LightboxItem index={0}>
                <LightboxZoom>
                  <LightboxMedia data-testid="media" style={{ width: 400, height: 300 }}>
                    <img src="/full.jpg" alt="full" />
                  </LightboxMedia>
                </LightboxZoom>
              </LightboxItem>
            </SlidesHost>
          </LightboxContent>
        </LightboxPortal>
      </LightboxRoot>,
    );

    clickTrigger('trigger');
    expect(itemImg().style.backgroundImage).toContain('/thumb.jpg');
  });

  it('places canvas placeholder inside Media when canvas path is available', async () => {
    const restoreBox = stubBox(400);
    Object.defineProperty(HTMLImageElement.prototype, 'naturalHeight', {
      configurable: true,
      get(this: HTMLImageElement & { __naturalHeight?: number }) {
        return this.__naturalHeight ?? (this.complete ? 200 : 0);
      },
    });
    // jsdom has no 2D canvas — stub enough for tryPaintCanvasPlaceholder.
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      scale: vi.fn(),
      drawImage: vi.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    render(
      <LightboxRoot>
        <LightboxTrigger index={0} data-testid="trigger">
          {({ imageRef }) => <img ref={imageRef} src="/thumb.jpg" alt="thumb" />}
        </LightboxTrigger>
        <LightboxPortal>
          <LightboxContent aria-label="viewer">
            <SlidesHost>
              <LightboxItem index={0}>
                <LightboxZoom data-testid="zoom">
                  <LightboxMedia data-testid="media">
                    <img src="/full.jpg" alt="full" />
                  </LightboxMedia>
                </LightboxZoom>
              </LightboxItem>
            </SlidesHost>
          </LightboxContent>
        </LightboxPortal>
      </LightboxRoot>,
    );

    const triggerImg = document.querySelector('[data-testid="trigger"] img') as HTMLImageElement & {
      __complete?: boolean;
      __naturalWidth?: number;
      __naturalHeight?: number;
    };
    triggerImg.__complete = true;
    triggerImg.__naturalWidth = 200;
    triggerImg.__naturalHeight = 200;

    clickTrigger('trigger');

    const media = document.querySelector('[data-testid="media"]')!;
    const canvas = media.querySelector('[data-ramka-placeholder]');
    expect(canvas).toBeTruthy();
    // Canvas must not live on Zoom's transform wrapper (Media's parent under Zoom).
    expect(canvas!.parentElement).toBe(media);

    // data-placeholder flips when Item notifies Media after inserting the canvas.
    await act(async () => undefined);
    expect(media).toHaveAttribute('data-placeholder');
    // Notify re-renders Media; isolation must survive that style reconcile or
    // the z-index:-1 canvas vanishes before the destination image paints.
    expect(media).toHaveStyle({ isolation: 'isolate' });

    HTMLCanvasElement.prototype.getContext = origGetContext;
    restoreBox();
  });

  it('imageRef without Media/morphRef falls back to CSS background (no parent-retarget canvas)', () => {
    render(
      <LightboxRoot>
        <LightboxTrigger index={0} data-testid="trigger">
          {({ imageRef }) => <img ref={imageRef} src="/thumb.jpg" alt="thumb" />}
        </LightboxTrigger>
        <LightboxPortal>
          <LightboxContent aria-label="viewer">
            <SlidesHost>
              <LightboxItem index={0}>
                {({ imageRef }) => (
                  <div data-testid="diy-host">
                    <img ref={imageRef} src="/full.jpg" alt="full" />
                  </div>
                )}
              </LightboxItem>
            </SlidesHost>
          </LightboxContent>
        </LightboxPortal>
      </LightboxRoot>,
    );

    clickTrigger('trigger');
    // No canvas mounted into a mystery parent — only CSS background on the img.
    expect(document.querySelector('[data-ramka-placeholder]')).toBeNull();
    expect(document.querySelector('[data-testid="diy-host"]')!.children).toHaveLength(1);
    expect(itemImg().style.backgroundImage).toContain('/thumb.jpg');
  });

  it('width/height apply a structural fit-box', () => {
    render(
      <LightboxRoot defaultOpen>
        <LightboxPortal>
          <LightboxContent aria-label="viewer">
            <SlidesHost>
              <LightboxItem index={0}>
                <LightboxZoom>
                  <LightboxMedia data-testid="media" width={1600} height={900}>
                    <img width={1600} height={900} src="/full.jpg" alt="full" />
                  </LightboxMedia>
                </LightboxZoom>
              </LightboxItem>
            </SlidesHost>
          </LightboxContent>
        </LightboxPortal>
      </LightboxRoot>,
    );

    const media = document.querySelector('[data-testid="media"]') as HTMLElement;
    expect(media).toHaveAttribute('data-width', '1600');
    expect(media).toHaveAttribute('data-height', '900');
    expect(media.style.aspectRatio).toBe('1600 / 900');
    expect(media.style.width).toContain('100cqw');
    expect(media.style.display).toBe('grid');
    expect(media.id).toBeTruthy();
  });

  it.each([
    {
      name: 'img',
      child: <img width={800} height={600} src="/full.jpg" alt="full" />,
    },
    {
      name: 'video',
      child: <video width={800} height={600} src="/clip.mp4" />,
    },
    {
      name: 'canvas',
      child: <canvas width={800} height={600} />,
    },
  ] as const)('scoped style stretches a direct $name child to fill the Media host', ({ name, child }) => {
    render(
      <LightboxRoot defaultOpen>
        <LightboxPortal>
          <LightboxContent aria-label="viewer">
            <SlidesHost>
              <LightboxItem index={0}>
                <LightboxZoom>
                  <LightboxMedia data-testid="media" width={800} height={600}>
                    {child}
                  </LightboxMedia>
                </LightboxZoom>
              </LightboxItem>
            </SlidesHost>
          </LightboxContent>
        </LightboxPortal>
      </LightboxRoot>,
    );

    const media = document.querySelector('[data-testid="media"]') as HTMLElement;
    expect(media.style.display).toBe('grid');
    expect(media.id).toBeTruthy();

    // The CSSOM copy is delivered as a sheet rather than a <style> child, so a
    // strict `style-src` cannot refuse it (the hoistable <style> in <head> is
    // the server-paint path — see lightbox-media.test.tsx). jsdom has no CSSOM
    // sheets, so the marker fallback lands in <head>.
    expect(media.querySelector('style')).toBeNull();
    const fillStyle = document.head.querySelector('style[data-ramka-media-fill]');
    expect(fillStyle).toBeTruthy();
    const css = fillStyle!.textContent ?? '';

    // One author rule stretches every direct media child (img / video / canvas).
    // `:not(#_)` buys id-level specificity with constant rule text (constant so
    // the hoistable copy can dedupe by href across instances and remounts).
    const host = '[data-ramka-media]:not(#_)';
    expect(css).toBe(
      `${host} > img:not([data-ramka-media-poster]),${host} > video,${host} > canvas{width:100%;height:100%;min-width:0;min-height:0;}`,
    );

    // Child is a direct Media descendant so the `> ${tag}` rule applies.
    // Walked rather than queried: React 18 ids contain `:`, which jsdom's
    // selector engine mangles when it expands `:scope`.
    const el = Array.from(media.children).find((node) => node.tagName.toLowerCase() === name);
    expect(el).toBeTruthy();
    expect(el!.parentElement).toBe(media);
  });

  it('adopts the fill rules in a browser once per document, and keeps them after unmount', () => {
    // Earlier tests in this file run without constructed sheets, so Media's
    // once-only fallback <style> is already in <head> (and by design never
    // removed). Drop it so the CSP assertion below sees only this render.
    document.head
      .querySelectorAll('style[data-ramka-media-fill]')
      .forEach((el) => el.remove());
    const stub = stubConstructedSheets();
    try {
      const view = render(
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent aria-label="viewer">
              <SlidesHost>
                <LightboxItem index={0}>
                  <LightboxMedia data-testid="media" width={800} height={600}>
                    <img width={800} height={600} src="/full.jpg" alt="full" />
                  </LightboxMedia>
                </LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );

      const media = document.querySelector('[data-testid="media"]') as HTMLElement;
      expect(media.querySelector('style')).toBeNull();
      expect(document.querySelectorAll('style[data-ramka-media-fill]')).toHaveLength(0);
      const fillRule = '[data-ramka-media]:not(#_) > img';
      expect(stub.adoptedCss().join('')).toContain(fillRule);
      const sheetCountWhileMounted = document.adoptedStyleSheets.length;

      view.unmount();

      // Never released: the CSS is static and attribute-scoped (inert without
      // a mounted Media), while adopting/releasing a sheet per Media mount is
      // a full-document restyle in WebKit.
      expect(stub.adoptedCss().join('')).toContain(fillRule);
      expect(document.adoptedStyleSheets.length).toBe(sheetCountWhileMounted);
    } finally {
      stub.restore();
    }
  });

  it('derives fit-box from child img width/height when Media props are omitted', () => {
    render(
      <LightboxRoot defaultOpen>
        <LightboxPortal>
          <LightboxContent aria-label="viewer">
            <SlidesHost>
              <LightboxItem index={0}>
                <LightboxMedia data-testid="media">
                  <img width={800} height={400} src="/full.jpg" alt="full" />
                </LightboxMedia>
              </LightboxItem>
            </SlidesHost>
          </LightboxContent>
        </LightboxPortal>
      </LightboxRoot>,
    );

    const media = document.querySelector('[data-testid="media"]') as HTMLElement;
    expect(media).toHaveAttribute('data-width', '800');
    expect(media).toHaveAttribute('data-height', '400');
    expect(media.style.aspectRatio).toBe('800 / 400');
  });

  it('video + poster: Media synthesizes a poster img for the placeholder bridge', () => {
    render(
      <LightboxRoot>
        <LightboxTrigger index={0} data-testid="trigger">
          {({ imageRef }) => <img ref={imageRef} src="/thumb.jpg" alt="thumb" />}
        </LightboxTrigger>
        <LightboxPortal>
          <LightboxContent aria-label="viewer">
            <SlidesHost>
              <LightboxItem index={0}>
                <LightboxMedia data-testid="media">
                  <video src="/clip.mp4" poster="/poster.jpg" />
                </LightboxMedia>
              </LightboxItem>
            </SlidesHost>
          </LightboxContent>
        </LightboxPortal>
      </LightboxRoot>,
    );

    clickTrigger('trigger');

    const poster = document.querySelector('[data-ramka-media-poster]') as HTMLImageElement | null;
    expect(poster).toBeTruthy();
    expect(poster!.getAttribute('src')).toBe('/poster.jpg');
    expect(poster!.style.backgroundImage).toContain('/thumb.jpg');
  });
});
