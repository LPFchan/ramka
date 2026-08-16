/**
 * Pure pull-to-dismiss math. Split from `gesture-math.ts` so the zoom engine
 * can live in a lazy chunk without dragging this onto that graph — and so
 * pull-to-dismiss does not statically import the zoom arithmetic.
 */

import { clamp, round, type GestureAxis } from './gesture-shared';

export type { GestureAxis } from './gesture-shared';

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
