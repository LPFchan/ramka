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

interface ZoomPose {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Recover `{zoom, offsetX, offsetY}` from a computed transform. The wrapper
 * transform is always `scale(z) translate(x, y)`, which resolves to
 * `matrix(z, 0, 0, z, z·x, z·y)` — so the pose is uniquely recoverable.
 * Returns `null` when the transform is missing/`none` or the environment
 * lacks `DOMMatrixReadOnly` (jsdom).
 */
function poseFromComputedTransform(transform: string): ZoomPose | null {
  if (!transform || transform === 'none') return null;
  try {
    const m = new DOMMatrixReadOnly(transform);
    const scale = Math.hypot(m.a, m.b);
    if (!(scale > 0)) return null;
    return { zoom: scale, offsetX: m.e / scale, offsetY: m.f / scale };
  } catch {
    return null;
  }
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
  // Sync flag for gesture gates — React state can lag a frame behind WAAPI
  // settle, and pointer handlers must not read a stale `true`.
  const animatingRef = React.useRef(false);
  const [isAnimating, setIsAnimating] = React.useState(false);

  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const setAnimating = React.useCallback((value: boolean) => {
    animatingRef.current = value;
    setIsAnimating(value);
  }, []);

  const play = React.useCallback(() => {
    const el = wrapperRef.current;
    const from = startTransform.current;
    // Only `captureStart()` arms a transition. Ignore layout-effect re-runs
    // from unrelated zoom/offset updates so they can't cancel an in-flight
    // double-tap / snap WAAPI (a mid-animation pan used to clear `from` and
    // then tear the animation down on the next play).
    if (!from || !el) return;

    const opts = overrideOpts.current;
    startTransform.current = undefined;
    overrideOpts.current = undefined;
    const onFinish = opts?.onFinish;

    runningAnimation.current?.cancel();
    runningAnimation.current = undefined;

    const to = `scale(${zoom}) translate(${offsetX}px, ${offsetY}px)`;
    if (from === to) {
      setAnimating(false);
      onFinish?.();
      return;
    }

    try {
      // React just committed `to` on the style attribute. Pin `from` before
      // paint so we don't flash the end pose for a frame, then let WAAPI own
      // the composite until settle.
      el.style.transform = from;
      const anim = el.animate(
        [
          { transform: from, easing: opts?.easing ?? 'ease-in-out' },
          { transform: to },
        ],
        {
          duration: reducedMotion ? 0 : (opts?.duration ?? duration),
          fill: 'forwards',
        },
      );
      runningAnimation.current = anim;
      setAnimating(true);

      const settleInlineToTarget = () => {
        // Never clear transform to '' — that drops React's inline style until
        // the next commit and flashes identity scale. Always land on `to`.
        el.style.transform = to;
      };

      anim.onfinish = () => {
        if (runningAnimation.current !== anim) return;
        runningAnimation.current = undefined;
        anim.onfinish = null;
        anim.oncancel = null;
        try {
          anim.commitStyles();
        } catch {
          settleInlineToTarget();
        }
        anim.cancel();
        settleInlineToTarget();
        setAnimating(false);
        onFinish?.();
      };
      anim.oncancel = () => {
        if (runningAnimation.current !== anim) return;
        runningAnimation.current = undefined;
        settleInlineToTarget();
        setAnimating(false);
      };
    } catch {
      // WAAPI not supported — silent fallback to instant state
      el.style.transform = to;
      setAnimating(false);
      onFinish?.();
    }
  }, [zoom, offsetX, offsetY, wrapperRef, duration, reducedMotion, setAnimating]);

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
    setAnimating(true);
  }, [wrapperRef, setAnimating]);

  /**
   * Cancel an in-flight transition so a live gesture can take over.
   *
   * Freezes the element at the **live mid-flight pose** (not the animation's
   * target) and returns that pose so the caller can commit it to state —
   * otherwise the takeover teleports to the end pose, a visible jump when a
   * pan interrupts a zoom bound-snap. Returns `null` when nothing was in
   * flight or the pose can't be recovered (then the committed React pose is
   * restored instead).
   */
  const cancel = React.useCallback((): ZoomPose | null => {
    const anim = runningAnimation.current;
    runningAnimation.current = undefined;
    startTransform.current = undefined;
    overrideOpts.current = undefined;
    if (!anim) {
      setAnimating(false);
      return null;
    }
    anim.onfinish = null;
    anim.oncancel = null;
    const el = wrapperRef.current;
    // Sample BEFORE cancel — cancelling drops the WAAPI style layer.
    const live = el ? poseFromComputedTransform(getComputedStyle(el).transform) : null;
    anim.cancel();
    if (el) {
      el.style.transform = live
        ? `scale(${live.zoom}) translate(${live.offsetX}px, ${live.offsetY}px)`
        : // Pose unrecoverable — fall back to the committed React pose (play()
          // may have pinned `from` on the inline style; never leave that).
          `scale(${zoom}) translate(${offsetX}px, ${offsetY}px)`;
    }
    setAnimating(false);
    return live;
  }, [wrapperRef, zoom, offsetX, offsetY, setAnimating]);

  const getIsAnimating = React.useCallback(() => animatingRef.current, []);

  return { captureStart, cancel, isAnimating, getIsAnimating };
}

export { useZoomAnimation };
