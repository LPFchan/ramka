'use client';

import * as React from 'react';

import { LightboxSlidesDataAttributes } from './lightbox-data-attributes';
import { LightboxSlidesCssVars } from './lightbox-css-vars';
import { useLightboxContext } from './lightbox-context';
import { useLightboxStyleNonce } from './lightbox-csp';
import { REACT_SUPPORTS_STYLE_HOISTING } from './react-style-hoisting';
import { SSR_INITIAL_SLIDE_CSS, SSR_INITIAL_SLIDE_HREF } from './ssr-initial-slide';
import {
  measureSlidesGeometry,
  slideIndexFromInlinePosition,
  slideInlinePositionForIndex,
  SLIDE_SELECTOR,
} from './lightbox-slides-geometry';
import { readInlineScroll, writeInlineScroll } from './lightbox-direction';
import { isFirefox } from './is-firefox';
import { useDirectionMismatchWarning } from './use-direction-mismatch-warning';
import { useIsServerPaint } from './use-server-paint';
import { useLightboxZoomPublish } from './lightbox-zoom-context';
import { mergeProps } from '../render/merge-props';
import { useRender } from '../render/use-render';

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
 * inside a `<dialog>`/portal on mobile Safari, unlike `getBoundingClientRect`.
 * The scroller is `position: relative` so it is the slides' `offsetParent`;
 * measurements also subtract a shared ancestor inset when it is not:
 *
 *   offsets[i] = inlineStart(slideᵢ) + widthᵢ/2 − clientWidth/2
 *   index      = nearest offsets[i] to the inline scroll position
 *   (uniform full-bleed tracks still use the O(1) round((inline−base)/step) path)
 *
 * Positions are **inline** (distance from the inline-start edge), so index order
 * and position order agree in both reading directions. `lightbox-direction.ts`
 * converts to and from physical `scrollLeft`, which runs negative under RTL.
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
 *   settles. The lock clears on `scrollend` (with a `SCROLL_IDLE_MS` fallback
 *   only in engines without that event, or after a trackpad pinch aborts the
 *   swipe without `scrollend`), at which point the marker is
 *   reconciled to the resting position.
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
 * primitive and no state-sync bridge. Publishes `preload` so `Lightbox.Item`s
 * inside `Lightbox.Slide`s gate their contents, and carries `data-orientation`
 * so shared CSS (e.g. disabling item entrance fades inside a scroller) keeps
 * working.
 */

/** How many neighbors of the active item keep their Item contents mounted. */
const LightboxSlidesPreloadContext = React.createContext(Number.POSITIVE_INFINITY);

function useSlidesPreload(): number {
  return React.useContext(LightboxSlidesPreloadContext);
}

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
  /**
   * First-paint slide positioning for pages that SERVER-RENDER an open
   * lightbox (deep links rendering `Portal container={null}`). A scroll
   * offset cannot be serialized into HTML, so such pages otherwise paint
   * slide 0 (or a blank past the `preload` window) until hydration. While
   * this is on, the server HTML carries a transform that translates every
   * slide by `activeIndex × (100% + gap)` so the active slide occupies the
   * scrollport at scroll offset 0; the post-hydration commit swaps the real
   * scroll offset in and drops the transform together — no flash, every
   * browser.
   *
   * ONLY for scrollport-wide slides (`flex: 0 0 100%` tracks): the percentage
   * resolves against each slide's own width, so content-sized (snug) slides
   * would shift by unequal distances. If the track has a `gap`, mirror it
   * into `--lightbox-ssr-slide-gap` (see `LightboxSlidesCssVars`). Without
   * the opt-in, the library still marks the active item so engines with
   * `scroll-initial-target` position any layout natively; other engines keep
   * the hydration jump. Client-side opens are unaffected either way — the
   * stand-in only ever renders for server paint + hydration.
   *
   * Degradation: the transform rule ships as a React 19 hoistable `<style>`
   * tag. On React 18, or under a strict CSP without the nonce wired (see
   * `Lightbox.CSPProvider`), the tag is unavailable and the server paint
   * shows slide 0 with the scroller frozen until the hydration jump — the
   * pre-existing baseline, never anything worse. @default false
   */
  ssrSlideShift?: boolean;
}

