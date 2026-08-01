/**
 * Pure gesture math shared by the lightbox gesture hooks.
 *
 * Everything here is a plain function of its inputs — no DOM, no refs, no React
 * — so the tricky bits (damping, velocity, direction-lock, elastic clamping,
 * focal-point zoom, momentum) can be unit-tested directly instead of only
 * through flaky pointer/wheel integration tests. The stateful hooks
 * (`use-pull-to-dismiss`, `use-zoom-gestures`) and `Lightbox.Zoom` own the
 * event wiring and constants and delegate the arithmetic here.
 */

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

/** Gesture axis after direction resolution. */
export type GestureAxis = 'none' | 'vertical' | 'horizontal';

/** Euclidean distance between two points. */
export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/** Hard clamp to `[min, max]`. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Round to `decimals` places to kill floating-point noise. */
export function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// ---------------------------------------------------------------------------
// Pull-to-dismiss
// ---------------------------------------------------------------------------

/** Vertical travel flattens toward `dismissDistance * this` as a ceiling. */
export const PULL_DAMP_TRAVEL_RATIO = 1.2;

export interface PullTransform {
  /** Damped horizontal translation (px). */
  x: number;
  /** Damped vertical translation (px). */
  y: number;
  /** Shrink scale (1 at rest → `minScale` at/after the threshold). */
  scale: number;
  /** 0 at rest → 1 at the dismiss threshold (clamped). */
  progress: number;
}

/**
 * Asymptotic damping for a pull-to-dismiss drag. Vertical travel moves ~1:1
 * near the origin then flattens toward a ceiling of
 * `dismissDistance * PULL_DAMP_TRAVEL_RATIO`; horizontal travel is scaled by
 * the same damping factor so the content never slides sideways faster than it
 * falls, and the curve never reverses regardless of drag distance.
 */
export function computePullTransform(
  rawDeltaX: number,
  rawDeltaY: number,
  dismissDistance: number,
  minScale: number,
): PullTransform {
  const absY = Math.abs(rawDeltaY);
  const maxTravel = dismissDistance * PULL_DAMP_TRAVEL_RATIO;
  const dampedAbsY = maxTravel * (1 - Math.exp(-absY / maxTravel));
  const dampedY = Math.sign(rawDeltaY) * dampedAbsY;
  const dampFactor = absY > 0 ? dampedAbsY / absY : 1;
  const dampedX = rawDeltaX * dampFactor;

  const progress = Math.min(absY / dismissDistance, 1);
  const scale = 1 - progress * (1 - minScale);

  return { x: dampedX, y: dampedY, scale, progress };
}

/** Average vertical velocity (px/s) across a series of `{ y, t }` samples. */
export function computePullVelocity(samples: readonly { y: number; t: number }[]): number {
  if (samples.length < 2) return 0;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const dt = last.t - first.t;
  if (dt === 0) return 0;
  return ((last.y - first.y) / dt) * 1000;
}

/**
 * Direction-lock: `'none'` until the pointer travels past `lockDistance`, then
 * whichever axis dominates. Ties resolve to vertical (favoring dismiss).
 */
export function resolveDragAxis(deltaX: number, deltaY: number, lockDistance: number): GestureAxis {
  if (Math.hypot(deltaX, deltaY) < lockDistance) return 'none';
  return Math.abs(deltaY) >= Math.abs(deltaX) ? 'vertical' : 'horizontal';
}

/**
 * Whether a completed pull should dismiss: either dragged past the distance
 * threshold, or flicked fast enough in the same direction as the drag.
 */
export function shouldDismissPull(
  deltaY: number,
  velocity: number,
  dismissDistance: number,
  dismissVelocity: number,
): boolean {
  const sameDirection = (deltaY > 0 && velocity > 0) || (deltaY < 0 && velocity < 0);
  return Math.abs(deltaY) >= dismissDistance || (Math.abs(velocity) >= dismissVelocity && sameDirection);
}

/**
 * Which axis a wheel event favors. `'none'` for a zero delta; ties (equal
 * magnitudes) resolve to vertical to mirror {@link resolveDragAxis}.
 */
export function wheelAxis(deltaX: number, deltaY: number): GestureAxis {
  if (deltaX === 0 && deltaY === 0) return 'none';
  return Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
}

// ---------------------------------------------------------------------------
// Zoom
// ---------------------------------------------------------------------------

/** Linear resistance for simple elastic clamps (e.g. pinch zoom overshoot). */
export const ELASTIC_FACTOR = 0.2;

