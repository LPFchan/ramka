'use client';

import * as React from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIRECTION_LOCK_DISTANCE = 6;
const DISMISS_DISTANCE = 100;
const DISMISS_VELOCITY = 400;
const SNAP_DURATION = 350;
const SNAP_EASING = 'cubic-bezier(0.2, 1.15, 0.4, 1)';
const MIN_SCALE = 0.85;
const VELOCITY_SAMPLES = 5;

/**
 * CSS custom property exposing pull progress (0 at rest → 1 at the dismiss
 * threshold) on both the content and backdrop elements while a drag is in
 * flight. The library deliberately does NOT hardcode a backdrop opacity
 * curve — consumers derive whatever styling they like (backdrop opacity,
 * blur, chrome fade, image scale) from this variable, e.g.
 * `opacity: calc(1 - var(--lightbox-pull-progress, 0) * 0.6)`.
 */
const PULL_PROGRESS_VAR = '--lightbox-pull-progress';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PullToDismissOptions {
  contentRef: React.RefObject<HTMLElement | null>;
  backdropRef: React.RefObject<HTMLElement | null>;
  getZoom: () => number;
  onClose: () => void;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

function usePullToDismiss({
  contentRef,
  backdropRef,
  getZoom,
  onClose,
  disabled = false,
}: PullToDismissOptions) {
  const pointerIdRef = React.useRef<number | null>(null);
  const startYRef = React.useRef(0);
  const startXRef = React.useRef(0);
  const directionRef = React.useRef<'none' | 'vertical' | 'horizontal'>('none');
  const velocityHistoryRef = React.useRef<{ y: number; t: number }[]>([]);
  const isPullingRef = React.useRef(false);
  const animationRef = React.useRef<Animation | null>(null);
  const dragTargetRef = React.useRef<HTMLElement | null>(null);

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

      // Asymptotic damping: moves ~1:1 near origin, then flattens toward
      // a ceiling. The curve never reverses regardless of drag distance.
      const absY = Math.abs(rawDeltaY);
      const maxTravel = DISMISS_DISTANCE * 1.2;
      const dampedAbsY = maxTravel * (1 - Math.exp(-absY / maxTravel));
      const dampedY = Math.sign(rawDeltaY) * dampedAbsY;
      const dampFactor = absY > 0 ? dampedAbsY / absY : 1;
      const dampedX = rawDeltaX * dampFactor;

      const progress = Math.min(absY / DISMISS_DISTANCE, 1);
      const scale = 1 - progress * (1 - MIN_SCALE);

      target.style.transform = `translate(${dampedX}px, ${dampedY}px) scale(${scale})`;

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
    if (content) {
      content.removeAttribute('data-pulling');
      content.style.removeProperty(PULL_PROGRESS_VAR);
    }
    if (backdrop) {
      backdrop.removeAttribute('data-pulling');
      backdrop.style.removeProperty(PULL_PROGRESS_VAR);
    }
  }, [contentRef, backdropRef]);

  const snapBack = React.useCallback(() => {
    const target = dragTargetRef.current;
    const content = contentRef.current;
    const backdrop = backdropRef.current;

    // Hand backdrop/chrome styling back to the consumer immediately: drop
    // the `data-pulling` flag (re-enabling any transition they suppressed
    // while pulling) and reset progress to 0 so their own transition eases
    // everything back to rest. The library only owns the item transform
    // snap-back below.
    content?.removeAttribute('data-pulling');
    backdrop?.removeAttribute('data-pulling');
    content?.style.setProperty(PULL_PROGRESS_VAR, '0');
    backdrop?.style.setProperty(PULL_PROGRESS_VAR, '0');

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

    const targetAnim = target.animate(
      [
        { transform: currentTransform },
        { transform: 'translate(0, 0) scale(1)' },
      ],
      { duration: SNAP_DURATION, easing: SNAP_EASING },
    );

    animationRef.current = targetAnim;

    targetAnim.finished.then(() => {
      animationRef.current = null;
      targetAnim.cancel();
      dragTargetRef.current = null;
      // Fully at rest — drop the inline var so the consumer's fallback
      // (typically `var(--lightbox-pull-progress, 0)`) takes over cleanly.
      content?.style.removeProperty(PULL_PROGRESS_VAR);
      backdrop?.style.removeProperty(PULL_PROGRESS_VAR);
    }).catch(() => {
      // Animation cancelled — cleanup already handled
    });
  }, [contentRef, backdropRef]);

  const computeVelocity = React.useCallback(() => {
    const history = velocityHistoryRef.current;
    if (history.length < 2) return 0;
    const first = history[0];
    const last = history[history.length - 1];
    const dt = last.t - first.t;
    if (dt === 0) return 0;
    return ((last.y - first.y) / dt) * 1000;
  }, []);

  React.useEffect(() => {
    if (disabled) return;
    const el = contentRef.current;
    if (!el) return;

    // Fresh mount — clear any dismiss latch / closing flag left over from a
    // prior close (in case the same element is reused).
    wheelDismissedRef.current = false;
    el.removeAttribute('data-closing');

    const handlePointerDown = (event: PointerEvent) => {
      // Touch-only gesture — ignore mouse and pen
      if (event.pointerType !== 'touch') return;
      if (pointerIdRef.current !== null) return;

      // Only activate when touching the visual content (morph target) inside
      // an item — not controls, backdrop, or the item's empty padding area.
      const target = event.target as HTMLElement | null;
      if (
        !target?.closest('[data-lightbox-morph], [data-lightbox-item] img, [data-lightbox-item] video')
      ) return;

      // Don't activate if zoomed or if zoom gestures are in progress
      if (getZoom() > 1) return;
      if (el.hasAttribute('data-zooming')) return;

      // Resolve the drag target: the active item element
      const activeItem = target?.closest('[data-lightbox-item]') as HTMLElement | null;
      if (!activeItem) return;

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

      const deltaX = event.clientX - startXRef.current;
      const deltaY = event.clientY - startYRef.current;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Direction lock: determine gesture direction after a small movement
      if (directionRef.current === 'none') {
        const totalDist = Math.hypot(deltaX, deltaY);
        if (totalDist < DIRECTION_LOCK_DISTANCE) return;
        directionRef.current = absY >= absX ? 'vertical' : 'horizontal';
        if (directionRef.current === 'horizontal') {
          cleanup();
          return;
        }
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

      const absDeltaY = Math.abs(deltaY);
      const absVelocity = Math.abs(velocity);
      const sameDirection = (deltaY > 0 && velocity > 0) || (deltaY < 0 && velocity < 0);

      if (
        absDeltaY >= DISMISS_DISTANCE ||
        (absVelocity >= DISMISS_VELOCITY && sameDirection)
      ) {
        // Hand off from "pulling" to "closing": `data-pulling` is dropped so
        // the backdrop can run its close fade, but chrome hidden while pulling
        // must stay hidden through the close animation (otherwise it flashes
        // back in as the content fades out). `data-closing` carries that state.
        el.setAttribute('data-closing', '');
        el.removeAttribute('data-pulling');
        backdropRef.current?.removeAttribute('data-pulling');
        dragTargetRef.current = null;
        onClose();
      } else {
        snapBack();
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
        el.setAttribute('data-closing', '');
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

      if (wheelDirRef.current === 'none') {
        if (event.deltaX === 0 && event.deltaY === 0) return;
        // Horizontal swipes belong to the scroll gallery — let them scroll
        // natively (the listener is passive; we never preventDefault).
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
          wheelDirRef.current = 'horizontal';
          scheduleWheelIdle();
          return;
        }

        const activeItem = el.querySelector(
          '[data-lightbox-item][data-active]',
        ) as HTMLElement | null;
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
  }, [disabled, contentRef, backdropRef, getZoom, onClose, applyTransform, clearTransform, snapBack, cleanup, computeVelocity]);
}

export { usePullToDismiss };
export type { PullToDismissOptions };
