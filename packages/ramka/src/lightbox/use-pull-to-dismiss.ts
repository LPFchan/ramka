'use client';

import * as React from 'react';

import {
  clamp,
  computePullTransform,
  computePullVelocity,
  resolveDragAxis,
  shouldDismissPull,
  springEasingLinear,
  wheelAxis,
} from './gesture-math';
import { LightboxContentCssVars } from './lightbox-css-vars';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIRECTION_LOCK_DISTANCE = 6;
const DISMISS_DISTANCE = 100;
const DISMISS_VELOCITY = 400;
const SNAP_DURATION = 270;
// Critically damped (no overshoot). A higher `settle` front-loads the motion so
// most of the distance is covered early and the spring arrives decisively,
// trimming the soft asymptotic tail that reads as "lazy".
const SNAP_DAMPING = 1;
const SNAP_SETTLE = 7.5;
// Fallback for engines without CSS `linear()` easing support (pre-2024 Safari).
// A firm, no-overshoot decelerating ease matching the near-critically-damped
// spring below (velocity follow-through is lost, but it won't look bouncy).
const SNAP_EASING_FALLBACK = 'cubic-bezier(0.33, 1, 0.68, 1)';
// Clamp the normalized release velocity fed into the spring so a tiny pull
// released with a quick flick can't blow up the follow-through.
const MAX_SNAP_VELOCITY = 2.5;
const MIN_SCALE = 0.85;
const VELOCITY_SAMPLES = 5;

/**
 * CSS custom property exposing pull progress (0 at rest → 1 at the dismiss
 * threshold) on both the content and backdrop elements while a drag is in
 * flight. The library deliberately does NOT hardcode a backdrop opacity
 * curve — consumers derive whatever styling they like (backdrop opacity,
 * blur, chrome fade, image scale) from this variable, e.g.
 * `opacity: calc(1 - var(--lightbox-pull-progress, 0) * 0.6)`.
 *
 * @see LightboxContentCssVars.pullProgress
 */
const PULL_PROGRESS_VAR = LightboxContentCssVars.pullProgress;

/**
 * CSS custom properties publishing the snap-back's duration and easing while a
 * cancelled pull springs back to rest. They make the item spring the single
 * source of truth for the snap-back: consumers reference these in their
 * transition so anything derived from {@link PULL_PROGRESS_VAR} (backdrop
 * opacity, chrome, blur) eases back on the exact same curve and duration.
 * Set on release, removed once at rest, so open/close fades keep their own
 * timing via the consumer's `var(..., fallback)`.
 */
const PULL_SNAP_DURATION_VAR = LightboxContentCssVars.pullSnapDuration;
const PULL_SNAP_EASING_VAR = LightboxContentCssVars.pullSnapEasing;