/**
 * UIScrollView rubber-band constant. Paired with {@link rubberBandDistance}:
 * `f(x, d, c) = (x · d · c) / (d + c · x)`.
 *
 * Lower = stiffer early resistance. Apple uses `0.55` for full-bleed scroll
 * views; media viewers feel better a bit tighter.
 */
export const RUBBER_BAND_CONSTANT = 0.28;

/**
 * Fraction of the viewport used as the rubber-band asymptote (touch).
 * Apple scroll views use `1` (ceiling ≈ full viewport). For zoomed media that
 * reads as “pulls way off-screen”, so we use a shorter leash.
 */
export const RUBBER_BAND_DIMENSION_FACTOR = 0.16;

/**
 * Mouse pan rubber-band asymptote. Pointer precision makes the touch leash
 * feel like you can yank the image too far — keep desktop tighter.
 */
export const RUBBER_BAND_DIMENSION_FACTOR_MOUSE = 0.09;

/**
 * Pan rubber-band dimension in offset units: `(viewportPx * factor) / zoom`.
 * Keeps screen-space feel zoom-invariant while capping max stretch.
 */
export function rubberBandPanDimension(
  viewportPx: number,
  zoom: number,
  factor = RUBBER_BAND_DIMENSION_FACTOR,
): number {
  if (viewportPx <= 0 || zoom <= 0) return 0;
  return (viewportPx * factor) / zoom;
}

/**
 * Apple UIScrollView rubber-band: maps unconstrained overscroll `x` (≥ 0) to a
 * resisted distance that asymptotes toward `dimension` and never reaches it.
 *
 * `dimension` must be in the **same units** as `x` (for pan offsets use
 * {@link rubberBandPanDimension}).
 */
export function rubberBandDistance(
  overscroll: number,
  dimension: number,
  constant = RUBBER_BAND_CONSTANT,
): number {
  if (overscroll <= 0 || dimension <= 0 || constant <= 0) return 0;
  return (overscroll * dimension * constant) / (dimension + constant * overscroll);
}

/**
 * Clamp `value` into `[min, max]` with UIScrollView-style rubber-banding past
 * the edges. In-range values pass through; outside, overshoot is compressed by
 * {@link rubberBandDistance} against `dimension`.
 */
export function rubberBandClamp(
  value: number,
  min: number,
  max: number,
  dimension: number,
  constant = RUBBER_BAND_CONSTANT,
): number {
  if (value < min) return min - rubberBandDistance(min - value, dimension, constant);
  if (value > max) return max + rubberBandDistance(value - max, dimension, constant);
  return value;
}

/**
 * Linear rubber-band clamp: values inside `[min, max]` pass through; outside
 * are scaled by `factor`. Used for pinch zoom overshoot (not pan — pan uses
 * {@link rubberBandClamp}).
 */
export function elasticClamp(value: number, min: number, max: number, factor = ELASTIC_FACTOR): number {
  if (value < min) return min - (min - value) * factor;
  if (value > max) return max + (value - max) * factor;
  return value;
}

/**
 * Elastic clamp against a symmetric `±max` bound. The resistance is applied to
 * the magnitude so the sign is preserved.
 */
export function elasticClampSymmetric(value: number, max: number, factor = ELASTIC_FACTOR): number {
  const abs = Math.abs(value);
  if (abs <= max) return value;
  return (max + (abs - max) * factor) * Math.sign(value);
}

/**
 * Maximum pan offset (in pre-zoom px) for content of `contentSize` inside a
 * `containerSize` viewport at `zoom`, when content is centered in the viewport.
 * Zero when the content doesn't overflow.
 */
export function maxPanOffset(contentSize: number, containerSize: number, zoom: number): number {
  return Math.max((contentSize * zoom - containerSize) / 2 / zoom, 0);
}

/**
 * Pan offset limits on one axis for `scale(zoom) translate(offset)` with origin
 * at `stageCenter`, against a (possibly padded) `viewport`.
 *
 * When the Zoom stage is inset unevenly (e.g. taller bottom chrome), true cover
 * against the real dialog is asymmetric — that is what makes every edge
 * reachable without empty margin on the opposite side.
 *
 * Cover collapses to δ = (viewportCenter − stageCenter) / zoom at the fit
 * threshold, not to rest `0`. While media still fits, we lock to a home offset
 * that lerps `0 → δ` between `minZoom` and the fit zoom so crossing the
 * threshold stays continuous (no mid-zoom teleport).
 *
 * - Fits → `{home,home}` (no pan; home is `0` at `minZoom`).
 * - Overflows → true cover `[alignEnd, alignStart]`.
 */
