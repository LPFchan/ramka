import { describe, it, expect } from 'vitest';

import {
  ELASTIC_FACTOR,
  RUBBER_BAND_CONSTANT,
  RUBBER_BAND_DIMENSION_FACTOR,
  bakeDiscreteZoomPath,
  bakeSettlePath,
  clamp,
  clampOffset,
  clampOffsetToViewport,
  computeMaxZoom,
  computeMomentumTarget,
  computeMomentumVelocity,
  stepPanPhysicsAxis,
  stepPanPhysics2D,
  distance,
  doubleTapTargetZoom,
  elasticClamp,
  invertElasticClamp,
  elasticClampSymmetric,
  focalOffset,
  maxPanOffset,
  panOffsetRange,
  isPerceptibleZoomSnapback,
  isTwoFingerPanIntent,
  pinchEngageSpread,
  pinchFingerAlignment,
  pinchMotionComponents,
  pinchPanOffset,
  pinchZoom,
  PINCH_ENGAGE_SPREAD,
  PINCH_ENGAGE_SPREAD_PAN,
  projectFocalZoom,
  resolvePinchZoom,
  round,
  relaxOverpan,
  rubberBandClamp,
  rubberBandDistance,
  rubberBandPanDimension,
  scaleZoom,
  isTrackpadPinchWheel,
  createWheelStreamState,
  feedWheelStream,
  normalizeWheelDelta,
  WHEEL_DELTA_LINE_HEIGHT,
  ZOOM_SNAPBACK_HAPTIC_MIN_OVERSHOOT,
  type WheelStreamState,
  type WheelStreamSampleKind,
} from './gesture-math';
import {
  PULL_DAMP_TRAVEL_RATIO,
  computePullTransform,
  computePullVelocity,
  resolveDragAxis,
  shouldDismissPull,
  springEasingLinear,
  wheelAxis,
} from './pull-math';

