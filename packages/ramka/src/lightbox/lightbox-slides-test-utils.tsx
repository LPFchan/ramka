import { act, fireEvent } from '@testing-library/react';
import * as React from 'react';
import { vi } from 'vitest';

import { LightboxSlide } from './lightbox-slide';
import { LightboxSlides } from './lightbox-slides';
import type { TextDirection } from './lightbox-direction';

/**
 * jsdom has no layout engine, no ResizeObserver callbacks, and no scroll
 * animation. Slides reads offsetLeft/offsetWidth/clientWidth, observes
 * resizes, and uses rAF — tests stub all three. Scroll settling is driven
 * by an explicit `scrollend`.
 */

export const SLIDE_TEST_WIDTH = 100;

/**
 * A ref object a fixture can both pass to `ref` and read `.current` from under
 * either React version. `React.RefObject<T | null>` cannot: @types/react 18
 * compares it to the `ref` prop's `RefObject<T>` by variance and rejects it,
 * while 19 needs the `| null`. A structural shape satisfies both.
 */
export type ZoomRefObject<T = unknown> = { current: T | null };

const roInstances = new Set<{ cb: ResizeObserverCallback }>();

let rafSeq = 0;
const rafCallbacks = new Map<number, FrameRequestCallback>();

/** Run one round of currently-scheduled animation frames. */
export function flushRaf() {
  const callbacks = [...rafCallbacks.entries()];
  rafCallbacks.clear();
  callbacks.forEach(([, cb]) => cb(0));
}

/**
 * Fire every live ResizeObserver, then drain the frames it schedules.
 * A real geometry change pins `activeIndex` via a double-rAF settle (and may
 * schedule `scrollToIndex` restore frames) — leave those pending and
 * `resizingRef` stays true, which would suppress later swipe→index updates.
 */
export function flushResizeObservers() {
  act(() => {
    roInstances.forEach((o) => o.cb([], o as unknown as ResizeObserver));
  });
  act(() => flushRaf());
  act(() => flushRaf());
  act(() => flushRaf());
}

/**
 * Install uniform full-viewport geometry and a writable `scrollLeft` on the
 * viewport, then trigger a re-measure so the scroller adopts it (mount measured
 * jsdom's zeroed layout).
 *
 * `offsetLeft` is measured from the scroller's padding-box left edge. An RTL
 * flex row packs slide 0 against the right edge of the client box and overflows
 * *leftward*, so with full-bleed slides slide 0 sits at 0 and slide `i` at
 * `-i * WIDTH`, with `scrollLeft` running `[-(count − 1) * WIDTH, 0]`. LTR is
 * slide `i` at `i * WIDTH` with `scrollLeft` in `[0, …]`.
 */
export function applySlideGeometry(
  viewport: HTMLElement,
  count: number,
  width = SLIDE_TEST_WIDTH,
  dir: TextDirection = 'ltr',
) {
  let scrollLeft = 0;
  Object.defineProperty(viewport, 'clientWidth', { configurable: true, get: () => width });
  Object.defineProperty(viewport, 'scrollWidth', { configurable: true, get: () => width * count });
  Object.defineProperty(viewport, 'scrollLeft', {
    configurable: true,
    get: () => scrollLeft,
    set: (v: number) => {
      scrollLeft = v;
    },
  });
  const slides = viewport.querySelectorAll<HTMLElement>('[data-ramka-slide]');
  slides.forEach((slide, i) => {
    const offsetLeft = (dir === 'rtl' ? -i : i) * width;
    Object.defineProperty(slide, 'offsetLeft', { configurable: true, get: () => offsetLeft });
    Object.defineProperty(slide, 'offsetWidth', { configurable: true, get: () => width });
  });
}

export function fireResizeObservers() {
  roInstances.forEach((o) => o.cb([], o as unknown as ResizeObserver));
}

export function setupGeometry(
  viewport: HTMLElement,
  count: number,
  width = SLIDE_TEST_WIDTH,
  dir: TextDirection = 'ltr',
) {
  applySlideGeometry(viewport, count, width, dir);
  flushResizeObservers();
}

/** Move the viewport and dispatch a scroll (as a physical swipe would). */
export function swipeTo(
  viewport: HTMLElement,
  index: number,
  width = SLIDE_TEST_WIDTH,
  dir: TextDirection = 'ltr',
) {
  act(() => {
    viewport.scrollLeft = inlineToPhysicalScroll(index * width, dir);
    fireEvent.scroll(viewport);
    flushRaf();
  });
}

/** Physical `scrollLeft` for an inline position, matching the browser's sign. */
export function inlineToPhysicalScroll(inline: number, dir: TextDirection = 'ltr'): number {
  return dir === 'rtl' ? -inline || 0 : inline;
}

/** Signal that scrolling has fully stopped (unlocks discrete navigation). */
export function endScroll(viewport: HTMLElement) {
  act(() => {
    fireEvent(viewport, new Event('scrollend'));
  });
}

export function installSlidesLayoutMocks({ raf = true }: { raf?: boolean } = {}) {
  roInstances.clear();
  rafCallbacks.clear();
  rafSeq = 0;

  vi.stubGlobal(
    'ResizeObserver',
    class {
      cb: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
        roInstances.add(this);
      }
      observe() {}
      unobserve() {}
      disconnect() {
        roInstances.delete(this);
      }
    },
  );

  if (!raf) return;

  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = ++rafSeq;
    rafCallbacks.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafCallbacks.delete(id);
  });
}

export function resetSlidesLayoutMocks() {
  vi.unstubAllGlobals();
}

/**
 * Test-only Slides host: wraps each child in a Slide and installs jsdom
 * geometry after layout so discrete navigation does not fight a zeroed scroller.
 */
export function SlidesHost({
  children,
  slideCount,
  dir = 'ltr',
  ...props
}: React.ComponentProps<typeof LightboxSlides> & {
  slideCount?: number;
  /** Lay the mocked geometry out for this direction (match Root's `dir`). */
  dir?: TextDirection;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const items = React.Children.toArray(children);
  const count = slideCount ?? items.length;

  React.useLayoutEffect(() => {
    if (ref.current) applySlideGeometry(ref.current, count, SLIDE_TEST_WIDTH, dir);
  }, [count, dir]);

  return (
    <LightboxSlides ref={ref} {...props}>
      {items.map((child, i) => (
        <LightboxSlide key={i}>{child}</LightboxSlide>
      ))}
    </LightboxSlides>
  );
}