export function panOffsetRange(
  contentSize: number,
  zoom: number,
  viewportStart: number,
  viewportEnd: number,
  stageCenter: number,
  minZoom = 1,
): { min: number; max: number; overflows: boolean } {
  if (zoom <= 0 || contentSize <= 0) {
    return { min: 0, max: 0, overflows: false };
  }

  const viewportSize = viewportEnd - viewportStart;
  const viewportCenter = (viewportStart + viewportEnd) / 2;
  const alignStart = (viewportStart - stageCenter) / zoom + contentSize / 2;
  const alignEnd = (viewportEnd - stageCenter) / zoom - contentSize / 2;

  if (contentSize * zoom <= viewportSize + 0.5) {
    const zoomFit = viewportSize / contentSize;
    if (!(zoomFit > minZoom + 1e-6) || zoom <= minZoom + 1e-6) {
      return { min: 0, max: 0, overflows: false };
    }
    const t = Math.min(1, Math.max(0, (zoom - minZoom) / (zoomFit - minZoom)));
    const home = t * ((viewportCenter - stageCenter) / zoomFit);
    return { min: home, max: home, overflows: false };
  }

  return { min: alignEnd, max: alignStart, overflows: true };
}

/** Hard-clamp an offset pair for a centered stage (symmetric ±max). */
export function clampOffset(
  offsetX: number,
  offsetY: number,
  contentW: number,
  contentH: number,
  containerW: number,
  containerH: number,
  zoom: number,
): { x: number; y: number } {
  const maxX = maxPanOffset(contentW, containerW, zoom);
  const maxY = maxPanOffset(contentH, containerH, zoom);
  return {
    x: Math.min(Math.abs(offsetX), maxX) * Math.sign(offsetX),
    y: Math.min(Math.abs(offsetY), maxY) * Math.sign(offsetY),
  };
}

type RectLike = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

/** Clamp pan offsets against `viewport` with transform origin at `stage` center. */
export function clampOffsetToViewport(
  offsetX: number,
  offsetY: number,
  contentW: number,
  contentH: number,
  zoom: number,
  viewport: RectLike,
  stage: RectLike,
  minZoom = 1,
): { x: number; y: number; overflowsX: boolean; overflowsY: boolean } {
  const xRange = panOffsetRange(
    contentW,
    zoom,
    viewport.left,
    viewport.right,
    stage.left + stage.width / 2,
    minZoom,
  );
  const yRange = panOffsetRange(
    contentH,
    zoom,
    viewport.top,
    viewport.bottom,
    stage.top + stage.height / 2,
    minZoom,
  );
  return {
    x: clamp(offsetX, xRange.min, xRange.max),
    y: clamp(offsetY, yRange.min, yRange.max),
    overflowsX: xRange.overflows,
    overflowsY: yRange.overflows,
  };
}

/**
 * Multiplicative wheel/trackpad zoom step:
 * `value * (1 + |delta|/factor) ^ sign(delta)`, capped so a single event can at
 * most double or halve the zoom.
 */
export function scaleZoom(value: number, delta: number, factor: number): number {
  return value * Math.min(1 + Math.abs(delta / factor), 2) ** Math.sign(delta);
}

/**
 * Auto max-zoom from an image's natural size vs the container, so 100% zoom
 * shows the image pixel-for-pixel. Floored at `minZoom + 1`; falls back when
 * the container hasn't been measured yet.
 */
export function computeMaxZoom(
  imageW: number,
  imageH: number,
  containerW: number,
  containerH: number,
  minZoom: number,
  fallback: number,
): number {
  if (containerW === 0 || containerH === 0) return fallback;
  const natural = Math.max(imageW / containerW, imageH / containerH);
  return Math.max(natural, minZoom + 1);
}

/**
 * New pan offset (one axis) that keeps the focal point `focal` px from center
 * fixed under the cursor while zooming from `fromZoom` to `toZoom`.
 */
export function focalOffset(currentOffset: number, focal: number, fromZoom: number, toZoom: number): number {
  return currentOffset + focal * (1 / toZoom - 1 / fromZoom);
}

/**
 * Project a focal zoom step onto the feasible pan set at the target zoom.
 *
 * Always honors `targetZoom` (caller clamps/elastic-bounds it). Offset is the
 * unconstrained focal result clamped into `range*` — the nearest feasible pan
 * at that zoom. When the cursor sits past a cover edge, the image may slip off
 * the focal point, but scale never stalls at the boundary.
 */
