'use client';

import { mergeProps, useRender } from '@base-ui/react';
import * as React from 'react';

import { useLightboxContext } from './lightbox-context';
import { LightboxItemGroupContext, type LightboxItemGroupContextValue } from './lightbox-item-group';
import {
  measureSlidesGeometry,
  slideIndexFromScrollLeft,
  slideScrollLeftForIndex,
  SLIDE_SELECTOR,
} from './lightbox-slides-geometry';

/**
 * `Lightbox.Slides` — a dedicated, lightbox-only horizontal snap scroller.
 *
 * ## Why this is lightbox-specific (and not a general scroll gallery)
 *
 * A lightbox carousel is a *very* constrained scroller, and leaning into those
 * constraints is what makes state-sync bulletproof:
 *
 * - **One axis** (horizontal), **center snap**, **mandatory snap**,
 *   **`scroll-snap-stop: always`** (a fling advances at most one slide,
 *   iOS-Photos style). Slides are usually one viewport wide; they may also be
 *   content-sized (snug around media) as long as snap offsets are measurable.
 *
 * Index sync uses **offset geometry** (`offsetLeft` / `offsetWidth`) — reliable
 * inside a `<dialog>`/portal on mobile Safari, unlike `getBoundingClientRect`:
 *
 *   offsets[i] = offsetLeft(slideᵢ) + widthᵢ/2 − clientWidth/2
 *   index      = nearest offsets[i] to scrollLeft
 *   (uniform full-bleed tracks still use the O(1) round((scrollLeft−base)/step) path)
 *
 * ## Eventual-scroll-position authority (the reliability core)
 *
 * The spec activates a marker from the scroll's *eventual* position, not its
 * transient one. We do the same, and split the two ways the position changes so
 * they can never race:
 *
 * - **Swipe → marker.** A user scroll drives `activeIndex` (`scroll` source) from
 *   the O(1) derived index, and — crucially — *locks* discrete navigation while
 *   it's in flight (`navigationLockedRef`). A compositor fling cannot be
 *   cancelled from JS (since 2021, Chromium commit 539fe37, a programmatic scroll
 *   does NOT abort the fling curve; only a real input gesture does), so rather
 *   than fight it we simply refuse to navigate over it: thumbnail/keyboard/button
 *   navigation that lands mid-scroll is dropped upstream until the scroll
 *   settles. The lock clears on `scrollend` (with a `SCROLL_IDLE_MS` fallback),
 *   at which point the marker is reconciled to the resting position.
 *
 * - **Marker → scroll.** Because discrete navigation only ever runs while the
 *   scroller is at rest, `scrollToIndex` is a plain instant jump to the slide's
 *   **exact** snap offset (snap briefly off so `scroll-snap-stop: always` can't
 *   intercept it), followed by a repaint — no fling to fight, ever.
 *
 * This makes the whole class of races (Safari desync, Chrome "off by a few" /
 * momentum bleed, snap-stop freezes) structurally impossible.
 *
 * ## Direct Lightbox integration
 *
 * Reads/writes the Lightbox's own `activeIndex` directly — no external scroll
 * primitive and no state-sync bridge. It also provides the item-group context so
 * `Lightbox.Item`s inside `Lightbox.Slide`s get active/preload/direction, and
 * carries `data-orientation` so shared CSS (e.g. disabling item entrance fades
 * inside a scroller) keeps working.
 */

interface LightboxSlidesState extends Record<string, unknown> {
  activeIndex: number;
  direction: 'forward' | 'backward';
}

interface LightboxSlidesProps extends useRender.ComponentProps<'div', LightboxSlidesState> {
  /**
   * How many slides on each side of the active one keep their `Lightbox.Item`
   * content mounted. Slide *boxes* are always present (so scroll extent is
   * correct); only their content is preload-gated. `1` keeps the neighbours you
   * can swipe to ready. @default 1
   */
  preload?: number;
}

/**
 * Quiet gap (ms without a scroll event) after which we treat a user scroll as
 * finished, for browsers without `scrollend` (the primary signal) or that drop
 * it. Comfortably longer than a frame so an in-progress fling never trips it.
 */
