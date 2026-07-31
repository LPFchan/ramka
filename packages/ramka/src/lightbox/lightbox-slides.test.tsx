import { render, screen, fireEvent, act } from '@testing-library/react';
import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { LightboxContent } from './lightbox-content';
import { LightboxPortal } from './lightbox-portal';
import { LightboxItem } from './lightbox-item';
import { LightboxRoot } from './lightbox-root';
import { LightboxSlide } from './lightbox-slide';
import { LightboxSlides } from './lightbox-slides';
import { LightboxThumbnail } from './lightbox-thumbnail';
import { LightboxThumbnailGroup } from './lightbox-thumbnail-group';
import { LightboxTrigger } from './lightbox-trigger';
import { LightboxZoom, type LightboxZoomRef } from './lightbox-zoom';
import { LightboxZoomIn } from './lightbox-zoom-in';

// ---------------------------------------------------------------------------
// jsdom has no layout engine, no ResizeObserver, and no scroll animation. The
// scroller reads offsetLeft/offsetWidth/clientWidth, observes resizes, and uses
// rAF, so we stub all three and make rAF a manually-drained queue. Scroll
// settling is driven by the `scrollend` event (fired explicitly in tests).
// ---------------------------------------------------------------------------

const WIDTH = 100;

const roInstances = new Set<{ cb: ResizeObserverCallback }>();

let rafSeq = 0;
const rafCallbacks = new Map<number, FrameRequestCallback>();