// Feature-detect CSS `linear()` easing once. When unsupported (pre-2024 Safari)
// both the WAAPI transform animation and the published CSS var use the static
// fallback curve, so they can never disagree.
const supportsLinearEasing =
  typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
    ? CSS.supports('transition-timing-function', 'linear(0, 1)')
    : false;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PullToDismissOptions {
  contentRef: React.RefObject<HTMLElement | null>;
  backdropRef: React.RefObject<HTMLElement | null>;
  /** The currently-active slide element, tracked in context by Lightbox.Item. */
  activeItemRef: React.RefObject<HTMLElement | null>;
  /**
   * Optional `Lightbox.Stage` host. When set, trackpad wheel pull-to-dismiss
   * only starts if the wheel target is inside Stage — so side panels outside
   * Stage keep native scroll. When null/omitted, any wheel over Content can
   * pull (Content itself is the stage).
   */
  stageRef?: React.RefObject<HTMLElement | null>;
  /**
   * Item element → its registered content/morph element (the `<img>` marked via
   * `imageRef`, or a `morphRef` override). The touch gate starts a pull
   * only when the finger lands inside this element, so grabbing an item's
   * letterbox padding or chrome never drags. Falls back to the whole item box
   * when an item registered nothing.
   */
  itemContentElementsRef?: React.RefObject<WeakMap<HTMLElement, HTMLElement>>;
  getZoom: () => number;
  onClose: () => void;
  disabled?: boolean;
  /**
   * True while a `Lightbox.Slides` user scroll/fling is in flight. The pull
   * gesture won't start (touch or trackpad) while this is set, so a swipe can't
   * be turned into a dismiss mid-scroll. Stays `false` for non-`Slides`
   * lightboxes, so their pull-to-dismiss is never gated.
   */
  isScrollingRef?: React.RefObject<boolean>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

function usePullToDismiss({
  contentRef,
  backdropRef,
  activeItemRef,
  stageRef,
  itemContentElementsRef,
  getZoom,
  onClose,
  disabled = false,
  isScrollingRef,
}: PullToDismissOptions) {
  const pointerIdRef = React.useRef<number | null>(null);
  const startYRef = React.useRef(0);
  const startXRef = React.useRef(0);
  const directionRef = React.useRef<'none' | 'vertical' | 'horizontal'>('none');
  const velocityHistoryRef = React.useRef<{ y: number; t: number }[]>([]);
  const isPullingRef = React.useRef(false);
  const animationRef = React.useRef<Animation | null>(null);
  const dragTargetRef = React.useRef<HTMLElement | null>(null);
  // Last *displayed* (damped) vertical offset, used as the spring amplitude so
  // the release velocity maps to a correctly-scaled follow-through.
  const lastAppliedYRef = React.useRef(0);

  // Trackpad (wheel) pull-to-dismiss state. A two-finger swipe emits a stream
  // of `wheel` events with no explicit end, so gesture completion is inferred
  // from an idle timer.
  const wheelDirRef = React.useRef<'none' | 'vertical' | 'horizontal'>('none');
  const wheelPullXRef = React.useRef(0);
  const wheelPullYRef = React.useRef(0);
  const wheelCountRef = React.useRef(0);
  const wheelIdleRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Once a wheel flick commits to dismissing, ignore the residual momentum
  // stream so it can't start a fresh pull and reset the item transform mid-
  // close (visible as a snap-back on Safari, whose View Transition snapshot is
  // captured a frame after the momentum event that would reset it).
  const wheelDismissedRef = React.useRef(false);

  const cleanup = React.useCallback(() => {
    pointerIdRef.current = null;
    directionRef.current = 'none';
    velocityHistoryRef.current = [];
    isPullingRef.current = false;
    // dragTargetRef is intentionally NOT cleared here — snapBack() and
    // clearTransform() still need it after cleanup runs in handlePointerUp.
  }, []);

  const applyTransform = React.useCallback(
    (rawDeltaX: number, rawDeltaY: number) => {
      const target = dragTargetRef.current;
      if (!target) return;

      const { x, y, scale, progress } = computePullTransform(
        rawDeltaX,
        rawDeltaY,
        DISMISS_DISTANCE,
        MIN_SCALE,
      );

      target.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
      lastAppliedYRef.current = y;

      // Publish the raw progress and let consumers decide how it maps to
      // visuals. Set it on both the content and the (separately portaled)
      // backdrop so either subtree can react to it.
      const progressValue = String(progress);
      contentRef.current?.style.setProperty(PULL_PROGRESS_VAR, progressValue);
      backdropRef.current?.style.setProperty(PULL_PROGRESS_VAR, progressValue);
    },
    [contentRef, backdropRef],
  );

  const clearTransform = React.useCallback(() => {
    const content = contentRef.current;
    const backdrop = backdropRef.current;
    if (dragTargetRef.current) {
      dragTargetRef.current.style.transform = '';
      dragTargetRef.current = null;
    }
    lastAppliedYRef.current = 0;
    for (const el of [content, backdrop]) {
      if (!el) continue;
      el.removeAttribute('data-pulling');
      el.style.removeProperty(PULL_PROGRESS_VAR);
      el.style.removeProperty(PULL_SNAP_DURATION_VAR);
      el.style.removeProperty(PULL_SNAP_EASING_VAR);
    }
  }, [contentRef, backdropRef]);

  const snapBack = React.useCallback((velocity = 0) => {
    const target = dragTargetRef.current;
    const content = contentRef.current;
    const backdrop = backdropRef.current;
    const releaseY = lastAppliedYRef.current;

    // Honor reduced-motion: snap straight to rest with no spring (mirrors the
    // zoom animations, which already collapse to a 0ms transition). The var
    // published below goes to 0ms too, so the backdrop/chrome fade is instant
    // in lockstep.
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = prefersReducedMotion ? 0 : SNAP_DURATION;

    // Feed the release velocity into a spring so the snap-back continues in the
    // gesture's direction (follow-through) before settling, like native iOS —
    // instead of reversing from a dead stop. Normalize the pointer velocity
    // (px/s) against the animation window and the displayed pull amplitude:
    // `d(fraction)/d(progress)|0 = velocity * durationSeconds / releaseY`.
    // Positive means "still moving away from rest", which the spring carries on.
    const normalizedVelocity =
      duration > 0 && Math.abs(releaseY) > 1
        ? clamp((velocity * (duration / 1000)) / releaseY, -MAX_SNAP_VELOCITY, MAX_SNAP_VELOCITY)
        : 0;

    // Single source of truth for the snap-back timing. The same duration+easing
    // drives the item's WAAPI transform below AND is published as CSS vars so
    // consumer visuals keyed to `--lightbox-pull-progress` (backdrop opacity,
    // chrome, blur) spring back on the identical curve. The easing is a
    // normalized (dimensionless) fraction, so it maps 1:1 onto opacity despite
    // the different amplitude — follow-through and the no-overshoot guarantee
    // included.
    const snapEasing = supportsLinearEasing
      ? springEasingLinear(normalizedVelocity, SNAP_DAMPING, SNAP_SETTLE)
      : SNAP_EASING_FALLBACK;

    // Hand backdrop/chrome styling back to the consumer: publish the snap
    // timing, drop the `data-pulling` flag (re-enabling the transition they
    // suppressed while pulling), and reset progress to 0 so that transition —
    // now on the item's curve+duration — eases everything back to rest.
    for (const el of [content, backdrop]) {
      if (!el) continue;
      el.style.setProperty(PULL_SNAP_DURATION_VAR, `${duration}ms`);
      el.style.setProperty(PULL_SNAP_EASING_VAR, snapEasing);
      el.removeAttribute('data-pulling');
      el.style.setProperty(PULL_PROGRESS_VAR, '0');
    }

    if (!target) {
      dragTargetRef.current = null;
      return;
    }

    const currentTransform = target.style.transform;

    // Clear the inline transform BEFORE starting the animation. The WAAPI
    // animation layer overrides computed values during playback, so the
    // cleared inline style is invisible while the animation runs. When the
    // animation finishes and is cancelled, the underlying computed value is
    // already clean — no flash.
    target.style.transform = '';

    const keyframes = [
      { transform: currentTransform },
      { transform: 'translate(0, 0) scale(1)' },
    ];

    let targetAnim: Animation;
    try {
      targetAnim = target.animate(keyframes, { duration, easing: snapEasing });
    } catch {
      // Easing rejected (e.g. `linear()` unsupported) — fall back to a static curve.
      targetAnim = target.animate(keyframes, { duration, easing: SNAP_EASING_FALLBACK });
    }

    animationRef.current = targetAnim;

    targetAnim.finished.then(() => {
      animationRef.current = null;
      targetAnim.cancel();
      dragTargetRef.current = null;
      // Fully at rest — drop the inline vars so the consumer's fallbacks
      // (`var(--lightbox-pull-progress, 0)`, and their own open/close timing)
      // take over cleanly.
      for (const el of [content, backdrop]) {
        el?.style.removeProperty(PULL_PROGRESS_VAR);
        el?.style.removeProperty(PULL_SNAP_DURATION_VAR);
        el?.style.removeProperty(PULL_SNAP_EASING_VAR);
      }
    }).catch(() => {
      // Animation cancelled — cleanup already handled
    });
  }, [contentRef, backdropRef]);

  const computeVelocity = React.useCallback(() => computePullVelocity(velocityHistoryRef.current), []);

  React.useEffect(() => {
    if (disabled) return;
    const el = contentRef.current;
    if (!el) return;

    // Fresh mount — clear any dismiss latch / pull-dismiss flag left over from
    // a prior close (in case the same element is reused).
    wheelDismissedRef.current = false;
    el.removeAttribute('data-pull-dismissing');

    const handlePointerDown = (event: PointerEvent) => {
      // Touch-only gesture — ignore mouse and pen
      if (event.pointerType !== 'touch') return;
      if (pointerIdRef.current !== null) return;
      // A Lightbox.Slides swipe/fling is in flight — don't start a pull.
      if (isScrollingRef?.current) return;

      // Resolve the owning item from whatever was touched. `data-ramka-item`
      // is the item's structural identity (also used by the wheel path and the
      // morph registry), so this isn't a content-type guess.
      const target = event.target as HTMLElement | null;
      const activeItem = target?.closest('[data-ramka-item]') as HTMLElement | null;
      if (!activeItem) return;

      // Only activate when touching the item's registered content element (the
      // `Lightbox.Media` host, or an `imageRef` / `morphRef` — the same element
      // that morphs), not chrome, backdrop, or the item's empty letterbox
      // padding. When an item registered nothing, fall back to the whole item
      // box so the gesture still works.
      const contentEl = itemContentElementsRef?.current?.get(activeItem) ?? activeItem;
      if (!target || !contentEl.contains(target)) return;

      // Don't activate if zoomed or if zoom gestures are in progress
      if (getZoom() > 1) return;
      if (el.hasAttribute('data-zooming')) return;

      // Cancel any in-progress snap-back
      if (animationRef.current) {
        animationRef.current.cancel();
        animationRef.current = null;
        clearTransform();
      }

      dragTargetRef.current = activeItem;
      pointerIdRef.current = event.pointerId;
      startYRef.current = event.clientY;
      startXRef.current = event.clientX;
      directionRef.current = 'none';
      velocityHistoryRef.current = [{ y: event.clientY, t: event.timeStamp }];
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerIdRef.current) return;
      // Abort if zoom changed or zoom gesture started mid-pull
      if (getZoom() > 1 || el.hasAttribute('data-zooming')) {
        if (isPullingRef.current) {
          isPullingRef.current = false;
          snapBack();
        }
        cleanup();
        return;
      }

      let deltaX = event.clientX - startXRef.current;
      let deltaY = event.clientY - startYRef.current;

      // Direction lock: determine gesture direction after a small movement
      if (directionRef.current === 'none') {
        const axis = resolveDragAxis(deltaX, deltaY, DIRECTION_LOCK_DISTANCE);
        if (axis === 'none') return;
        directionRef.current = axis;
        if (axis === 'horizontal') {
          cleanup();
          return;
        }
        // Re-anchor the origin to where the vertical pull was recognized so the
        // image starts moving from 0. Otherwise the first frame would jump by
        // the distance the finger already traveled during direction detection —
        // a visible snap that grows the faster the pull begins. From here the
        // image trails the finger smoothly from rest.
        startXRef.current = event.clientX;
        startYRef.current = event.clientY;
        deltaX = 0;
        deltaY = 0;
      }

      if (directionRef.current !== 'vertical') return;

      // We're pulling — track velocity and apply visual feedback
      if (!isPullingRef.current) {
        isPullingRef.current = true;
        el.setAttribute('data-pulling', '');
        backdropRef.current?.setAttribute('data-pulling', '');
        el.setPointerCapture(event.pointerId);
      }

      // Track velocity samples
      const history = velocityHistoryRef.current;
      history.push({ y: event.clientY, t: event.timeStamp });
      if (history.length > VELOCITY_SAMPLES) {
        history.shift();
      }

      applyTransform(deltaX, deltaY);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerIdRef.current) return;

      const wasPulling = isPullingRef.current;
      const deltaY = event.clientY - startYRef.current;
      const velocity = computeVelocity();

      cleanup();

      if (!wasPulling) return;

      if (shouldDismissPull(deltaY, velocity, DISMISS_DISTANCE, DISMISS_VELOCITY)) {
        // Hand off from "pulling" to "dismissing": `data-pulling` is dropped so
        // the backdrop can run its close fade, but chrome hidden while pulling
        // must stay hidden through the close animation (otherwise it flashes
        // back in as the content fades out). `data-pull-dismissing` carries that state.
        el.setAttribute('data-pull-dismissing', '');
        el.removeAttribute('data-pulling');
        backdropRef.current?.removeAttribute('data-pulling');
        dragTargetRef.current = null;
        onClose();
      } else {
        snapBack(velocity);
      }
    };

    const handlePointerCancel = (event: PointerEvent) => {
      if (event.pointerId !== pointerIdRef.current) return;
      const wasPulling = isPullingRef.current;
      cleanup();
      if (wasPulling) {
        snapBack();
      }
    };

    // Only prevent native scrolling once the gesture is committed to
    // vertical (pull-to-dismiss). Before direction is determined, allow
    // native behavior so scroll gallery swiping works unimpeded.
    const handleTouchMove = (event: TouchEvent) => {
      if (pointerIdRef.current === null) return;
      if (directionRef.current !== 'vertical') return;
      if (event.touches.length === 1) {
        event.preventDefault();
      }
    };

    // -----------------------------------------------------------------
    // Trackpad pull-to-dismiss — a two-finger vertical swipe arrives as a
    // stream of pixel-mode wheel events. Mirror the touch gesture: move the
    // image with the swipe, then dismiss past the threshold or snap back.
    // -----------------------------------------------------------------
    const WHEEL_IDLE_END = 90;
    // Require several events so a single discrete mouse-wheel notch (which can
    // exceed the dismiss distance in one step) can't dismiss — trackpads emit
    // many small events per swipe.
    const MIN_WHEEL_EVENTS = 3;

    const resetWheel = () => {
      wheelDirRef.current = 'none';
      wheelPullXRef.current = 0;
      wheelPullYRef.current = 0;
      wheelCountRef.current = 0;
      if (wheelIdleRef.current) {
        clearTimeout(wheelIdleRef.current);
        wheelIdleRef.current = null;
      }
    };

    const finishWheel = (dismissNow: boolean) => {
      const wasVertical = wheelDirRef.current === 'vertical';
      const pulledY = wheelPullYRef.current;
      const count = wheelCountRef.current;
      resetWheel();
      if (!wasVertical) return;

      const shouldDismiss =
        (dismissNow || Math.abs(pulledY) >= DISMISS_DISTANCE) && count >= MIN_WHEEL_EVENTS;

      if (shouldDismiss) {
        // Latch: swallow the trackpad's momentum tail so it can't restart a
        // pull and reset the item mid-close.
        wheelDismissedRef.current = true;
        // Keep chrome hidden through the close animation (see touch path).
        el.setAttribute('data-pull-dismissing', '');
        el.removeAttribute('data-pulling');
        backdropRef.current?.removeAttribute('data-pulling');
        dragTargetRef.current = null;
        onClose();
      } else {
        snapBack();
      }
    };

    const scheduleWheelIdle = () => {
      if (wheelIdleRef.current) clearTimeout(wheelIdleRef.current);
      wheelIdleRef.current = setTimeout(() => finishWheel(false), WHEEL_IDLE_END);
    };

    const handleWheel = (event: WheelEvent) => {
      // Already committed to dismissing — ignore the momentum tail.
      if (wheelDismissedRef.current) return;
      // A Lightbox.Slides scroll/fling is in flight — don't start a pull
      // (passive listener: the slides keep scrolling normally).
      if (isScrollingRef?.current) return;
      // Precision devices (trackpads) report pixel-mode deltas; line/page mode
      // is a classic mouse wheel — leave those alone.
      if (event.deltaMode !== 0) return;
      // Defer to zoom (owns the wheel when zoomed) and to an active touch pull.
      if (getZoom() > 1 || el.hasAttribute('data-zooming')) return;
      if (pointerIdRef.current !== null) return;
      if (event.ctrlKey) return; // pinch-zoom intent

      // When a Stage is mounted, only wheels whose target is inside it can
      // start/continue a pull — side panels outside Stage keep native scroll.
      const stage = stageRef?.current;
      const wheelTarget = event.target as Node | null;
      if (stage && wheelTarget && !stage.contains(wheelTarget)) return;

      if (wheelDirRef.current === 'none') {
        const axis = wheelAxis(event.deltaX, event.deltaY);
        if (axis === 'none') return;
        // Horizontal swipes belong to the scroll gallery — let them scroll
        // natively (the listener is passive; we never preventDefault).
        if (axis === 'horizontal') {
          wheelDirRef.current = 'horizontal';
          scheduleWheelIdle();
          return;
        }

        const activeItem = activeItemRef.current;
        if (!activeItem) {
          wheelDirRef.current = 'horizontal'; // nothing to pull — bail gesture
          scheduleWheelIdle();
          return;
        }

        // Cancel any in-flight snap-back and take over the active item.
        if (animationRef.current) {
          animationRef.current.cancel();
          animationRef.current = null;
          clearTransform();
        }
        dragTargetRef.current = activeItem;
        wheelDirRef.current = 'vertical';
        wheelPullXRef.current = 0;
        wheelPullYRef.current = 0;
        wheelCountRef.current = 0;
        el.setAttribute('data-pulling', '');
        backdropRef.current?.setAttribute('data-pulling', '');
      }

      scheduleWheelIdle();
      if (wheelDirRef.current !== 'vertical') return;

      // Content follows the fingers (natural-scroll: fingers down → deltaY < 0).
      wheelPullXRef.current += -event.deltaX;
      wheelPullYRef.current += -event.deltaY;
      wheelCountRef.current += 1;
      applyTransform(wheelPullXRef.current, wheelPullYRef.current);

      if (
        Math.abs(wheelPullYRef.current) >= DISMISS_DISTANCE &&
        wheelCountRef.current >= MIN_WHEEL_EVENTS
      ) {
        finishWheel(true);
      }
    };

    el.addEventListener('pointerdown', handlePointerDown);
    el.addEventListener('pointermove', handlePointerMove);
    el.addEventListener('pointerup', handlePointerUp);
    el.addEventListener('pointercancel', handlePointerCancel);
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerup', handlePointerUp);
      el.removeEventListener('pointercancel', handlePointerCancel);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('wheel', handleWheel);
      if (wheelIdleRef.current) {
        clearTimeout(wheelIdleRef.current);
        wheelIdleRef.current = null;
      }
      if (animationRef.current) {
        animationRef.current.cancel();
        animationRef.current = null;
      }
      clearTransform();
    };
  }, [disabled, contentRef, backdropRef, activeItemRef, itemContentElementsRef, getZoom, onClose, isScrollingRef, applyTransform, clearTransform, snapBack, cleanup, computeVelocity]);
}

export { usePullToDismiss };
export type { PullToDismissOptions };
