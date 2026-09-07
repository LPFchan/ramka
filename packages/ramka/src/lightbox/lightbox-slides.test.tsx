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
import { REACT_SUPPORTS_STYLE_HOISTING } from './react-style-hoisting';
import {
  SLIDE_TEST_WIDTH as WIDTH,
  applySlideGeometry,
  endScroll,
  flushRaf,
  installSlidesLayoutMocks,
  resetSlidesLayoutMocks,
  fireResizeObservers,
  setupGeometry,
  swipeTo,
  inlineToPhysicalScroll,
  type ZoomRefObject,
} from './lightbox-slides-test-utils';
import type { TextDirection } from './lightbox-direction';

beforeEach(() => {
  installSlidesLayoutMocks();

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
  resetSlidesLayoutMocks();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function SlidesLightbox({
  itemCount = 8,
  defaultValue = 0,
  loop = false,
  dir = 'ltr',
  onValueChange,
}: {
  itemCount?: number;
  defaultValue?: number;
  loop?: boolean;
  dir?: TextDirection;
  onValueChange?: (value: number, metadata: { source: string }) => void;
} = {}) {
  return (
    <LightboxRoot
      defaultOpen
      defaultValue={defaultValue}
      loop={loop}
      dir={dir}
      onValueChange={onValueChange}
    >
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

  it('never renders the ssrSlideShift stand-in on client mounts', () => {
    // The stand-in exists solely for server paint + hydration, gated by a
    // useSyncExternalStore hydration check — a pure client open must not render
    // it even transiently. (An earlier version rendered it and retired it in a
    // layout effect; the real-scroll write under the still-translated slides
    // let Chromium's snap-target tracking capture the slide visually at that
    // offset — 2×index — and re-align to it when the transform left, silently
    // committing the wrong index.) After mount: no attribute, no vars,
    // scrolling unfrozen, snap on. (Server-paint behavior is covered in
    // lightbox-slides-ssr.test.tsx.)
    render(
      <LightboxRoot defaultOpen defaultValue={2}>
        <LightboxTrigger index={0}>open</LightboxTrigger>
        <LightboxPortal>
          <LightboxContent aria-label="ssr shift test">
            <LightboxSlides data-testid="slides" ssrSlideShift aria-label="Slides">
              {Array.from({ length: 4 }, (_, i) => (
                <LightboxSlide key={i}>
                  <LightboxItem index={i} aria-label={`${i + 1} of 4`}>
                    Item {i}
                  </LightboxItem>
                </LightboxSlide>
              ))}
            </LightboxSlides>
          </LightboxContent>
        </LightboxPortal>
      </LightboxRoot>,
    );
    const viewport = screen.getByTestId('slides');
    expect(viewport).not.toHaveAttribute('data-ssr-shift');
    expect(viewport.style.getPropertyValue('--lightbox-ssr-index')).toBe('');
    expect(viewport.style.overflowX).toBe('auto');
    expect(viewport.style.scrollSnapType).toBe('x mandatory');
    // The client never stamps the SSR active-item marker either.
    expect(document.querySelector('[data-ssr-active]')).toBeNull();
    // The rules ride along as a hoisted <style> (React 19 hoists in jsdom
    // too), ready for pages whose first paint is server HTML. React 18 has no
    // hoisting — the version gate renders nothing there (react-style-hoisting.ts).
    if (REACT_SUPPORTS_STYLE_HOISTING) {
      const hoisted = Array.from(document.head.querySelectorAll('style[data-precedence]')).map(
        (el) => el.textContent ?? '',
      );
      expect(hoisted.some((css) => css.includes('scroll-initial-target:nearest'))).toBe(true);
    }
  });

  it('hydration handoff: holds the jump while the ssrSlideShift stand-in is on, then retires and jumps in one commit', async () => {
    // The real scroll offset is written only AFTER the stand-in retires — never
    // under it. WebKit includes transformed boxes in the scrollable-overflow
    // area, so while slides are translated inline-start `scrollWidth` shrinks
    // by the shift and the real offset is unreachable: a hydration-commit jump
    // gets clamped slides short, and Safari painted the wrong slide (and a
    // wrongly-positioned thumbnail strip) until a later correction. The retire
    // re-render (a post-hydration passive effect) drops the transform and
    // writes the real offset in one commit.
    //
    // The ThumbnailStrip rides the same handoff: its hydration-commit refresh
    // bails while the scrollport carries `data-ssr-shift` (positioning against
    // the held-back offset 0 would reveal the strip pointing at slide 0), and
    // the retire's `notifySlidesViewport` re-enters it — so `data-positioned`
    // must be absent in server HTML and present, with the real offset in
    // place, after hydration. If the re-entry notify is ever dropped, the
    // strip stays unpositioned (hidden) forever and this test fails.
    //
    // The SSR stamps (`data-ssr-active` on the active Item, `data-morph-target`
    // on the active Trigger) ride it too: they're gated on `useIsServerPaint`,
    // so the hydration render matches the server byte-for-byte (React 19 warns
    // on server-rendered attributes the hydration render omits — the
    // console.error spy below pins that), the flip removes `data-ssr-active`,
    // and the Trigger's re-sync keeps `data-morph-target` on the active
    // trigger through the flip's React-side removal.
    const { renderToString } = await import('react-dom/server');
    const { hydrateRoot } = await import('react-dom/client');
    const { LightboxThumbnailStrip } = await import('./lightbox-thumbnail-strip');
    const { LightboxThumbnailStripTrack } = await import('./lightbox-thumbnail-strip-track');
    const ui = (
      <LightboxRoot defaultOpen defaultValue={2}>
        {Array.from({ length: 4 }, (_, i) => (
          <LightboxTrigger key={i} index={i} data-testid={`trigger-${i}`}>
            open {i}
          </LightboxTrigger>
        ))}
        <LightboxPortal container={null}>
          <LightboxContent aria-label="hydration handoff">
            <LightboxSlides data-testid="slides" ssrSlideShift aria-label="Slides">
              {Array.from({ length: 4 }, (_, i) => (
                <LightboxSlide key={i}>
                  <LightboxItem index={i} aria-label={`${i + 1} of 4`}>
                    Item {i}
                  </LightboxItem>
                </LightboxSlide>
              ))}
            </LightboxSlides>
            <LightboxThumbnailStrip data-testid="strip">
              <LightboxThumbnailStripTrack aria-label="Thumbs">
                {Array.from({ length: 4 }, (_, i) => (
                  <LightboxThumbnail key={i} index={i}>
                    t{i}
                  </LightboxThumbnail>
                ))}
              </LightboxThumbnailStripTrack>
            </LightboxThumbnailStrip>
          </LightboxContent>
        </LightboxPortal>
      </LightboxRoot>
    );

    const container = document.createElement('div');
    document.body.appendChild(container);
    // renderToString always renders the server snapshot, so the stand-in is
    // stamped even though this test runs in jsdom.
    container.innerHTML = renderToString(ui);
    const viewport = container.querySelector<HTMLElement>('[data-ramka-slides]')!;
    const strip = container.querySelector<HTMLElement>('[data-ramka-thumbnail-strip]')!;
    const activeTrigger = container.querySelector<HTMLElement>('[data-testid="trigger-2"]')!;
    expect(viewport).toHaveAttribute('data-ssr-shift');
    // Server HTML carries the SSR stamps for the active index.
    expect(container.querySelector('[data-index="2"][data-ramka-item]')).toHaveAttribute(
      'data-ssr-active',
    );
    expect(activeTrigger).toHaveAttribute('data-morph-target');
    // Scroll/transform positions cannot be serialized: server HTML must never
    // claim the strip is positioned.
    expect(strip).not.toHaveAttribute('data-positioned');
    // Server HTML sits at offset 0; geometry must exist on the server DOM
    // before hydration effects measure it.
    applySlideGeometry(viewport, 4);
    expect(viewport.scrollLeft).toBe(0);

    const consoleErrorSpy = vi.spyOn(console, 'error');
    let root!: ReturnType<typeof hydrateRoot>;
    try {
      act(() => {
        root = hydrateRoot(container, ui);
      });

      // The hydration render must match the server markup byte-for-byte —
      // React 19 reports any attribute diff ("A tree hydrated but some
      // attributes of the server rendered HTML didn't match…") through
      // console.error.
      const hydrationComplaints = consoleErrorSpy.mock.calls.filter((call) =>
        call.some((arg) => typeof arg === 'string' && /hydrat/i.test(arg)),
      );
      expect(hydrationComplaints).toEqual([]);

      // One retire commit: stand-in gone AND the real offset in place.
      expect(viewport).not.toHaveAttribute('data-ssr-shift');
      expect(viewport.style.getPropertyValue('--lightbox-ssr-index')).toBe('');
      expect(viewport.scrollLeft).toBe(2 * WIDTH);
      // The strip was re-entered after the handoff and marked positioned.
      expect(strip).toHaveAttribute('data-positioned');
      // The flip un-renders `data-ssr-active` (its scroll-initial-target job
      // ended at the scroller's initial layout)…
      expect(container.querySelector('[data-ssr-active]')).toBeNull();
      // …but the active trigger must STAY hidden: React's flip-side removal of
      // the prop copy is restored by the morph-sync layout effect in the same
      // commit.
      expect(activeTrigger).toHaveAttribute('data-morph-target');
    } finally {
      consoleErrorSpy.mockRestore();
      // Manual root — testing-library cleanup doesn't know about it, and a
      // leaked open lightbox breaks every later `data-testid` query.
      act(() => root?.unmount());
      container.remove();
    }
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
      fireResizeObservers();
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
      fireResizeObservers();
    });
    expect(viewport.style.scrollSnapType).toBe('none');

    // Second resize before the first restore frame — previously this captured
    // savedSnap='none' and permanently stuck snap off after the superseded rAF.
    applyWidth(40);
    act(() => {
      fireResizeObservers();
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
    // jsdom advertises `onscrollend` but never dispatches it. Strip it so this
    // test exercises the Safari < 17.4 idle path (production uses `scrollend`).
    const scrollendDesc = Object.getOwnPropertyDescriptor(window, 'onscrollend');
    delete (window as { onscrollend?: unknown }).onscrollend;
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
      if (scrollendDesc) Object.defineProperty(window, 'onscrollend', scrollendDesc);
      vi.useRealTimers();
    }
  });

  it('Firefox: unlocks via the idle fallback even though scrollend is advertised', () => {
    // Gecko advertises `onscrollend` but often never fires it for a wheel
    // scroll that settles through scroll snap (Bugzilla 1993068). Trusting the
    // advertised event left the fling lock held forever — thumbs, keyboard,
    // zoom buttons and pinch all dead until a trackpad pinch happened to arm
    // the fallback. Firefox must use the quiet-gap fallback as the guaranteed
    // release.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const originalUa = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Macintosh; rv:153.0) Gecko/20100101 Firefox/153.0',
    });
    try {
      expect('onscrollend' in window).toBe(true);
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

      // `scrollend` never arrives: the quiet-gap fallback must release the lock.
      act(() => {
        vi.advanceTimersByTime(200);
      });

      act(() => {
        fireEvent.click(screen.getByTestId('thumb-6'));
      });
      act(() => flushRaf());
      expect(activeThumb()).toBe(6);
    } finally {
      Object.defineProperty(navigator, 'userAgent', {
        configurable: true,
        value: originalUa,
      });
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
      zoomRef?: ZoomRefObject<LightboxZoomRef>;
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

    function dispatchTrackpadWheel(
      target: Element,
      deltaX: number,
      deltaY: number,
      ctrlKey = false,
      metaKey = false,
    ) {
      const event = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaX,
        deltaY,
        ctrlKey,
        metaKey,
      });
      Object.defineProperty(event, 'deltaMode', { value: 0 });
      target.dispatchEvent(event);
    }

    it('does not start a trackpad pull until scrollend, even after scroll events go quiet', () => {
      // Production path: `scrollend` is the settle signal. jsdom advertises
      // `onscrollend` (so the idle fallback is not used); a quiet gap must not
      // unlock and let a vertical continuation of the same trackpad swipe pull.
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      try {
        render(<GestureLightbox />);
        const viewport = screen.getByTestId('slides');
        const content = screen.getByTestId('content');
        setupGeometry(viewport, 8);

        swipeTo(viewport, 2);
        const img = screen.getByTestId('img-2');

        act(() => {
          for (let i = 0; i < 4; i++) dispatchTrackpadWheel(img, 0, -30);
        });
        expect(content).not.toHaveAttribute('data-pulling');

        // Past SCROLL_IDLE_MS with no further `scroll` events (fingers turned
        // vertical). Must stay locked until `scrollend`.
        act(() => {
          vi.advanceTimersByTime(200);
        });
        act(() => {
          for (let i = 0; i < 4; i++) dispatchTrackpadWheel(img, 0, -30);
        });
        expect(content).not.toHaveAttribute('data-pulling');

        // Touch pull is gated on the same lock.
        act(() => {
          dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200 });
          dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 240 });
        });
        expect(content).not.toHaveAttribute('data-pulling');
        act(() => {
          dispatchPointer(content, 'pointerup', { clientX: 200, clientY: 240 });
        });

        endScroll(viewport);
        act(() => {
          dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200 });
          dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 240 });
        });
        expect(content).toHaveAttribute('data-pulling');
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not re-lock after scrollend while a scroll rAF is still pending', () => {
      // Repro: ⌘+/- mid-swipe. `scrollend` settles, then the last `scroll`
      // event's process rAF used to lock again with no follow-up scrollend —
      // pull/pinch/thumbs stayed dead until the next real swipe.
      render(<GestureLightbox />);
      const viewport = screen.getByTestId('slides');
      const content = screen.getByTestId('content');
      setupGeometry(viewport, 8);

      act(() => {
        viewport.scrollLeft = 2 * WIDTH;
        fireEvent.scroll(viewport);
        fireEvent(viewport, new Event('scrollend'));
        flushRaf();
      });

      const img = screen.getByTestId('img-2');
      act(() => {
        dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200 });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 240 });
      });
      expect(content).toHaveAttribute('data-pulling');
      act(() => {
        dispatchPointer(content, 'pointerup', { clientX: 200, clientY: 240 });
      });
      act(() => {
        fireEvent.click(screen.getByTestId('thumb-6'));
      });
      act(() => flushRaf());
      expect(activeThumb()).toBe(6);
    });

    it('starts a trackpad pull after scrollend of a gallery swipe', () => {
      render(<GestureLightbox />);
      const viewport = screen.getByTestId('slides');
      const content = screen.getByTestId('content');
      setupGeometry(viewport, 8);

      swipeTo(viewport, 2);
      const img = screen.getByTestId('img-2');

      act(() => {
        for (let i = 0; i < 3; i++) dispatchTrackpadWheel(img, 0, -20);
      });
      expect(content).not.toHaveAttribute('data-pulling');

      endScroll(viewport);
      act(() => {
        for (let i = 0; i < 3; i++) dispatchTrackpadWheel(img, 0, -20);
      });
      expect(content).toHaveAttribute('data-pulling');
    });

    it('starts a trackpad pull on a slides lightbox at rest', () => {
      render(<GestureLightbox />);
      const viewport = screen.getByTestId('slides');
      const content = screen.getByTestId('content');
      setupGeometry(viewport, 8);
      const img = screen.getByTestId('img-0');

      act(() => {
        for (let i = 0; i < 3; i++) dispatchTrackpadWheel(img, 0, -20);
      });
      expect(content).toHaveAttribute('data-pulling');
    });

    it('does not convert a horizontal trackpad swipe into a pull when fingers turn vertical', () => {
      render(<GestureLightbox />);
      const viewport = screen.getByTestId('slides');
      const content = screen.getByTestId('content');
      setupGeometry(viewport, 8);
      const img = screen.getByTestId('img-0');

      act(() => {
        for (let i = 0; i < 4; i++) dispatchTrackpadWheel(img, 40, 0);
        for (let i = 0; i < 4; i++) dispatchTrackpadWheel(img, 0, -30);
      });
      expect(content).not.toHaveAttribute('data-pulling');
    });

    it('does not freeze gestures after a trackpad pinch interrupts an in-flight swipe', () => {
      // Regression: pinch mid-swipe (Chrome ctrlKey+wheel / Safari GestureEvent)
      // aborts the gallery scroll without `scrollend`. The idle fallback is
      // normally skipped when `onscrollend` exists (vertical-turn must not
      // unlock), so pull/pinch/thumbs stayed dead until the next real swipe.
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      try {
        const zoomRef = React.createRef<LightboxZoomRef>();
        render(<GestureLightbox withZoom zoomRef={zoomRef} observedIndex={2} />);
        const viewport = screen.getByTestId('slides');
        const content = screen.getByTestId('content');
        setupGeometry(viewport, 8);

        swipeTo(viewport, 2);
        const img = screen.getByTestId('img-2');
        expect(activeThumb()).toBe(2);

        act(() => {
          dispatchTrackpadWheel(img, 0, -40, true);
        });

        // Still locked immediately — snap may still be in flight.
        act(() => {
          dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200 });
          dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 240 });
        });
        expect(content).not.toHaveAttribute('data-pulling');
        act(() => {
          dispatchPointer(content, 'pointerup', { clientX: 200, clientY: 240 });
        });
        act(() => {
          fireEvent.click(screen.getByTestId('thumb-6'));
        });
        expect(activeThumb()).toBe(2);
        act(() => {
          fireEvent.wheel(img, { deltaY: -100, ctrlKey: true });
        });
        expect(zoomRef.current?.zoom).toBe(1);

        // Pinch + scroll went quiet and `scrollend` never arrived. Must settle.
        act(() => {
          vi.advanceTimersByTime(200);
        });
        act(() => {
          dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200 });
          dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 240 });
        });
        expect(content).toHaveAttribute('data-pulling');
        act(() => {
          dispatchPointer(content, 'pointerup', { clientX: 200, clientY: 240 });
        });

        act(() => {
          fireEvent.wheel(img, { deltaY: -100, ctrlKey: true });
        });
        expect(zoomRef.current!.zoom).toBeGreaterThan(1);

        act(() => {
          fireEvent.click(screen.getByTestId('thumb-6'));
        });
        act(() => flushRaf());
        expect(activeThumb()).toBe(6);
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not freeze gestures after a Safari trackpad pinch interrupts an in-flight swipe', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      try {
        render(<GestureLightbox />);
        const viewport = screen.getByTestId('slides');
        const content = screen.getByTestId('content');
        setupGeometry(viewport, 8);

        swipeTo(viewport, 2);
        const img = screen.getByTestId('img-2');

        act(() => {
          img.dispatchEvent(new Event('gesturestart', { bubbles: true, cancelable: true }));
          img.dispatchEvent(new Event('gesturechange', { bubbles: true, cancelable: true }));
        });

        act(() => {
          vi.advanceTimersByTime(200);
        });
        act(() => {
          dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200 });
          dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 240 });
        });
        expect(content).toHaveAttribute('data-pulling');
        act(() => {
          dispatchPointer(content, 'pointerup', { clientX: 200, clientY: 240 });
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

    it('does not freeze gestures after ⌘+scroll (metaKey wheel) interrupts an in-flight swipe', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      try {
        render(<GestureLightbox />);
        const viewport = screen.getByTestId('slides');
        const content = screen.getByTestId('content');
        setupGeometry(viewport, 8);

        swipeTo(viewport, 2);
        const img = screen.getByTestId('img-2');

        act(() => {
          dispatchTrackpadWheel(img, 0, -40, false, true);
        });
        act(() => {
          vi.advanceTimersByTime(200);
        });
        act(() => {
          dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200 });
          dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 240 });
        });
        expect(content).toHaveAttribute('data-pulling');
      } finally {
        vi.useRealTimers();
      }
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

    it('does not freeze gestures after leftover-finger movement during pinch snap-back', () => {
      render(<GestureLightbox />);
      const viewport = screen.getByTestId('slides');
      const content = screen.getByTestId('content');
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
        viewport.dispatchEvent(
          new TouchEvent('touchstart', {
            bubbles: true,
            cancelable: true,
            touches: [
              { clientX: 140, clientY: 200 } as Touch,
              { clientX: 200, clientY: 200 } as Touch,
            ],
          }),
        );
        viewport.dispatchEvent(
          new TouchEvent('touchend', {
            bubbles: true,
            cancelable: true,
            touches: [{ clientX: 140, clientY: 200 } as Touch],
          }),
        );
        viewport.dispatchEvent(
          new TouchEvent('touchmove', {
            bubbles: true,
            cancelable: true,
            touches: [{ clientX: 200, clientY: 200 } as Touch],
          }),
        );
        viewport.dispatchEvent(
          new TouchEvent('touchend', {
            bubbles: true,
            cancelable: true,
            touches: [] as unknown as Touch[],
          }),
        );
      });

      act(() => {
        dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200 });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 240 });
      });
      expect(content).toHaveAttribute('data-pulling');
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

    it('drops keyboard +/- zoom while a scroll is in flight, then resumes after it settles', () => {
      // Regression: keyboard zoom was not gated (unlike pinch / zoom buttons).
      // A discrete zoom mid-swipe aborts compositor scrolling without
      // `scrollend` and freezes pull/pinch/thumbs.
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      try {
        const zoomRef = React.createRef<LightboxZoomRef>();
        render(<GestureLightbox withZoom zoomRef={zoomRef} observedIndex={1} />);
        const viewport = screen.getByTestId('slides');
        const content = screen.getByTestId('content');
        setupGeometry(viewport, 8);
        const img = screen.getByTestId('img-1');

        swipeTo(viewport, 1);
        expect(zoomRef.current?.zoom).toBe(1);
        expect(activeThumb()).toBe(1);
        act(() => {
          fireEvent.keyDown(content, { key: '=' });
        });
        expect(zoomRef.current?.zoom).toBe(1);
        act(() => {
          fireEvent.keyDown(content, { key: '-' });
        });
        expect(zoomRef.current?.zoom).toBe(1);
        act(() => {
          fireEvent.keyDown(content, { key: '0' });
        });
        expect(zoomRef.current?.zoom).toBe(1);

        // Unlike a trackpad pinch, keyboard zoom must not idle-unlock: the
        // swipe is still the live gesture until `scrollend`.
        act(() => {
          vi.advanceTimersByTime(200);
        });
        act(() => {
          dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200 });
          dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 240 });
        });
        expect(content).not.toHaveAttribute('data-pulling');
        act(() => {
          dispatchPointer(content, 'pointerup', { clientX: 200, clientY: 240 });
        });
        act(() => {
          fireEvent.click(screen.getByTestId('thumb-6'));
        });
        expect(activeThumb()).toBe(1);

        endScroll(viewport);
        act(() => {
          fireEvent.keyDown(content, { key: '=' });
        });
        expect(zoomRef.current!.zoom).toBeGreaterThan(1);

        act(() => {
          fireEvent.click(screen.getByTestId('thumb-6'));
        });
        act(() => flushRaf());
        expect(activeThumb()).toBe(6);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Reading direction