export function projectFocalZoom(
  currentZoom: number,
  currentOffsetX: number,
  currentOffsetY: number,
  targetZoom: number,
  focalX: number,
  focalY: number,
  rangeX: { min: number; max: number },
  rangeY: { min: number; max: number },
): { zoom: number; offsetX: number; offsetY: number } {
  if (!(targetZoom > 0) || !(currentZoom > 0)) {
    return { zoom: currentZoom, offsetX: currentOffsetX, offsetY: currentOffsetY };
  }
  return {
    zoom: targetZoom,
    offsetX: clamp(
      focalOffset(currentOffsetX, focalX, currentZoom, targetZoom),
      rangeX.min,
      rangeX.max,
    ),
    offsetY: clamp(
      focalOffset(currentOffsetY, focalY, currentZoom, targetZoom),
      rangeY.min,
      rangeY.max,
    ),
  };
}

/** Pinch target zoom from the initial pinch (zoom + finger distance) and the current finger distance. */
export function pinchZoom(initialZoom: number, initialDistance: number, currentDistance: number): number {
  return (initialZoom / initialDistance) * currentDistance;
}

/**
 * Double-tap target: zoom back to `minZoom` when already zoomed in, otherwise
 * to `zoomStep` (capped at `maxZoom`).
 */
export function doubleTapTargetZoom(zoom: number, minZoom: number, maxZoom: number, zoomStep: number): number {
  return zoom > minZoom ? minZoom : Math.min(zoomStep, maxZoom);
}

// ---------------------------------------------------------------------------
// Spring
// ---------------------------------------------------------------------------

/**
 * Generate a CSS/WAAPI `linear()` easing string approximating a damped spring,
 * for iOS-style rubber-band *release* snap-backs.
 *
 * The returned easing maps progress `0 → 1` to the fraction of the journey
 * from the released position back to rest. Unlike a plain ease-out it is
 * velocity-aware: with a positive `initialVelocity` the curve first dips below
 * `0` — i.e. the content *follows through* in the release direction before
 * springing back — and it always finishes with a small settle overshoot above
 * `1`, landing exactly at `1`. This mirrors how a native spring picks up the
 * gesture's release velocity instead of reversing from a dead stop.
 *
 * All physics run in normalized progress time, so the caller controls the wall-
 * clock feel purely through the animation's `duration`.
 *
 * @param initialVelocity Release velocity in normalized units — the spring's
 *   `d(fraction)/d(progress)` at `p = 0`. Positive continues past the start
 *   (follow-through); `0` releases at rest. Callers derive it from the real
 *   pointer velocity: `velocity * durationSeconds / releaseAmplitudePx`.
 * @param damping Damping ratio ζ. Lower (`< 1`) is under-damped and *will*
 *   overshoot rest (bouncy). The default `1` is **critically damped**: given a
 *   sane release velocity it approaches rest monotonically and provably never
 *   crosses it, so the easing output never exceeds `1` — no overshoot past rest,
 *   no overflow. Values `> 1` are over-damped (even softer, still no overshoot).
 *   The "life" comes purely from the velocity follow-through, never an end bounce.
 * @param settle The `ζω` product controlling how completely the spring settles
 *   by `p = 1`. Larger settles more fully (crisper arrival, less tail).
 * @param samples Number of `linear()` stops (more = smoother, longer string).
 */
export function springEasingLinear(
  initialVelocity = 0,
  damping = 1,
  settle = 6,
  samples = 40,
): string {
  const zeta = clamp(damping, 0.05, 4);
  const omega = settle / zeta; // natural frequency (ζω = settle)
  const vn = initialVelocity;

  // s(p) is the remaining-distance fraction: s(0) = 1, s(∞) = 0, s'(0) = vn.
  // The easing is e(p) = 1 − s(p), so e(0) = 0 and e settles at 1. When s stays
  // positive (critical / over-damped) e never exceeds 1 → no overshoot past rest.
  let s: (p: number) => number;
  if (zeta < 1) {
    // Under-damped — oscillates, overshoots rest.
    const omegaD = omega * Math.sqrt(1 - zeta * zeta);
    const c = (vn + zeta * omega) / omegaD;
    s = (p) => Math.exp(-zeta * omega * p) * (Math.cos(omegaD * p) + c * Math.sin(omegaD * p));
  } else if (zeta === 1) {
    // Critically damped — fastest non-overshooting approach to rest.
    s = (p) => Math.exp(-omega * p) * (1 + (vn + omega) * p);
  } else {
    // Over-damped — two real roots, monotonic settle.
    const rate = omega * Math.sqrt(zeta * zeta - 1);
    const r1 = -zeta * omega + rate;
    const r2 = -zeta * omega - rate;
    const a = (vn - r2) / (r1 - r2);
    const b = 1 - a;
    s = (p) => a * Math.exp(r1 * p) + b * Math.exp(r2 * p);
  }

  const points: string[] = [];
  for (let i = 0; i < samples; i += 1) {
    if (i === samples - 1) {
      // Pin the final stop exactly at rest so the transform lands clean.
      points.push('1');
      break;
    }
    const p = i / (samples - 1);
    // Never allow a stop past rest — a hard guarantee against overshoot/overflow
    // even if an under-damped ζ is requested. Follow-through (values < 0, i.e.
    // continuing in the release direction) is intentionally left unclamped.
    points.push(String(Math.min(round(1 - s(p), 4), 1)));
  }
  return `linear(${points.join(', ')})`;
}

