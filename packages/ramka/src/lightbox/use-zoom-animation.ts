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
  /**
   * `discrete` (default): a deliberate zoom transition (double-tap, keyboard,
   * buttons) — gestures are deferred until it settles.
   * `settle`: baked release physics (coast, bounce, bound snap-back) — fully
   * interruptible; a new gesture cancels it and takes over at the live pose.
   */
  kind?: 'discrete' | 'settle';
  /**
   * Baked physics trajectory: intermediate poses at a fixed timestep, played
   * as linear WAAPI keyframes on the compositor (immune to rAF throttling —
   * e.g. iOS Low Power Mode caps rAF at ~30fps while compositor animations
   * keep native refresh). The final keyframe is the committed React pose.
   * When set, `easing` is ignored — the physics IS the easing.
   */
  path?: ZoomPose[];
  /**
   * Exact numeric start pose. When provided, captureStart skips the
   * `getComputedStyle` sample — a forced style recalc that costs real frames
   * in the release hot path. Only valid when the caller KNOWS the visual pose
   * (e.g. right after cancelling any in-flight animation committed it).
   */
  fromPose?: ZoomPose;
  /**
   * Whether this transition changes the zoom scale (default true). Zoom-static
   * settles (pure momentum pan) let chrome skip its per-frame live-scale
   * sampling loop — the committed zoom is already the visual truth.
   */
  zoomChanges?: boolean;
}

