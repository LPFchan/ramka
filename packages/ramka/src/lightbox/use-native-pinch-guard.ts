'use client';

import * as React from 'react';

/**
 * Prevent native pinch-zoom gestures (touch and trackpad) for the entire
 * time the lightbox is mounted.
 *
 * Attached on `document`, NOT the content element. During the VT open the
 * content mounts `visibility: hidden` (see `preparing`), which makes it
 * non-hit-testable — so a quick pinch mid-open lands on the page/trigger/
 * backdrop instead of the content, triggers native page zoom, and then our
 * per-image `Lightbox.Zoom` gesture guards (which `preventDefault` every
 * subsequent gesture over the viewer) trap the page in that zoomed state
 * with no way to pinch back out. A document-level guard blocks native
 * pinch-zoom everywhere, from mount through the whole transition. The
 * per-Zoom listeners still perform the actual image zoom — `preventDefault`
 * cancels only the browser's native default, not our own handlers.
 *
 * Safari quirk: a non-passive `wheel` listener on an ancestor forces Safari
 * to fall back from compositor-thread scrolling to main-thread scrolling,
 * killing momentum/flick scrolling in descendant scroll containers (e.g.
 * Lightbox.Slides). Safari fires its own GestureEvent (gesturestart/
 * gesturechange) for trackpad pinch — preventing those stops native zoom
 * without any wheel listener. For Chrome/Firefox (no GestureEvent), trackpad
 * pinch arrives as ctrlKey+wheel and non-passive wheel listeners don't break
 * their momentum scrolling, so a non-passive wheel handler is safe.
 */
export function useNativePinchGuard(mounted: boolean): void {
  React.useEffect(() => {
    if (!mounted) return;

    let pinchGestureActive = false;
    const preventTouchPinch = (event: TouchEvent) => {
      // Two-finger: native page pinch. Leftover finger after a pinch
      // (zoom snap-back): native gallery scroll, which would lock Slides
      // with no `scrollend` and freeze pull/pinch/double-tap.
      if (event.touches.length > 1 || pinchGestureActive) {
        event.preventDefault();
      }
    };
    const onPinchTouchStart = (event: TouchEvent) => {
      if (event.touches.length > 1) pinchGestureActive = true;
    };
    const onPinchTouchEnd = (event: TouchEvent) => {
      if (event.touches.length === 0) pinchGestureActive = false;
    };
    document.addEventListener('touchmove', preventTouchPinch, { passive: false });
    document.addEventListener('touchstart', onPinchTouchStart, { passive: true });
    document.addEventListener('touchend', onPinchTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onPinchTouchEnd, { passive: true });

    const hasSafariGestures = 'GestureEvent' in window;

    let preventGesture: ((e: Event) => void) | undefined;
    let preventWheelZoom: ((e: WheelEvent) => void) | undefined;

    if (hasSafariGestures) {
      preventGesture = (e: Event) => e.preventDefault();
      document.addEventListener('gesturestart', preventGesture);
      document.addEventListener('gesturechange', preventGesture);
    } else {
      preventWheelZoom = (e: WheelEvent) => {
        if (e.ctrlKey) e.preventDefault();
      };
      document.addEventListener('wheel', preventWheelZoom, { passive: false });
    }

    return () => {
      document.removeEventListener('touchmove', preventTouchPinch);
      document.removeEventListener('touchstart', onPinchTouchStart);
      document.removeEventListener('touchend', onPinchTouchEnd);
      document.removeEventListener('touchcancel', onPinchTouchEnd);
      if (preventGesture) {
        document.removeEventListener('gesturestart', preventGesture);
        document.removeEventListener('gesturechange', preventGesture);
      }
      if (preventWheelZoom) {
        document.removeEventListener('wheel', preventWheelZoom);
      }
    };
  }, [mounted]);
}