// ---------------------------------------------------------------------------

/**
 * The same navigation contract in both reading directions. Index order is the
 * invariant: index 0 is always the inline-start slide and `ArrowRight` always
 * moves *visually* right, which means it advances in LTR and retreats in RTL.
 *
 * Assertions go through `inlineToPhysicalScroll` so they state the inline
 * position while still checking the real signed `scrollLeft` the browser would
 * see — negative in RTL. Asserting inline positions directly would pass even if
 * the physical sign were wrong.
 */
describe.each<TextDirection>(['ltr', 'rtl'])('Lightbox.Slides (dir=%s)', (dir) => {
  const physical = (inline: number) => inlineToPhysicalScroll(inline, dir);
  /** Key that moves one slide *forward* through the index order. */
  const forwardKey = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
  const backwardKey = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';

  function setup(props: Parameters<typeof SlidesLightbox>[0] = {}) {
    render(<SlidesLightbox dir={dir} {...props} />);
    const viewport = screen.getByTestId('slides');
    setupGeometry(viewport, 8, WIDTH, dir);
    return viewport;
  }

  it('starts parked on slide 0 at the inline-start edge', () => {
    const viewport = setup();
    expect(activeThumb()).toBe(0);
    expect(viewport.scrollLeft).toBe(0);
  });

  it('derives the active index from a swipe', () => {
    const viewport = setup();

    swipeTo(viewport, 3, WIDTH, dir);
    expect(activeThumb()).toBe(3);
    expect(viewport.scrollLeft).toBe(physical(3 * WIDTH));

    endScroll(viewport);
    expect(activeThumb()).toBe(3);
  });

  it('scrolls to the slide a thumbnail selects', () => {
    const viewport = setup();

    act(() => {
      fireEvent.click(screen.getByTestId('thumb-5'));
    });
    act(() => flushRaf());

    expect(activeThumb()).toBe(5);
    expect(viewport.scrollLeft).toBe(physical(5 * WIDTH));
  });

  it('mirrors the horizontal arrow keys', () => {
    const viewport = setup({ defaultValue: 4 });
    act(() => flushRaf());
    const group = screen.getByTestId('thumb-group');

    act(() => {
      fireEvent.keyDown(group, { key: forwardKey });
    });
    act(() => flushRaf());
    expect(activeThumb()).toBe(5);
    expect(viewport.scrollLeft).toBe(physical(5 * WIDTH));

    act(() => {
      fireEvent.keyDown(group, { key: backwardKey });
    });
    act(() => flushRaf());
    expect(activeThumb()).toBe(4);
    expect(viewport.scrollLeft).toBe(physical(4 * WIDTH));
  });

  it('keeps ArrowDown / ArrowUp on index order', () => {
    setup({ defaultValue: 4 });
    act(() => flushRaf());
    const group = screen.getByTestId('thumb-group');

    act(() => {
      fireEvent.keyDown(group, { key: 'ArrowDown' });
    });
    act(() => flushRaf());
    expect(activeThumb()).toBe(5);

    act(() => {
      fireEvent.keyDown(group, { key: 'ArrowUp' });
    });
    act(() => flushRaf());
    expect(activeThumb()).toBe(4);
  });

  it('clamps at both ends of the index range', () => {
    const viewport = setup({ defaultValue: 0 });
    const group = screen.getByTestId('thumb-group');

    act(() => {
      fireEvent.keyDown(group, { key: backwardKey });
    });
    act(() => flushRaf());
    expect(activeThumb()).toBe(0);
    expect(viewport.scrollLeft).toBe(0);

    act(() => {
      fireEvent.keyDown(group, { key: 'End' });
    });
    act(() => flushRaf());
    expect(activeThumb()).toBe(7);
    expect(viewport.scrollLeft).toBe(physical(7 * WIDTH));

    act(() => {
      fireEvent.keyDown(group, { key: forwardKey });
    });
    act(() => flushRaf());
    expect(activeThumb()).toBe(7);
    expect(viewport.scrollLeft).toBe(physical(7 * WIDTH));

    act(() => {
      fireEvent.keyDown(group, { key: 'Home' });
    });
    act(() => flushRaf());
    expect(activeThumb()).toBe(0);
    expect(viewport.scrollLeft).toBe(0);
  });

  it('wraps in both directions when loop is on', () => {
    const viewport = setup({ loop: true, defaultValue: 0 });
    const group = screen.getByTestId('thumb-group');

    act(() => {
      fireEvent.keyDown(group, { key: backwardKey });
    });
    act(() => flushRaf());
    expect(activeThumb()).toBe(7);
    expect(viewport.scrollLeft).toBe(physical(7 * WIDTH));

    act(() => {
      fireEvent.keyDown(group, { key: forwardKey });
    });
    act(() => flushRaf());
    expect(activeThumb()).toBe(0);
    expect(viewport.scrollLeft).toBe(0);
  });
});
