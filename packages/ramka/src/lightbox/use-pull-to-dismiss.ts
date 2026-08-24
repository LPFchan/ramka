'use client';

import * as React from 'react';

import { clamp } from './gesture-shared';
import {
  computePullTransform,
  computePullVelocity,
  resolveDragAxis,
  shouldDismissPull,
  springEasingLinear,
  wheelAxis,
} from './pull-math';
import { LightboxContentCssVars } from './lightbox-css-vars';
import type { InitializedRef } from '../react-compat';

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
 * Interactive / opt-out targets that must not start a touch pull. Matches the
 * Stage-wide hit target: letterbox and empty Stage area can dismiss, but
 * Close / Prev / Next / links / form controls keep their native press.
 * Authors can mark custom chrome with `data-ramka-no-pull`.
 */
const PULL_IGNORED_TARGET_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="slider"]',
  '[data-ramka-no-pull]',
].join(',');

function isPullIgnoredTarget(target: Element): boolean {
  return Boolean(target.closest(PULL_IGNORED_TARGET_SELECTOR));
}

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
   * Shared capture destination from Stage `morphRef`. When set, pull
   * transforms this node (the frame / bezel) instead of the active item,
   * so the carousel can keep clipping neighbors.
   */
  destinationMorphElementRef?: React.RefObject<HTMLElement | null>;
  /**
   * Optional `Lightbox.Stage` host. When set, touch and trackpad wheel
   * pull-to-dismiss only start if the event target is inside Stage — so side
   * panels outside Stage keep native scroll / their own gestures. When
   * null/omitted, any touch or wheel over Content can pull (Content itself is
   * the stage).
   */
  stageRef?: React.RefObject<HTMLElement | null>;
  getZoom: () => number;
  onClose: () => void;
  disabled?: boolean;
  /**
   * True while a `Lightbox.Slides` user scroll/fling is in flight (until
   * `scrollend`). The pull gesture won't start (touch or trackpad) while this
   * is set, so a swipe that turns vertical mid-scroll can't become a dismiss.
   * Stays `false` for non-`Slides` lightboxes, so their pull-to-dismiss is
   * never gated.
   */
  isScrollingRef?: InitializedRef<boolean>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

function usePullToDismiss({
  contentRef,
  backdropRef,
  activeItemRef,
  destinationMorphElementRef,
  stageRef,
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

  const resolveDragTarget = React.useCallback((): HTMLElement | null => {
    return destinationMorphElementRef?.current ?? activeItemRef.current;
  }, [destinationMorphElementRef, activeItemRef]);

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
  // True while this wheel sequence was claimed by a Slides scroll. Cleared on
  // `scrollend` (lock drops) so the next wheel can start a fresh pull.
  const wheelLockedByScrollRef = React.useRef(false);

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
      el.removeAttribute('data-pull-snapping');
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
    // timing, drop `data-pulling` (re-enabling the transition they suppressed
    // while pulling), latch `data-pull-snapping` so pull-only layout stays
    // until the item is parked, and reset progress to 0 so that transition —
    // now on the item's curve+duration — eases everything back to rest.
    for (const el of [content, backdrop]) {
      if (!el) continue;
      el.style.setProperty(PULL_SNAP_DURATION_VAR, `${duration}ms`);
      el.style.setProperty(PULL_SNAP_EASING_VAR, snapEasing);
      el.removeAttribute('data-pulling');
      el.setAttribute('data-pull-snapping', '');
      el.style.setProperty(PULL_PROGRESS_VAR, '0');
    }

    if (!target) {
      dragTargetRef.current = null;
      for (const el of [content, backdrop]) {
        el?.removeAttribute('data-pull-snapping');
      }
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
        el?.removeAttribute('data-pull-snapping');
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
    el.removeAttribute('data-pull-snapping');

    const handlePointerDown = (event: PointerEvent) => {
      // Touch-only gesture — ignore mouse and pen
      if (event.pointerType !== 'touch') return;
      if (pointerIdRef.current !== null) return;
      // A Lightbox.Slides swipe/fling is in flight — don't start a pull.
      if (isScrollingRef?.current) return;

      const target = event.target as HTMLElement | null;
      if (!target) return;

      // Match wheel: when Stage is mounted, only touches inside it can start a
      // pull — side panels outside Stage keep their own gestures.
      const stage = stageRef?.current;
      if (stage && !stage.contains(target)) return;

      // Stage-wide hit target (letterbox, empty Stage, decorative chrome) —
      // but don't steal presses on real controls.
      if (isPullIgnoredTarget(target)) return;

      // Drag the shared Stage morph target when set, else the active item —
      // even if the finger landed on Stage padding rather than the media.
      const dragTarget = resolveDragTarget();
      if (!dragTarget) return;

      // Don't activate if zoomed or if zoom gestures are in progress
      if (getZoom() > 1) return;
      if (el.hasAttribute('data-zooming')) return;

      // Cancel any in-progress snap-back
      if (animationRef.current) {
        animationRef.current.cancel();
        animationRef.current = null;
        clearTransform();
      }

      dragTargetRef.current = dragTarget;
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
      wheelLockedByScrollRef.current = false;
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

      // Gallery scroll owns this wheel sequence until `scrollend`. Latch as
      // horizontal (and keep the idle timer alive) so a mid-gesture vertical
      // turn cannot start a pull — including after the 90ms wheel-idle timer
      // reset `wheelDir` while `isScrollingRef` was still set.
      if (isScrollingRef?.current && wheelDirRef.current !== 'vertical') {
        wheelDirRef.current = 'horizontal';
        wheelLockedByScrollRef.current = true;
        scheduleWheelIdle();
        return;
      }
      // `scrollend` has fired. A gallery-owned sequence must not block a new
      // vertical gesture now that the scroller is at rest.
      if (wheelLockedByScrollRef.current) {
        wheelLockedByScrollRef.current = false;
        wheelDirRef.current = 'none';
      }

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

        const dragTarget = resolveDragTarget();
        if (!dragTarget) {
          wheelDirRef.current = 'horizontal'; // nothing to pull — bail gesture
          scheduleWheelIdle();
          return;
        }

        // Cancel any in-flight snap-back and take over the drag target.
        if (animationRef.current) {
          animationRef.current.cancel();
          animationRef.current = null;
          clearTransform();
        }
        dragTargetRef.current = dragTarget;
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
  }, [disabled, contentRef, backdropRef, activeItemRef, destinationMorphElementRef, stageRef, getZoom, onClose, isScrollingRef, applyTransform, clearTransform, snapBack, cleanup, computeVelocity, resolveDragTarget]);
}

export { usePullToDismiss };
export type { PullToDismissOptions };
