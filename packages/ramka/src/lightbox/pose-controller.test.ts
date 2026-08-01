import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import {
  PoseController,
  poseTransform,
  poseMatrix,
  lerpPoseMatrix,
  livePoseOnPath,
} from './pose-controller';

function makeEl() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('PoseController', () => {
  let el: HTMLDivElement;
  let previousAnimate: typeof Element.prototype.animate;

  beforeEach(() => {
    el = makeEl();
    previousAnimate = Element.prototype.animate;
  });

  afterEach(() => {
    el.remove();
    Element.prototype.animate = previousAnimate;
  });

  it('setPose writes transform without commit notify by default', () => {
    const c = new PoseController({ zoom: 1, offsetX: 0, offsetY: 0 });
    c.attach(el);
    const commits: number[] = [];
    const visuals: number[] = [];
    c.subscribeCommit(() => commits.push(1));
    c.subscribeVisual(() => visuals.push(1));

    c.setPose({ zoom: 2, offsetX: 10, offsetY: 0 });
    expect(el.style.transform).toBe(poseTransform({ zoom: 2, offsetX: 10, offsetY: 0 }));
    expect(c.getPose()).toEqual({ zoom: 2, offsetX: 10, offsetY: 0 });
    expect(visuals.length).toBe(1);
    expect(commits.length).toBe(0);
  });

  it('settle starts from the exact last setPose and finishes at rest', () => {
    const held: Array<{
      onfinish: (() => void) | null;
      cancel: ReturnType<typeof vi.fn>;
      currentTime: number;
      duration: number;
    }> = [];
    Element.prototype.animate = vi.fn((_kf, opts) => {
      const anim = {
        cancel: vi.fn(),
        play: vi.fn(),
        pause: vi.fn(),
        onfinish: null as (() => void) | null,
        oncancel: null as (() => void) | null,
        commitStyles: vi.fn(),
        currentTime: 0,
        duration: typeof opts === 'object' ? Number(opts?.duration ?? 0) : 0,
      };
      held.push(anim);
      return anim as unknown as Animation;
    }) as unknown as typeof Element.prototype.animate;

    const c = new PoseController({ zoom: 2, offsetX: 0, offsetY: 0 });
    c.attach(el);
    c.setPose({ zoom: 2, offsetX: 40, offsetY: 0 });

    const fromBefore = el.style.transform;
    let finished = false;
    const ok = c.settle({
      path: [{ zoom: 2, offsetX: 60, offsetY: 0 }],
      pathOffsets: [0.5],
      to: { zoom: 2, offsetX: 80, offsetY: 0 },
      durationMs: 100,
      onFinish: () => {
        finished = true;
      },
    });
    expect(ok).toBe(true);
    expect(c.getPhase()).toBe('settling');
    expect(el.style.transform).toBe(fromBefore);

    const keyframes = (Element.prototype.animate as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Keyframe[];
    expect(keyframes[0]!.transform).toBe(fromBefore);
    expect(keyframes[keyframes.length - 1]!.transform).toBe(
      poseTransform({ zoom: 2, offsetX: 80, offsetY: 0 }),
    );

    held[0]!.onfinish?.();
    expect(finished).toBe(true);
    expect(c.getPhase()).toBe('idle');
    expect(c.getPose()).toEqual({ zoom: 2, offsetX: 80, offsetY: 0 });
  });

  it('settle does not notifyCommit until finish (release-seam)', () => {
    Element.prototype.animate = vi.fn((_kf, opts) => {
      return {
        cancel: vi.fn(),
        play: vi.fn(),
        pause: vi.fn(),
        onfinish: null as (() => void) | null,
        oncancel: null as (() => void) | null,
        commitStyles: vi.fn(),
        currentTime: 0,
        duration: typeof opts === 'object' ? Number(opts?.duration ?? 0) : 0,
      } as unknown as Animation;
    }) as unknown as typeof Element.prototype.animate;

    const c = new PoseController({ zoom: 2, offsetX: 0, offsetY: 0 });
    c.attach(el);
    c.beginTracking();
    c.setPose({ zoom: 2, offsetX: 40, offsetY: 0 });

    const commits: Array<{ zoom: number; offsetX: number; phase: string }> = [];
    c.subscribeCommit(() => {
      const s = c.getSnapshot();
      commits.push({ zoom: s.zoom, offsetX: s.offsetX, phase: s.phase });
    });
    // Drop the beginTracking commit so we only assert settle enter/finish.
    commits.length = 0;

    // Old (wrong) order: leave tracking before settle — must not dump pan delta.
    c.endTracking({ commit: false });
    expect(commits.length).toBe(0);

    const ok = c.settle({
      path: [{ zoom: 2, offsetX: 60, offsetY: 0 }],
      pathOffsets: [0.5],
      to: { zoom: 2, offsetX: 80, offsetY: 0 },
      durationMs: 100,
    });
    expect(ok).toBe(true);
    expect(c.getPhase()).toBe('settling');
    expect(commits.length).toBe(0);

    const running = (
      Element.prototype.animate as ReturnType<typeof vi.fn>
    ).mock.results[0]!.value as { onfinish: (() => void) | null };
    running.onfinish?.();
    expect(commits.length).toBe(1);
    expect(commits[0]).toEqual({ zoom: 2, offsetX: 80, phase: 'idle' });
  });

  it('endTracking defaults to no commit; commitSnapshot syncs at rest', () => {
    const c = new PoseController({ zoom: 1, offsetX: 0, offsetY: 0 });
    c.attach(el);
    c.beginTracking();
    c.setPose({ zoom: 2, offsetX: 30, offsetY: 0 });
    const commits: number[] = [];
    c.subscribeCommit(() => commits.push(1));
    commits.length = 0;

    c.endTracking();
    expect(c.getPhase()).toBe('idle');
    expect(commits.length).toBe(0);
    expect(c.getSnapshot().offsetX).toBe(0); // still beginTracking snapshot

    c.commitSnapshot();
    expect(commits.length).toBe(1);
    expect(c.getSnapshot().offsetX).toBe(30);
  });

  it('catch recovers the mid-settle pose analytically', () => {
    Element.prototype.animate = vi.fn((_kf, opts) => {
      const anim = {
        cancel: vi.fn(),
        play: vi.fn(),
        pause: vi.fn(),
        onfinish: null as (() => void) | null,
        oncancel: null as (() => void) | null,
        commitStyles: vi.fn(),
        currentTime: 50,
        duration: typeof opts === 'object' ? Number(opts?.duration ?? 0) : 0,
      };
      return anim as unknown as Animation;
    }) as unknown as typeof Element.prototype.animate;

    const c = new PoseController({ zoom: 2, offsetX: 0, offsetY: 0 });
    c.attach(el);
    c.setPose({ zoom: 2, offsetX: 0, offsetY: 0 });
    c.settle({
      path: [{ zoom: 2, offsetX: 100, offsetY: 0 }],
      pathOffsets: [0.5],
      to: { zoom: 2, offsetX: 200, offsetY: 0 },
      durationMs: 100,
    });

    const caught = c.catch();
    expect(caught).not.toBeNull();
    // t=50 of 100 → halfway on the path → offsetX ≈ 100
    expect(caught!.offsetX).toBeCloseTo(100, 5);
    expect(c.getPhase()).toBe('tracking');
    expect(el.style.transform).toBe(poseTransform(caught!));
  });

  it('discrete sets phase and blocks until finish', () => {
    Element.prototype.animate = vi.fn((_kf, opts) => {
      const anim = {
        cancel: vi.fn(),
        play: vi.fn(),
        pause: vi.fn(),
        onfinish: null as (() => void) | null,
        oncancel: null as (() => void) | null,
        commitStyles: vi.fn(),
        currentTime: 0,
        duration: typeof opts === 'object' ? Number(opts?.duration ?? 0) : 0,
      };
      // Stash for finish
      (el as unknown as { __anim: typeof anim }).__anim = anim;
      return anim as unknown as Animation;
    }) as unknown as typeof Element.prototype.animate;

    const c = new PoseController({ zoom: 1, offsetX: 0, offsetY: 0 });
    c.attach(el);
    c.discrete({ to: { zoom: 2, offsetX: 0, offsetY: 0 }, duration: 200 });
    expect(c.isDiscreteAnimating()).toBe(true);
    expect(c.getPhase()).toBe('discrete');
    // Target is committed immediately for the public API; WAAPI still runs.
    expect(c.getPose().zoom).toBe(2);
    expect(c.getSnapshot().zoom).toBe(2);

    // Matrix keyframes so WAAPI matrix-lerps (focal-stable double-tap).
    const keyframes = (Element.prototype.animate as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Keyframe[];
    expect(keyframes[0]!.transform).toBe(poseMatrix({ zoom: 1, offsetX: 0, offsetY: 0 }));
    expect(keyframes[1]!.transform).toBe(poseMatrix({ zoom: 2, offsetX: 0, offsetY: 0 }));

    const anim = (el as unknown as { __anim: { onfinish: (() => void) | null } }).__anim;
    anim.onfinish?.();
    expect(c.isDiscreteAnimating()).toBe(false);
    expect(c.getPose().zoom).toBe(2);
  });

  it('beginTracking catches settle', () => {
    Element.prototype.animate = vi.fn((_kf, opts) => {
      return {
        cancel: vi.fn(),
        play: vi.fn(),
        pause: vi.fn(),
        onfinish: null,
        oncancel: null,
        commitStyles: vi.fn(),
        currentTime: 0,
        duration: typeof opts === 'object' ? Number(opts?.duration ?? 0) : 0,
      } as unknown as Animation;
    }) as unknown as typeof Element.prototype.animate;

    const c = new PoseController({ zoom: 2, offsetX: 0, offsetY: 0 });
    c.attach(el);
    c.settle({
      path: [{ zoom: 2, offsetX: 50, offsetY: 0 }],
      pathOffsets: [0.5],
      to: { zoom: 2, offsetX: 100, offsetY: 0 },
      durationMs: 100,
    });
    expect(c.getPhase()).toBe('settling');
    c.beginTracking();
    expect(c.getPhase()).toBe('tracking');
  });
});

describe('livePoseOnPath', () => {
  it('lerps non-uniform offsets', () => {
    const pose = livePoseOnPath(
      {
        poses: [
          { zoom: 1, offsetX: 0, offsetY: 0 },
          { zoom: 1, offsetX: 100, offsetY: 0 },
          { zoom: 1, offsetX: 200, offsetY: 0 },
        ],
        offsets: [0, 0.25, 1],
        duration: 100,
      },
      25,
    );
    expect(pose!.offsetX).toBeCloseTo(100, 5);
  });

  it('matrixInterp mid-zoom matches focal-stable matrix lerp (not component lerp)', () => {
    // Zoom 1→2 with end offset -50 (focal 100). Component lerp at t=0.5 is -25;
    // matrix lerp is -50/1.5 ≈ -33.33 (keeps the tap point fixed).
    const from = { zoom: 1, offsetX: 0, offsetY: 0 };
    const to = { zoom: 2, offsetX: -50, offsetY: 0 };
    const mid = livePoseOnPath(
      { poses: [from, to], offsets: [0, 1], duration: 100, matrixInterp: true },
      50,
    );
    expect(mid!.zoom).toBeCloseTo(1.5, 5);
    expect(mid!.offsetX).toBeCloseTo(-50 / 1.5, 5);
    expect(mid!.offsetX).not.toBeCloseTo(-25, 5);
    expect(lerpPoseMatrix(from, to, 0.5).offsetX).toBeCloseTo(mid!.offsetX, 10);
  });
});
