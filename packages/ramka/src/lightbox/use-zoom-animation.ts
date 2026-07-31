'use client';

import * as React from 'react';

/**
 * Manages Web Animations API transitions for zoom changes.
 *
 * Call `captureStart()` before a state update to snapshot the current
 * transform. On the next layout effect the hook creates a WAAPI
 * animation from the snapshot to the new computed transform.
 *
 * Rapid / continuous gestures (pinch, scroll) skip animation entirely —
 * they update state every frame and never call `captureStart()`.
 *
 * `isAnimating` is true while a WAAPI transition is in flight so callers
 * can keep chrome attributes (e.g. `data-zoomed`) aligned with the
 * *visual* transform rather than the already-committed React state.
 */
interface CaptureOptions {
  duration?: number;
  easing?: string;
  /** Fired when the WAAPI transition finishes (not when cancelled). */
  onFinish?: () => void;
}

function useZoomAnimation(
  zoom: number,
  offsetX: number,
  offsetY: number,
  wrapperRef: React.RefObject<HTMLElement | null>,
  duration: number,
) {
  const runningAnimation = React.useRef<Animation | undefined>(undefined);
  const startTransform = React.useRef<string | undefined>(undefined);
  const overrideOpts = React.useRef<CaptureOptions | undefined>(undefined);
  const [isAnimating, setIsAnimating] = React.useState(false);

  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const play = React.useCallback(() => {
    runningAnimation.current?.cancel();
    runningAnimation.current = undefined;

    const el = wrapperRef.current;
    const from = startTransform.current;
    const opts = overrideOpts.current;
    startTransform.current = undefined;
    overrideOpts.current = undefined;
    const onFinish = opts?.onFinish;

    if (!from || !el) {
      setIsAnimating(false);
      return;
    }

    const to = `scale(${zoom}) translate(${offsetX}px, ${offsetY}px)`;
    if (from === to) {
      setIsAnimating(false);
      onFinish?.();
      return;
    }

    try {
      const anim = el.animate(
        [
          { transform: from, easing: opts?.easing ?? 'ease-in-out' },
          { transform: to },
        ],
        {
          duration: reducedMotion ? 0 : (opts?.duration ?? duration),
          fill: 'none',
        },
      );
      runningAnimation.current = anim;
      setIsAnimating(true);
      anim.onfinish = () => {
        if (runningAnimation.current === anim) {
          runningAnimation.current = undefined;
          setIsAnimating(false);
          onFinish?.();
        }
      };
      anim.oncancel = () => {
        if (runningAnimation.current === anim) {
          runningAnimation.current = undefined;
          setIsAnimating(false);
        }
      };
    } catch {
      // WAAPI not supported — silent fallback to instant state
      setIsAnimating(false);
      onFinish?.();
    }
  }, [zoom, offsetX, offsetY, wrapperRef, duration, reducedMotion]);

  React.useLayoutEffect(play, [zoom, offsetX, offsetY, play]);

  /**
   * Call before a state change to capture the current transform.
   * Pass options to override the animation duration/easing for
   * this particular transition (e.g. faster snap-back).
   *
   * Marks `isAnimating` eagerly (same event turn as the upcoming
   * `setZoom`) so chrome that keys off it — e.g. keeping `data-zoomed`
   * through a zoom-out — doesn't see a one-frame gap before the layout
   * effect starts the WAAPI animation.
   */
  const captureStart = React.useCallback((opts?: CaptureOptions) => {
    const el = wrapperRef.current;
    startTransform.current = el ? getComputedStyle(el).transform : undefined;
    overrideOpts.current = opts;
    setIsAnimating(true);
  }, [wrapperRef]);

  const cancel = React.useCallback(() => {
    runningAnimation.current?.cancel();
    runningAnimation.current = undefined;
    startTransform.current = undefined;
    overrideOpts.current = undefined;
    setIsAnimating(false);
  }, []);

  return { captureStart, cancel, isAnimating };
}

export { useZoomAnimation };