// ---------------------------------------------------------------------------
// Momentum / scroll physics (rAF-stepped, not WAAPI)
// ---------------------------------------------------------------------------

export interface MomentumSample {
  x: number;
  y: number;
  t: number;
}

export interface MomentumVelocity {
  /** Offset-space px/s (already divided by zoom). */
  vx: number;
  vy: number;
}

/** Exponential friction while coasting inside pan bounds (higher = stops sooner). */
export const PAN_PHYSICS_FRICTION = 3.2;

export interface PanPhysicsSpring {
  stiffness: number;
  damping: number;
}

/**
 * Mouse overscroll snap — snappy (~150–180ms). Touch uses a softer spring;
 * the same k on a phone feels harsh.
 */
export const PAN_PHYSICS_SPRING_MOUSE: PanPhysicsSpring = {
  stiffness: 480,
  damping: 44, // ≈ critical: 2 * sqrt(480)
};

/** Touch overscroll snap / wall bounce — gentler iOS-like return. */
export const PAN_PHYSICS_SPRING_TOUCH: PanPhysicsSpring = {
  stiffness: 210,
  damping: 30, // ≈ critical: 2 * sqrt(210)
};

/**
 * Zoom bound snap-back spring (rAF-stepped, in zoom units). Runs as a *value*
 * animation on zoom that composes with a live pan on the surviving finger —
 * never a WAAPI transform racing the pointer. Stiffer than the touch pan
 * spring: iOS's pinch rubber-band return is brisk (~200ms) even while the
 * remaining finger keeps panning.
 *
 * The snap seeds its initial velocity at -ω·x₀ (see zoomSnapSeedVelocity),
 * which turns the critically damped response into pure exponential decay
 * x(t) = x₀·e^(-ωt) — an ease-OUT: fastest exactly at release, asymptotic
 * landing, and overshoot is impossible (velocity never changes sign). From
 * rest the same spring is an ease-in-out — velocity peaks only at t = 1/ω
 * (~40ms), a visible hesitation right at release that reads as lazy.
 */
export const ZOOM_SNAP_SPRING: PanPhysicsSpring = {
  stiffness: 600,
  damping: 49, // ≈ critical: 2 * sqrt(600)
};

/**
 * Initial zoom velocity (zoom units/s) for the bound snap-back, given the
 * overshoot displacement `from - target`. Exactly -ω·x₀ for the critically
 * damped ZOOM_SNAP_SPRING, collapsing it to pure exponential decay — the
 * iOS rubber-band return character (see ZOOM_SNAP_SPRING).
 */
export function zoomSnapSeedVelocity(from: number, target: number): number {
  return (target - from) * Math.sqrt(ZOOM_SNAP_SPRING.stiffness);
}
/**
 * Settle thresholds — deliberately loose. Gestures are deferred while the
 * snap runs, so a strict tail is a felt input freeze: with tight thresholds
 * the spring was visually done ~80ms before it formally settled. These cut
 * the tail to ~0 at the cost of a ≤1% zoom-unit correction on the settle
 * frame (imperceptible — ~0.2% of scale at a typical 4× bound).
 */
export const ZOOM_SNAP_STOP_SPEED = 0.25;
/** Settle when within this distance of the bound (zoom units). */
export const ZOOM_SNAP_STOP_DISTANCE = 0.01;

