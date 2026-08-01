import { describe, it, expect } from 'vitest';

import {
  PULL_DAMP_TRAVEL_RATIO,
  ELASTIC_FACTOR,
  RUBBER_BAND_CONSTANT,
  RUBBER_BAND_DIMENSION_FACTOR,
  bakeSettlePath,
  clamp,
  clampOffset,
  clampOffsetToViewport,
  computeMaxZoom,
  computeMomentumTarget,
  computeMomentumVelocity,
  computePullTransform,
  stepPanPhysicsAxis,
  stepPanPhysics2D,
  computePullVelocity,
  distance,
  doubleTapTargetZoom,
  elasticClamp,
  elasticClampSymmetric,
  focalOffset,
  maxPanOffset,
  panOffsetRange,
  pinchZoom,
  projectFocalZoom,
  resolveDragAxis,
  round,
  rubberBandClamp,
  rubberBandDistance,
  rubberBandPanDimension,
  scaleZoom,
  shouldDismissPull,
  springEasingLinear,
  wheelAxis,
} from './gesture-math';

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
    expect(baked!.path.length).toBeLessThan(30);
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
});
