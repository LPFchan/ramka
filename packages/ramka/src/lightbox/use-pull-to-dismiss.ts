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

// Wheel/trackpad pull tuning. A two-finger trackpad swipe arrives as a
// stream of `wheel` events with no explicit end, so we accumulate the
// vertical delta and detect the gesture end via a short idle timeout.
// The dismiss distance is larger than the touch threshold because wheel
// deltas accumulate quickly and we want the gesture to feel deliberate.
const WHEEL_DISMISS_DISTANCE = 150;
// Idle gap (ms) with no `wheel` events that marks the end of a trackpad
// gesture. Sized to wait out the sparse, near-zero-delta tail of a
// momentum scroll so the close (which releases the document scroll lock)
// only fires once events have truly stopped.
const WHEEL_END_DELAY = 120;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PullToDismissOptions {
  contentRef: React.RefObject<HTMLElement | null>;
  backdropRef: React.RefObject<HTMLElement | null>;
  getZoom: () => number;
  onClose: () => void;
  /**
   * Enable the touch (pointer) pull-to-dismiss gesture — drag the image
   * vertically with one finger to close. @default true
   */
  touchEnabled?: boolean;
  /**
   * Enable the trackpad (wheel) pull-to-dismiss gesture — a two-finger
   * vertical swipe on a touchpad pulls the image and closes the lightbox,
   * mirroring the touch gesture. @default false
   */
  wheelEnabled?: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

function usePullToDismiss({
  contentRef,
  backdropRef,
  getZoom,
  onClose,
  touchEnabled = true,
  wheelEnabled = false,
}: PullToDismissOptions) {
  const pointerIdRef = React.useRef<number | null>(null);
  const startYRef = React.useRef(0);
  const startXRef = React.useRef(0);
  const directionRef = React.useRef<'none' | 'vertical' | 'horizontal'>('none');
  const velocityHistoryRef = React.useRef<{ y: number; t: number }[]>([]);
  const isPullingRef = React.useRef(false);
  const animationRef = React.useRef<Animation | null>(null);
  const dragTargetRef = React.useRef<HTMLElement | null>(null);

  // Wheel-gesture state. Kept separate from the pointer refs above so the
  // two input sources never interfere; in practice only one is active on a
  // given device, but the guards below also make them mutually exclusive.
  const wheelActiveRef = React.useRef(false);
  const wheelAccumXRef = React.useRef(0);
  const wheelAccumYRef = React.useRef(0);
  const wheelEndTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // True briefly after a wheel dismiss. Closing in a non-view-transition
  // mode keeps Content mounted through the exit animation, so the trackpad
  // momentum tail would otherwise immediately start (and re-pull) a fresh
  // gesture. This flag swallows that tail until the wheel stream goes idle.
  // (Page-scroll bleed during/after close is handled separately by the
  // `overscroll-behavior: contain` containment on Lightbox.Content.)
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
      const backdrop = backdropRef.current;
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

      if (backdrop) {
        backdrop.style.opacity = String(1 - progress * 0.6);
      }
    },
    [backdropRef],
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
    }
    if (backdrop) {
      backdrop.style.opacity = '';
      backdrop.removeAttribute('data-pulling');
    }
  }, [contentRef, backdropRef]);

  const snapBack = React.useCallback(() => {
    const target = dragTargetRef.current;
    const content = contentRef.current;
    const backdrop = backdropRef.current;

    if (!target) {
      clearTransform();
      return;
    }

    const currentTransform = target.style.transform;
    const currentBackdropOpacity = backdrop?.style.opacity ?? '1';

    // Clear inline styles BEFORE starting the animations. The WAAPI
    // animation layer overrides computed values during playback, so the
    // cleared inline styles are invisible while the animation runs.
    // When the animation finishes and is cancelled, the underlying
    // computed values are already clean — no flash.
    target.style.transform = '';
    if (backdrop) {
      backdrop.style.opacity = '';
    }

    const targetAnim = target.animate(
      [
        { transform: currentTransform },
        { transform: 'translate(0, 0) scale(1)' },
      ],
      { duration: SNAP_DURATION, easing: SNAP_EASING },
    );

    let backdropAnim: Animation | undefined;
    if (backdrop) {
      backdropAnim = backdrop.animate(
        [{ opacity: currentBackdropOpacity }, { opacity: '1' }],
        { duration: SNAP_DURATION, easing: SNAP_EASING },
      );
    }

    animationRef.current = targetAnim;

    targetAnim.finished.then(() => {
      animationRef.current = null;
      targetAnim.cancel();
      backdropAnim?.cancel();
      content?.removeAttribute('data-pulling');
      backdrop?.removeAttribute('data-pulling');
      dragTargetRef.current = null;
    }).catch(() => {
      // Animation cancelled — cleanup already handled
    });
  }, [contentRef, backdropRef, clearTransform]);

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
    if (!touchEnabled && !wheelEnabled) return;
    const el = contentRef.current;
    if (!el) return;

    // -------------------------------------------------------------------
    // Touch (pointer) gesture
    // -------------------------------------------------------------------

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

    // -------------------------------------------------------------------
    // Trackpad (wheel) gesture
    // -------------------------------------------------------------------

    // A sub-threshold wheel gesture has no "end" event, so when the wheel
    // stream goes idle we snap the pulled item back. (Crossing the threshold
    // dismisses immediately in handleWheel — this only handles the
    // "pulled a little, then stopped" case.)
    const endWheelGesture = () => {
      if (wheelEndTimeoutRef.current) {
        clearTimeout(wheelEndTimeoutRef.current);
        wheelEndTimeoutRef.current = null;
      }
      if (!wheelActiveRef.current) return;
      wheelActiveRef.current = false;
      wheelAccumXRef.current = 0;
      wheelAccumYRef.current = 0;
      snapBack();
    };

    // The wheel listener is PASSIVE. Page-scroll bleed is prevented by the
    // `overscroll-behavior: contain` containment on Lightbox.Content (set
    // when wheelToClose is enabled), which keeps a vertical wheel gesture —
    // and its trackpad momentum tail — latched inside the modal subtree
    // instead of chaining out to the document. Staying passive also keeps
    // Safari's compositor momentum scrolling alive in a nested ScrollGallery.
    const handleWheel = (event: WheelEvent) => {
      // A touch pull owns the gesture — don't double-handle.
      if (pointerIdRef.current !== null || isPullingRef.current) return;
      // Ctrl+wheel is pinch-zoom intent; zoomed/zooming is handled by Zoom.
      if (event.ctrlKey) return;
      if (getZoom() > 1 || el.hasAttribute('data-zooming')) return;

      // Swallow the momentum tail right after a dismiss so it can't start a
      // fresh pull while Content lingers through a non-VT close animation.
      if (wheelDismissedRef.current) {
        if (wheelEndTimeoutRef.current) clearTimeout(wheelEndTimeoutRef.current);
        wheelEndTimeoutRef.current = setTimeout(() => {
          wheelDismissedRef.current = false;
          wheelEndTimeoutRef.current = null;
        }, WHEEL_END_DELAY);
        return;
      }

      const absX = Math.abs(event.deltaX);
      const absY = Math.abs(event.deltaY);

      if (!wheelActiveRef.current) {
        // Only start on a vertical-dominant gesture; horizontal scrolling
        // belongs to a nested ScrollGallery and must pass through.
        if (absY === 0 || absY <= absX) return;

        const activeItem = el.querySelector(
          '[data-lightbox-item][data-active]',
        ) as HTMLElement | null;
        if (!activeItem) return;

        // Cancel any in-progress snap-back before re-grabbing the target.
        if (animationRef.current) {
          animationRef.current.cancel();
          animationRef.current = null;
          clearTransform();
        }

        dragTargetRef.current = activeItem;
        wheelActiveRef.current = true;
        wheelAccumXRef.current = 0;
        wheelAccumYRef.current = 0;
        el.setAttribute('data-pulling', '');
        backdropRef.current?.setAttribute('data-pulling', '');
      }

      // Negate so the image follows the fingers regardless of the OS
      // "natural scrolling" setting.
      wheelAccumXRef.current += -event.deltaX;
      wheelAccumYRef.current += -event.deltaY;
      applyTransform(wheelAccumXRef.current, wheelAccumYRef.current);

      // Continuous dismiss: as soon as the pull crosses the threshold, close
      // immediately so the close animation flows straight out of the gesture.
      if (Math.abs(wheelAccumYRef.current) >= WHEEL_DISMISS_DISTANCE) {
        wheelActiveRef.current = false;
        wheelDismissedRef.current = true;
        wheelAccumXRef.current = 0;
        wheelAccumYRef.current = 0;
        // Leave the pulled transform in place so the close animation
        // continues from where the gesture left off (matching touch).
        el.removeAttribute('data-pulling');
        backdropRef.current?.removeAttribute('data-pulling');
        dragTargetRef.current = null;
        onClose();
        // Arm the cooldown that swallows the trailing momentum tail.
        if (wheelEndTimeoutRef.current) clearTimeout(wheelEndTimeoutRef.current);
        wheelEndTimeoutRef.current = setTimeout(() => {
          wheelDismissedRef.current = false;
          wheelEndTimeoutRef.current = null;
        }, WHEEL_END_DELAY);
        return;
      }

      // Sub-threshold: (re)arm the idle timer that snaps the item back.
      if (wheelEndTimeoutRef.current) clearTimeout(wheelEndTimeoutRef.current);
      wheelEndTimeoutRef.current = setTimeout(endWheelGesture, WHEEL_END_DELAY);
    };

    if (touchEnabled) {
      el.addEventListener('pointerdown', handlePointerDown);
      el.addEventListener('pointermove', handlePointerMove);
      el.addEventListener('pointerup', handlePointerUp);
      el.addEventListener('pointercancel', handlePointerCancel);
      el.addEventListener('touchmove', handleTouchMove, { passive: false });
    }

    if (wheelEnabled) {
      el.addEventListener('wheel', handleWheel, { passive: true });
    }

    return () => {
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerup', handlePointerUp);
      el.removeEventListener('pointercancel', handlePointerCancel);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('wheel', handleWheel);
      if (wheelEndTimeoutRef.current) {
        clearTimeout(wheelEndTimeoutRef.current);
        wheelEndTimeoutRef.current = null;
      }
      wheelActiveRef.current = false;
      wheelDismissedRef.current = false;
      if (animationRef.current) {
        animationRef.current.cancel();
        animationRef.current = null;
      }
      clearTransform();
    };
  }, [touchEnabled, wheelEnabled, contentRef, backdropRef, getZoom, onClose, applyTransform, clearTransform, snapBack, cleanup, computeVelocity]);
}

export { usePullToDismiss };
export type { PullToDismissOptions };