// ---------------------------------------------------------------------------
// Release-settle baking
//
// The moment the last input ends, the remaining motion is fully deterministic:
// current pose + velocities evolving under the physics above, with nothing
// left to compose against. So instead of stepping it live on a rAF loop —
// main-thread bound, and throttled to ~30fps by iOS Safari in Low Power Mode —
// we integrate the WHOLE trajectory synchronously at a fixed 60Hz step and
// hand the resulting keyframes to WAAPI. The compositor plays them at native
// refresh, immune to rAF throttling and main-thread jank, with exactly the
// same physics feel. rAF stepping remains only while a finger is down (the
// 2→1 zoom snap composing with a live pan), where per-frame composition with
// pointer input is unavoidable.
// ---------------------------------------------------------------------------

/** Fixed integration step for baked settle trajectories (seconds). */
export const SETTLE_BAKE_DT = 1 / 60;
/** Hard cap on baked trajectory length (frames) — 12s of coast is a bug. */
const SETTLE_BAKE_MAX_FRAMES = 720;
/**
 * Max keyframes handed to WAAPI. Physics still integrates at 60Hz for
 * fidelity; the recorded path is then decimated to this budget (keyframes get
 * explicit time offsets so playback timing is unchanged). Long coasts would
 * otherwise emit hundreds of keyframes — costly to parse on release (the
 * exact moment the main thread must go idle for the handoff) and costly for
 * the engine's compositor commit. The settle curves are smooth exponentials/
 * near-critical springs, so linear interpolation across a few steps stays
 * within a small fraction of a pixel.
 */
const SETTLE_BAKE_MAX_KEYFRAMES = 64;

