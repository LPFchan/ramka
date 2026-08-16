/**
 * Pure zoom/pan math for the lightbox zoom engine.
 *
 * Everything here is a plain function of its inputs — no DOM, no refs, no React
 * — so the tricky bits (elastic clamping, focal-point zoom, momentum) can be
 * unit-tested directly instead of only through flaky pointer/wheel integration
 * tests. `use-zoom-gestures` and `Lightbox.Zoom` own the event wiring and
 * delegate the arithmetic here.
 *
 * Pull-to-dismiss helpers live in `pull-math.ts` so this module can stay in
 * the lazy zoom chunk. Shared primitives (`clamp`, `round`, …) are re-exported
 * from `gesture-shared.ts`.
 */

import { clamp } from './gesture-shared';

export type { GestureAxis } from './gesture-shared';
export { clamp, distance, round } from './gesture-shared';

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
 * Pan offset (one axis) that keeps the content under `originFocal` glued to
 * `currentFocal` while zooming from `originZoom` to `currentZoom`.
 *
 * Same transform convention as {@link focalOffset}:
 * `content = screen / zoom − offset`. A two-finger pinch uses this so the
 * image follows the centroid (pan) and scale (zoom) as one pose. When the
 * focals are equal this is identical to `focalOffset`.
 */
export function pinchPanOffset(
  originOffset: number,
  originFocal: number,
  originZoom: number,
  currentFocal: number,
  currentZoom: number,
): number {
  if (!(originZoom > 0) || !(currentZoom > 0)) return originOffset;
  return originOffset + currentFocal / currentZoom - originFocal / originZoom;
}

/**
 * New pan offset (one axis) that keeps the focal point `focal` px from center
 * fixed under the cursor while zooming from `fromZoom` to `toZoom`.
 */