interface ZoomPose {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

interface RunningPathInfo {
  /** All poses incl. start and end — keyframes at uniform time offsets. */
  poses: ZoomPose[];
  duration: number;
}

function poseTransform(p: ZoomPose): string {
  return `scale(${p.zoom}) translate(${p.offsetX}px, ${p.offsetY}px)`;
}

/**
 * Exact live pose of a keyframed settle animation at `currentTime`. Keyframes
 * sit at uniform offsets and interpolate linearly, and CSS interpolates a
 * matching `scale() translate()` pair per-function numerically — so lerping
 * the two bracketing poses reproduces the composited transform exactly,
 * without trusting `getComputedStyle` mid-WAAPI (inconsistent in Safari).
 */
function livePoseOnPath(info: RunningPathInfo, currentTime: unknown): ZoomPose | null {
  const n = info.poses.length;
  if (n === 0) return null;
  if (n === 1 || info.duration <= 0) return info.poses[n - 1]!;
  const ct = typeof currentTime === 'number' ? currentTime : 0;
  const p = Math.min(1, Math.max(0, ct / info.duration));
  const seg = p * (n - 1);
  const i = Math.min(n - 2, Math.floor(seg));
  const f = seg - i;
  const a = info.poses[i]!;
  const b = info.poses[i + 1]!;
  return {
    zoom: a.zoom + (b.zoom - a.zoom) * f,
    offsetX: a.offsetX + (b.offsetX - a.offsetX) * f,
    offsetY: a.offsetY + (b.offsetY - a.offsetY) * f,
  };
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
  // Kind of the armed/running transition — gates read this synchronously.
  const runningKind = React.useRef<'discrete' | 'settle' | undefined>(undefined);
  // Numeric trajectory of a keyframed settle — for exact cancel recovery.
  const runningPath = React.useRef<RunningPathInfo | undefined>(undefined);
  // Whether the armed/running transition animates the zoom scale. State (not
  // a ref) so the chrome publisher effect re-evaluates when a new animation
  // arms in the same batch as another ends (isAnimating never flips then).
  const [animatesZoom, setAnimatesZoom] = React.useState(true);
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
    runningPath.current = undefined;

    const toPose: ZoomPose = { zoom, offsetX, offsetY };
    const to = poseTransform(toPose);
    if (from === to) {
      runningKind.current = undefined;
      setAnimating(false);
      onFinish?.();
      return;
    }

    try {
      // React just committed `to` on the style attribute. Pin `from` before
      // paint so we don't flash the end pose for a frame, then let WAAPI own
      // the composite until settle.
      el.style.transform = from;
      const path = opts?.path;
      const animDuration = reducedMotion ? 0 : (opts?.duration ?? duration);
      const keyframes: Keyframe[] =
        path && path.length > 0
          ? // Baked physics: uniform linear keyframes ending on the committed
            // pose. Per-keyframe easing defaults to linear — the trajectory
            // itself carries the physics curve.
            [{ transform: from }, ...path.map((p) => ({ transform: poseTransform(p) })), { transform: to }]
          : [{ transform: from, easing: opts?.easing ?? 'ease-in-out' }, { transform: to }];
      const anim = el.animate(keyframes, {
        duration: animDuration,
        fill: 'forwards',
      });
      runningAnimation.current = anim;
      if (path && path.length > 0) {
        // Prefer the exact numeric start pose when the caller provided one;
        // otherwise the `from` keyframe is the live computed transform, whose
        // numeric pose is one bake step behind path[0] — close enough that
        // starting the recovery trajectory there is exact for practical use.
        runningPath.current = {
          poses: [opts?.fromPose ?? path[0]!, ...path, toPose],
          duration: animDuration,
        };
      }
      setAnimating(true);

      const settleInlineToTarget = () => {
        // Never clear transform to '' — that drops React's inline style until
        // the next commit and flashes identity scale. Always land on `to`.
        el.style.transform = to;
      };

      anim.onfinish = () => {
        if (runningAnimation.current !== anim) return;
        runningAnimation.current = undefined;
        runningPath.current = undefined;
        runningKind.current = undefined;
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
        runningPath.current = undefined;
        runningKind.current = undefined;
        settleInlineToTarget();
        setAnimating(false);
      };
    } catch {
      // WAAPI not supported — silent fallback to instant state
      el.style.transform = to;
      runningKind.current = undefined;
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
    if (opts?.fromPose) {
      // Known start pose — skip the getComputedStyle sample (a forced style
      // recalc that costs real frames in the release hot path).
      startTransform.current = poseTransform(opts.fromPose);
    } else {
      const el = wrapperRef.current;
      startTransform.current = el ? getComputedStyle(el).transform : undefined;
    }
    overrideOpts.current = opts;
    runningKind.current = opts?.kind ?? 'discrete';
    setAnimatesZoom(opts?.zoomChanges ?? true);
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
    const pathInfo = runningPath.current;
    runningAnimation.current = undefined;
    runningPath.current = undefined;
    runningKind.current = undefined;
    startTransform.current = undefined;
    overrideOpts.current = undefined;
    if (!anim) {
      setAnimating(false);
      return null;
    }
    anim.onfinish = null;
    anim.oncancel = null;
    const el = wrapperRef.current;
    // Keyframed settles recover their pose analytically from the baked
    // trajectory (exact); two-pose transitions sample the computed transform
    // BEFORE cancel — cancelling drops the WAAPI style layer.
    const live = pathInfo
      ? livePoseOnPath(pathInfo, anim.currentTime)
      : el
        ? poseFromComputedTransform(getComputedStyle(el).transform)
        : null;
    anim.cancel();
    if (el) {
      el.style.transform = live
        ? poseTransform(live)
        : // Pose unrecoverable — fall back to the committed React pose (play()
          // may have pinned `from` on the inline style; never leave that).
          `scale(${zoom}) translate(${offsetX}px, ${offsetY}px)`;
    }
    setAnimating(false);
    return live;
  }, [wrapperRef, zoom, offsetX, offsetY, setAnimating]);

  const getIsAnimating = React.useCallback(() => animatingRef.current, []);

  /**
   * True only while a *discrete* zoom transition plays (double-tap, keyboard,
   * buttons). Gesture gates key off this — baked settle physics must NOT
   * block input; a touch catches it (cancel + live-pose takeover) instead.
   */
  const getIsDiscreteAnimating = React.useCallback(
    () => animatingRef.current && runningKind.current === 'discrete',
    [],
  );

  /**
   * Live animated zoom of a keyframed settle, computed analytically from the
   * baked trajectory — no `getComputedStyle`, so sampling it per frame costs
   * no style recalc. Returns `null` when no keyframed animation is running.
   */
  const getLiveAnimatedZoom = React.useCallback((): number | null => {
    const anim = runningAnimation.current;
    const info = runningPath.current;
    if (!anim || !info) return null;
    return livePoseOnPath(info, anim.currentTime)?.zoom ?? null;
  }, []);

  return {
    captureStart,
    cancel,
    isAnimating,
    /** Whether the armed/running transition animates the zoom scale. */
    animatesZoom,
    getIsAnimating,
    getIsDiscreteAnimating,
    getLiveAnimatedZoom,
  };
}

export { useZoomAnimation };
