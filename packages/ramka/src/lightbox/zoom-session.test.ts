import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

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