/**
 * Quiet gap (ms without a scroll event) after which we treat a user scroll as
 * finished — used only in engines without a *reliable* `scrollend` (Safari
 * < 17.4 has none; Gecko advertises it but often never fires it after a wheel
 * scroll settles through snap — see `scrollendReliable`). Must not run
 * alongside a reliable `scrollend`: a trackpad swipe that turns from
 * horizontal to vertical stops producing `scroll` events
 * (`overflow-y: hidden`) while the gesture is still down, and unlocking on
 * that quiet gap lets pull-to-dismiss start mid-swipe. `scrollend` fires when
 * the user has released and the scroller is at rest.
 */
const SCROLL_IDLE_MS = 140;

/**
 * Safari half-decoded-tile fix is only needed after a jump *settles*. During
 * rapid marker changes (thumbnail-strip scrub, key repeat) a synchronous visibility
 * toggle per jump forces layout every frame — debounce to the last index.
 */
const REPAINT_IDLE_MS = 120;

/** Must match the slides viewport React `style.scrollSnapType`. */
const SLIDES_SCROLL_SNAP_TYPE = 'x mandatory';

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}


const slidesStateAttributesMapping = {
  activeIndex: (value: unknown) => ({ 'data-active-index': String(value) }),
  direction: (value: unknown) => ({ 'data-direction': String(value) }),
};