/** Parse a `linear(a, b, c, ...)` easing string into its numeric stops. */
function parseLinearStops(easing: string): number[] {
  const inner = easing.replace(/^linear\(/, '').replace(/\)$/, '');
  return inner.split(',').map((s) => Number(s.trim()));
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

describe('distance', () => {
  it('returns 0 for the same point', () => {
    expect(distance(5, 5, 5, 5)).toBe(0);
  });

  it('computes a 3-4-5 triangle', () => {
    expect(distance(0, 0, 3, 4)).toBe(5);
  });

  it('is order-independent', () => {
    expect(distance(1, 2, 4, 6)).toBe(distance(4, 6, 1, 2));
  });
});

describe('clamp', () => {
  it('passes values inside the range through', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps below min and above max', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
  });

  it('returns the bounds at the edges', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe('round', () => {
  it('rounds to the requested precision', () => {
    expect(round(1.23456, 2)).toBe(1.23);
    expect(round(1.23556, 3)).toBe(1.236);
  });

  it('removes floating-point noise', () => {
    expect(round(0.1 + 0.2, 5)).toBe(0.3);
  });

  it('rounds to an integer with 0 decimals', () => {
    expect(round(2.7, 0)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Pull-to-dismiss
// ---------------------------------------------------------------------------

describe('computePullTransform', () => {
  const DISMISS = 100;
  const MIN_SCALE = 0.85;

  it('is identity at the origin', () => {
    const t = computePullTransform(0, 0, DISMISS, MIN_SCALE);
    expect(t.x).toBe(0);
    expect(t.y).toBe(0);
    expect(t.scale).toBe(1);
    expect(t.progress).toBe(0);
  });

  it('moves nearly 1:1 for small drags', () => {
    const t = computePullTransform(0, 5, DISMISS, MIN_SCALE);
    // Damping is asymptotic, so at 5px it's very close to 5 but slightly less.
    expect(t.y).toBeGreaterThan(4.5);
    expect(t.y).toBeLessThan(5);
  });

  it('never lets damped travel exceed the ceiling', () => {
    const ceiling = DISMISS * PULL_DAMP_TRAVEL_RATIO;
    // A finite drag stays strictly under the ceiling...
    expect(Math.abs(computePullTransform(0, 500, DISMISS, MIN_SCALE).y)).toBeLessThan(ceiling);
    // ...and an extreme drag saturates at (but never past) it.
    const saturated = computePullTransform(0, 100000, DISMISS, MIN_SCALE);
    expect(Math.abs(saturated.y)).toBeLessThanOrEqual(ceiling);
    expect(Math.abs(saturated.y)).toBeGreaterThan(ceiling * 0.99);
  });

  it('preserves the vertical sign (never reverses)', () => {
    expect(computePullTransform(0, 40, DISMISS, MIN_SCALE).y).toBeGreaterThan(0);
    expect(computePullTransform(0, -40, DISMISS, MIN_SCALE).y).toBeLessThan(0);
  });

  it('damps horizontal travel by the same factor as vertical', () => {
    const t = computePullTransform(30, 60, DISMISS, MIN_SCALE);
    // dampFactor = dampedY / rawY; dampedX = rawX * dampFactor
    const dampFactor = t.y / 60;
    expect(t.x).toBeCloseTo(30 * dampFactor, 10);
  });

  it('clamps progress to 1 and scale to minScale at/after the threshold', () => {
    const atThreshold = computePullTransform(0, DISMISS, DISMISS, MIN_SCALE);
    expect(atThreshold.progress).toBe(1);
    expect(atThreshold.scale).toBeCloseTo(MIN_SCALE, 10);

    const past = computePullTransform(0, DISMISS * 3, DISMISS, MIN_SCALE);
    expect(past.progress).toBe(1);
    expect(past.scale).toBeCloseTo(MIN_SCALE, 10);
  });

  it('scales progress and scale linearly below the threshold', () => {
    const half = computePullTransform(0, DISMISS / 2, DISMISS, MIN_SCALE);
    expect(half.progress).toBeCloseTo(0.5, 10);
    expect(half.scale).toBeCloseTo(1 - 0.5 * (1 - MIN_SCALE), 10);
  });
});

describe('computePullVelocity', () => {
  it('returns 0 with fewer than two samples', () => {
    expect(computePullVelocity([])).toBe(0);
    expect(computePullVelocity([{ y: 10, t: 5 }])).toBe(0);
  });

  it('returns 0 when the time delta is zero', () => {
    expect(computePullVelocity([{ y: 0, t: 100 }, { y: 50, t: 100 }])).toBe(0);
  });

  it('computes px/s from the first and last sample', () => {
    // 100px over 200ms => 500 px/s
    const v = computePullVelocity([
      { y: 0, t: 0 },
      { y: 20, t: 50 },
      { y: 100, t: 200 },
    ]);
    expect(v).toBe(500);
  });

  it('is negative for upward motion', () => {
    expect(computePullVelocity([{ y: 100, t: 0 }, { y: 0, t: 100 }])).toBe(-1000);
  });
});

describe('resolveDragAxis', () => {
  it('is none until past the lock distance', () => {
    expect(resolveDragAxis(3, 3, 6)).toBe('none');
  });

  it('locks vertical when vertical dominates', () => {
    expect(resolveDragAxis(2, 40, 6)).toBe('vertical');
  });

  it('locks horizontal when horizontal dominates', () => {
    expect(resolveDragAxis(40, 2, 6)).toBe('horizontal');
  });

  it('resolves ties to vertical', () => {
    expect(resolveDragAxis(30, 30, 6)).toBe('vertical');
  });
});

describe('shouldDismissPull', () => {
  const DISMISS_DISTANCE = 100;
  const DISMISS_VELOCITY = 400;

  it('dismisses when dragged past the distance threshold', () => {
    expect(shouldDismissPull(120, 0, DISMISS_DISTANCE, DISMISS_VELOCITY)).toBe(true);
    expect(shouldDismissPull(-120, 0, DISMISS_DISTANCE, DISMISS_VELOCITY)).toBe(true);
  });

  it('does not dismiss for a small slow drag', () => {
    expect(shouldDismissPull(30, 100, DISMISS_DISTANCE, DISMISS_VELOCITY)).toBe(false);
  });

  it('dismisses on a fast flick in the drag direction', () => {
    expect(shouldDismissPull(30, 600, DISMISS_DISTANCE, DISMISS_VELOCITY)).toBe(true);
    expect(shouldDismissPull(-30, -600, DISMISS_DISTANCE, DISMISS_VELOCITY)).toBe(true);
  });

  it('ignores a fast flick opposite to the drag direction', () => {
    // Dragged down a little, but flicked up hard => not a dismiss.
    expect(shouldDismissPull(30, -600, DISMISS_DISTANCE, DISMISS_VELOCITY)).toBe(false);
  });
});

describe('wheelAxis', () => {
  it('is none for a zero delta', () => {
    expect(wheelAxis(0, 0)).toBe('none');
  });

  it('favors horizontal when |dx| > |dy|', () => {
    expect(wheelAxis(10, 3)).toBe('horizontal');
  });

  it('favors vertical when |dy| >= |dx| (ties vertical)', () => {
    expect(wheelAxis(3, 10)).toBe('vertical');
    expect(wheelAxis(7, 7)).toBe('vertical');
  });
});

// ---------------------------------------------------------------------------
// Zoom — clamping
// ---------------------------------------------------------------------------

describe('elasticClamp', () => {
  it('passes in-range values through untouched', () => {
    expect(elasticClamp(3, 1, 4)).toBe(3);
    expect(elasticClamp(1, 1, 4)).toBe(1);
    expect(elasticClamp(4, 1, 4)).toBe(4);
  });

  it('applies resistance past the max', () => {
    // 1 over the max => max + 1 * factor
    expect(elasticClamp(5, 1, 4)).toBeCloseTo(4 + 1 * ELASTIC_FACTOR, 10);
  });

  it('applies resistance below the min', () => {
    expect(elasticClamp(0, 1, 4)).toBeCloseTo(1 - 1 * ELASTIC_FACTOR, 10);
  });

  it('honors a custom factor', () => {
    expect(elasticClamp(5, 1, 4, 0.5)).toBeCloseTo(4.5, 10);
  });
});

describe('invertElasticClamp', () => {
  it('is the identity inside the range', () => {
    expect(invertElasticClamp(3, 1, 4)).toBe(3);
    expect(invertElasticClamp(1, 1, 4)).toBe(1);
    expect(invertElasticClamp(4, 1, 4)).toBe(4);
  });

  it('round-trips elasticClamp past max and min', () => {
    expect(invertElasticClamp(elasticClamp(8, 1, 4), 1, 4)).toBeCloseTo(8, 10);
    expect(invertElasticClamp(elasticClamp(0.5, 1, 4), 1, 4)).toBeCloseTo(0.5, 10);
  });
});

describe('isPerceptibleZoomSnapback', () => {
  it('is false at rest and inside the range', () => {
    expect(isPerceptibleZoomSnapback(2, 1, 4)).toBe(false);
    expect(isPerceptibleZoomSnapback(1, 1, 4)).toBe(false);
    expect(isPerceptibleZoomSnapback(4, 1, 4)).toBe(false);
  });

  it('ignores epsilon overshoot from span jitter / rounding at a bound', () => {
    // A two-finger pan at max zoom whose pinch engages from jitter leaves the
    // displayed zoom epsilon out of bounds (elasticClamp + round(…, 5)).
    // Native viewers pan silently here — no haptic.
    expect(isPerceptibleZoomSnapback(4.00001, 1, 4)).toBe(false);
    expect(
      isPerceptibleZoomSnapback(4 + 4 * ZOOM_SNAPBACK_HAPTIC_MIN_OVERSHOOT * 0.99, 1, 4),
    ).toBe(false);
    expect(isPerceptibleZoomSnapback(0.999, 1, 4)).toBe(false);
  });

  it('detects a deliberate rubber-banded overshoot past max', () => {
    // Raw pinch 25% past the bound → displayed 4 + 1 * ELASTIC_FACTOR * … well
    // above the 1%-of-bound threshold.
    expect(isPerceptibleZoomSnapback(elasticClamp(5, 1, 4), 1, 4)).toBe(true);
  });

  it('detects a deliberate pinch-out below min', () => {
    expect(isPerceptibleZoomSnapback(elasticClamp(0.5, 1, 4), 1, 4)).toBe(true);
  });

  it('scales the threshold with the violated bound', () => {
    // Same absolute overshoot: perceptible against min 1, jitter against max 4.
    expect(isPerceptibleZoomSnapback(1 - 0.02, 1, 4)).toBe(true);
    expect(isPerceptibleZoomSnapback(4 + 0.02, 1, 4)).toBe(false);
  });
});

describe('rubberBandDistance', () => {
  it('is 0 for non-positive overscroll or dimension', () => {
    expect(rubberBandDistance(0, 400)).toBe(0);
    expect(rubberBandDistance(-10, 400)).toBe(0);
    expect(rubberBandDistance(50, 0)).toBe(0);
  });

  it('matches the UIScrollView formula', () => {
    const x = 100;
    const d = 400;
    const c = RUBBER_BAND_CONSTANT;
    expect(rubberBandDistance(x, d, c)).toBeCloseTo((x * d * c) / (d + c * x), 10);
  });

  it('stays strictly below the dimension asymptote', () => {
    expect(rubberBandDistance(1e9, 400)).toBeLessThan(400);
    expect(rubberBandDistance(1e9, 400)).toBeGreaterThan(399);
  });

  it('is stiffer for small pulls than a linear 0.2 factor would be at large x', () => {
    // Small pull: Apple ~0.55·x/(1 + …) ≈ half of x early; still resisted.
    const small = rubberBandDistance(20, 400);
    expect(small).toBeGreaterThan(0);
    expect(small).toBeLessThan(20);
  });
});

describe('rubberBandClamp', () => {
  it('passes in-range values through untouched', () => {
    expect(rubberBandClamp(3, 1, 4, 400)).toBe(3);
    expect(rubberBandClamp(1, 1, 4, 400)).toBe(1);
    expect(rubberBandClamp(4, 1, 4, 400)).toBe(4);
  });

  it('rubber-bands past max and min', () => {
    const pastMax = rubberBandClamp(4 + 100, 1, 4, 400);
    expect(pastMax).toBeCloseTo(4 + rubberBandDistance(100, 400), 10);
    expect(pastMax).toBeLessThan(4 + 100);

    const pastMin = rubberBandClamp(1 - 100, 1, 4, 400);
    expect(pastMin).toBeCloseTo(1 - rubberBandDistance(100, 400), 10);
    expect(pastMin).toBeGreaterThan(1 - 100);
  });

  it('keeps screen-space feel when dimension is viewport/zoom', () => {
    // Same finger travel (screen px) at two zooms → same screen overshoot.
    const finger = 80;
    const viewport = 400;
    const z1 = 1.5;
    const z2 = 3;
    const screen1 =
      rubberBandDistance(finger / z1, rubberBandPanDimension(viewport, z1)) * z1;
    const screen2 =
      rubberBandDistance(finger / z2, rubberBandPanDimension(viewport, z2)) * z2;
    expect(screen1).toBeCloseTo(screen2, 8);
  });
});

describe('relaxOverpan', () => {
  it('passes in-range values through', () => {
    expect(relaxOverpan(5, 0, 10, 16)).toBe(5);
    expect(relaxOverpan(0, 0, 10, 16)).toBe(0);
    expect(relaxOverpan(10, 0, 10, 16)).toBe(10);
  });

  it('decays overshoot past max exponentially with elapsed time', () => {
    // One full time constant → e^-1 of the overshoot remains.
    const relaxed = relaxOverpan(100, -10, 0, 150, 150);
    expect(relaxed).toBeCloseTo(100 * Math.exp(-1), 6);
  });

  it('decays overshoot past min symmetrically', () => {
    const relaxed = relaxOverpan(-100, 0, 10, 150, 150);
    expect(relaxed).toBeCloseTo(-100 * Math.exp(-1), 6);
  });

  it('never crosses the bound', () => {
    const relaxed = relaxOverpan(50, 0, 10, 100000, 150);
    expect(relaxed).toBeGreaterThanOrEqual(10);
    expect(relaxed).toBeCloseTo(10, 3);
  });

  it('is a no-op for zero or negative dt', () => {
    expect(relaxOverpan(100, 0, 10, 0)).toBe(100);
    expect(relaxOverpan(100, 0, 10, -5)).toBe(100);
  });

  it('reaches a rate-proportional equilibrium for a steady stream', () => {
    // Constant push of 10px per 16ms into an edge at max=0: equilibrium
    // overshoot ≈ rate * tau = (10 / 16) * 150 ≈ 94 (slightly above, since
    // the sample lands after the relax step).
    let raw = 0;
    for (let i = 0; i < 200; i++) {
      raw = relaxOverpan(raw, -Infinity, 0, 16, 150) + 10;
    }
    const equilibrium = 10 / (1 - Math.exp(-16 / 150));
    expect(raw).toBeCloseTo(equilibrium, 3);
    // A decaying tail then glides the overshoot back toward the bound.
    let d = 10;
    for (let i = 0; i < 120; i++) {
      d *= 0.9;
      raw = relaxOverpan(raw, -Infinity, 0, 16, 150) + d;
    }
    expect(raw).toBeLessThan(equilibrium * 0.05);
  });
});

describe('rubberBandPanDimension', () => {
  it('scales viewport by the dimension factor and zoom', () => {
    expect(rubberBandPanDimension(400, 2)).toBeCloseTo(
      (400 * RUBBER_BAND_DIMENSION_FACTOR) / 2,
      10,
    );
  });

  it('is 0 for non-positive inputs', () => {
    expect(rubberBandPanDimension(0, 2)).toBe(0);
    expect(rubberBandPanDimension(400, 0)).toBe(0);
  });
});

describe('elasticClampSymmetric', () => {
  it('passes values within ±max through', () => {
    expect(elasticClampSymmetric(10, 20)).toBe(10);
    expect(elasticClampSymmetric(-20, 20)).toBe(-20);
  });

  it('applies resistance past the positive bound', () => {
    expect(elasticClampSymmetric(30, 20)).toBeCloseTo(20 + 10 * ELASTIC_FACTOR, 10);
  });

  it('applies resistance past the negative bound and preserves sign', () => {
    expect(elasticClampSymmetric(-30, 20)).toBeCloseTo(-(20 + 10 * ELASTIC_FACTOR), 10);
  });
});

describe('maxPanOffset', () => {
  it('is 0 when content does not overflow the container', () => {
    expect(maxPanOffset(100, 200, 1)).toBe(0);
  });

  it('grows as the content is zoomed past the container', () => {
    // (200 * 2 - 200) / 2 / 2 = 50
    expect(maxPanOffset(200, 200, 2)).toBe(50);
  });
});

describe('panOffsetRange', () => {
  it('matches ±maxPanOffset when the stage is centered in the viewport', () => {
    const max = maxPanOffset(200, 200, 2);
    const range = panOffsetRange(200, 2, 0, 200, 100);
    expect(range.overflows).toBe(true);
    expect(range.min).toBeCloseTo(-max);
    expect(range.max).toBeCloseTo(max);
  });

  it('locks to 0 at minZoom when scaled content still fits the viewport', () => {
    expect(panOffsetRange(100, 1, 0, 200, 100)).toEqual({ min: 0, max: 0, overflows: false });
  });

  it('extends pan toward the side with less chrome so edges stay reachable', () => {
    // Extra bottom padding → stage center above mid → need more +offset to reach top.
    const asymmetric = panOffsetRange(300, 2, 0, 400, 180);
    const symmetric = panOffsetRange(300, 2, 0, 400, 200);
    expect(asymmetric.overflows).toBe(true);
    expect(asymmetric.max).toBeGreaterThan(symmetric.max);
    expect(asymmetric.min).toBeGreaterThan(symmetric.min);
  });

  it('lerps home toward δ while fitting so the overflow crossing stays continuous', () => {
    // Viewport 0..400, stage center 180 → δ at zoomFit.
    const content = 200;
    const zoomFit = 400 / content; // 2
    const deltaAtFit = (200 - 180) / zoomFit; // 10
    const mid = panOffsetRange(content, 1.5, 0, 400, 180, 1);
    expect(mid.overflows).toBe(false);
    expect(mid.min).toBeCloseTo(mid.max);
    expect(mid.min).toBeCloseTo(((1.5 - 1) / (zoomFit - 1)) * deltaAtFit);

    const atFit = panOffsetRange(content, zoomFit, 0, 400, 180, 1);
    // Exactly at fit threshold: treated as fitting (≤), home → δ.
    expect(atFit.overflows).toBe(false);
    expect(atFit.min).toBeCloseTo(deltaAtFit);

    // Must clear the 0.5px fit epsilon: content*z > viewport + 0.5.
    const overZoom = (400 + 0.5) / content + 0.01;
    const justOver = panOffsetRange(content, overZoom, 0, 400, 180, 1);
    const delta = (200 - 180) / overZoom;
    expect(justOver.overflows).toBe(true);
    // Cover singularity is the midpoint; range is still tiny just above fit.
    expect((justOver.min + justOver.max) / 2).toBeCloseTo(delta);
    expect(justOver.min).toBeLessThanOrEqual(delta + 1e-9);
    expect(justOver.max).toBeGreaterThanOrEqual(delta - 1e-9);
  });
});

describe('clampOffsetToViewport', () => {
  it('matches clampOffset when stage and viewport share a center', () => {
    const box = { left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200 };
    const a = clampOffset(1000, -1000, 200, 200, 200, 200, 2);
    const b = clampOffsetToViewport(1000, -1000, 200, 200, 2, box, box);
    expect(b.x).toBe(a.x);
    expect(b.y).toBe(a.y);
  });
});

describe('clampOffset', () => {
  it('clamps both axes to the pannable region', () => {
    // container 200x200, content 200x200, zoom 2 => max offset 50 each axis
    const clamped = clampOffset(1000, -1000, 200, 200, 200, 200, 2);
    expect(clamped.x).toBe(50);
    expect(clamped.y).toBe(-50);
  });

  it('leaves in-range offsets untouched', () => {
    const clamped = clampOffset(10, -20, 200, 200, 200, 200, 2);
    expect(clamped).toEqual({ x: 10, y: -20 });
  });

  it('pins to 0 when there is no overflow', () => {
    const clamped = clampOffset(30, 30, 100, 100, 200, 200, 1);
    expect(clamped).toEqual({ x: 0, y: 0 });
  });
});

// ---------------------------------------------------------------------------
// Zoom — scaling / focal / pinch
// ---------------------------------------------------------------------------

describe('scaleZoom', () => {
  it('zooms in for a positive delta', () => {
    expect(scaleZoom(1, 100, 100)).toBeCloseTo(2, 10);
  });

  it('zooms out for a negative delta', () => {
    expect(scaleZoom(2, -100, 100)).toBeCloseTo(1, 10);
  });

  it('caps a single step at doubling', () => {
    // Huge delta => factor capped at 2
    expect(scaleZoom(1, 100000, 100)).toBeCloseTo(2, 10);
  });

  it('caps a single step at halving', () => {
    expect(scaleZoom(4, -100000, 100)).toBeCloseTo(2, 10);
  });

  it('is a no-op for a zero delta', () => {
    expect(scaleZoom(3, 0, 100)).toBe(3);
  });
});

describe('isTrackpadPinchWheel', () => {
  it('treats synthesized ctrlKey (no physical Control) as a trackpad pinch', () => {
    expect(isTrackpadPinchWheel(true, false)).toBe(true);
  });

  it('treats ctrlKey with a physical Control key as Ctrl+scroll', () => {
    expect(isTrackpadPinchWheel(true, true)).toBe(false);
  });

  it('is false when ctrlKey is not set', () => {
    expect(isTrackpadPinchWheel(false, false)).toBe(false);
    expect(isTrackpadPinchWheel(false, true)).toBe(false);
  });
});

describe('normalizeWheelDelta', () => {
  it('passes pixel-mode deltas through', () => {
    expect(normalizeWheelDelta(42, 0)).toBe(42);
  });

  it('scales line-mode deltas by the line height', () => {
    expect(normalizeWheelDelta(3, 1)).toBe(3 * WHEEL_DELTA_LINE_HEIGHT);
  });

  it('scales page-mode deltas by the page size', () => {
    expect(normalizeWheelDelta(1, 2, 900)).toBe(900);
  });
});

describe('feedWheelStream', () => {
  /** Feed a run of events on one axis at a fixed cadence; returns last kind. */
  function feedRun(
    state: WheelStreamState,
    deltas: number[],
    startT: number,
    stepMs = 16,
  ): { kind: WheelStreamSampleKind; t: number } {
    let kind: WheelStreamSampleKind = 'user';
    let t = startT;
    for (const d of deltas) {
      t += stepMs;
      kind = feedWheelStream(state, 0, d, t);
    }
    return { kind, t };
  }

  /** Geometric decay tail like macOS momentum (ratio within the band). */
  function momentumTail(from: number, ratio: number, count: number): number[] {
    const out: number[] = [];
    let d = from;
    for (let i = 0; i < count; i++) {
      out.push(d);
      d *= ratio;
    }
    return out;
  }

  it('classifies a smoothly decaying tail as momentum', () => {
    const state = createWheelStreamState();
    // Fingers down: irregular magnitudes.
    const { t } = feedRun(state, [12, 30, 24, 41, 38, 52], 0);
    expect(state.isMomentum).toBe(false);
    // Lift → synthesized tail decaying ~7%/event (pair ratio ≈ 0.865).
    const { kind } = feedRun(state, momentumTail(50, 0.93, 16), t);
    expect(state.isMomentum).toBe(true);
    expect(kind).toBe('momentum');
  });

  it('never classifies a steady finger pan as momentum', () => {
    const state = createWheelStreamState();
    const { kind } = feedRun(state, Array.from({ length: 40 }, () => 10), 0);
    expect(state.isMomentum).toBe(false);
    expect(kind).toBe('user');
  });

  it('never classifies an accelerating pan as momentum', () => {
    const state = createWheelStreamState();
    const deltas = Array.from({ length: 30 }, (_, i) => 4 + i * 2);
    const { kind } = feedRun(state, deltas, 0);
    expect(state.isMomentum).toBe(false);
    expect(kind).toBe('user');
  });

  it('interrupts momentum when a sample doubles the decayed envelope', () => {
    const state = createWheelStreamState();
    const { t } = feedRun(state, momentumTail(60, 0.9, 24), 0);
    expect(state.isMomentum).toBe(true);
    const kind = feedWheelStream(state, 0, 30, t + 16);
    expect(kind).toBe('interrupt');
  });

  it('interrupts momentum on a real reversal of the dominant axis', () => {
    const state = createWheelStreamState();
    const { t } = feedRun(state, momentumTail(60, 0.9, 24), 0);
    expect(state.isMomentum).toBe(true);
    // Same magnitude the tail would have — but opposite direction.
    const kind = feedWheelStream(state, 0, -5, t + 16);
    expect(kind).toBe('interrupt');
  });

  it('does not interrupt on sub-floor cross-axis jitter', () => {
    const state = createWheelStreamState();
    const { t } = feedRun(state, momentumTail(60, 0.9, 24), 0);
    expect(state.isMomentum).toBe(true);
    const kind = feedWheelStream(state, 1, 4, t + 16);
    expect(kind).toBe('momentum');
  });

  it('flags momentum from the Blink -0 finger-lift marker when moving fast', () => {
    const state = createWheelStreamState();
    feedRun(state, [20, 22, 21, 23, 20, 22], 0); // ~1.3 px/ms
    expect(state.isMomentum).toBe(false);
    const kind = feedWheelStream(state, -0, 0, 120, true);
    expect(kind).toBe('ignore');
    expect(state.isMomentum).toBe(true);
  });

  it('ignores the -0 marker when barely moving', () => {
    const state = createWheelStreamState();
    feedRun(state, [1, 1, 1, 1], 0, 50); // 0.02 px/ms
    const kind = feedWheelStream(state, -0, 0, 250, true);
    expect(kind).toBe('ignore');
    expect(state.isMomentum).toBe(false);
  });

  it('zero-delta samples are ignored and do not disturb velocity', () => {
    const state = createWheelStreamState();
    feedRun(state, [20, 20, 20, 20], 0);
    const velY = state.velY;
    expect(feedWheelStream(state, 0, 0, 80)).toBe('ignore');
    expect(state.velY).toBe(velY);
  });
});

describe('computeMaxZoom', () => {
  it('returns the fallback when the container is unmeasured', () => {
    expect(computeMaxZoom(4000, 3000, 0, 0, 1, 4)).toBe(4);
  });

  it('derives max zoom from natural size vs container', () => {
    // image 800x400 in a 200x200 box => max(4, 2) = 4
    expect(computeMaxZoom(800, 400, 200, 200, 1, 4)).toBe(4);
  });

  it('floors at minZoom + 1 for small images', () => {
    // image barely larger than container => natural ~1.05, floored to 2
    expect(computeMaxZoom(210, 210, 200, 200, 1, 4)).toBe(2);
  });
});

describe('pinchPanOffset', () => {
  it('matches focalOffset when the centroid does not move', () => {
    expect(pinchPanOffset(10, 50, 2, 50, 3)).toBeCloseTo(focalOffset(10, 50, 2, 3), 10);
  });

  it('is a no-op when neither zoom nor centroid change', () => {
    expect(pinchPanOffset(10, 40, 2, 40, 2)).toBe(10);
  });

  it('pans by the centroid travel when zoom is unchanged', () => {
    // content = screen/zoom − offset; glue originFocal onto currentFocal.
    // 0 + 80/2 − 20/2 = 30
    expect(pinchPanOffset(0, 20, 2, 80, 2)).toBeCloseTo(30, 10);
  });

  it('composes pinch-zoom and centroid pan', () => {
    // Zoom 1→2 and slide the centroid 0→40: 0 + 40/2 − 0/1 = 20
    expect(pinchPanOffset(0, 0, 1, 40, 2)).toBeCloseTo(20, 10);
  });

  it('returns the origin offset for non-positive zooms', () => {
    expect(pinchPanOffset(7, 10, 0, 20, 2)).toBe(7);
    expect(pinchPanOffset(7, 10, 2, 20, 0)).toBe(7);
  });
});

describe('focalOffset', () => {
  it('is a no-op when the zoom does not change', () => {
    expect(focalOffset(10, 50, 2, 2)).toBe(10);
  });

  it('shifts the offset toward the focal point when zooming in', () => {
    // from 1x to 2x with focal 100 => 0 + 100 * (1/2 - 1/1) = -50
    expect(focalOffset(0, 100, 1, 2)).toBeCloseTo(-50, 10);
  });

  it('shifts the offset back when zooming out', () => {
    // from 2x to 1x with focal 100 => 0 + 100 * (1/1 - 1/2) = 50
    expect(focalOffset(0, 100, 2, 1)).toBeCloseTo(50, 10);
  });
});

describe('projectFocalZoom', () => {
  it('keeps the unconstrained focal offset when it lies inside the range', () => {
    const next = projectFocalZoom(2, 0, 0, 1.5, 80, 0, { min: -100, max: 100 }, { min: -100, max: 100 });
    expect(next.zoom).toBe(1.5);
    expect(next.offsetX).toBeCloseTo(focalOffset(0, 80, 2, 1.5), 10);
    expect(next.offsetY).toBe(0);
  });

  it('clamps pan but still applies the target zoom when focal is past an edge', () => {
    // Zooming out with a large +focal wants a large +offset; range caps it.
    const next = projectFocalZoom(3, 40, 0, 1.2, 200, 0, { min: -20, max: 20 }, { min: 0, max: 0 });
    expect(next.zoom).toBe(1.2);
    expect(next.offsetX).toBe(20);
    expect(focalOffset(40, 200, 3, 1.2)).toBeGreaterThan(20);
  });
});

describe('pinchZoom', () => {
  it('scales zoom proportionally to finger spread', () => {
    // fingers moved from 100px apart to 200px apart at initial zoom 1 => 2
    expect(pinchZoom(1, 100, 200)).toBe(2);
  });

  it('shrinks zoom when fingers close', () => {
    expect(pinchZoom(2, 200, 100)).toBe(1);
  });
});

describe('pinchFingerAlignment', () => {
  it('is ~1 when both fingers travel the same way', () => {
    expect(pinchFingerAlignment(0, 0, 40, 0, 80, 0, 120, 0)).toBeCloseTo(1, 5);
  });

  it('is ~-1 when fingers travel opposite ways', () => {
    expect(pinchFingerAlignment(40, 0, 0, 0, 80, 0, 120, 0)).toBeCloseTo(-1, 5);
  });

  it('is null until both fingers have moved enough', () => {
    expect(pinchFingerAlignment(0, 0, 2, 0, 80, 0, 140, 0)).toBeNull();
  });
});

describe('pinchMotionComponents', () => {
  it('reads a two-finger slide as pan with almost no spread', () => {
    const m = pinchMotionComponents(0, 0, 50, 0, 80, 0, 130, 0);
    expect(m.pan).toBeCloseTo(50, 5);
    expect(m.spread).toBeLessThan(1);
  });

  it('reads a planted-finger pinch as spread', () => {
    const m = pinchMotionComponents(0, 0, 0, 0, 80, 0, 160, 0);
    expect(m.spread).toBeCloseTo(80, 5);
    expect(m.pan).toBeCloseTo(40, 5);
  });
});

describe('isTwoFingerPanIntent / pinchEngageSpread', () => {
  it('treats aligned travel as pan and raises the zoom slop', () => {
    expect(isTwoFingerPanIntent(8, 40, 0.95)).toBe(true);
    expect(pinchEngageSpread(80, true)).toBe(PINCH_ENGAGE_SPREAD_PAN);
  });

  it('keeps a tight slop for a decisive pinch', () => {
    expect(isTwoFingerPanIntent(40, 10, -0.9)).toBe(false);
    expect(pinchEngageSpread(80, false)).toBe(PINCH_ENGAGE_SPREAD);
  });
});

describe('resolvePinchZoom', () => {
  it('freezes zoom while two fingers slide with span jitter', () => {
    const next = resolvePinchZoom({
      initialZoom: 2,
      initialDistance: 80,
      currentDistance: 92,
      engaged: false,
      alignment: 0.95,
      panTravel: 50,
    });
    expect(next.engaged).toBe(false);
    expect(next.zoom).toBe(2);
  });

  it('engages a real pinch from the original baseline', () => {
    const next = resolvePinchZoom({
      initialZoom: 2,
      initialDistance: 80,
      currentDistance: 160,
      engaged: false,
      alignment: -1,
      panTravel: 0,
    });
    expect(next.engaged).toBe(true);
    expect(next.zoom).toBe(4);
    expect(next.baselineDistance).toBe(80);
  });

  it('eats pan-mode slop so zoom starts at 1× relative when a slide becomes a pinch', () => {
    const next = resolvePinchZoom({
      initialZoom: 2,
      initialDistance: 80,
      currentDistance: 80 + PINCH_ENGAGE_SPREAD_PAN + 1,
      engaged: false,
      alignment: 0.95,
      panTravel: 40,
    });
    expect(next.engaged).toBe(true);
    expect(next.baselineDistance).toBe(80 + PINCH_ENGAGE_SPREAD_PAN);
    expect(next.zoom).toBeCloseTo(
      pinchZoom(2, 80 + PINCH_ENGAGE_SPREAD_PAN, 80 + PINCH_ENGAGE_SPREAD_PAN + 1),
      5,
    );
  });
});

describe('doubleTapTargetZoom', () => {
  it('zooms back to min when already zoomed in', () => {
    expect(doubleTapTargetZoom(2.5, 1, 4, 2)).toBe(1);
  });

  it('zooms to the step from rest', () => {
    expect(doubleTapTargetZoom(1, 1, 4, 2)).toBe(2);
  });

  it('caps the step at maxZoom', () => {
    expect(doubleTapTargetZoom(1, 1, 1.5, 2)).toBe(1.5);
  });
});

// ---------------------------------------------------------------------------
// Momentum
// ---------------------------------------------------------------------------

describe('computeMomentumTarget', () => {
  const MULTIPLIER = 300;
  const THRESHOLD = 50;

  it('returns null with fewer than two samples', () => {
    expect(computeMomentumTarget([], 0, 0, 2, MULTIPLIER, THRESHOLD)).toBeNull();
    expect(
      computeMomentumTarget([{ x: 0, y: 0, t: 0 }], 0, 0, 2, MULTIPLIER, THRESHOLD),
    ).toBeNull();
  });

  it('returns null when the time delta is non-positive', () => {
    expect(
      computeMomentumTarget(
        [{ x: 0, y: 0, t: 100 }, { x: 50, y: 50, t: 100 }],
        0,
        0,
        2,
        MULTIPLIER,
        THRESHOLD,
      ),
    ).toBeNull();
  });

  it('returns null when release speed is at/below the threshold', () => {
    // 1px over 1000ms => 1 px/s, well below threshold
    expect(
      computeMomentumTarget(
        [{ x: 0, y: 0, t: 0 }, { x: 1, y: 0, t: 1000 }],
        0,
        0,
        2,
        MULTIPLIER,
        THRESHOLD,
      ),
    ).toBeNull();
  });

  it('projects the release velocity forward, scaled by zoom', () => {
    // 100px over 100ms => 1000 px/s on x. factor = 300/1000 = 0.3.
    // targetX = 0 + (1000 * 0.3) / 2 = 150
    const target = computeMomentumTarget(
      [{ x: 0, y: 0, t: 0 }, { x: 100, y: 0, t: 100 }],
      0,
      0,
      2,
      MULTIPLIER,
      THRESHOLD,
    );
    expect(target).not.toBeNull();
    expect(target!.targetX).toBeCloseTo(150, 10);
    expect(target!.targetY).toBeCloseTo(0, 10);
  });

  it('adds the projection onto the current offset', () => {
    const target = computeMomentumTarget(
      [{ x: 0, y: 0, t: 0 }, { x: 0, y: 100, t: 100 }],
      10,
      20,
      1,
      MULTIPLIER,
      THRESHOLD,
    );
    // vy = 1000 px/s, factor 0.3, zoom 1 => +300; plus current 20 => 320
    expect(target!.targetY).toBeCloseTo(320, 10);
    expect(target!.targetX).toBeCloseTo(10, 10);
  });
});

describe('computeMomentumVelocity', () => {
  it('returns offset-space velocity scaled by zoom', () => {
    // 100px over 100ms => 1000 screen px/s; zoom 2 => 500 offset px/s
    const vel = computeMomentumVelocity(
      [
        { x: 0, y: 0, t: 0 },
        { x: 100, y: 0, t: 100 },
      ],
      2,
      50,
    );
    expect(vel).not.toBeNull();
    expect(vel!.vx).toBeCloseTo(500, 10);
    expect(vel!.vy).toBeCloseTo(0, 10);
  });
});

describe('stepPanPhysicsAxis', () => {
  const dt = 1 / 60;

  it('coasts inside bounds with friction (keeps momentum direction)', () => {
    const a = stepPanPhysicsAxis(
      { position: 0, velocity: 400, min: -100, max: 100, canCoast: true },
      dt,
    );
    expect(a.position).toBeGreaterThan(0);
    expect(a.velocity).toBeGreaterThan(0);
    expect(a.velocity).toBeLessThan(400);
    expect(a.settled).toBe(false);
  });

  it('springs back when past the max bound while carrying outward velocity', () => {
    let state = { position: 100, velocity: 600, min: -100, max: 100, canCoast: true };
    let peak = state.position;
    for (let i = 0; i < 12; i++) {
      const step = stepPanPhysicsAxis(state, dt);
      state = {
        position: step.position,
        velocity: step.velocity,
        min: -100,
        max: 100,
        canCoast: true,
      };
      peak = Math.max(peak, state.position);
    }
    expect(peak).toBeGreaterThan(100);
    // After the overshoot, spring pulls velocity back inward.
    expect(state.velocity).toBeLessThan(600);
  });

  it('settles onto the bound from an overscrolled rest', () => {
    let state = { position: 130, velocity: 0, min: -100, max: 100, canCoast: true };
    let settled = false;
    for (let i = 0; i < 180; i++) {
      const step = stepPanPhysicsAxis(state, dt);
      state = {
        position: step.position,
        velocity: step.velocity,
        min: -100,
        max: 100,
        canCoast: true,
      };
      if (step.settled) {
        settled = true;
        break;
      }
    }
    expect(settled).toBe(true);
    expect(state.position).toBeCloseTo(100, 0);
    expect(state.velocity).toBe(0);
  });

  it('does not coast a locked axis that is already at rest', () => {
    const step = stepPanPhysicsAxis(
      { position: 0, velocity: 500, min: 0, max: 0, canCoast: false },
      dt,
    );
    expect(step.position).toBe(0);
    expect(step.velocity).toBe(0);
    expect(step.settled).toBe(true);
  });
});

describe('stepPanPhysics2D', () => {
  it('coasts independently per axis', () => {
    const next = stepPanPhysics2D(
      { x: 0, y: 0, vx: 300, vy: 0 },
      { min: -100, max: 100 },
      { min: 0, max: 0 },
      true,
      false,
      1 / 60,
    );
    expect(next.x).toBeGreaterThan(0);
    expect(next.y).toBe(0);
    expect(next.vy).toBe(0);
    expect(next.settled).toBe(false);
  });
});

describe('springEasingLinear', () => {
  it('produces a valid linear() easing string', () => {
    expect(springEasingLinear()).toMatch(/^linear\([-\d., ]+\)$/);
  });

  it('starts at 0 and lands exactly at rest (1)', () => {
    const stops = parseLinearStops(springEasingLinear());
    expect(stops[0]).toBe(0);
    expect(stops[stops.length - 1]).toBe(1);
  });

  it('settles at rest with zero overshoot when released at rest (default critical damping)', () => {
    const stops = parseLinearStops(springEasingLinear(0));
    // Critically damped: approaches rest monotonically and never crosses it.
    expect(Math.max(...stops)).toBe(1);
    // Released at rest → no follow-through (never dips below the start).
    expect(Math.min(...stops)).toBeGreaterThanOrEqual(0);
  });

  it('never overshoots past rest at the default damping, for any release velocity', () => {
    // The hard guarantee the pull-to-dismiss snap-back relies on: no stop may
    // exceed 1, so the transform can never spring past its resting bounds.
    for (const v of [-2.5, -1, 0, 1.2, 2.5]) {
      const stops = parseLinearStops(springEasingLinear(v));
      expect(Math.max(...stops)).toBeLessThanOrEqual(1);
      expect(stops[stops.length - 1]).toBe(1);
    }
  });

  it('follows through (dips below 0) for a positive release velocity', () => {
    const stops = parseLinearStops(springEasingLinear(1.2));
    // Continues in the release direction before springing back — but still
    // never past rest on the other side.
    expect(Math.min(...stops)).toBeLessThan(0);
    expect(Math.max(...stops)).toBeLessThanOrEqual(1);
    expect(stops[stops.length - 1]).toBe(1);
  });

  it('does not follow through for a velocity toward rest', () => {
    const stops = parseLinearStops(springEasingLinear(-1));
    expect(Math.min(...stops)).toBeGreaterThanOrEqual(0);
  });

  it('clamps away overshoot even when an under-damped ratio is requested', () => {
    // Even a deliberately bouncy ζ is capped at rest — belt-and-suspenders
    // against overflow.
    expect(Math.max(...parseLinearStops(springEasingLinear(0, 0.4)))).toBeLessThanOrEqual(1);
  });

  it('honors the requested sample count', () => {
    expect(parseLinearStops(springEasingLinear(0, 1, 6, 24))).toHaveLength(24);
  });
});

describe('bakeSettlePath', () => {
  // Content overflows the viewport by ±100px on x, letterboxed on y.
  const geometryAt = (zoom: number) => ({
    x: { min: -100 * zoom, max: 100 * zoom, overflows: true },
    y: { min: 0, max: 0, overflows: false },
  });
  const restOffsetsAt = (zoom: number, x: number, y: number) => {
    const g = geometryAt(zoom);
    return { x: clamp(x, g.x.min, g.x.max), y: clamp(y, g.y.min, g.y.max) };
  };
  const base = {
    minZoom: 1,
    maxZoom: 4,
    vx: 0,
    vy: 0,
    panSpring: { stiffness: 480, damping: 44 },
    geometryAt,
    restOffsetsAt,
  };

  it('returns null when everything is at rest', () => {
    expect(bakeSettlePath({ ...base, zoom: 2, offsetX: 50, offsetY: 0 })).toBeNull();
  });

  it('bakes an out-of-bounds zoom monotonically back to the bound', () => {
    const baked = bakeSettlePath({ ...base, zoom: 6, offsetX: 0, offsetY: 0 });
    expect(baked).not.toBeNull();
    expect(baked!.zoom).toBe(4);
    expect(baked!.path.length).toBeGreaterThan(3);
    // Ease-out exponential: strictly decreasing, never dipping below the bound.
    let prev = 6;
    for (const pose of baked!.path) {
      expect(pose.zoom).toBeLessThan(prev);
      expect(pose.zoom).toBeGreaterThanOrEqual(4 - 1e-6);
      prev = pose.zoom;
    }
    // Crisp: visually settled in well under half a second of frames.
    expect(baked!.path.length).toBeLessThan(40);
    // No settle-frame teleport onto the bound (was a 2–4px edge hitch).
    const last = baked!.path[baked!.path.length - 1]!;
    expect(Math.abs(last.zoom - baked!.zoom)).toBeLessThan(0.002);
    if (baked!.path.length >= 2) {
      const penultimate = baked!.path[baked!.path.length - 2]!;
      expect(Math.abs(penultimate.zoom - last.zoom)).toBeLessThan(0.05);
    }
  });

  it('zoom snap-back keeps an off-center focal glued (no pan toward origin)', () => {
    // Focal zoom from 4× at rest to 4.8× at cursor x=80, then snap to 4×.
    // Without retargeting offsets as scale returns, the image slides toward
    // center by ~(1 - 4/4.8)*80 px — worse the farther the cursor is.
    const fromZ = 4.8;
    const bound = 4;
    const focalX = 80;
    const startX = focalOffset(0, focalX, bound, fromZ);
    expect(startX).not.toBeCloseTo(0, 5);

    const baked = bakeSettlePath({
      ...base,
      zoom: fromZ,
      offsetX: startX,
      offsetY: 0,
      focalX,
      focalY: 0,
    });
    expect(baked).not.toBeNull();
    expect(baked!.offsetX).toBeCloseTo(focalOffset(startX, focalX, fromZ, bound), 5);
    expect(baked!.offsetX).toBeCloseTo(0, 5);
    for (const pose of baked!.path) {
      expect(pose.offsetX).toBeCloseTo(focalOffset(startX, focalX, fromZ, pose.zoom), 3);
    }
  });

  it('under-min zoom snap-back does not pan when the image is not pannable', () => {
    const letterbox = () => ({
      x: { min: 0, max: 0, overflows: false as const },
      y: { min: 0, max: 0, overflows: false as const },
    });
    const baked = bakeSettlePath({
      ...base,
      geometryAt: letterbox,
      restOffsetsAt: () => ({ x: 0, y: 0 }),
      minZoom: 1,
      zoom: 0.8,
      offsetX: 0,
      offsetY: 0,
      focalX: 80,
      focalY: 60,
    });
    expect(baked).not.toBeNull();
    expect(baked!.zoom).toBe(1);
    expect(baked!.offsetX).toBe(0);
    expect(baked!.offsetY).toBe(0);
    for (const pose of baked!.path) {
      expect(pose.offsetX).toBe(0);
      expect(pose.offsetY).toBe(0);
    }
  });

  it('glides out-of-range offsets to rest together with the zoom return', () => {
    // At 6× offsets up to 600 are legal; at the 4× bound only 400 is. The
    // held overscroll must glide home as the scale returns — one motion.
    const baked = bakeSettlePath({ ...base, zoom: 6, offsetX: 600, offsetY: 0 });
    expect(baked).not.toBeNull();
    expect(baked!.offsetX).toBe(400);
    const last = baked!.path[baked!.path.length - 1]!;
    expect(last.offsetX).toBeCloseTo(400, 0);
  });

  it('rubber-band snap does not teleport the last few offset pixels', () => {
    // Past +max (200 at zoom 2). The stop threshold used to snap ~0.6
    // offset-px (= ~2.4 screen px at 4×) in one frame — a visible hitch.
    const baked = bakeSettlePath({ ...base, zoom: 2, offsetX: 280, offsetY: 0 });
    expect(baked).not.toBeNull();
    expect(baked!.offsetX).toBe(200);
    const last = baked!.path[baked!.path.length - 1]!;
    expect(Math.abs(last.offsetX - baked!.offsetX)).toBeLessThan(0.1);
  });

  it('bakes a flick coast that slows under friction and stays in range', () => {
    const baked = bakeSettlePath({ ...base, zoom: 2, offsetX: 0, offsetY: 0, vx: 800 });
    expect(baked).not.toBeNull();
    // Coasts in the flick direction and lands clamped.
    expect(baked!.offsetX).toBeGreaterThan(0);
    expect(baked!.offsetX).toBeLessThanOrEqual(200);
    // Per-frame deltas shrink over time (friction), ignoring the settle snap.
    const deltas = baked!.path.slice(1).map((p, i) => p.offsetX - baked!.path[i]!.offsetX);
    expect(deltas[0]!).toBeGreaterThan(deltas[Math.floor(deltas.length / 2)]!);
  });

  it('carries an injected zoom velocity instead of re-seeding', () => {
    // A near-zero carried velocity (interrupted rAF snap at its start) must
    // ease in from that state, not restart at the full exponential seed.
    const carried = bakeSettlePath({ ...base, zoom: 6, offsetX: 0, offsetY: 0, vz: -1 });
    const seeded = bakeSettlePath({ ...base, zoom: 6, offsetX: 0, offsetY: 0 });
    expect(carried!.path[0]!.zoom).toBeGreaterThan(seeded!.path[0]!.zoom);
  });

  it('does not coast a letterboxed axis', () => {
    const baked = bakeSettlePath({ ...base, zoom: 2, offsetX: 0, offsetY: 0, vy: 900 });
    expect(baked).toBeNull();
  });

  it('emits offsets aligned with the path, strictly increasing and < 1', () => {
    const baked = bakeSettlePath({ ...base, zoom: 6, offsetX: 0, offsetY: 0 });
    expect(baked!.offsets.length).toBe(baked!.path.length);
    let prev = 0;
    for (const t of baked!.offsets) {
      expect(t).toBeGreaterThan(prev);
      expect(t).toBeLessThan(1);
      prev = t;
    }
    // Duration covers the whole trajectory: one extra interval carries the
    // final keyframe onto the rest pose.
    expect(baked!.durationMs).toBeGreaterThan(0);
    expect(baked!.offsets[baked!.offsets.length - 1]!).toBeCloseTo(
      1 - (1000 / 60) / baked!.durationMs,
      5,
    );
  });

  it('decimates long coasts to a bounded keyframe budget with true timing', () => {
    // A wide range and a huge flick produce a multi-second coast — hundreds
    // of 60Hz sim frames. The keyframe list must stay bounded while offsets
    // keep each kept frame at its exact original time.
    const wide = {
      ...base,
      geometryAt: (zoom: number) => ({
        x: { min: -5000 * zoom, max: 5000 * zoom, overflows: true },
        y: { min: 0, max: 0, overflows: false },
      }),
      restOffsetsAt: (zoom: number, x: number, y: number) => {
        const min = -5000 * zoom;
        const max = 5000 * zoom;
        return { x: clamp(x, min, max), y: clamp(y, min, max) };
      },
    };
    const baked = bakeSettlePath({ ...wide, zoom: 2, offsetX: 0, offsetY: 0, vx: 4000 });
    expect(baked).not.toBeNull();
    expect(baked!.path.length).toBeLessThanOrEqual(64);
    expect(baked!.path.length).toBeGreaterThan(16);
    // Long trajectory: duration far exceeds keyframe count at uniform 60Hz —
    // only explicit offsets can represent it.
    expect(baked!.durationMs).toBeGreaterThan((baked!.path.length + 1) * (1000 / 60));
    // Final sim frame is within a sub-pixel of rest (no stop-threshold teleport).
    const last = baked!.path[baked!.path.length - 1]!;
    expect(Math.abs(last.offsetX - baked!.offsetX)).toBeLessThan(0.15);
    // Friction ordering survives decimation: early gaps outpace late gaps in
    // position-per-unit-time.
    const o = baked!.offsets;
    const p = baked!.path;
    const speedFirst = p[1]!.offsetX - p[0]!.offsetX;
    const speedLast = p[p.length - 1]!.offsetX - p[p.length - 2]!.offsetX;
    const dtFirst = o[1]! - o[0]!;
    const dtLast = o[o.length - 1]! - o[o.length - 2]!;
    expect(speedFirst / dtFirst).toBeGreaterThan(speedLast / dtLast);
  });
});

describe('bakeDiscreteZoomPath', () => {
  const rest = { offsetX: 0, offsetY: 0 };
  const durationMs = 300;

  it('returns null for a degenerate zero zoom delta', () => {
    expect(
      bakeDiscreteZoomPath({ from: { zoom: 2, ...rest }, to: { zoom: 2, ...rest }, durationMs }),
    ).toBeNull();
    // Even with carried velocity — pure-offset moves fall back to the tween.
    expect(
      bakeDiscreteZoomPath({
        from: { zoom: 2, ...rest },
        to: { zoom: 2, offsetX: 10, offsetY: 0 },
        vZoom: 1,
        durationMs,
      }),
    ).toBeNull();
  });

  it('from rest: reproduces the exact CSS ease-in-out curve', () => {
    const baked = bakeDiscreteZoomPath({
      from: { zoom: 1, ...rest },
      to: { zoom: 2, ...rest },
      durationMs,
    });
    expect(baked).not.toBeNull();
    expect(baked!.durationMs).toBe(durationMs);
    let prev = 1;
    for (const pose of baked!.path) {
      // Eased from rest: strictly increasing, never past the target.
      expect(pose.zoom).toBeGreaterThan(prev);
      expect(pose.zoom).toBeLessThanOrEqual(2 + 1e-9);
      prev = pose.zoom;
    }
    // cubic-bezier(0.42, 0, 0.58, 1) is symmetric: progress at half time is ½.
    // The parametric sample at t=0.5 lands exactly on (x=0.5, y=0.5).
    const midIdx = baked!.offsets.findIndex((o) => Math.abs(o - 0.5) < 1e-9);
    expect(midIdx).toBeGreaterThan(-1);
    expect(baked!.path[midIdx]!.zoom).toBeCloseTo(1.5, 9);
    // Ease-in start: first sample has barely moved (slow-in, unlike a spring).
    expect(baked!.path[0]!.zoom - 1).toBeLessThan(0.01);
  });

  it('zoom-out is the mirror motion', () => {
    const zoomOut = bakeDiscreteZoomPath({
      from: { zoom: 2, ...rest },
      to: { zoom: 1, ...rest },
      durationMs,
    });
    expect(zoomOut).not.toBeNull();
    let prev = 2;
    for (const pose of zoomOut!.path) {
      expect(pose.zoom).toBeLessThan(prev);
      prev = pose.zoom;
    }
  });

  it('carried velocity makes early progress faster than a cold start', () => {
    const from = { zoom: 1.4, ...rest };
    const to = { zoom: 4, ...rest };
    const cold = bakeDiscreteZoomPath({ from, to, durationMs });
    const carried = bakeDiscreteZoomPath({ from, to, vZoom: 3, durationMs });
    expect(carried!.path[0]!.zoom).toBeGreaterThan(cold!.path[0]!.zoom);
  });

  it('large carried velocity overshoots the target and eases back', () => {
    const baked = bakeDiscreteZoomPath({
      from: { zoom: 1.8, ...rest },
      to: { zoom: 2, ...rest },
      vZoom: 8,
      durationMs,
    });
    const maxZoom = Math.max(...baked!.path.map((p) => p.zoom));
    expect(maxZoom).toBeGreaterThan(2);
    // ...but the overshoot is bounded by the tangent cap, and the curve
    // returns to land at the target with zero slope.
    expect(maxZoom).toBeLessThan(2.2);
    const last = baked!.path[baked!.path.length - 1]!;
    expect(Math.abs(last.zoom - 2)).toBeLessThan(0.01);
  });

  it('offsets ride the focal-stable matrix-lerp line between the poses', () => {
    const from = { zoom: 1, offsetX: 0, offsetY: 0 };
    const to = { zoom: 2, offsetX: -50, offsetY: 0 };
    for (const vZoom of [0, 5]) {
      const baked = bakeDiscreteZoomPath({ from, to, vZoom, durationMs });
      for (const pose of baked!.path) {
        // Matrix lerp: e = lerp(z_a·x_a, z_b·x_b, t) with t = (z − z_a)/(z_b − z_a),
        // then x = e / z. Here e goes 0 → −100.
        const t = (pose.zoom - from.zoom) / (to.zoom - from.zoom);
        expect(pose.offsetX).toBeCloseTo((-100 * t) / pose.zoom, 6);
      }
    }
  });

  it('emits offsets aligned with the path, strictly increasing and < 1', () => {
    for (const vZoom of [0, 3]) {
      const baked = bakeDiscreteZoomPath({
        from: { zoom: 1, ...rest },
        to: { zoom: 4, ...rest },
        vZoom,
        durationMs,
      });
      expect(baked!.offsets.length).toBe(baked!.path.length);
      let prev = 0;
      for (const t of baked!.offsets) {
        expect(t).toBeGreaterThan(prev);
        expect(t).toBeLessThan(1);
        prev = t;
      }
    }
  });
});
