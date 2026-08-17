import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { panOffsetRange } from './gesture-math';
import { PoseController } from './pose-controller';
import { createZoomSession, type ZoomSessionDeps } from './zoom-session';

/** Parse the zoom (scale) out of a `matrix(z, 0, 0, z, e, f)` keyframe. */
function matrixZoom(transform: unknown): number {
  const m = /^matrix\(([^,]+),/.exec(String(transform));
  if (!m) throw new Error(`not a matrix transform: ${String(transform)}`);
  return Number(m[1]);
}

interface HeldAnim {
  onfinish: (() => void) | null;
  oncancel: (() => void) | null;
  cancel: ReturnType<typeof vi.fn>;
  commitStyles: ReturnType<typeof vi.fn>;
  currentTime: number;
  keyframes: Keyframe[];
  duration: number;
}

describe('zoom session discrete zoom retargeting', () => {
  let el: HTMLDivElement;
  let previousAnimate: typeof Element.prototype.animate;
  let held: HeldAnim[];

  beforeEach(() => {
    el = document.createElement('div');
    document.body.appendChild(el);
    previousAnimate = Element.prototype.animate;
    held = [];
    Element.prototype.animate = vi.fn((kf, opts) => {
      const anim: HeldAnim = {
        onfinish: null,
        oncancel: null,
        cancel: vi.fn(),
        commitStyles: vi.fn(),
        currentTime: 0,
        keyframes: kf as Keyframe[],
        duration: typeof opts === 'object' ? Number(opts?.duration ?? 0) : 0,
      };
      anim.cancel = vi.fn(() => anim.oncancel?.());
      held.push(anim);
      return anim as unknown as Animation;
    }) as unknown as typeof Element.prototype.animate;
  });

  afterEach(() => {
    el.remove();
    Element.prototype.animate = previousAnimate;
  });

  function makeSession(overrides?: Partial<ZoomSessionDeps>) {
    const controller = new PoseController(
      { zoom: 1, offsetX: 0, offsetY: 0 },
      { reducedMotion: overrides?.reducedMotion ?? false },
    );
    controller.attach(el);
    const deps: ZoomSessionDeps = {
      controller,
      measureStageLayout: () => null,
      measurePanGeometry: () => null,
      clampOffsets: () => ({ x: 0, y: 0 }),
      minZoom: 1,
      maxZoom: 8,
      zoomStep: 2,
      reducedMotion: false,
      isDragging: () => false,
      setDraggingUi: () => {},
      invalidateLayoutCache: () => {},
      ...overrides,
    };
    return { session: createZoomSession(() => deps), controller };
  }

  it('bakes an eased keyframe path for a button zoom (multi-keyframe, matrix form)', () => {
    const { session, controller } = makeSession();
    session.zoomIn();

    expect(controller.getPhase()).toBe('discrete');
    expect(controller.getPose().zoom).toBe(2);
    const kf = held[0]!.keyframes;
    expect(kf.length).toBeGreaterThan(3);
    expect(matrixZoom(kf[0]!.transform)).toBeCloseTo(1, 6);
    expect(matrixZoom(kf[kf.length - 1]!.transform)).toBeCloseTo(2, 6);
  });

  it('retargets mid-flight from the live pose, carrying velocity forward', () => {
    const { session, controller } = makeSession();
    session.zoomIn();
    expect(held).toHaveLength(1);

    // Interrupt a quarter of the way in, while velocity is still high.
    const first = held[0]!;
    first.currentTime = first.duration / 4;
    const liveZoom = controller.getLiveAnimatedZoom()!;
    expect(liveZoom).toBeGreaterThan(1);
    expect(liveZoom).toBeLessThan(2);

    session.zoomIn();

    // Target compounds from the committed zoom: 1 → 2 → 4.
    expect(controller.getPose().zoom).toBe(4);
    expect(held).toHaveLength(2);
    const kf = held[1]!.keyframes;

    // New animation starts at the live visual zoom — no restart from 1,
    // no forward jump to the previous target.
    expect(matrixZoom(kf[0]!.transform)).toBeCloseTo(liveZoom, 4);

    // Carried velocity: the first spring step moves faster than a cold-start
    // spring would from the same pose (which covers the same distance in
    // strictly more frames).
    const coldStart = held[0]!.keyframes;
    const warmFirstStep = matrixZoom(kf[1]!.transform) - matrixZoom(kf[0]!.transform);
    const coldFirstStep =
      matrixZoom(coldStart[1]!.transform) - matrixZoom(coldStart[0]!.transform);
    // Normalize by distance to compare fractional progress per frame.
    const warmSpan = 4 - liveZoom;
    const coldSpan = 2 - 1;
    expect(warmFirstStep / warmSpan).toBeGreaterThan(coldFirstStep / coldSpan);
  });

  it('flushes whenZoomAnimationSettled waiters only after the final retarget lands', () => {
    const { session } = makeSession();
    const waiter = vi.fn();

    session.zoomIn();
    session.actions.whenZoomAnimationSettled(waiter);
    expect(waiter).not.toHaveBeenCalled();

    // Retarget mid-flight — the waiter must survive the cancel.
    held[0]!.currentTime = held[0]!.duration / 2;
    session.zoomIn();
    expect(waiter).not.toHaveBeenCalled();

    held[1]!.onfinish?.();
    expect(waiter).toHaveBeenCalledTimes(1);
  });

  it('zoomOut retargets an in-flight zoomIn without a backward jump', () => {
    const { session, controller } = makeSession();
    session.zoomIn();
    held[0]!.currentTime = held[0]!.duration / 2;
    const liveZoom = controller.getLiveAnimatedZoom()!;

    session.zoomOut();

    // Steps from the committed target (2 / 2 = 1), but the motion starts at
    // the live visual zoom and turns around from there.
    expect(controller.getPose().zoom).toBe(1);
    const kf = held[1]!.keyframes;
    expect(matrixZoom(kf[0]!.transform)).toBeCloseTo(liveZoom, 4);
    expect(matrixZoom(kf[kf.length - 1]!.transform)).toBeCloseTo(1, 6);
  });

  it('reduced motion keeps discrete zoom instant (no bake, no animation)', () => {
    const { session, controller } = makeSession({ reducedMotion: true });
    const discreteSpy = vi.spyOn(controller, 'discrete');
    session.zoomIn();
    expect(controller.getPose().zoom).toBe(2);
    expect(controller.getPhase()).toBe('idle');
    // discrete() short-circuits before creating a WAAPI animation.
    expect(discreteSpy).toHaveBeenCalled();
    expect(held).toHaveLength(0);
  });
});

describe('zoom session two-finger pinch-pan', () => {
  let el: HTMLDivElement;

  beforeEach(() => {
    el = document.createElement('div');
    document.body.appendChild(el);
  });

  afterEach(() => {
    el.remove();
  });

  function overflowingGeo(z: number) {
    const overflows = z > 1;
    const max = overflows ? 100 : 0;
    const box = { left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400 } as DOMRect;
    return {
      stage: box,
      viewport: box,
      contentW: 400,
      contentH: 400,
      x: { min: -max, max, overflows },
      y: { min: -max, max, overflows },
    };
  }

  function makeSession() {
    const controller = new PoseController({ zoom: 2, offsetX: 0, offsetY: 0 }, { reducedMotion: true });
    controller.attach(el);
    const session = createZoomSession(() => ({
      controller,
      measureStageLayout: () => overflowingGeo(controller.getPose().zoom),
      measurePanGeometry: (z) => overflowingGeo(z),
      clampOffsets: (x, y) => ({ x, y }),
      minZoom: 1,
      maxZoom: 8,
      zoomStep: 2,
      reducedMotion: true,
      isDragging: () => true,
      setDraggingUi: () => {},
      invalidateLayoutCache: () => {},
    }));
    return { session, controller };
  }

  it('translates with the centroid when zoom is unchanged', () => {
    const { session, controller } = makeSession();
    session.actions.applyPinchPan(
      2,
      { zoom: 2, offsetX: 0, offsetY: 0, cx: 0, cy: 0 },
      { x: 60, y: 0 },
      true,
    );
    expect(controller.getPose().zoom).toBe(2);
    expect(controller.getPose().offsetX).toBeCloseTo(30, 5);
    expect(controller.getPose().offsetY).toBe(0);
  });

  it('keeps the origin content point under the moving centroid while scaling', () => {
    const { session, controller } = makeSession();
    session.actions.applyPinchPan(
      4,
      { zoom: 2, offsetX: 0, offsetY: 0, cx: 0, cy: 0 },
      { x: 40, y: 0 },
      true,
    );
    expect(controller.getPose().zoom).toBe(4);
    expect(controller.getPose().offsetX).toBeCloseTo(10, 5);
  });

  it('does not pan a letterboxed axis on touch', () => {
    const { session, controller } = makeSession();
    controller.replacePose({ zoom: 1, offsetX: 0, offsetY: 0 });
    session.actions.applyPinchPan(
      1,
      { zoom: 1, offsetX: 0, offsetY: 0, cx: 0, cy: 0 },
      { x: 80, y: 40 },
      true,
    );
    expect(controller.getPose().offsetX).toBe(0);
    expect(controller.getPose().offsetY).toBe(0);
  });
});

describe('zoom session pinch cover-threshold continuity', () => {
  let el: HTMLDivElement;

  beforeEach(() => {
    el = document.createElement('div');
    document.body.appendChild(el);
  });

  afterEach(() => {
    el.remove();
  });

  /**
   * Asymmetric chrome: viewport 0..400, stage center Y at 180 (δ = 20).
   * Content 200 → zoomFit = 2, home at fit = 10. Crossing overflow used to
   * drop a centered pinch from home (~10–20px) back to raw 0.
   */
  function asymmetricGeo(z: number) {
    const viewport = { left: 0, top: 0, right: 400, bottom: 400, width: 400, height: 400 } as DOMRect;
    const stage = { left: 0, top: 0, right: 400, bottom: 360, width: 400, height: 360 } as DOMRect;
    return {
      viewport,
      stage,
      contentW: 200,
      contentH: 200,
      x: panOffsetRange(200, z, 0, 400, 200, 1),
      y: panOffsetRange(200, z, 0, 400, 180, 1),
    };
  }

  function makeSession() {
    const controller = new PoseController({ zoom: 1, offsetX: 0, offsetY: 0 }, { reducedMotion: true });
    controller.attach(el);
    const session = createZoomSession(() => ({
      controller,
      measureStageLayout: () => asymmetricGeo(controller.getPose().zoom),
      measurePanGeometry: (z) => asymmetricGeo(z),
      clampOffsets: (x, y) => ({ x, y }),
      minZoom: 1,
      maxZoom: 8,
      zoomStep: 2,
      reducedMotion: true,
      isDragging: () => true,
      setDraggingUi: () => {},
      invalidateLayoutCache: () => {},
    }));
    return { session, controller };
  }

  const origin = { zoom: 1, offsetX: 0, offsetY: 0, cx: 0, cy: 0 };

  it('does not jump off cover-home when a centered pinch crosses overflow', () => {
    const { session, controller } = makeSession();

    session.actions.applyPinchPan(1.5, origin, { x: 0, y: 0 }, true);
    session.actions.applyPinchPan(2, origin, { x: 0, y: 0 }, true);
    const atFit = controller.getPose().offsetY;
    expect(asymmetricGeo(2).y.overflows).toBe(false);
    expect(atFit).toBeCloseTo(10, 5);

    session.actions.applyPinchPan(2.5, origin, { x: 0, y: 0 }, true);
    expect(asymmetricGeo(2.5).y.overflows).toBe(true);
    // Continues from the last home pose — not raw 0 (the old ~δ jump).
    expect(controller.getPose().offsetY).toBeCloseTo(atFit, 5);
  });

  it('does not apply discarded off-center tracking when the axis unlocks', () => {
    const { session, controller } = makeSession();
    const offCenter = { ...origin, cy: 40 };

    session.actions.applyPinchPan(2, offCenter, { x: 0, y: 40 }, true);
    const atFit = controller.getPose().offsetY;
    expect(atFit).toBeCloseTo(10, 5);

    session.actions.applyPinchPan(2.5, offCenter, { x: 0, y: 40 }, true);
    // Raw origin math would be 40/2.5 − 40 = −24. Rebase continues from home.
    expect(controller.getPose().offsetY).toBeCloseTo(atFit + 40 / 2.5 - 40 / 2, 5);
  });

  it('drops the letterbox rebase when a new drag starts', () => {
    const { session, controller } = makeSession();
    session.actions.applyPinchPan(2, origin, { x: 0, y: 0 }, true);
    expect(controller.getPose().offsetY).toBeCloseTo(10, 5);

    session.actions.setDragging(true);
    controller.replacePose({ zoom: 2.5, offsetX: 0, offsetY: 0 });
    session.actions.applyPinchPan(
      2.5,
      { zoom: 2.5, offsetX: 0, offsetY: 0, cx: 0, cy: 0 },
      { x: 0, y: 0 },
      true,
    );
    // New pinch is already overflowing — must use the fresh origin, not home.
    expect(controller.getPose().offsetY).toBeCloseTo(0, 5);
  });
});