/** Run one round of currently-scheduled animation frames. */
function flushRaf() {
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
function flushResizeObservers() {
  act(() => {
    roInstances.forEach((o) => o.cb([], o as unknown as ResizeObserver));
  });
  act(() => flushRaf());
  act(() => flushRaf());
  act(() => flushRaf());
}

/**
 * Install uniform full-viewport geometry (slide i at offsetLeft `i*WIDTH`) and a
 * writable `scrollLeft` on the viewport, then trigger a re-measure so the
 * scroller adopts it (mount measured jsdom's zeroed layout).
 */
function setupGeometry(viewport: HTMLElement, count: number) {
  let scrollLeft = 0;
  Object.defineProperty(viewport, 'clientWidth', { configurable: true, get: () => WIDTH });
  Object.defineProperty(viewport, 'scrollWidth', { configurable: true, get: () => WIDTH * count });
  Object.defineProperty(viewport, 'scrollLeft', {
    configurable: true,
    get: () => scrollLeft,
    set: (v: number) => {
      scrollLeft = v;
    },
  });
  const slides = viewport.querySelectorAll<HTMLElement>('[data-ramka-slide]');
  slides.forEach((slide, i) => {
    Object.defineProperty(slide, 'offsetLeft', { configurable: true, get: () => i * WIDTH });
    Object.defineProperty(slide, 'offsetWidth', { configurable: true, get: () => WIDTH });
  });
  flushResizeObservers();
}

/** Move the viewport and dispatch a scroll (as a physical swipe would). */
function swipeTo(viewport: HTMLElement, index: number) {
  act(() => {
    viewport.scrollLeft = index * WIDTH;
    fireEvent.scroll(viewport);
    flushRaf();
  });
}

/** Signal that scrolling has fully stopped (unlocks discrete navigation). */
function endScroll(viewport: HTMLElement) {
  act(() => {
    fireEvent(viewport, new Event('scrollend'));
  });
}

beforeEach(() => {
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

  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = ++rafSeq;
    rafCallbacks.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafCallbacks.delete(id);
  });

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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function SlidesLightbox({
  itemCount = 8,
  defaultValue = 0,
  loop = false,
  onValueChange,
}: {
  itemCount?: number;
  defaultValue?: number;
  loop?: boolean;
  onValueChange?: (value: number, metadata: { source: string }) => void;
} = {}) {
  return (
    <LightboxRoot defaultOpen defaultValue={defaultValue} loop={loop} onValueChange={onValueChange}>
      {Array.from({ length: itemCount }, (_, i) => (
        <LightboxTrigger key={`t-${i}`} index={i} data-testid={`trigger-${i}`}>
          Trigger {i}
        </LightboxTrigger>
      ))}

      <LightboxPortal>
        <LightboxContent data-testid="content" aria-label="Slides lightbox">
          <LightboxSlides data-testid="slides" preload={itemCount}>
            {Array.from({ length: itemCount }, (_, i) => (
              <LightboxSlide key={`s-${i}`} data-testid={`slide-${i}`}>
                <LightboxItem index={i} data-testid={`item-${i}`}>
                  Item {i}
                </LightboxItem>
              </LightboxSlide>
            ))}
          </LightboxSlides>

          <LightboxThumbnailGroup data-testid="thumb-group">
            {Array.from({ length: itemCount }, (_, i) => (
              <LightboxThumbnail key={`th-${i}`} index={i} data-testid={`thumb-${i}`}>
                Thumb {i}
              </LightboxThumbnail>
            ))}
          </LightboxThumbnailGroup>
        </LightboxContent>
      </LightboxPortal>
    </LightboxRoot>
  );
}

function activeThumb(): number {
  const active = document.querySelector('[role="tab"][data-active]');
  return active ? Number(active.getAttribute('data-index')) : -1;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Lightbox.Slides', () => {
  it('renders slide boxes with the snap contract and marks the viewport as a horizontal group', () => {
    render(<SlidesLightbox />);
    const viewport = screen.getByTestId('slides');
    expect(viewport).toHaveAttribute('role', 'group');
    expect(viewport).toHaveAttribute('data-orientation', 'horizontal');

    const slide = screen.getByTestId('slide-0');
    expect(slide).toHaveAttribute('data-ramka-slide');
    expect(slide.style.scrollSnapAlign).toBe('center');
    expect(slide.style.scrollSnapStop).toBe('always');
  });

  it('positions the viewport at the initial active index', () => {
    render(<SlidesLightbox defaultValue={3} />);
    const viewport = screen.getByTestId('slides');
    setupGeometry(viewport, 8);
    expect(viewport.scrollLeft).toBe(3 * WIDTH);
  });

  it('opts the slides viewport out of CSS scroll anchoring', () => {
    render(<SlidesLightbox />);
    expect(screen.getByTestId('slides').style.overflowAnchor).toBe('none');
  });

  it('keeps the active index on viewport resize when scrollLeft is temporarily stale', () => {
    render(<SlidesLightbox defaultValue={3} />);
    const viewport = screen.getByTestId('slides');
    setupGeometry(viewport, 8);
    expect(activeThumb()).toBe(3);
    expect(viewport.scrollLeft).toBe(3 * WIDTH);

    // Layout shrink: slide geometry updates but scrollLeft is still the
    // pre-resize px. Nearest-index with the new step would pick a different
    // slide — resize must pin `activeIndex` instead of adopting that.
    const NEW = 50;
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, get: () => NEW });
    Object.defineProperty(viewport, 'scrollWidth', { configurable: true, get: () => NEW * 8 });
    viewport.querySelectorAll<HTMLElement>('[data-ramka-slide]').forEach((slide, i) => {
      Object.defineProperty(slide, 'offsetLeft', { configurable: true, get: () => i * NEW });
      Object.defineProperty(slide, 'offsetWidth', { configurable: true, get: () => NEW });
    });
    expect(viewport.scrollLeft).toBe(3 * WIDTH); // 300 → would map to index 6 at NEW=50

    // Fire RO without draining the double-rAF settle so `resizingRef` stays true.
    act(() => {
      roInstances.forEach((o) => o.cb([], o as unknown as ResizeObserver));
    });
    act(() => flushRaf()); // scrollToIndex restore + outer resize frame

    // Mid-resize echo with a "wrong" scrollLeft must not update the marker.
    act(() => {
      viewport.scrollLeft = 6 * NEW;
      fireEvent.scroll(viewport);
      flushRaf();
    });
    expect(activeThumb()).toBe(3);

    // Finish resize settle (inner rAF re-pins active, then jump frames).
    act(() => flushRaf());
    act(() => flushRaf());
    act(() => flushRaf());

    expect(activeThumb()).toBe(3);
    expect(viewport.scrollLeft).toBe(3 * NEW);
  });

  it('never leaves scroll-snap stuck at none across overlapping resize jumps', () => {
    render(<SlidesLightbox defaultValue={3} />);
    const viewport = screen.getByTestId('slides');
    setupGeometry(viewport, 8);
    expect(viewport.style.scrollSnapType).toBe('x mandatory');

    const applyWidth = (width: number) => {
      Object.defineProperty(viewport, 'clientWidth', { configurable: true, get: () => width });
      Object.defineProperty(viewport, 'scrollWidth', { configurable: true, get: () => width * 8 });
      viewport.querySelectorAll<HTMLElement>('[data-ramka-slide]').forEach((slide, i) => {
        Object.defineProperty(slide, 'offsetLeft', { configurable: true, get: () => i * width });
        Object.defineProperty(slide, 'offsetWidth', { configurable: true, get: () => width });
      });
    };

    // First resize: stale scrollLeft forces a snap-suppressed jump (rAF pending).
    applyWidth(50);
    viewport.scrollLeft = 3 * WIDTH;
    act(() => {
      roInstances.forEach((o) => o.cb([], o as unknown as ResizeObserver));
    });
    expect(viewport.style.scrollSnapType).toBe('none');

    // Second resize before the first restore frame — previously this captured
    // savedSnap='none' and permanently stuck snap off after the superseded rAF.
    applyWidth(40);
    act(() => {
      roInstances.forEach((o) => o.cb([], o as unknown as ResizeObserver));
    });

    act(() => flushRaf());
    act(() => flushRaf());
    act(() => flushRaf());
    act(() => flushRaf());

    expect(viewport.style.scrollSnapType).toBe('x mandatory');
    expect(activeThumb()).toBe(3);
    expect(viewport.scrollLeft).toBe(3 * 40);
  });

  it('jumps to the exact snap offset on programmatic navigation (thumbnail click) at rest', () => {
    render(<SlidesLightbox />);
    const viewport = screen.getByTestId('slides');
    setupGeometry(viewport, 8);

    act(() => {
      fireEvent.click(screen.getByTestId('thumb-5'));
    });
    act(() => flushRaf());

    expect(activeThumb()).toBe(5);
    expect(viewport.scrollLeft).toBe(5 * WIDTH);
    // Snap restored after the jump (was only off for the exact set).
    expect(viewport.style.scrollSnapType).toBe('x mandatory');
  });

  it('derives the active index from a swipe via O(1) offset arithmetic', () => {
    const onValueChange = vi.fn();
    render(<SlidesLightbox onValueChange={onValueChange} />);
    const viewport = screen.getByTestId('slides');
    setupGeometry(viewport, 8);

    swipeTo(viewport, 4);

    expect(activeThumb()).toBe(4);
    expect(onValueChange).toHaveBeenCalledWith(4, expect.objectContaining({ source: 'scroll' }));
  });

  it('rounds a partial swipe to the nearest slide', () => {
    render(<SlidesLightbox />);
    const viewport = screen.getByTestId('slides');
    setupGeometry(viewport, 8);

    act(() => {
      viewport.scrollLeft = 1.6 * WIDTH;
      fireEvent.scroll(viewport);
      flushRaf();
    });
    expect(activeThumb()).toBe(2);

    act(() => {
      viewport.scrollLeft = 1.4 * WIDTH;
      fireEvent.scroll(viewport);
      flushRaf();
    });
    expect(activeThumb()).toBe(1);
  });

  it('locks discrete navigation while a user scroll/fling is in flight, then unlocks on scrollend', () => {
    render(<SlidesLightbox />);
    const viewport = screen.getByTestId('slides');
    setupGeometry(viewport, 8);

    // User swipe: marker follows and discrete navigation is now locked.
    swipeTo(viewport, 3);
    expect(activeThumb()).toBe(3);

    // A thumbnail click that lands mid-fling is dropped — the swipe stays
    // authoritative, so the marker never diverges from the real position.
    act(() => {
      fireEvent.click(screen.getByTestId('thumb-6'));
    });
    expect(activeThumb()).toBe(3);

    // Once the scroll settles, navigation is allowed again.
    endScroll(viewport);
    act(() => {
      fireEvent.click(screen.getByTestId('thumb-6'));
    });
    act(() => flushRaf());
    expect(activeThumb()).toBe(6);
    expect(viewport.scrollLeft).toBe(6 * WIDTH);
  });

  it('reconciles the marker to the resting position when a fling settles between slides', () => {
    render(<SlidesLightbox />);
    const viewport = screen.getByTestId('slides');
    setupGeometry(viewport, 8);

    // Fling in flight, currently reading as slide 3.
    swipeTo(viewport, 3);
    expect(activeThumb()).toBe(3);

    // It coasts to rest centered on slide 5 before scrollend fires.
    act(() => {
      viewport.scrollLeft = 5 * WIDTH;
    });
    endScroll(viewport);
    expect(activeThumb()).toBe(5);
  });

  it('does not lock navigation from its own programmatic jump', () => {
    render(<SlidesLightbox />);
    const viewport = screen.getByTestId('slides');
    setupGeometry(viewport, 8);

    // Jump at rest, then simulate the jump's own scroll event landing on target.
    act(() => {
      fireEvent.click(screen.getByTestId('thumb-5'));
    });
    act(() => flushRaf());
    act(() => {
      fireEvent.scroll(viewport);
      flushRaf();
    });

    // Navigation must still be unlocked (the jump is not a user scroll).
    act(() => {
      fireEvent.click(screen.getByTestId('thumb-2'));
    });
    act(() => flushRaf());
    expect(activeThumb()).toBe(2);
    expect(viewport.scrollLeft).toBe(2 * WIDTH);
  });

  it('keeps accepting thumbnail jumps during rapid programmatic navigation (scrub)', () => {
    // ThumbnailStrip scrub fires many marker changes while snap restore still emits
    // scroll events. Those must not take the user-fling lock, or later thumbs
    // are dropped and the active state lags behind the strip.
    render(<SlidesLightbox />);
    const viewport = screen.getByTestId('slides');
    setupGeometry(viewport, 8);

    for (const i of [1, 2, 3, 4, 5]) {
      act(() => {
        fireEvent.click(screen.getByTestId(`thumb-${i}`));
      });
      act(() => {
        flushRaf();
        fireEvent.scroll(viewport);
        flushRaf();
      });
      expect(activeThumb()).toBe(i);
      expect(viewport.scrollLeft).toBe(i * WIDTH);
    }
  });

  it('does not re-scroll when the active index change originates from a swipe', () => {
    render(<SlidesLightbox />);
    const viewport = screen.getByTestId('slides');
    setupGeometry(viewport, 8);

    swipeTo(viewport, 4);
    // A swipe-derived index must not trigger a jump that fights momentum:
    // scrollLeft stays exactly where the user left it.
    expect(viewport.scrollLeft).toBe(4 * WIDTH);
    expect(activeThumb()).toBe(4);
  });

  it('clamps the derived index to the slide range', () => {
    render(<SlidesLightbox itemCount={4} />);
    const viewport = screen.getByTestId('slides');
    setupGeometry(viewport, 4);

    act(() => {
      viewport.scrollLeft = 99 * WIDTH;
      fireEvent.scroll(viewport);
      flushRaf();
    });
    expect(activeThumb()).toBe(3);
  });

  it('unlocks navigation via the idle fallback when scrollend never fires', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      render(<SlidesLightbox />);
      const viewport = screen.getByTestId('slides');
      setupGeometry(viewport, 8);

      // Swipe locks discrete navigation.
      swipeTo(viewport, 3);
      expect(activeThumb()).toBe(3);

      // A thumbnail click mid-fling is dropped while locked.
      act(() => {
        fireEvent.click(screen.getByTestId('thumb-6'));
      });
      expect(activeThumb()).toBe(3);

      // `scrollend` never arrives (e.g. Safari < 17.4): the quiet-gap fallback
      // must still settle the scroll and release the lock.
      act(() => {
        vi.advanceTimersByTime(200);
      });

      act(() => {
        fireEvent.click(screen.getByTestId('thumb-6'));
      });
      act(() => flushRaf());
      expect(activeThumb()).toBe(6);
    } finally {
      vi.useRealTimers();
    }
  });

  it('navigates arrow keys relative to the active index, not the focused thumbnail', () => {
    // A swipe moves the active item without moving DOM focus. Arrow keys must
    // step from the *active* index (source of truth), so the next arrow after a
    // swipe advances one from where the user actually swiped to.
    render(<SlidesLightbox />);
    const viewport = screen.getByTestId('slides');
    setupGeometry(viewport, 8);

    swipeTo(viewport, 4);
    endScroll(viewport);
    expect(activeThumb()).toBe(4);

    act(() => {
      fireEvent.keyDown(screen.getByTestId('thumb-group'), { key: 'ArrowRight' });
    });
    act(() => flushRaf());
    expect(activeThumb()).toBe(5);
    expect(viewport.scrollLeft).toBe(5 * WIDTH);
  });

  it('drops arrow keys while a scroll is in flight without accumulating them', () => {
    // The bug this guards against: arrow presses during a fling used to rove
    // focus (uncapped) and then fire all at once on the first press after the
    // scroll settled — jumping many slides instead of one.
    render(<SlidesLightbox />);
    const viewport = screen.getByTestId('slides');
    setupGeometry(viewport, 8);

    swipeTo(viewport, 3);
    expect(activeThumb()).toBe(3);

    const group = screen.getByTestId('thumb-group');
    act(() => {
      fireEvent.keyDown(group, { key: 'ArrowRight' });
      fireEvent.keyDown(group, { key: 'ArrowRight' });
      fireEvent.keyDown(group, { key: 'ArrowRight' });
    });
    // All dropped while locked — nothing queued.
    expect(activeThumb()).toBe(3);

    endScroll(viewport);
    act(() => {
      fireEvent.keyDown(group, { key: 'ArrowRight' });
    });
    act(() => flushRaf());
    // Exactly one step from the settled position, not 3 (or 4).
    expect(activeThumb()).toBe(4);
    expect(viewport.scrollLeft).toBe(4 * WIDTH);
  });

  // -------------------------------------------------------------------------
  // Gesture suppression while a swipe/fling is in flight. `Lightbox.Slides`
  // owns the "a scroll is in progress" signal (navigationLockedRef); pull-to-
  // dismiss and zoom/pan defer to it so a swipe can't be hijacked mid-scroll.
  // -------------------------------------------------------------------------
  describe('gesture suppression while scrolling', () => {
    const origPointerEvent = globalThis.PointerEvent;

    beforeEach(() => {
      if (!globalThis.PointerEvent) {
        (globalThis as Record<string, unknown>).PointerEvent = class PointerEvent extends MouseEvent {
          pointerId: number;
          pointerType: string;
          constructor(type: string, init: PointerEventInit & { pointerId?: number; pointerType?: string } = {}) {
            super(type, init);
            this.pointerId = init.pointerId ?? 0;
            this.pointerType = init.pointerType ?? 'mouse';
          }
        };
      }
      if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = vi.fn();
      if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = vi.fn();
      if (!Element.prototype.animate) {
        Element.prototype.animate = vi.fn(() => ({
          finished: Promise.resolve(),
          cancel: vi.fn(),
        })) as unknown as typeof Element.prototype.animate;
      }
    });

    afterEach(() => {
      if (origPointerEvent) (globalThis as Record<string, unknown>).PointerEvent = origPointerEvent;
    });

    function dispatchPointer(
      el: Element,
      type: string,
      init: {
        pointerId?: number;
        pointerType?: string;
        clientX?: number;
        clientY?: number;
        isPrimary?: boolean;
      } = {},
    ) {
      const { isPrimary = init.pointerId === 1 || init.pointerId == null, ...rest } = init;
      const event = new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'touch',
        ...rest,
      });
      Object.defineProperty(event, 'isPrimary', { configurable: true, value: isPrimary });
      el.dispatchEvent(event);
    }

    function GestureLightbox({
      withZoom = false,
      withButtons = false,
      zoomRef,
      observedIndex = 0,
      itemCount = 8,
    }: {
      withZoom?: boolean;
      withButtons?: boolean;
      zoomRef?: React.RefObject<LightboxZoomRef | null>;
      observedIndex?: number;
      itemCount?: number;
    } = {}) {
      return (
        <LightboxRoot defaultOpen defaultValue={0}>
          {Array.from({ length: itemCount }, (_, i) => (
            <LightboxTrigger key={`t-${i}`} index={i}>
              Trigger {i}
            </LightboxTrigger>
          ))}
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Gesture lightbox">
              {withButtons ? <LightboxZoomIn data-testid="zoom-in">+</LightboxZoomIn> : null}
              <LightboxSlides data-testid="slides" preload={itemCount}>
                {Array.from({ length: itemCount }, (_, i) => (
                  <LightboxSlide key={`s-${i}`} data-testid={`slide-${i}`}>
                    <LightboxItem index={i} data-testid={`item-${i}`}>
                      {withZoom ? (
                        <LightboxZoom ref={i === observedIndex ? zoomRef : undefined} maxZoom={4}>
                          <img src={`p${i}.jpg`} alt={`photo ${i}`} data-testid={`img-${i}`} />
                        </LightboxZoom>
                      ) : (
                        <img src={`p${i}.jpg`} alt={`photo ${i}`} data-testid={`img-${i}`} />
                      )}
                    </LightboxItem>
                  </LightboxSlide>
                ))}
              </LightboxSlides>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>
      );
    }

    it('suppresses pull-to-dismiss while a scroll is in flight, then resumes after it settles', () => {
      render(<GestureLightbox />);
      const viewport = screen.getByTestId('slides');
      const content = screen.getByTestId('content');
      setupGeometry(viewport, 8);

      // User swipe locks the scroller. A vertical drag on the active item must
      // NOT start a pull while the fling is in flight.
      swipeTo(viewport, 2);
      const img = screen.getByTestId('img-2');
      act(() => {
        dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200 });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 240 });
      });
      expect(content).not.toHaveAttribute('data-pulling');

      // Once the scroll settles, the same drag starts a pull normally.
      endScroll(viewport);
      act(() => {
        dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200 });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 240 });
      });
      expect(content).toHaveAttribute('data-pulling');
    });

    it('does not leave gestures locked after an open/snap scroll echo on the first slide', () => {
      // Regression: onScroll used to set navigationLockedRef without a settle
      // path when the scroller was still parked on the jump target (open /
      // snap restore). Pull/pinch/double-tap stayed dead until the user swiped.
      render(<GestureLightbox />);
      const viewport = screen.getByTestId('slides');
      const content = screen.getByTestId('content');
      setupGeometry(viewport, 8);

      // Spurious scroll while still on slide 0 (jump target). Must not stick
      // the fling lock.
      act(() => {
        fireEvent.scroll(viewport);
        flushRaf();
      });

      const img = screen.getByTestId('img-0');
      act(() => {
        dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200 });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 240 });
      });
      expect(content).toHaveAttribute('data-pulling');
    });

    it('suppresses zoom gestures while a scroll is in flight, then resumes after it settles', () => {
      const zoomRef = React.createRef<LightboxZoomRef>();
      render(<GestureLightbox withZoom zoomRef={zoomRef} observedIndex={1} />);
      const viewport = screen.getByTestId('slides');
      setupGeometry(viewport, 8);

      // Swipe locks the scroller; a ctrl+wheel zoom on the slide is ignored.
      swipeTo(viewport, 1);
      expect(zoomRef.current?.zoom).toBe(1);
      const img = screen.getByTestId('img-1');
      act(() => {
        fireEvent.wheel(img, { deltaY: -100, ctrlKey: true });
      });
      expect(zoomRef.current?.zoom).toBe(1);

      // After settling, the same wheel gesture zooms in.
      endScroll(viewport);
      act(() => {
        fireEvent.wheel(img, { deltaY: -100, ctrlKey: true });
      });
      expect(zoomRef.current!.zoom).toBeGreaterThan(1);
    });

    it('locks from a single-finger touch slide before scroll events (iOS Safari)', () => {
      // Mobile Safari often compositor-scrolls without pointermove on Zoom.
      // Capture-phase touchmove on Slides must flip the lock so a second finger
      // can't arm pinch before the first `scroll` event.
      const zoomRef = React.createRef<LightboxZoomRef>();
      render(<GestureLightbox withZoom zoomRef={zoomRef} observedIndex={0} />);
      const viewport = screen.getByTestId('slides');
      setupGeometry(viewport, 8);
      const img = screen.getByTestId('img-0');

      act(() => {
        viewport.dispatchEvent(
          new TouchEvent('touchstart', {
            bubbles: true,
            cancelable: true,
            touches: [{ clientX: 100, clientY: 200 } as Touch],
          }),
        );
        viewport.dispatchEvent(
          new TouchEvent('touchmove', {
            bubbles: true,
            cancelable: true,
            touches: [{ clientX: 140, clientY: 200 } as Touch],
          }),
        );
      });

      // Second finger + pinch spread — lock is already held from touchmove.
      act(() => {
        dispatchPointer(img, 'pointerdown', { pointerId: 1, clientX: 100, clientY: 200, isPrimary: true });
        dispatchPointer(img, 'pointerdown', { pointerId: 2, clientX: 150, clientY: 200, isPrimary: false });
        dispatchPointer(img, 'pointermove', { pointerId: 1, clientX: 70, clientY: 200, isPrimary: true });
        dispatchPointer(img, 'pointermove', { pointerId: 2, clientX: 220, clientY: 200, isPrimary: false });
      });
      expect(zoomRef.current?.zoom).toBe(1);
    });

    it('ignores a second-finger pinch that lands while a one-finger swipe is in flight', () => {
      const zoomRef = React.createRef<LightboxZoomRef>();
      render(<GestureLightbox withZoom zoomRef={zoomRef} observedIndex={0} />);
      const viewport = screen.getByTestId('slides');
      setupGeometry(viewport, 8);
      const img = screen.getByTestId('img-0');

      // Finger 1 starts a swipe (moves past the tap threshold at 1×).
      act(() => {
        dispatchPointer(img, 'pointerdown', { pointerId: 1, clientX: 100, clientY: 200, isPrimary: true });
        dispatchPointer(img, 'pointermove', { pointerId: 1, clientX: 140, clientY: 200, isPrimary: true });
      });

      // Scroll lock without changing the active slide (keep this Zoom active).
      act(() => {
        fireEvent.scroll(viewport);
      });

      // Finger 2 lands and spreads — must NOT arm a pinch mid-scroll.
      act(() => {
        dispatchPointer(img, 'pointerdown', { pointerId: 2, clientX: 180, clientY: 220, isPrimary: false });
        dispatchPointer(img, 'pointermove', { pointerId: 1, clientX: 90, clientY: 200, isPrimary: true });
        dispatchPointer(img, 'pointermove', { pointerId: 2, clientX: 220, clientY: 240, isPrimary: false });
      });
      expect(zoomRef.current?.zoom).toBe(1);

      endScroll(viewport);
      act(() => {
        dispatchPointer(img, 'pointerup', { pointerId: 1, clientX: 90, clientY: 200, isPrimary: true });
        dispatchPointer(img, 'pointerup', { pointerId: 2, clientX: 220, clientY: 240, isPrimary: false });
      });

      // After settle, a real two-finger pinch zooms.
      act(() => {
        dispatchPointer(img, 'pointerdown', { pointerId: 1, clientX: 100, clientY: 200, isPrimary: true });
        dispatchPointer(img, 'pointerdown', { pointerId: 2, clientX: 140, clientY: 200, isPrimary: false });
        dispatchPointer(img, 'pointermove', { pointerId: 1, clientX: 80, clientY: 200, isPrimary: true });
        dispatchPointer(img, 'pointermove', { pointerId: 2, clientX: 200, clientY: 200, isPrimary: false });
      });
      expect(zoomRef.current!.zoom).toBeGreaterThan(1);
    });

    it('drops zoom-button clicks while a scroll is in flight, then resumes after it settles', () => {
      const zoomRef = React.createRef<LightboxZoomRef>();
      render(<GestureLightbox withZoom withButtons zoomRef={zoomRef} observedIndex={1} />);
      const viewport = screen.getByTestId('slides');
      setupGeometry(viewport, 8);

      // Swipe locks the scroller; the chrome zoom button (active-zoom bridge)
      // must no-op so a scroll can't be hijacked into a zoom.
      swipeTo(viewport, 1);
      expect(zoomRef.current?.zoom).toBe(1);
      act(() => {
        fireEvent.click(screen.getByTestId('zoom-in'));
      });
      expect(zoomRef.current?.zoom).toBe(1);

      // After settling, the button zooms in normally.
      endScroll(viewport);
      act(() => {
        fireEvent.click(screen.getByTestId('zoom-in'));
      });
      expect(zoomRef.current!.zoom).toBeGreaterThan(1);
    });
  });
});