export interface SettlePose {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export interface SettleAxisGeometry {
  min: number;
  max: number;
  overflows: boolean;
}

export interface BakeSettleInput {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  /**
   * Zoom-axis velocity carried from an interrupted live snap (zoom units/s).
   * When omitted and zoom is out of bounds, the exponential-decay seed is
   * used (see zoomSnapSeedVelocity).
   */
  vz?: number;
  offsetX: number;
  offsetY: number;
  /** Release velocities in offset-space px/s. */
  vx: number;
  vy: number;
  panSpring: PanPhysicsSpring;
  /** Pan ranges at a given zoom — pure math over cached layout rects. */
  geometryAt: (zoom: number) => { x: SettleAxisGeometry; y: SettleAxisGeometry } | null;
  /** Clamped rest offsets at a given zoom (viewport-aware). */
  restOffsetsAt: (zoom: number, x: number, y: number) => { x: number; y: number };
}

export interface BakedSettle {
  /**
   * Intermediate poses (final rest pose excluded), decimated to at most
   * SETTLE_BAKE_MAX_KEYFRAMES. Aligned 1:1 with `offsets`.
   */
  path: SettlePose[];
  /** Fractional keyframe time (0..1, exclusive) for each pose in `path`. */
  offsets: number[];
  /** Total trajectory duration in milliseconds. */
  durationMs: number;
  /** Exact rest pose to commit as state / final keyframe. */
  zoom: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Integrate the full release-settle trajectory — zoom bound snap-back, offset
 * glide, friction coast, and edge bounce, all composed exactly like the live
 * rAF steppers — into a keyframe path for compositor playback.
 *
 * Returns `null` when there is nothing to animate (pose at rest, no speed).
 */
export function bakeSettlePath(input: BakeSettleInput): BakedSettle | null {
  const { minZoom, maxZoom, panSpring, geometryAt, restOffsetsAt } = input;

  let z = input.zoom;
  const bound = clamp(z, minZoom, maxZoom);
  let zoomActive = Math.abs(z - bound) > 1e-6;
  let vz = input.vz ?? (zoomActive ? zoomSnapSeedVelocity(z, bound) : 0);
  if (!zoomActive) vz = 0;

  let x = input.offsetX;
  let y = input.offsetY;
  let vx = input.vx;
  let vy = input.vy;

  // Pan arming decision — mirror the live path: letterboxed axes don't coast,
  // they only spring home if already past rest.
  const geo = geometryAt(z);
  if (!geo) return null;
  const outX = x < geo.x.min || x > geo.x.max;
  const outY = y < geo.y.min || y > geo.y.max;
  if (!geo.x.overflows && !outX) vx = 0;
  if (!geo.y.overflows && !outY) vy = 0;
  let panActive = outX || outY || Math.hypot(vx, vy) >= PAN_PHYSICS_STOP_SPEED;

  if (!zoomActive && !panActive) return null;

  const path: SettlePose[] = [];
  let frames = 0;
  while ((zoomActive || panActive) && frames < SETTLE_BAKE_MAX_FRAMES) {
    frames += 1;
    const zPrev = z;

    if (zoomActive) {
      const step = stepPanPhysicsAxis(
        { position: z, velocity: vz, min: bound, max: bound, canCoast: false },
        SETTLE_BAKE_DT,
        PAN_PHYSICS_FRICTION,
        ZOOM_SNAP_SPRING.stiffness,
        ZOOM_SNAP_SPRING.damping,
        ZOOM_SNAP_STOP_SPEED,
        ZOOM_SNAP_STOP_DISTANCE,
      );
      vz = step.velocity;
      z = step.settled ? bound : step.position;
      if (step.settled) {
        zoomActive = false;
        vz = 0;
      }
    }

    if (panActive) {
      // Coast / bounce with ranges re-derived at the animating zoom, exactly
      // like the live per-tick re-measure.
      const g = geometryAt(z);
      if (!g) break;
      const next = stepPanPhysics2D(
        { x, y, vx, vy },
        g.x,
        g.y,
        g.x.overflows,
        g.y.overflows,
        SETTLE_BAKE_DT,
        panSpring,
      );
      x = next.x;
      y = next.y;
      vx = next.vx;
      vy = next.vy;
      if (next.settled) {
        const rest = restOffsetsAt(z, x, y);
        x = rest.x;
        y = rest.y;
        panActive = false;
      }
    } else if (zPrev !== z) {
      // No pan of its own — glide offsets toward their rest pose at the bound
      // by the fraction of remaining zoom distance this step covered, so zoom
      // and offsets settle together as one motion.
      const rest = restOffsetsAt(bound, x, y);
      if (rest.x !== x || rest.y !== y) {
        const denom = zPrev - bound;
        const f = denom !== 0 ? Math.min(1, Math.max(0, (zPrev - z) / denom)) : 1;
        x += (rest.x - x) * f;
        y += (rest.y - y) * f;
      }
    }

    path.push({ zoom: z, offsetX: x, offsetY: y });
  }

  const rest = restOffsetsAt(bound, x, y);

  // The rest pose lands one step after the last simulated pose; total
  // trajectory time therefore spans path.length + 1 intervals.
  const total = path.length + 1;
  const durationMs = total * SETTLE_BAKE_DT * 1000;

  let keptPath = path;
  let offsets: number[];
  if (path.length > SETTLE_BAKE_MAX_KEYFRAMES) {
    // Decimate: keep every stride-th sim frame (plus, always, the last one)
    // and carry each kept frame's true time as an explicit keyframe offset —
    // playback timing is identical, only intermediate samples are dropped.
    const stride = Math.ceil(path.length / SETTLE_BAKE_MAX_KEYFRAMES);
    keptPath = [];
    offsets = [];
    for (let i = stride - 1; i < path.length - 1; i += stride) {
      keptPath.push(path[i]!);
      offsets.push((i + 1) / total);
    }
    keptPath.push(path[path.length - 1]!);
    offsets.push(path.length / total);
  } else {
    offsets = path.map((_, i) => (i + 1) / total);
  }

  return { path: keptPath, offsets, durationMs, zoom: bound, offsetX: rest.x, offsetY: rest.y };
}

/** @deprecated Prefer {@link PAN_PHYSICS_SPRING_MOUSE}. */
export const PAN_PHYSICS_STIFFNESS = PAN_PHYSICS_SPRING_MOUSE.stiffness;
/** @deprecated Prefer {@link PAN_PHYSICS_SPRING_MOUSE}. */
export const PAN_PHYSICS_DAMPING = PAN_PHYSICS_SPRING_MOUSE.damping;
/** Settle when |velocity| is below this (offset px/s). */
export const PAN_PHYSICS_STOP_SPEED = 12;
/** Settle when within this distance of the bound while slow (offset px). */
export const PAN_PHYSICS_STOP_DISTANCE = 0.6;

/**
 * Release velocity from recent pointer samples, in **offset-space** px/s.
 * Returns `null` when there aren't enough samples or screen speed is at/below
 * `threshold` (screen px/s).
 */
export function computeMomentumVelocity(
  samples: readonly MomentumSample[],
  zoom: number,
  threshold: number,
): MomentumVelocity | null {
  if (samples.length < 2 || zoom <= 0) return null;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const dt = last.t - first.t;
  if (dt <= 0) return null;

  const vxScreen = ((last.x - first.x) / dt) * 1000;
  const vyScreen = ((last.y - first.y) / dt) * 1000;
  if (Math.hypot(vxScreen, vyScreen) <= threshold) return null;

  return { vx: vxScreen / zoom, vy: vyScreen / zoom };
}

/**
 * @deprecated Prefer {@link computeMomentumVelocity} + rAF physics. Kept for
 * older call sites/tests that project a one-shot target.
 */
export function computeMomentumTarget(
  samples: readonly MomentumSample[],
  currentX: number,
  currentY: number,
  zoom: number,
  multiplier: number,
  threshold: number,
): { targetX: number; targetY: number } | null {
  const vel = computeMomentumVelocity(samples, zoom, threshold);
  if (!vel) return null;
  const factor = multiplier / 1000;
  // Velocity is already offset-space; multiplier was tuned for screen vel / zoom.
  return {
    targetX: currentX + vel.vx * factor,
    targetY: currentY + vel.vy * factor,
  };
}

export interface PanPhysicsAxisInput {
  position: number;
  velocity: number;
  min: number;
  max: number;
  /** When false, axis won't coast — only spring back if past rest. */
  canCoast: boolean;
}

export interface PanPhysicsAxisResult {
  position: number;
  velocity: number;
  settled: boolean;
}

/**
 * One integration step of iOS-like scroll physics on a single axis:
 * friction coast inside bounds, spring+damping bounce outside.
 */
export function stepPanPhysicsAxis(
  axis: PanPhysicsAxisInput,
  dt: number,
  friction = PAN_PHYSICS_FRICTION,
  stiffness = PAN_PHYSICS_SPRING_MOUSE.stiffness,
  damping = PAN_PHYSICS_SPRING_MOUSE.damping,
  stopSpeed = PAN_PHYSICS_STOP_SPEED,
  stopDistance = PAN_PHYSICS_STOP_DISTANCE,
): PanPhysicsAxisResult {
  let { position: x, velocity: v } = axis;
  const { min, max, canCoast } = axis;
  if (dt <= 0) {
    return { position: x, velocity: v, settled: true };
  }

  const out = x < min || x > max;
  if (out) {
    const target = x < min ? min : max;
    const a = (target - x) * stiffness - v * damping;
    v += a * dt;
    x += v * dt;
    // Crossed back into bounds this step — hand off remaining velocity to coast
    // (or stop on a locked axis). Keeps wall-bounce continuous.
    if (x >= min && x <= max) {
      if (!canCoast) {
        return { position: clamp(x, min, max), velocity: 0, settled: true };
      }
      if (Math.abs(v) < stopSpeed) {
        return { position: clamp(x, min, max), velocity: 0, settled: true };
      }
      return { position: clamp(x, min, max), velocity: v, settled: false };
    }
    const dist = Math.abs(x - target);
    if (Math.abs(v) < stopSpeed && dist < stopDistance) {
      return { position: target, velocity: 0, settled: true };
    }
    return { position: x, velocity: v, settled: false };
  }

  if (!canCoast) {
    return { position: x, velocity: 0, settled: true };
  }

  v *= Math.exp(-friction * dt);
  x += v * dt;

  // Crossed a bound this step — leave overshoot for the next spring step.
  if (x < min || x > max) {
    return { position: x, velocity: v, settled: false };
  }
  if (Math.abs(v) < stopSpeed) {
    return { position: x, velocity: 0, settled: true };
  }
  return { position: x, velocity: v, settled: false };
}

export interface PanPhysicsState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * One 2D integration step. `canCoastX/Y` gate freestyle inertia (overflowing
 * axes); non-coasting axes still spring home if past their rest bound.
 */
export function stepPanPhysics2D(
  state: PanPhysicsState,
  xRange: { min: number; max: number },
  yRange: { min: number; max: number },
  canCoastX: boolean,
  canCoastY: boolean,
  dt: number,
  spring: PanPhysicsSpring = PAN_PHYSICS_SPRING_MOUSE,
): PanPhysicsState & { settled: boolean } {
  const xStep = stepPanPhysicsAxis(
    {
      position: state.x,
      velocity: state.vx,
      min: xRange.min,
      max: xRange.max,
      canCoast: canCoastX,
    },
    dt,
    PAN_PHYSICS_FRICTION,
    spring.stiffness,
    spring.damping,
  );
  const yStep = stepPanPhysicsAxis(
    {
      position: state.y,
      velocity: state.vy,
      min: yRange.min,
      max: yRange.max,
      canCoast: canCoastY,
    },
    dt,
    PAN_PHYSICS_FRICTION,
    spring.stiffness,
    spring.damping,
  );
  return {
    x: xStep.position,
    y: yStep.position,
    vx: xStep.velocity,
    vy: yStep.velocity,
    settled: xStep.settled && yStep.settled,
  };
}
