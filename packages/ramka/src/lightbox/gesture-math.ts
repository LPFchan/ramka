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

/** Resistance applied to values pulled past their bounds (iOS-like rubber band). */
export const ELASTIC_FACTOR = 0.2;

/**
 * Rubber-band clamp: values inside `[min, max]` pass through unchanged; values
 * outside are allowed through with `factor` resistance so they can overshoot
 * with increasing difficulty.
 */
export function elasticClamp(value: number, min: number, max: number, factor = ELASTIC_FACTOR): number {
  if (value < min) return min - (min - value) * factor;
  if (value > max) return max + (value - max) * factor;
  return value;
}

/**
 * Elastic clamp against a symmetric `±max` bound (used for pan offsets). The
 * resistance is applied to the magnitude so the sign is preserved.
 */
export function elasticClampSymmetric(value: number, max: number, factor = ELASTIC_FACTOR): number {
  const abs = Math.abs(value);
  if (abs <= max) return value;
  return (max + (abs - max) * factor) * Math.sign(value);
}

/**
 * Maximum pan offset (in pre-zoom px) for content of `contentSize` inside a
 * `containerSize` viewport at `zoom`. Zero when the content doesn't overflow.
 */
export function maxPanOffset(contentSize: number, containerSize: number, zoom: number): number {
  return Math.max((contentSize * zoom - containerSize) / 2 / zoom, 0);
}

/** Hard-clamp an offset pair to the pannable region for the given sizes/zoom. */
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
// Momentum
// ---------------------------------------------------------------------------

export interface MomentumSample {
  x: number;
  y: number;
  t: number;
}

export interface MomentumTarget {
  targetX: number;
  targetY: number;
}

/**
 * Momentum-pan target from recent drag samples, projecting the release
 * velocity forward. Returns `null` when there aren't enough samples, the
 * time delta is non-positive, or the release speed is at/below `threshold`
 * (in which case the caller should just snap to bounds instead).
 */
export function computeMomentumTarget(
  samples: readonly MomentumSample[],
  currentX: number,
  currentY: number,
  zoom: number,
  multiplier: number,
  threshold: number,
): MomentumTarget | null {
  if (samples.length < 2) return null;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const dt = last.t - first.t;
  if (dt <= 0) return null;

  const vx = ((last.x - first.x) / dt) * 1000;
  const vy = ((last.y - first.y) / dt) * 1000;
  const speed = Math.hypot(vx, vy);
  if (speed <= threshold) return null;

  const factor = multiplier / 1000;
  return {
    targetX: currentX + (vx * factor) / zoom,
    targetY: currentY + (vy * factor) / zoom,
  };
}