const SCROLL_IDLE_MS = 140;

/**
 * Safari half-decoded-tile fix is only needed after a jump *settles*. During
 * rapid marker changes (filmstrip scrub, key repeat) a synchronous visibility
 * toggle per jump forces layout every frame — debounce to the last index.
 */
const REPAINT_IDLE_MS = 120;

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

const slidesStateAttributesMapping = {
  activeIndex: (value: unknown) => ({ 'data-active-index': String(value) }),
  direction: (value: unknown) => ({ 'data-direction': String(value) }),
};

const LightboxSlides = React.forwardRef<HTMLDivElement, LightboxSlidesProps>(
  function LightboxSlides(props, forwardedRef) {
    const { render, preload = 1, style, ...elementProps } = props;
    const {
      activeIndex,
      setActiveIndex,
      navigationLockedRef,
      loop,
      itemCount,
      slidesViewportRef,
      slidesGeometryRef,
      notifySlidesViewport,
    } = useLightboxContext();

    const viewportRef = React.useRef<HTMLDivElement | null>(null);
    // Local mirror of context `slidesGeometryRef` for hot scroll paths.
    const geometryRef = slidesGeometryRef;
    // True while our own programmatic jump is settling (including the follow-up
    // frame that restores scroll-snap). Scroll events in this window must not
    // lock navigation — snap restore often emits a second scroll after the
    // exact `scrollLeft` set, and mistaking that for a user fling drops the
    // next thumbnail/keyboard update (filmstrip scrub feels lagged).
    const programmaticRef = React.useRef(false);
    const jumpTargetRef = React.useRef(0);
    /** Bumps on every `scrollToIndex` so superseded rAF tails no-op. */
    const jumpGenRef = React.useRef(0);
    const repaintTimerRef = React.useRef(0);
    // setTimeout id for the scroll-idle fallback that clears the lock in browsers
    // without (or that miss) `scrollend`.
    const idleTimerRef = React.useRef(0);
    // Always-fresh mirror of activeIndex for use inside stable event listeners.
    const activeIndexRef = React.useRef(activeIndex);
    activeIndexRef.current = activeIndex;

    const mergedRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        const prev = viewportRef.current;
        viewportRef.current = node;
        // Publish for scroll-linked chrome (Filmstrip). Clear only if we still own
        // the slot — another Slides mount could have replaced us.
        if (node) {
          slidesViewportRef.current = node;
        } else if (slidesViewportRef.current === prev) {
          slidesViewportRef.current = null;
        }
        notifySlidesViewport();
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef, slidesViewportRef, notifySlidesViewport],
    );

    const indexFromScroll = React.useCallback((viewport: HTMLElement): number => {
      return slideIndexFromScrollLeft(viewport.scrollLeft, geometryRef.current);
    }, []);

    // Force WebKit to re-rasterize a slide's tile (a synchronous visibility
    // toggle with a reflow between — no frame ever paints it hidden, so it can't
    // flicker). Fixes the half-decoded image Safari leaves after a long jump.
    const repaintSlide = React.useCallback((index: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const slide = viewport.querySelectorAll<HTMLElement>(SLIDE_SELECTOR)[index];
      if (!slide) return;
      const previous = slide.style.visibility;
      slide.style.visibility = 'hidden';
      void slide.offsetWidth;
      slide.style.visibility = previous;
    }, []);

    // Jump to a slide's exact snap offset. Only ever runs while the scroller is
    // at rest — a user scroll locks discrete navigation upstream (see
    // `navigationLockedRef`), so there is never a fling to fight here. Snap is
    // momentarily disabled so `scroll-snap-stop: always` can't intercept the
    // exact set; the follow-up frame restores it and re-asserts the offset.
    // Safari tile repaint runs only after jumps go idle (see `REPAINT_IDLE_MS`).
    const scrollToIndex = React.useCallback(
      (index: number) => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        const max = viewport.scrollWidth - viewport.clientWidth;
        const target = clamp(
          slideScrollLeftForIndex(index, geometryRef.current),
          0,
          max > 0 ? max : 0,
        );
        if (Math.abs(viewport.scrollLeft - target) < 1) return;

        programmaticRef.current = true;
        jumpTargetRef.current = target;
        const gen = (jumpGenRef.current += 1);

        const savedSnap = viewport.style.scrollSnapType;
        viewport.style.scrollSnapType = 'none';
        viewport.scrollLeft = target;
        requestAnimationFrame(() => {
          const vp = viewportRef.current;
          if (!vp || gen !== jumpGenRef.current) return;
          vp.style.scrollSnapType = savedSnap;
          if (Math.abs(vp.scrollLeft - target) >= 1) {
            // Keep the programmatic window open through the restore write so its
            // scroll event can't take the user-fling lock.
            programmaticRef.current = true;
            jumpTargetRef.current = target;
            vp.scrollLeft = target;
          }
          requestAnimationFrame(() => {
            if (gen !== jumpGenRef.current) return;
            programmaticRef.current = false;
            window.clearTimeout(repaintTimerRef.current);
            repaintTimerRef.current = window.setTimeout(() => {
              if (gen !== jumpGenRef.current) return;
              repaintSlide(index);
            }, REPAINT_IDLE_MS);
          });
        });
      },
      [repaintSlide],
    );

    // Measure on mount / item-count change, and re-center on viewport resize so
    // the active slide stays centered (a fractional scrollLeft would otherwise
    // drift after a resize).
    React.useLayoutEffect(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      geometryRef.current = measureSlidesGeometry(viewport);
      notifySlidesViewport();

      // ResizeObserver fires an initial callback on `observe()` with the current
      // size. In a real browser we already measured the same values in the
      // layout effect above, so re-centering from that initial callback is a
      // redundant scroll write landing *during the open commit* (it dirties
      // layout, forcing the next read to reflow). Only re-center when geometry
      // actually changed — genuine resizes still work, and the no-op initial
      // callback is skipped. See LIGHTBOX_PERF.md.
      const observer = new ResizeObserver(() => {
        const prev = geometryRef.current;
        const next = measureSlidesGeometry(viewport);
        geometryRef.current = next;
        if (
          prev &&
          next.base === prev.base &&
          next.step === prev.step &&
          next.count === prev.count &&
          next.offsets.length === prev.offsets.length &&
          next.offsets.every((offset, i) => offset === prev.offsets[i])
        ) {
          return;
        }
        notifySlidesViewport();
        scrollToIndex(activeIndexRef.current);
      });
      observer.observe(viewport);
      return () => observer.disconnect();
    }, [itemCount, scrollToIndex, notifySlidesViewport]);

    // Drive scroll position from the active index. Skip when the viewport is
    // already showing it (our own swipe-derived updates, which must not
    // re-trigger a jump and fight momentum).
    React.useLayoutEffect(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      if (indexFromScroll(viewport) === activeIndex) return;
      scrollToIndex(activeIndex);
    }, [activeIndex, indexFromScroll, scrollToIndex]);

    // Swipe → active index, and lock discrete navigation while the user scroll /
    // fling is in flight. The lock is what makes this bulletproof: since a fling
    // can't be cancelled from JS, we never navigate over one — thumbnail/keyboard
    // /button navigation is dropped upstream (see `navigationLockedRef`) until
    // the scroll settles, so the marker and the real position can't diverge.
    React.useEffect(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      // Scrolling has fully stopped: unlock and reconcile the marker to the
      // resting position (in case a fling ended between two derived slides).
      const settle = () => {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = 0;
        navigationLockedRef.current = false;
        programmaticRef.current = false;
        const derived = indexFromScroll(viewport);
        if (derived !== activeIndexRef.current) setActiveIndex(derived, 'scroll');
      };
      const armIdleFallback = () => {
        window.clearTimeout(idleTimerRef.current);
        // Fallback for browsers without `scrollend` (or that drop it): treat a
        // quiet gap as the scroll having ended.
        idleTimerRef.current = window.setTimeout(settle, SCROLL_IDLE_MS);
      };

      let frame = 0;
      const process = () => {
        frame = 0;
        // Entire programmatic jump window (exact set + snap restore): ignore.
        // Clearing happens in `scrollToIndex`'s rAF tail — do not clear here on
        // "near target", or the restore frame's scroll is misclassified as a fling.
        if (programmaticRef.current) return;
        // Late echo after the programmatic flag cleared (snap restore / subpixel
        // re-set): still parked on the jump target with no lock yet. A real user
        // swipe changes `scrollLeft` before this handler runs, so it won't match.
        if (
          !navigationLockedRef.current &&
          Math.abs(viewport.scrollLeft - jumpTargetRef.current) < 1
        ) {
          return;
        }
        // Genuine user scroll/fling: lock discrete nav, keep the marker following
        // the swipe, and (re)arm the idle-settle fallback.
        navigationLockedRef.current = true;
        armIdleFallback();
        const derived = indexFromScroll(viewport);
        if (derived !== activeIndexRef.current) setActiveIndex(derived, 'scroll');
      };
      const onScroll = () => {
        if (frame === 0) frame = requestAnimationFrame(process);
      };

      viewport.addEventListener('scroll', onScroll, { passive: true });
      viewport.addEventListener('scrollend', settle);
      return () => {
        if (frame !== 0) cancelAnimationFrame(frame);
        window.clearTimeout(idleTimerRef.current);
        window.clearTimeout(repaintTimerRef.current);
        idleTimerRef.current = 0;
        viewport.removeEventListener('scroll', onScroll);
        viewport.removeEventListener('scrollend', settle);
      };
    }, [indexFromScroll, setActiveIndex, navigationLockedRef]);

    // Direction (used by item-entrance CSS / consumers). Mirrors ItemGroup.
    const prevIndexRef = React.useRef(activeIndex);
    const [direction, setDirection] = React.useState<'forward' | 'backward'>('forward');
    React.useEffect(() => {
      if (activeIndex !== prevIndexRef.current) {
        setDirection(activeIndex > prevIndexRef.current ? 'forward' : 'backward');
        prevIndexRef.current = activeIndex;
      }
    }, [activeIndex]);

    const groupContext = React.useMemo<LightboxItemGroupContextValue>(
      () => ({ activeIndex, preload, direction, loop, itemCount }),
      [activeIndex, preload, direction, loop, itemCount],
    );

    const state = React.useMemo<LightboxSlidesState>(
      () => ({ activeIndex, direction }),
      [activeIndex, direction],
    );

    return (
      <LightboxItemGroupContext.Provider value={groupContext}>
        {useRender({
          render,
          ref: mergedRef,
          state,
          stateAttributesMapping: slidesStateAttributesMapping,
          props: mergeProps<'div'>(
            {
              role: 'group',
              // APG Carousel pattern: the container that wraps the slides is a
              // carousel. Give it a label via `aria-label` / `aria-labelledby`
              // (the word "carousel" is supplied by the roledescription, so the
              // label itself should omit it).
              'aria-roledescription': 'carousel',
              'data-orientation': 'horizontal',
              // The scroller assumptions, baked in. Consumers can still layer
              // gap/padding/scrollbar-hiding via className/style; the offset-based
              // geometry accounts for any gap automatically.
              style: {
                display: 'flex',
                overflowX: 'auto',
                overflowY: 'hidden',
                overscrollBehaviorX: 'contain',
                scrollSnapType: 'x mandatory',
                // Programmatic navigation sets scrollLeft directly (instant); a
                // smooth scroll-behavior here would turn those exact jumps into
                // animations that snap-stop:always could intercept.
                scrollBehavior: 'auto',
                scrollbarWidth: 'none',
                ...style,
                // Size container so snug stage/snap CSS can use cqw/cqh against
                // this scrollport (consumer styles; not a new prop).
                containerType: 'size',
              },
            } as React.ComponentPropsWithRef<'div'>,
            elementProps as React.ComponentPropsWithRef<'div'>,
          ),
          defaultTagName: 'div',
        })}
      </LightboxItemGroupContext.Provider>
    );
  },
);

LightboxSlides.displayName = 'LightboxSlides';

export { LightboxSlides };
export type { LightboxSlidesProps, LightboxSlidesState };
