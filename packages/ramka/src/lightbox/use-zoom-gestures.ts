'use client';

import * as React from 'react';

import {
  computeMomentumTarget,
  distance,
  doubleTapTargetZoom,
  pinchZoom,
  scaleZoom,
} from './gesture-math';

// ---------------------------------------------------------------------------
// Config type
// ---------------------------------------------------------------------------

interface ZoomGestureConfig {
  minZoom: number;
  maxZoom: number;
  zoomStep: number;
  scrollToZoom: boolean;
  wheelSensitivity: number;
  keyboardPanDistance: number;
  doubleClickDelay: number;
}

// ---------------------------------------------------------------------------
// Actions — called by the gesture hook, implemented by the Zoom component
// ---------------------------------------------------------------------------

interface ZoomGestureActions {
  getZoom: () => number;
  getOffsets: () => { x: number; y: number };
  zoomIn: () => void;
  zoomOut: () => void;
  changeZoom: (target: number, rapid: boolean, dx?: number, dy?: number, overscroll?: boolean) => void;
  changeOffsets: (dx: number, dy: number, overscroll?: boolean) => void;
  setDragging: (dragging: boolean) => void;
  snapToBounds: () => void;
  snapOffsetsToBounds: () => void;
  /** Animate offsets with momentum deceleration to a final position. */
  momentumPan: (targetX: number, targetY: number) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

function useZoomGestures(
  containerRef: React.RefObject<HTMLElement | null>,
  wrapperRef: React.RefObject<HTMLElement | null>,
  config: ZoomGestureConfig,
  actions: ZoomGestureActions,
  disabled: boolean,
  contentElementRef?: React.RefObject<HTMLElement | null>,
  /** Current zoom level — used to decide whether the wheel listener must be
   *  non-passive (zoomed → need preventDefault for pan) or can be passive
   *  (1× → preserve Safari compositor-thread momentum scrolling). */
  currentZoom = 1,
  /** True while a `Lightbox.Slides` user scroll/fling is in flight. Gesture
   *  starts (pinch / pan / double-tap / scroll-to-zoom) are ignored while this
   *  is set, so an in-progress swipe can't be hijacked mid-scroll. */
  isScrollingRef?: React.RefObject<boolean>,
) {
  const activePointers = React.useRef<PointerEvent[]>([]);
  const lastPointerDown = React.useRef(0);
  const hadPinch = React.useRef(false);

  // Tap detection for double-tap: track whether the previous single-finger
  // interaction was a stationary tap (not a drag/pinch/pull).
  const TAP_MOVE_THRESHOLD = 10;
  const DOUBLE_TAP_DISTANCE = 50;
  const lastWasTap = React.useRef(false);
  const lastTapPos = React.useRef<{ x: number; y: number } | null>(null);
  const tapCandidate = React.useRef(false);
  const tapStartPos = React.useRef<{ x: number; y: number } | null>(null);
  // A double-tap is only committed once the SECOND touch also ends as a
  // stationary tap. These hold the armed state between that touch's
  // pointerdown (where timing/distance qualify) and its pointerup (where we
  // confirm it didn't turn into a swipe/flick) — see handlePointerDown/Up.
  const pendingDoubleTap = React.useRef(false);
  const doubleTapFocal = React.useRef<[number, number] | null>(null);
  const pinchState = React.useRef<{
    initialDistance: number;
    initialZoom: number;
  } | undefined>(undefined);
  const zoomingTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Velocity tracking for momentum pan on touch release.
  // Stores recent pointer positions within a ~100ms window.
  const velocityTracker = React.useRef<Array<{ x: number; y: number; t: number }>>([]);
  const VELOCITY_WINDOW = 100;
  const MOMENTUM_MULTIPLIER = 300;
  const MOMENTUM_THRESHOLD = 50;

  // Stable refs so event listeners always see latest values
  const configRef = React.useRef(config);
  configRef.current = config;
  const actionsRef = React.useRef(actions);
  actionsRef.current = actions;

  const translateCoordinates = React.useCallback(
    (event: { clientX: number; clientY: number }): [number, number] => {
      const el = containerRef.current;
      if (!el) return [0, 0];
      const rect = el.getBoundingClientRect();
      return [
        event.clientX - rect.left - rect.width / 2,
        event.clientY - rect.top - rect.height / 2,
      ];
    },
    [containerRef],
  );

  // -------------------------------------------------------------------
  // Pointer events — pinch, drag, double-click/tap
  // -------------------------------------------------------------------

  const clearPointer = React.useCallback((id: number) => {
    const arr = activePointers.current;
    const idx = arr.findIndex((p) => p.pointerId === id);
    if (idx !== -1) arr.splice(idx, 1);
  }, []);

  const replacePointer = React.useCallback(
    (event: PointerEvent) => {
      clearPointer(event.pointerId);
      activePointers.current.push(event);
    },
    [clearPointer],
  );

  const setZooming = React.useCallback(
    (active: boolean) => {
      const el = contentElementRef?.current;
      if (!el) return;
      if (active) {
        if (zoomingTimerRef.current) {
          clearTimeout(zoomingTimerRef.current);
          zoomingTimerRef.current = null;
        }
        el.setAttribute('data-zooming', '');
      } else {
        // Delay removal to cover the snap-back animation period
        zoomingTimerRef.current = setTimeout(() => {
          el.removeAttribute('data-zooming');
          zoomingTimerRef.current = null;
        }, 250);
      }
    },
    [contentElementRef],
  );

  const handlePointerDown = React.useCallback(
    (event: PointerEvent) => {
      // A Lightbox.Slides swipe/fling is in flight — ignore new zoom/pan
      // gestures so the scroll stays authoritative until it settles.
      if (isScrollingRef?.current) return;
      const pointers = activePointers.current;
      const { doubleClickDelay } = configRef.current;
      const { getZoom } = actionsRef.current;
      const zoom = getZoom();

      if (
        (event.pointerType === 'mouse' && event.button !== 0) ||
        !wrapperRef.current?.contains(event.target as Node)
      ) {
        return;
      }

      // Don't activate if pull-to-dismiss is in progress or snapping back.
      // Also clear all tracking state — pull-to-dismiss captures the pointer
      // via setPointerCapture, so we never receive pointerup for it and
      // would otherwise accumulate stale entries in activePointers.
      if (contentElementRef?.current?.hasAttribute('data-pulling')) {
        pointers.length = 0;
        lastPointerDown.current = 0;
        pinchState.current = undefined;
        hadPinch.current = false;
        return;
      }

      // A primary touch is the first finger to land on an otherwise empty
      // screen — by definition nothing else is down. So any pointers still in
      // `activePointers` are stale: pull-to-dismiss captures the pointer via
      // setPointerCapture (on an ancestor), so its `pointerup` never reaches
      // this hook and the entry lingers. Drop them now, otherwise this lone
      // finger pairs with the ghost into a phantom two-finger pinch — e.g. tap
      // the image (a hair of movement arms pull), then flick, and it "zooms".
      // A genuine pinch is unaffected: its second finger is never primary.
      if (event.pointerType === 'touch' && event.isPrimary && pointers.length > 0) {
        pointers.length = 0;
        pinchState.current = undefined;
        hadPinch.current = false;
      }

      // Stale pointer cleanup: if all recorded pointers are old (>500ms),
      // they were likely captured by pull-to-dismiss and we never got
      // pointerup for them. During a normal pinch both fingers arrive
      // within milliseconds, so this won't trigger.
      if (pointers.length > 0) {
        const newest = Math.max(...pointers.map((p) => p.timeStamp));
        if (event.timeStamp - newest > 500) {
          pointers.length = 0;
          pinchState.current = undefined;
          hadPinch.current = false;
        }
      }

      if (zoom > 1) {
        event.stopPropagation();
        actionsRef.current.setDragging(true);
        setZooming(true);
      }

      // Double-click / double-tap: toggle between zoomed and 1x.
      // Both taps must be genuine taps — the previous interaction must have
      // been a stationary single-finger tap (lastWasTap), not a drag/pinch,
      // and the two taps must be close together spatially and in time.
      //
      // Crucially the zoom is NOT fired here on pointerdown: we can't yet tell
      // whether this second touch is a tap or the start of a swipe/flick. A
      // quick swipe beginning near the first tap satisfies the distance+timing
      // gate and would zoom by mistake. Instead we ARM it and commit on
      // pointerup, but only if the touch stayed stationary (tapCandidate).
      const now = event.timeStamp;
      const prevTap = lastTapPos.current;
      const tapDist = prevTap ? Math.hypot(event.clientX - prevTap.x, event.clientY - prevTap.y) : 0;
      pendingDoubleTap.current =
        pointers.length === 0 &&
        lastWasTap.current &&
        now - lastPointerDown.current < doubleClickDelay &&
        tapDist < DOUBLE_TAP_DISTANCE;
      doubleTapFocal.current = pendingDoubleTap.current ? translateCoordinates(event) : null;

      lastPointerDown.current = now;

      // Start tap candidate tracking for this new single-finger interaction
      if (pointers.length === 0) {
        tapCandidate.current = true;
        tapStartPos.current = { x: event.clientX, y: event.clientY };
      } else {
        // Multiple fingers — not a tap
        tapCandidate.current = false;
        tapStartPos.current = null;
      }

      replacePointer(event);

      if (pointers.length === 2) {
        setZooming(true);
        // A pinch invalidates both tap tracking and double-tap timing
        lastPointerDown.current = 0;
        tapCandidate.current = false;
        tapStartPos.current = null;
        const dist = distance(pointers[0].clientX, pointers[0].clientY, pointers[1].clientX, pointers[1].clientY);
        pinchState.current = {
          initialDistance: Math.max(dist, 1),
          initialZoom: zoom,
        };
        hadPinch.current = true;
      }
    },
    [wrapperRef, contentElementRef, isScrollingRef, translateCoordinates, replacePointer, setZooming],
  );

  const handlePointerMove = React.useCallback(
    (event: PointerEvent) => {
      const pointers = activePointers.current;
      const { getZoom, changeZoom, changeOffsets } = actionsRef.current;
      const zoom = getZoom();

      // Invalidate tap candidate if finger moved beyond threshold
      if (tapCandidate.current && tapStartPos.current) {
        const dx = event.clientX - tapStartPos.current.x;
        const dy = event.clientY - tapStartPos.current.y;
        if (Math.hypot(dx, dy) > TAP_MOVE_THRESHOLD) {
          tapCandidate.current = false;
          tapStartPos.current = null;
        }
      }

      const existing = pointers.find((p) => p.pointerId === event.pointerId);

      // Pinch zoom (2 pointers) — overscroll allows elastic bounce past bounds
      if (pointers.length === 2 && pinchState.current) {
        event.stopPropagation();
        replacePointer(event);
        velocityTracker.current.length = 0;

        const currentDist = distance(pointers[0].clientX, pointers[0].clientY, pointers[1].clientX, pointers[1].clientY);
        const targetZoom = pinchZoom(pinchState.current.initialZoom, pinchState.current.initialDistance, currentDist);

        const [cx, cy] = pointers
          .map((p) => translateCoordinates(p))
          .reduce<[number, number]>((acc, c) => [acc[0] + c[0] / 2, acc[1] + c[1] / 2], [0, 0]);

        changeZoom(targetZoom, true, cx, cy, true);
        return;
      }

      // Single-pointer drag for panning — elastic on touch
      if (zoom > 1 && existing) {
        event.stopPropagation();
        if (pointers.length === 1) {
          const isTouch = event.pointerType === 'touch';
          changeOffsets(
            (existing.clientX - event.clientX) / zoom,
            (existing.clientY - event.clientY) / zoom,
            isTouch,
          );
          // Track positions for momentum calculation on touch release
          if (isTouch) {
            const now = event.timeStamp;
            const tracker = velocityTracker.current;
            tracker.push({ x: event.clientX, y: event.clientY, t: now });
            // Trim entries older than the velocity window
            while (tracker.length > 0 && now - tracker[0].t > VELOCITY_WINDOW) {
              tracker.shift();
            }
          }
        }
        replacePointer(event);
      }
    },
    [replacePointer, translateCoordinates],
  );

  const handlePointerUp = React.useCallback(
    (event: PointerEvent) => {
      const pointers = activePointers.current;
      if (pointers.length === 2 && pointers.some((p) => p.pointerId === event.pointerId)) {
        pinchState.current = undefined;
      }
      clearPointer(event.pointerId);
      if (activePointers.current.length === 0) {
        const wasTap = tapCandidate.current;
        const wasPinch = hadPinch.current;

        // Commit a deferred double-tap only if this second touch actually
        // ended as a stationary tap (not a swipe/flick, which clears
        // tapCandidate on move) and wasn't part of a pinch.
        if (pendingDoubleTap.current && wasTap && !wasPinch) {
          pendingDoubleTap.current = false;
          const focal = doubleTapFocal.current;
          doubleTapFocal.current = null;
          lastWasTap.current = false;
          lastTapPos.current = null;
          lastPointerDown.current = 0;
          tapCandidate.current = false;
          tapStartPos.current = null;
          actionsRef.current.setDragging(false);

          const { minZoom, maxZoom, zoomStep } = configRef.current;
          const zoom = actionsRef.current.getZoom();
          const targetZoom = doubleTapTargetZoom(zoom, minZoom, maxZoom, zoomStep);
          setZooming(true);
          if (focal) {
            actionsRef.current.changeZoom(targetZoom, false, focal[0], focal[1]);
          } else {
            actionsRef.current.changeZoom(targetZoom, false);
          }
          return;
        }
        pendingDoubleTap.current = false;
        doubleTapFocal.current = null;

        // Finalize tap detection: was this a clean single-finger tap?
        lastWasTap.current = wasTap;
        if (wasTap) {
          lastTapPos.current = { x: event.clientX, y: event.clientY };
        }
        tapCandidate.current = false;
        tapStartPos.current = null;
        actionsRef.current.setDragging(false);
        if (wasPinch) {
          hadPinch.current = false;
          actionsRef.current.snapToBounds();
        }
        if (event.pointerType === 'touch') {
          const tracker = velocityTracker.current;
          const zoom = actionsRef.current.getZoom();
          const hasMomentum = !wasPinch && zoom > 1 && tracker.length >= 2;

          if (hasMomentum) {
            const { x: curX, y: curY } = actionsRef.current.getOffsets();
            const target = computeMomentumTarget(
              tracker,
              curX,
              curY,
              zoom,
              MOMENTUM_MULTIPLIER,
              MOMENTUM_THRESHOLD,
            );
            if (target) {
              tracker.length = 0;
              actionsRef.current.momentumPan(target.targetX, target.targetY);
              setZooming(false);
              return;
            }
          }

          tracker.length = 0;
          actionsRef.current.snapOffsetsToBounds();
        }
        // Clear zooming flag (delayed to cover snap-back animation)
        setZooming(false);
      }
    },
    [clearPointer, setZooming],
  );

  // -------------------------------------------------------------------
  // Wheel / trackpad
  // -------------------------------------------------------------------

  // Safari provides GestureEvent for trackpad pinch — we handle zoom via
  // gesturechange there. The wheel handler skips ctrlKey only while a
  // gesture is active to avoid double-processing. Physical Ctrl+wheel
  // (no gesture) is still handled normally on Safari.
  const hasSafariGesturesRef = React.useRef(
    typeof window !== 'undefined' && 'GestureEvent' in window,
  );
  const gestureActiveRef = React.useRef(false);

  const handleWheel = React.useCallback(
    (event: WheelEvent) => {
      // Defer to an in-flight Lightbox.Slides scroll (passive: the event still
      // scrolls the slides; we just don't start a scroll-to-zoom).
      if (isScrollingRef?.current) return;
      const { scrollToZoom, wheelSensitivity } = configRef.current;
      const { getZoom, changeZoom, changeOffsets } = actionsRef.current;
      const zoom = getZoom();

      // Skip ctrlKey+wheel during an active Safari trackpad pinch gesture
      // (GestureEvent handles it). Physical Ctrl+wheel still works.
      const shouldZoom =
        (event.ctrlKey && !gestureActiveRef.current) || scrollToZoom;

      if (shouldZoom) {
        if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
          event.preventDefault();
          event.stopPropagation();
          changeZoom(
            scaleZoom(zoom, -event.deltaY, wheelSensitivity),
            true,
            ...translateCoordinates(event),
          );
          return;
        }
      }

      if (zoom > 1) {
        event.preventDefault();
        event.stopPropagation();
        if (!scrollToZoom) {
          changeOffsets(event.deltaX, event.deltaY);
        }
      }
    },
    [translateCoordinates, isScrollingRef],
  );