export function focalOffset(currentOffset: number, focal: number, fromZoom: number, toZoom: number): number {
  return pinchPanOffset(currentOffset, focal, fromZoom, focal, toZoom);
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
 * iOS-style two-finger intent. UIKit keeps pinch and pan as separate
 * recognizers: pan may begin on translation slop, pinch only after the
 * fingers actually spread/pinch, and pinch `scale` starts at 1 when it
 * begins. Applying `currentDist / initialDist` from contact is what makes
 * a two-finger pan feel like it is also zooming — fingers never hold a
 * perfectly constant span.
 */

/** Spread (px) that engages zoom when the motion looks like a real pinch. */
export const PINCH_ENGAGE_SPREAD = 10;

/** Spread (px) that engages zoom while the fingers are clearly panning together. */
export const PINCH_ENGAGE_SPREAD_PAN = 28;

/** Extra pan-mode slop as a fraction of the starting finger span. */
export const PINCH_ENGAGE_SPREAD_PAN_RATIO = 0.14;

/** Cosine similarity above this → both fingers travel as a pair. */
export const PINCH_PAN_ALIGNMENT = 0.6;

/** Each finger must travel this far (px) before alignment is trusted. */
export const PINCH_ALIGNMENT_MIN_TRAVEL = 10;

/** Centroid travel (px) that can mark the gesture pan-dominant. */
export const PINCH_PAN_TRAVEL = 14;

/** Pan travel must exceed spread by this factor to count as pan-dominant. */
export const PINCH_PAN_DOMINANCE = 1.35;

/** Cosine of the two fingers' displacement vectors, or `null` if either has not moved enough. */
export function pinchFingerAlignment(
  a0x: number,
  a0y: number,
  a1x: number,
  a1y: number,
  b0x: number,
  b0y: number,
  b1x: number,
  b1y: number,
  minTravel = PINCH_ALIGNMENT_MIN_TRAVEL,
): number | null {
  const dax = a1x - a0x;
  const day = a1y - a0y;
  const dbx = b1x - b0x;
  const dby = b1y - b0y;
  const la = Math.hypot(dax, day);
  const lb = Math.hypot(dbx, dby);
  if (la < minTravel || lb < minTravel) return null;
  return (dax * dbx + day * dby) / (la * lb);
}

/**
 * Decompose two-finger motion into |spread| along the original pair axis
 * and centroid travel. A planted-finger pinch has large spread and modest
 * pan; a two-finger slide is the reverse.
 */
export function pinchMotionComponents(
  a0x: number,
  a0y: number,
  a1x: number,
  a1y: number,
  b0x: number,
  b0y: number,
  b1x: number,
  b1y: number,
): { spread: number; pan: number } {
  const axisX = b0x - a0x;
  const axisY = b0y - a0y;
  const axisLen = Math.hypot(axisX, axisY) || 1;
  const ux = axisX / axisLen;
  const uy = axisY / axisLen;
  const dax = a1x - a0x;
  const day = a1y - a0y;
  const dbx = b1x - b0x;
  const dby = b1y - b0y;
  const spread = Math.abs(dbx * ux + dby * uy - (dax * ux + day * uy));
  return { spread, pan: Math.hypot((dax + dbx) / 2, (day + dby) / 2) };
}

/** True when the fingers are sliding as a pair, not spreading. */
export function isTwoFingerPanIntent(
  spreadDelta: number,
  panTravel: number,
  alignment: number | null,
): boolean {
  if (alignment != null && alignment >= PINCH_PAN_ALIGNMENT) return true;
  return panTravel >= PINCH_PAN_TRAVEL && panTravel > spreadDelta * PINCH_PAN_DOMINANCE;
}

/** Spread (px) required before zoom may change, given the current intent. */
export function pinchEngageSpread(initialDistance: number, panIntent: boolean): number {
  if (panIntent) {
    return Math.max(PINCH_ENGAGE_SPREAD_PAN, initialDistance * PINCH_ENGAGE_SPREAD_PAN_RATIO);
  }
  return PINCH_ENGAGE_SPREAD;
}

export interface ResolvePinchZoomInput {
  initialZoom: number;
  /** Distance baseline — the contact span, or the slop-adjusted span after engage. */
  initialDistance: number;
  currentDistance: number;
  engaged: boolean;
  alignment: number | null;
  panTravel: number;
}

export interface ResolvedPinchZoom {
  zoom: number;
  engaged: boolean;
  baselineDistance: number;
}

/**
 * Live pinch scale with iOS-style begin slop.
 *
 * Until the gesture is clearly a pinch, zoom stays at `initialZoom` (pan
 * still runs). A two-finger slide uses a larger slop so span jitter cannot
 * scale the image. When zoom first engages during a pan, the slop is eaten
 * so scale starts at 1 relative to the engage point (no pop). A decisive
 * pinch keeps the original baseline so a fast spread is not discarded.
 */
export function resolvePinchZoom(input: ResolvePinchZoomInput): ResolvedPinchZoom {
  const { initialZoom, initialDistance, currentDistance, engaged, alignment, panTravel } = input;
  if (!(initialDistance > 0)) {
    return { zoom: initialZoom, engaged, baselineDistance: Math.max(initialDistance, 1) };
  }

  const spreadDelta = Math.abs(currentDistance - initialDistance);
  const panIntent = isTwoFingerPanIntent(spreadDelta, panTravel, alignment);
  const gate = pinchEngageSpread(initialDistance, panIntent);

  if (!engaged) {
    if (spreadDelta <= gate) {
      return { zoom: initialZoom, engaged: false, baselineDistance: initialDistance };
    }
    const signed = currentDistance - initialDistance;
    const baseline = panIntent
      ? initialDistance + Math.sign(signed || 1) * gate
      : initialDistance;
    return {
      zoom: pinchZoom(initialZoom, baseline, currentDistance),
      engaged: true,
      baselineDistance: baseline,
    };
  }

  return {
    zoom: pinchZoom(initialZoom, initialDistance, currentDistance),
    engaged: true,
    baselineDistance: initialDistance,
  };
}

/**
 * Double-tap target: zoom back to `minZoom` when already zoomed in, otherwise
 * to `zoomStep` (capped at `maxZoom`).
 */
export function doubleTapTargetZoom(zoom: number, minZoom: number, maxZoom: number, zoomStep: number): number {
  return zoom > minZoom ? minZoom : Math.min(zoomStep, maxZoom);
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
 * Zoom-axis settle thresholds. Keep the distance tight: forcing the last
 * sample onto the bound used to jump ~0.01 zoom units in one frame, which on
 * a typical image edge is a visible 2–4px hitch. Pan can run concurrently
 * with the live rAF snap, so a slightly longer spring tail is fine.
 */
export const ZOOM_SNAP_STOP_SPEED = 0.08;
/** Settle when within this distance of the bound (zoom units). */
export const ZOOM_SNAP_STOP_DISTANCE = 0.001;

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
      // Keep the stepped pose — do not teleport to `bound`. Exact rest is the
      // WAAPI final keyframe; snapping here made the last ~0.01 zoom units
      // (often 2–4 screen px at the content edge) feel like a hard cut.
      z = step.position;
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
        // Leave (x, y) at the last integrated pose. Exact rest is the WAAPI
        // final keyframe (`offsetX`/`offsetY` below) — overwriting here with
        // rest duplicated the stop-threshold teleport into the path.
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

// ---------------------------------------------------------------------------
// Discrete zoom baking (buttons / keyboard / double-tap)
//
// Discrete zoom used to be a raw 2-keyframe ease-in-out WAAPI tween. That
// tween restarted from zero velocity whenever a new step interrupted the
// previous one — rapid button presses stuttered — and its live pose could not
// be sampled accurately mid-flight (the analytic path helpers lerp linearly
// and know nothing about CSS easing). Instead we bake the SAME 300ms
// ease-in-out curve into explicit keyframes (compositor playback, exactly
// like the release settle above), which makes the live pose and velocity
// analytically recoverable at any interrupt point. A press that lands
// mid-flight then bakes a fresh curve whose initial slope matches the carried
// velocity (a cubic Hermite), so hammering the button reads as one continuous
// motion — while a single uninterrupted press feels identical to before.
// ---------------------------------------------------------------------------

/**
 * CSS `ease-in-out` control points — cubic-bezier(0.42, 0, 0.58, 1). The
 * from-rest discrete zoom bake reproduces this exact curve so the single-press
 * feel is unchanged from the raw eased tween it replaced.
 */
export const DISCRETE_ZOOM_EASE = { x1: 0.42, y1: 0, x2: 0.58, y2: 1 };
/** Keyframe samples per baked discrete zoom curve. */
export const DISCRETE_ZOOM_BAKE_SAMPLES = 32;
/**
 * Cap on the carried-velocity tangent (normalized progress units). Bounds the
 * Hermite overshoot when an extreme velocity is carried into a small step.
 */
export const DISCRETE_ZOOM_MAX_CARRY_TANGENT = 4;
/** Carried tangents below this are treated as rest (use the ease curve). */
const DISCRETE_ZOOM_MIN_CARRY_TANGENT = 0.02;

export interface BakeDiscreteZoomInput {
  from: SettlePose;
  to: SettlePose;
  /**
   * Zoom velocity carried from an interrupted animation (zoom units/s).
   * Omit / 0 when starting from rest.
   */
  vZoom?: number;
  /** Curve duration in milliseconds (the discrete animation duration). */
  durationMs: number;
}

export interface BakedDiscreteZoom {
  /** Intermediate poses (final target excluded), aligned 1:1 with `offsets`. */
  path: SettlePose[];
  /** Fractional keyframe time (0..1, exclusive) for each pose in `path`. */
  offsets: number[];
  /** Total trajectory duration in milliseconds. */
  durationMs: number;
}

/**
 * Lerp two poses the way CSS matrix-interpolates `scale() translate()` —
 * mirror of `lerpPoseMatrix` in pose-controller (kept local so gesture math
 * stays a leaf module). Extrapolates for t outside [0, 1] (overshoot).
 */
function lerpSettlePoseMatrix(a: SettlePose, b: SettlePose, t: number): SettlePose {
  const z = a.zoom + (b.zoom - a.zoom) * t;
  if (!(z > 0)) return { ...b };
  const e = a.zoom * a.offsetX + (b.zoom * b.offsetX - a.zoom * a.offsetX) * t;
  const f = a.zoom * a.offsetY + (b.zoom * b.offsetY - a.zoom * a.offsetY) * t;
  return { zoom: z, offsetX: e / z, offsetY: f / z };
}

/**
 * Bake a discrete zoom step into a keyframe path for compositor playback.
 * Poses ride the matrix-lerp line between `from` and `to` (the same
 * focal-stable path WAAPI matrix interpolation takes); only the progress
 * parameterization differs by case:
 *
 * - From rest: the exact CSS ease-in-out curve, sampled parametrically —
 *   keyframe offsets carry the bezier's x (time) and progress its y — so the
 *   uninterrupted feel is identical to the raw eased tween.
 * - With carried velocity: a cubic Hermite over the same duration whose
 *   initial slope matches the carried velocity and whose end slope is zero,
 *   giving the same soft landing. A large carried velocity may slightly
 *   overshoot the target mid-curve and ease back — the elastic interrupt feel.
 *
 * Returns `null` for a degenerate zero zoom delta (pure-offset moves fall
 * back to the plain 2-keyframe tween) or a non-positive duration.
 */
export function bakeDiscreteZoomPath(input: BakeDiscreteZoomInput): BakedDiscreteZoom | null {
  const { from, to, durationMs } = input;
  if (!(from.zoom > 0) || !(to.zoom > 0) || !(durationMs > 0)) return null;

  const zoomDelta = to.zoom - from.zoom;
  // Degenerate: no zoom delta to drive progress against. Callers fall back
  // to the plain 2-keyframe tween for pure-offset moves.
  if (Math.abs(zoomDelta) < 1e-9) return null;

  // Carried velocity as the initial slope of normalized progress s(τ),
  // τ = time / duration: ds/dτ = v · D / Δz.
  const rawTangent = ((input.vZoom ?? 0) * (durationMs / 1000)) / zoomDelta;
  const m0 = clamp(rawTangent, -DISCRETE_ZOOM_MAX_CARRY_TANGENT, DISCRETE_ZOOM_MAX_CARRY_TANGENT);

  const n = DISCRETE_ZOOM_BAKE_SAMPLES;
  const path: SettlePose[] = [];
  const offsets: number[] = [];

  if (Math.abs(m0) < DISCRETE_ZOOM_MIN_CARRY_TANGENT) {
    // From rest: sample the bezier parametrically. Each parameter step yields
    // an (x=time, y=progress) pair; x becomes the explicit keyframe offset, so
    // playback timing matches the true curve with no root solving.
    const { x1, y1, x2, y2 } = DISCRETE_ZOOM_EASE;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const omt = 1 - t;
      const b1 = 3 * omt * omt * t;
      const b2 = 3 * omt * t * t;
      const t3 = t * t * t;
      const x = b1 * x1 + b2 * x2 + t3;
      const y = b1 * y1 + b2 * y2 + t3;
      offsets.push(x);
      path.push(lerpSettlePoseMatrix(from, to, y));
    }
  } else {
    // Carried velocity: cubic Hermite s(τ) with s(0)=0, s'(0)=m0, s(1)=1,
    // s'(1)=0 — velocity-continuous pickup, same soft landing as the ease.
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const s = m0 * (t3 - 2 * t2 + t) + (3 * t2 - 2 * t3);
      offsets.push(t);
      path.push(lerpSettlePoseMatrix(from, to, s));
    }
  }

  return { path, offsets, durationMs };
}

/** @deprecated Prefer {@link PAN_PHYSICS_SPRING_MOUSE}. */
export const PAN_PHYSICS_STIFFNESS = PAN_PHYSICS_SPRING_MOUSE.stiffness;
/** @deprecated Prefer {@link PAN_PHYSICS_SPRING_MOUSE}. */
export const PAN_PHYSICS_DAMPING = PAN_PHYSICS_SPRING_MOUSE.damping;
/** Settle when |velocity| is below this (offset px/s). */
export const PAN_PHYSICS_STOP_SPEED = 12;
/**
 * Settle when within this distance of the bound while slow (offset-space px).
 * Kept small: at 4× zoom, 0.6 offset-px was ~2.4px on screen — the spring
 * looked smooth then jumped the last few pixels when the bake snapped to rest.
 */
export const PAN_PHYSICS_STOP_DISTANCE = 0.08;

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
      // Keep the stepped pose — do not teleport to `target`. The bake's final
      // WAAPI keyframe lands on exact rest; snapping here made the last
      // 2–4 screen px (stopDistance × zoom) feel like a hard cut.
      return { position: x, velocity: 0, settled: true };
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