const LightboxSlides = React.forwardRef<HTMLDivElement, LightboxSlidesProps>(
  function LightboxSlides(props, forwardedRef) {
    const { render, preload = 1, ssrSlideShift = false, style, ...elementProps } = props;
    const {
      activeIndex,
      direction,
      dir,
      setActiveIndex,
      navigationLockedRef,
      itemCount,
      slidesViewportRef,
      slidesGeometryRef,
      notifySlidesViewport,
    } = useLightboxContext();
    const { activeZoomRef } = useLightboxZoomPublish();
    const styleNonce = useLightboxStyleNonce();

    const viewportRef = React.useRef<HTMLDivElement | null>(null);
    // Local mirror of context `slidesGeometryRef` for hot scroll paths.
    const geometryRef = slidesGeometryRef;
    // True while our own programmatic jump is settling (including the follow-up
    // frame that restores scroll-snap). Scroll events in this window must not
    // lock navigation — snap restore often emits a second scroll after the
    // exact `scrollLeft` set, and mistaking that for a user fling drops the
    // next thumbnail/keyboard update (thumbnail-strip scrub feels lagged).
    const programmaticRef = React.useRef(false);
    const jumpTargetRef = React.useRef(0);
    /** Bumps on every `scrollToIndex` so superseded rAF tails no-op. */
    const jumpGenRef = React.useRef(0);
    /**
     * Nested `scrollToIndex` calls (resize storms) briefly set
     * `scrollSnapType: none`. Depth-count restores so a superseded rAF cannot
     * leave snap stuck at `none` after capturing the in-flight value.
     */
    const snapSuppressDepthRef = React.useRef(0);
    /**
     * True while a viewport resize is re-snapping to `activeIndex`. Mid-resize
     * `scrollLeft` is stale px (slides are % width) — must not be read as a
     * user swipe or the active item jumps. See `overflow-anchor: none` + RO.
     */
    const resizingRef = React.useRef(false);
    /** Bumps on every resize pass so superseded re-snap rAF tails no-op. */
    const resizeGenRef = React.useRef(0);
    const repaintTimerRef = React.useRef(0);
    // setTimeout id for the scroll-idle fallback that clears the lock in browsers
    // without `scrollend`, and after a trackpad pinch interrupts an in-flight
    // swipe (`scrollend` may never fire — see `pinchInterruptedRef`).
    const idleTimerRef = React.useRef(0);
    /**
     * True when a trackpad pinch landed while the user-fling lock was held.
     * Pinch reclassifies the gesture (Safari `gesturestart` / Chrome
     * `ctrlKey+wheel` / Safari ⌘+scroll `metaKey`) and often aborts the swipe
     * without `scrollend`, which would freeze pull/pinch/thumbs until the next
     * real swipe. While set, the idle fallback runs even in `scrollend`
     * engines.
     */
    const pinchInterruptedRef = React.useRef(false);
    // Always-fresh mirror of activeIndex for use inside stable event listeners.
    const activeIndexRef = React.useRef(activeIndex);
    activeIndexRef.current = activeIndex;

    // The `ssrSlideShift` transform stand-in (see ssr-initial-slide.ts). Active
    // ONLY while the markup on screen is server HTML (`useIsServerPaint`);
    // React's post-hydration flip to `false` is what retires the stand-in
    // (real scroll in, transform out, in one commit). NOTE the retire's
    // timing: the flip is a passive-effect re-render after the hydration
    // commit — usually but not provably before the hydrated frame paints.
    // That's fine for the slides themselves (a shifted frame is
    // pixel-identical to the real offset — the whole point of the stand-in),
    // but nothing that positions against the scroller may trust its offset
    // while the shift attribute is present: ThumbnailStrip holds
    // `data-positioned` back for exactly this window and re-enters via the
    // retire's notifySlidesViewport.
    //
    // Pure client-side opens NEVER render the shift — not even for a retired
    // first pass. An earlier version did (state initialized from the prop, a
    // mount layout effect retired it) and that was a live index-corruption bug,
    // not just waste: the mount jump writes the real scrollLeft while the
    // slides are still translated, and Chromium's scroll-snap target tracking
    // captures whichever slide *visually* occupies that offset — slide 2×index
    // under a −index shift. When the stand-in then retires, the engine
    // re-aligns to its captured target and silently scrolls the viewport to
    // slide 2×index; the settle handler reads that as a user swipe and commits
    // the wrong index. Belt to that suspender: while the stand-in IS applied
    // (server paint → hydration), the inline style below also disables
    // scroll-snap, so no engine can capture a snap target through transformed
    // positions in the first place.
    const isServerPaint = useIsServerPaint();
    const ssrShiftActive = ssrSlideShift && isServerPaint;

    const mergedRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        const prev = viewportRef.current;
        viewportRef.current = node;
        // Publish for scroll-linked chrome (ThumbnailStrip). Clear only if we still own
        // the slot — another Slides mount could have replaced us.
        if (node) {
          slidesViewportRef.current = node;
        } else if (slidesViewportRef.current === prev) {
          slidesViewportRef.current = null;
        }
        if (!node && prev) {
          // Unmount mid-jump: never leave the host with snap suppressed.
          snapSuppressDepthRef.current = 0;
          prev.style.scrollSnapType = SLIDES_SCROLL_SNAP_TYPE;
        }
        notifySlidesViewport();
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef, slidesViewportRef, notifySlidesViewport],
    );

    useDirectionMismatchWarning(viewportRef, dir);

    const indexFromScroll = React.useCallback(
      (viewport: HTMLElement): number => {
        return slideIndexFromInlinePosition(readInlineScroll(viewport, dir), geometryRef.current);
      },
      [dir],
    );

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
    //
    // Never save/restore `scrollSnapType` from the live inline style: overlapping
    // jumps (resize storms) would capture `none` and permanently stick snap off
    // when a superseded rAF returns early. Depth-count + constant restore only.
    const scrollToIndex = React.useCallback(
      (index: number) => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        // `max` is the largest *inline* position, which is direction-agnostic —
        // the physical range is `[0, max]` in LTR and `[-max, 0]` in RTL, and
        // `writeInlineScroll` handles that.
        const max = viewport.scrollWidth - viewport.clientWidth;
        const target = clamp(
          slideInlinePositionForIndex(index, geometryRef.current),
          0,
          max > 0 ? max : 0,
        );
        if (Math.abs(readInlineScroll(viewport, dir) - target) < 1) {
          return;
        }

        programmaticRef.current = true;
        jumpTargetRef.current = target;
        const gen = (jumpGenRef.current += 1);

        if (snapSuppressDepthRef.current === 0) {
          viewport.style.scrollSnapType = 'none';
        }
        snapSuppressDepthRef.current += 1;

        writeInlineScroll(viewport, dir, target);
        requestAnimationFrame(() => {
          const vp = viewportRef.current;
          // Always release our suppress slot — even when this jump was
          // superseded — so snap cannot stick at `none`.
          snapSuppressDepthRef.current = Math.max(0, snapSuppressDepthRef.current - 1);
          if (vp && snapSuppressDepthRef.current === 0) {
            vp.style.scrollSnapType = SLIDES_SCROLL_SNAP_TYPE;
          }
          if (!vp || gen !== jumpGenRef.current) return;
          if (Math.abs(readInlineScroll(vp, dir) - target) >= 1) {
            // Keep the programmatic window open through the restore write so its
            // scroll event can't take the user-fling lock.
            programmaticRef.current = true;
            jumpTargetRef.current = target;
            writeInlineScroll(vp, dir, target);
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
      [repaintSlide, dir],
    );

    // Measure on mount / item-count change, and re-center on viewport resize so
    // the active slide stays centered (a fractional scrollLeft would otherwise
    // drift after a resize).
    React.useLayoutEffect(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      geometryRef.current = measureSlidesGeometry(viewport, dir);
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
        const next = measureSlidesGeometry(viewport, dir);
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

        // Hold scroll→index updates: layout leaves scrollLeft in stale px while
        // slide widths (% / cqw) change, so nearest-index math picks the wrong
        // slide until we re-snap. Chrome's snap-after-layout helps; Safari less
        // so — we always pin `activeIndex` and ignore mid-resize scroll echoes.
        const gen = (resizeGenRef.current += 1);
        resizingRef.current = true;
        pinchInterruptedRef.current = false;
        navigationLockedRef.current = false;
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = 0;

        notifySlidesViewport();
        scrollToIndex(activeIndexRef.current);

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (gen !== resizeGenRef.current) return;
            // Second pin after UA snap-after-layout / anchoring has settled.
            scrollToIndex(activeIndexRef.current);
            resizingRef.current = false;
          });
        });
      });
      observer.observe(viewport);
      return () => observer.disconnect();
    }, [itemCount, scrollToIndex, notifySlidesViewport, navigationLockedRef, dir]);

    // Drive scroll position from the active index. Skip when the viewport is
    // already showing it (our own swipe-derived updates, which must not
    // re-trigger a jump and fight momentum).
    //
    // Also skip — and defer to the retire commit — while the SSR shift
    // stand-in is applied. The real offset is UNREACHABLE under the shift in
    // WebKit: translated boxes feed the scrollable-overflow area there, so
    // content shifted inline-start shrinks `scrollWidth` by exactly the shift
    // and both our clamp and the engine cap the write one-or-more slides short
    // (Safari painted `activeIndex − shift` frames before a later jump
    // corrected it; Chromium/Gecko keep untransformed scroll bounds and never
    // showed it). When the stand-in retires, `ssrShiftActive` re-runs this
    // effect in the same pre-paint commit with real bounds — jump there, then
    // re-notify scroll-linked chrome (ThumbnailStrip subscribers re-position
    // synchronously) so nothing ever paints against the held-back offset 0.
    const pendingSsrJumpRef = React.useRef(false);
    React.useLayoutEffect(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      if (ssrShiftActive) {
        pendingSsrJumpRef.current = true;
        return;
      }
      const ssrHandoff = pendingSsrJumpRef.current;
      pendingSsrJumpRef.current = false;
      const derived = indexFromScroll(viewport);
      if (derived !== activeIndex) scrollToIndex(activeIndex);
      if (ssrHandoff) notifySlidesViewport();
    }, [activeIndex, indexFromScroll, scrollToIndex, ssrShiftActive, notifySlidesViewport]);

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
      // True once a real `scroll` event has fired for the current lock. Touch
      // can lock speculatively (horizontal slide at 1×) with no compositor
      // scroll — and then nothing emits `scrollend`.
      let sawScrollSinceLock = false;
      let frame = 0;
      const settle = () => {
        if (frame !== 0) {
          cancelAnimationFrame(frame);
          frame = 0;
        }
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = 0;
        sawScrollSinceLock = false;
        pinchInterruptedRef.current = false;
        navigationLockedRef.current = false;
        programmaticRef.current = false;
        // Resize re-snap owns the marker — don't adopt a stale mid-layout index.
        if (resizingRef.current) {
          return;
        }
        const derived = indexFromScroll(viewport);
        if (derived !== activeIndexRef.current) setActiveIndex(derived, 'scroll');
      };
      // Gecko advertises `scrollend` but frequently never fires it for a wheel
      // scroll that settles through scroll snap (Bugzilla 1993068; the
      // "scrollend fired after snap completion" WPT fails on Gecko), and can
      // deliver a late `scroll` *after* `scrollend` — which re-locks with no
      // follow-up settle signal. Either way the fling lock is held forever and
      // every gated surface (thumbs/keyboard/buttons/zoom/pull) goes dead until
      // a trackpad pinch happens to arm the fallback. Treat Firefox as a
      // no-`scrollend` engine: `scrollend` still settles immediately when it
      // does fire; the quiet-gap timer is the guaranteed release.
      const scrollendReliable = 'onscrollend' in window && !isFirefox();
      const armIdleFallback = () => {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = 0;
        // `scrollend` is the settle signal (user released, scroller at rest).
        // A quiet gap is not: turning a trackpad swipe vertical stops `scroll`
        // events without ending the gesture. Only engines without a *reliable*
        // `scrollend` (Safari < 17.4, Firefox — see above) fall back to idle —
        // unless a trackpad pinch aborted the swipe, in which case `scrollend`
        // often never comes.
        if (scrollendReliable && !pinchInterruptedRef.current) return;
        idleTimerRef.current = window.setTimeout(settle, SCROLL_IDLE_MS);
      };
      const lockUserScroll = () => {
        if (programmaticRef.current) return;
        if (!navigationLockedRef.current) sawScrollSinceLock = false;
        navigationLockedRef.current = true;
        // Arm settle when locking. `onScroll` may set the lock before `process`
        // runs; if that rAF is skipped (programmatic race) or this effect
        // rebinds, a bare lock with no settle path leaves pull/pinch/double-tap
        // dead until the next real swipe. `scrollend` is that path when present;
        // otherwise the idle fallback is.
        armIdleFallback();
      };

      const isParkedOnJumpTarget = () =>
        Math.abs(readInlineScroll(viewport, dir) - jumpTargetRef.current) < 1;

      const process = () => {
        frame = 0;
        // Entire programmatic jump window (exact set + snap restore): ignore.
        // Clearing happens in `scrollToIndex`'s rAF tail — do not clear here on
        // "near target", or the restore frame's scroll is misclassified as a fling.
        if (programmaticRef.current || resizingRef.current) {
          // Race: `onScroll` may have locked in the same frame before
          // `scrollToIndex` flipped `programmaticRef`. Undo the false fling
          // lock so open/jump doesn't suppress gestures until a user swipe.
          sawScrollSinceLock = false;
          pinchInterruptedRef.current = false;
          navigationLockedRef.current = false;
          window.clearTimeout(idleTimerRef.current);
          idleTimerRef.current = 0;
          return;
        }
        // Late echo after the programmatic flag cleared (snap restore / subpixel
        // re-set): still parked on the jump target. A real user swipe changes
        // `scrollLeft` before this handler runs, so it won't match.
        if (isParkedOnJumpTarget()) {
          sawScrollSinceLock = false;
          pinchInterruptedRef.current = false;
          navigationLockedRef.current = false;
          window.clearTimeout(idleTimerRef.current);
          idleTimerRef.current = 0;
          return;
        }
        // `scrollend` already settled (⌘+/- aborts the swipe, then this rAF
        // from the last `scroll` used to re-lock with no follow-up scrollend).
        if (!navigationLockedRef.current) return;
        const derived = indexFromScroll(viewport);
        if (derived !== activeIndexRef.current) setActiveIndex(derived, 'scroll');
      };
      const onScroll = () => {
        // Lock synchronously — don't wait for the rAF `process` tick. A second
        // finger can land in the same frame as the first scroll event; delaying
        // the lock lets zoom arm a pinch mid-swipe. Skip programmatic jumps and
        // open/snap echoes still parked on the jump target (those used to leave
        // `navigationLockedRef` stuck true on the first slide).
        if (!programmaticRef.current && !resizingRef.current && !isParkedOnJumpTarget()) {
          lockUserScroll();
          sawScrollSinceLock = true;
        }
        if (frame === 0) frame = requestAnimationFrame(process);
      };

      // iOS Safari often starts compositor scrolling without delivering
      // `pointermove` to Zoom — so a second finger can arm a pinch before the
      // first `scroll` event flips the lock. Capture-phase touch listeners lock
      // at 1× as soon as a single finger slides horizontally (or a second finger
      // lands after that). Vertical slides are pull-to-dismiss — do not lock.
      // When already zoomed, don't lock from touch alone — that would abort
      // one-finger pan / intentional pinch via `isScrollingRef`.
      const TOUCH_LOCK_PX = 10;
      let touchStartX = 0;
      let touchStartY = 0;
      let sawSingleFinger = false;
      let singleFingerSlid = false;
      let hadMultiTouch = false;
      const isAtRestZoom = () => (activeZoomRef.current?.getZoom() ?? 1) <= 1 + 1e-6;

      const onTouchStart = (event: TouchEvent) => {
        if (event.touches.length > 1) {
          hadMultiTouch = true;
          if (sawSingleFinger && singleFingerSlid && isAtRestZoom()) {
            lockUserScroll();
          }
          return;
        }
        if (event.touches.length === 1) {
          sawSingleFinger = true;
          singleFingerSlid = false;
          touchStartX = event.touches[0]!.clientX;
          touchStartY = event.touches[0]!.clientY;
        }
      };
      const onTouchMove = (event: TouchEvent) => {
        // Leftover finger after a pinch is not a gallery swipe — snap-back
        // often reports 1× while that finger is still down, and treating it as
        // a horizontal slide would lock with no `scroll`/`scrollend`.
        if (hadMultiTouch) return;
        if (event.touches.length !== 1 || !sawSingleFinger || singleFingerSlid) return;
        const touch = event.touches[0]!;
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;
        if (Math.hypot(dx, dy) < TOUCH_LOCK_PX) {
          return;
        }
        singleFingerSlid = true;
        // Horizontal slide → gallery swipe. Vertical → pull-to-dismiss.
        if (isAtRestZoom() && Math.abs(dx) >= Math.abs(dy)) {
          lockUserScroll();
        }
      };
      const onTouchEnd = (event: TouchEvent) => {
        if (event.touches.length > 0) return;
        sawSingleFinger = false;
        singleFingerSlid = false;
        hadMultiTouch = false;
        // Speculative touch lock with no compositor scroll: nothing will emit
        // `scrollend`. Unlock so the next pull/pinch/double-tap isn't dead.
        // A real swipe that did scroll still waits for `scrollend` (momentum).
        if (navigationLockedRef.current && !sawScrollSinceLock) {
          settle();
        }
      };

      // Trackpad pinch mid-swipe: Safari GestureEvent / Chrome ctrlKey+wheel /
      // Safari ⌘+scroll (metaKey). Must stay passive — a non-passive wheel on
      // this scroller kills Safari compositor momentum. Observation only;
      // native pinch is already swallowed by `useNativePinchGuard`.
      const onTrackpadPinch = (event: Event) => {
        if (!navigationLockedRef.current) return;
        if (event.type === 'wheel') {
          const wheel = event as WheelEvent;
          if (!wheel.ctrlKey && !wheel.metaKey) return;
        }
        pinchInterruptedRef.current = true;
        armIdleFallback();
      };

      viewport.addEventListener('scroll', onScroll, { passive: true });
      viewport.addEventListener('scrollend', settle);
      viewport.addEventListener('wheel', onTrackpadPinch, { passive: true, capture: true });
      viewport.addEventListener('gesturestart', onTrackpadPinch, { capture: true });
      viewport.addEventListener('gesturechange', onTrackpadPinch, { capture: true });
      viewport.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
      viewport.addEventListener('touchmove', onTouchMove, { passive: true, capture: true });
      viewport.addEventListener('touchend', onTouchEnd, { passive: true, capture: true });
      viewport.addEventListener('touchcancel', onTouchEnd, { passive: true, capture: true });
      return () => {
        if (frame !== 0) cancelAnimationFrame(frame);
        window.clearTimeout(idleTimerRef.current);
        window.clearTimeout(repaintTimerRef.current);
        idleTimerRef.current = 0;
        viewport.removeEventListener('scroll', onScroll);
        viewport.removeEventListener('scrollend', settle);
        viewport.removeEventListener('wheel', onTrackpadPinch, true);
        viewport.removeEventListener('gesturestart', onTrackpadPinch, true);
        viewport.removeEventListener('gesturechange', onTrackpadPinch, true);
        viewport.removeEventListener('touchstart', onTouchStart, true);
        viewport.removeEventListener('touchmove', onTouchMove, true);
        viewport.removeEventListener('touchend', onTouchEnd, true);
        viewport.removeEventListener('touchcancel', onTouchEnd, true);
      };
    }, [indexFromScroll, setActiveIndex, navigationLockedRef, activeZoomRef, dir]);

    const state = React.useMemo<LightboxSlidesState>(
      () => ({ activeIndex, direction }),
      [activeIndex, direction],
    );

    return (
      <LightboxSlidesPreloadContext.Provider value={preload}>
        {/*
          SSR initial-slide rules (scroll-initial-target + the ssrSlideShift
          transform — see ssr-initial-slide.ts). Hoisted into <head> and deduped
          by `href` on React 19; gated off on React 18 (no hoisting — see
          react-style-hoisting.ts). Deliberately NO CSSOM fallback: these rules
          only matter for the server paint, and both attributes they match are
          gone by the end of the hydration commit, so a client-injected copy
          could never apply. Where the tag is unavailable or refused (React 18,
          strict CSP without a `Lightbox.CSPProvider` nonce) the page keeps
          the pre-existing hydration-jump behavior.
        */}
        {REACT_SUPPORTS_STYLE_HOISTING ? (
          <style href={SSR_INITIAL_SLIDE_HREF} precedence="ramka" nonce={styleNonce}>
            {SSR_INITIAL_SLIDE_CSS}
          </style>
        ) : null}
        {useRender({
          render,
          ref: mergedRef,
          state,
          stateAttributesMapping: slidesStateAttributesMapping,
          props: mergeProps<'div'>(
            {
              role: 'group',
              [LightboxSlidesDataAttributes.slides]: '',
              // SSR transform stand-in (see ssr-initial-slide.ts). Present in
              // the server HTML and the (identical) hydration render; the
              // mount layout effect retires it pre-paint.
              ...(ssrShiftActive ? { [LightboxSlidesDataAttributes.ssrShift]: '' } : null),
              // APG Carousel pattern: the container that wraps the slides is a
              // carousel, but the word announcing that is copy, so it is yours
              // to pass — `aria-roledescription="carousel"` translated, plus an
              // `aria-label` naming *which* carousel (leave "carousel" out of
              // the label; the roledescription already says it).
              //
              // No `tabIndex` here, deliberately. Automated checkers flag a
              // scroll container with no focusable content (axe
              // `scrollable-region-focusable`) because a keyboard user would
              // otherwise have no way to scroll it. That premise does not hold
              // for this scroller: Content takes focus when the dialog opens
              // and owns Arrow / Home / End, which move the scroller through
              // real navigation. Adding a tab stop here would insert a stop
              // with nothing to operate and hand the same arrow keys a second
              // (native, non-snapping) handler.
              'data-orientation': 'horizontal',
              // The scroller assumptions, baked in. Consumers can still layer
              // gap/padding/scrollbar-hiding via className/style; the offset-based
              // geometry accounts for any gap automatically.
              style: {
                display: 'flex',
                overflowX: 'auto',
                overflowY: 'hidden',
                overscrollBehaviorX: 'contain',
                scrollSnapType: SLIDES_SCROLL_SNAP_TYPE,
                // Programmatic navigation sets scrollLeft directly (instant); a
                // smooth scroll-behavior here would turn those exact jumps into
                // animations that snap-stop:always could intercept.
                scrollBehavior: 'auto',
                scrollbarWidth: 'none',
                // Carousels: opt out of scroll anchoring. Default `auto` can nudge
                // `scrollLeft` during resize/reflow and fight snap-after-layout /
                // our active-index pin (Chromium carousel footguns do the same).
                overflowAnchor: 'none',
                ...style,
                // Containing block for slides so `offsetLeft` is scroller-relative
                // (a static scroller inside a positioned dialog otherwise inherits
                // the dialog inset and lags the active index — see geometry).
                position: 'relative',
                // Size container so snug stage/snap CSS can use cqw/cqh against
                // this scrollport (consumer styles; not a new prop).
                containerType: 'size',
                // SSR shift inputs (after `...style` — they must win while the
                // stand-in is on). `overflow-x: hidden` freezes the scroller:
                // it is a live native scroller whose content has merely been
                // translated, so a pre-hydration swipe would reveal the blank
                // positions the slides vacated. Programmatic `scrollLeft`
                // writes (the hydration jump) work on hidden overflow.
                // Deliberate: this block is NOT gated on style hoisting, so a
                // React 18 server paint (no hoistable, no transform rule) still
                // gets the freeze — slide 0 shown un-swipeable until hydration,
                // rather than a scroller the user can fling pre-hydration and
                // then have yanked away by the jump.
                // `scroll-snap-type: none` because the translated positions must
                // never feed snap-target tracking: the hydration jump writes the
                // real scrollLeft while slides are still shifted, and an engine
                // that captures the slide *visually* at that offset (Chromium
                // does) re-aligns to it — i.e. scrolls to the wrong slide — the
                // moment the transform leaves. The whole block leaves with
                // `ssrShiftActive`.
                ...(ssrShiftActive
                  ? ({
                      overflowX: 'hidden',
                      scrollSnapType: 'none',
                      [LightboxSlidesCssVars.ssrIndex]: activeIndex,
                      [LightboxSlidesCssVars.ssrShiftSign]: dir === 'rtl' ? 1 : -1,
                    } as React.CSSProperties)
                  : null),
              },
            } as React.ComponentPropsWithRef<'div'>,
            elementProps as React.ComponentPropsWithRef<'div'>,
          ),
          defaultTagName: 'div',
        })}
      </LightboxSlidesPreloadContext.Provider>
    );
  },
);

LightboxSlides.displayName = 'LightboxSlides';

export { LightboxSlides, useSlidesPreload };
export type { LightboxSlidesProps, LightboxSlidesState };