  // -------------------------------------------------------------------
  // Attach / detach listeners
  //
  // Keyboard zoom/pan is intentionally NOT handled here: the zoom container is
  // not focusable (so it can never strand focus when its slide becomes inert),
  // and keyboard is owned by Lightbox.Content, which drives the active slide's
  // zoom through the active-zoom bridge (reset/panBy/zoomIn/zoomOut).
  // -------------------------------------------------------------------

  // Pointer + keyboard listeners (always passive-compatible, stable effect)
  React.useEffect(() => {
    if (disabled) return;
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('pointerdown', handlePointerDown);
    el.addEventListener('pointermove', handlePointerMove);
    el.addEventListener('pointerup', handlePointerUp);
    el.addEventListener('pointercancel', handlePointerUp);

    return () => {
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerup', handlePointerUp);
      el.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [disabled, containerRef, handlePointerDown, handlePointerMove, handlePointerUp]);

  // Wheel listener — registered separately so we can toggle passive flag.
  //
  // Safari quirk: a non-passive wheel listener on an ancestor kills
  // compositor-thread momentum scrolling in descendant scroll containers
  // (e.g. Lightbox.Slides). Chrome/Firefox don't have this issue so
  // non-passive is always safe there.
  //
  // On Safari, trackpad pinch-to-zoom is handled via GestureEvent (below),
  // NOT via ctrlKey+wheel, so the wheel handler only needs non-passive
  // when zoomed in (for pan preventDefault) or scrollToZoom is on.
  const needsNonPassiveWheel = hasSafariGesturesRef.current
    ? currentZoom > 1 || config.scrollToZoom
    : true;

  React.useEffect(() => {
    if (disabled) return;
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('wheel', handleWheel, { passive: !needsNonPassiveWheel });

    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [disabled, containerRef, handleWheel, needsNonPassiveWheel]);

  // Safari trackpad pinch-to-zoom via GestureEvent.
  //
  // Safari fires gesturestart/gesturechange/gestureend for trackpad pinch
  // gestures, with a `scale` property for the cumulative pinch factor.
  // This is more reliable than ctrlKey+wheel on Safari and doesn't require
  // a non-passive wheel listener (which would break momentum scrolling).
  React.useEffect(() => {
    if (disabled || !hasSafariGesturesRef.current) return;
    const el = containerRef.current;
    if (!el) return;

    let initialZoom = 1;

    const onGestureStart = (e: Event) => {
      // Always swallow the native page-zoom gesture over the lightbox. Then, if a
      // Lightbox.Slides swipe/fling is in flight, leave `gestureActiveRef` false so
      // the whole gesture (gesturechange/gestureend) is a no-op — the pinch can't
      // hijack the scroll. It re-arms naturally on the next gesture once settled.
      e.preventDefault();
      if (isScrollingRef?.current) return;
      gestureActiveRef.current = true;
      initialZoom = actionsRef.current.getZoom();
    };

    const onGestureChange = (e: Event) => {
      e.preventDefault();
      // Gesture never started (suppressed mid-scroll) — don't zoom.
      if (!gestureActiveRef.current) return;
      const scale = (e as { scale?: number }).scale;
      if (typeof scale !== 'number') return;
      const target = initialZoom * scale;
      const [cx, cy] = translateCoordinates(e as unknown as { clientX: number; clientY: number });
      actionsRef.current.changeZoom(target, true, cx, cy, true);
    };

    const onGestureEnd = (e: Event) => {
      e.preventDefault();
      if (!gestureActiveRef.current) return;
      gestureActiveRef.current = false;
      actionsRef.current.snapToBounds();
    };

    el.addEventListener('gesturestart', onGestureStart);
    el.addEventListener('gesturechange', onGestureChange);
    el.addEventListener('gestureend', onGestureEnd);

    return () => {
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
      el.removeEventListener('gestureend', onGestureEnd);
    };
  }, [disabled, containerRef, translateCoordinates, isScrollingRef]);

  // Cleanup when disabled changes or component unmounts
  React.useEffect(() => {
    const ptrs = activePointers.current;
    const contentEl = contentElementRef?.current;
    return () => {
      ptrs.length = 0;
      lastPointerDown.current = 0;
      hadPinch.current = false;
      pinchState.current = undefined;
      if (zoomingTimerRef.current) {
        clearTimeout(zoomingTimerRef.current);
        zoomingTimerRef.current = null;
      }
      contentEl?.removeAttribute('data-zooming');
    };
  }, [disabled, contentElementRef]);
}

export { useZoomGestures };
export type { ZoomGestureConfig, ZoomGestureActions };
