/**
 * Tiny shared primitives used by both pull-to-dismiss (main chunk) and the
 * lazy zoom engine. Keep this file small — it stays on the critical path.
 */

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
