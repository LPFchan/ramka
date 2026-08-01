/**
 * Single owner of the zoom/pan visual transform.
 *
 * React never writes `style.transform` while this controller is attached.
 * Tracking uses direct style writes; settle/discrete use WAAPI. Phase
 * transitions are explicit so gesture code cannot accidentally dual-drive
 * the same pixels.
 */

export type PosePhase = 'idle' | 'tracking' | 'settling' | 'discrete';

export interface ZoomPose {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export interface PoseSnapshot extends ZoomPose {
  phase: PosePhase;
  /** True while a WAAPI that changes scale is in flight (chrome sampling). */
  animatesZoom: boolean;
}

export interface SettleSpec {
  path: ZoomPose[];
  pathOffsets: number[];
  to: ZoomPose;
  durationMs: number;
  /** Default false — pure pan coasts skip chrome live-scale sampling. */
  zoomChanges?: boolean;
  onFinish?: () => void;
}

export interface DiscreteSpec {
  to: ZoomPose;
  duration?: number;
  easing?: string;
  onFinish?: () => void;
}

interface RunningPathInfo {
  poses: ZoomPose[];
  offsets?: number[];
  duration: number;
}

type Listener = () => void;

export function poseTransform(p: ZoomPose): string {
  return `scale(${p.zoom}) translate(${p.offsetX}px, ${p.offsetY}px)`;
}

/**
 * Exact live pose of a keyframed animation at `currentTime`.
 * Settle recovery must use this — never getComputedStyle mid-WAAPI (Safari).
 */
export function livePoseOnPath(info: RunningPathInfo, currentTime: unknown): ZoomPose | null {
  const n = info.poses.length;
  if (n === 0) return null;
  if (n === 1 || info.duration <= 0) return info.poses[n - 1]!;
  const ct = typeof currentTime === 'number' ? currentTime : 0;
  const p = Math.min(1, Math.max(0, ct / info.duration));
  let i: number;
  let f: number;
  const offsets = info.offsets;
  if (offsets) {
    i = 0;
    while (i < n - 2 && offsets[i + 1]! < p) i += 1;
    const t0 = offsets[i]!;
    const t1 = offsets[i + 1]!;
    f = t1 > t0 ? Math.min(1, Math.max(0, (p - t0) / (t1 - t0))) : 1;
  } else {
    const seg = p * (n - 1);
    i = Math.min(n - 2, Math.floor(seg));
    f = seg - i;
  }
  const a = info.poses[i]!;
  const b = info.poses[i + 1]!;
  return {
    zoom: a.zoom + (b.zoom - a.zoom) * f,
    offsetX: a.offsetX + (b.offsetX - a.offsetX) * f,
    offsetY: a.offsetY + (b.offsetY - a.offsetY) * f,
  };
}

function poseFromComputedTransform(transform: string): ZoomPose | null {
  if (!transform || transform === 'none') return null;
  try {
    const m = new DOMMatrixReadOnly(transform);
    const scale = Math.hypot(m.a, m.b);
    if (!(scale > 0)) return null;
    return { zoom: scale, offsetX: m.e / scale, offsetY: m.f / scale };
  } catch {
    return null;
  }
}

export class PoseController {
  private el: HTMLElement | null = null;
  private pose: ZoomPose;
  private phase: PosePhase = 'idle';
  private anim: Animation | null = null;
  private pathInfo: RunningPathInfo | null = null;
  private animatesZoom = false;
  private reducedMotion: boolean;
  private defaultDiscreteDuration: number;

  /** React / commit subscribers — phase boundaries and finished animations. */
  private commitListeners = new Set<Listener>();
  /** Chrome visual subscribers — every pose write including hot pan/pinch. */
  private visualListeners = new Set<Listener>();

  private snapshot: PoseSnapshot;

  constructor(
    initial: ZoomPose,
    opts?: { reducedMotion?: boolean; defaultDiscreteDuration?: number },
  ) {
    this.pose = { ...initial };
    this.reducedMotion = opts?.reducedMotion ?? false;
    this.defaultDiscreteDuration = opts?.defaultDiscreteDuration ?? 300;
    this.snapshot = this.makeSnapshot();
  }

  /** Attach (or reattach) the transform host. Writes the current pose immediately. */
  attach(el: HTMLElement | null): void {
    this.el = el;
    if (el) this.writeTransform();
  }

  /**
   * Authoritative pose for gestures / public API.
   * - Settling: live analytic path pose (release→rest; React commits on finish).
   * - Discrete: committed target (armed immediately; WAAPI still composites
   *   from→to — chrome samples via `getLiveAnimatedZoom`).
   * - Idle / tracking: controller pose.
   */
  getPose(): ZoomPose {
    if (this.phase === 'settling' && this.anim && this.pathInfo) {
      const live = livePoseOnPath(this.pathInfo, this.anim.currentTime);
      if (live) return live;
    }
    return { ...this.pose };
  }

  getPhase(): PosePhase {
    return this.phase;
  }

  /** Stable snapshot for useSyncExternalStore (identity changes on commit notify). */
  getSnapshot = (): PoseSnapshot => this.snapshot;

  subscribeCommit = (listener: Listener): (() => void) => {
    this.commitListeners.add(listener);
    return () => {
      this.commitListeners.delete(listener);
    };
  };

  subscribeVisual = (listener: Listener): (() => void) => {
    this.visualListeners.add(listener);
    return () => {
      this.visualListeners.delete(listener);
    };
  };

  isDiscreteAnimating(): boolean {
    return this.phase === 'discrete';
  }

  isSettling(): boolean {
    return this.phase === 'settling';
  }

  /** Whether the running WAAPI changes scale (chrome sampling gate). */
  getAnimatesZoom(): boolean {
    return this.animatesZoom;
  }

  /** Live zoom while a keyframed settle/discrete path is running; else null. */
  getLiveAnimatedZoom(): number | null {
    if (!this.anim || !this.pathInfo) return null;
    return livePoseOnPath(this.pathInfo, this.anim.currentTime)?.zoom ?? null;
  }

  /**
   * Enter tracking. Catches an interruptible settle at the live pose.
   * No-op (returns current pose) if a discrete animation owns the transform —
   * callers must gate on `isDiscreteAnimating()`.
   */
  beginTracking(): ZoomPose {
    if (this.phase === 'discrete') return this.getPose();
    if (this.phase === 'settling') this.catchInternal();
    this.phase = 'tracking';
    this.notifyCommit();
    return this.getPose();
  }

  /**
   * Leave tracking. Default does **not** notify the React commit store —
   * flick release must settle (or explicitly `commitSnapshot`) without dumping
   * the full pan delta into a sync re-render before WAAPI starts.
   */
  endTracking(opts?: { commit?: boolean }): void {
    if (this.phase !== 'tracking') return;
    this.phase = 'idle';
    if (opts?.commit) this.notifyCommit();
  }

  /** Push the live pose into the React commit store (at-rest release sync). */
  commitSnapshot(): void {
    this.notifyCommit();
  }

  /**
   * Direct pose write (finger pan / pinch / zoom-snap ticks).
   * Hot path: DOM write + visual notify; React commit store unchanged unless
   * `commit` is true.
   */
  setPose(next: ZoomPose, opts?: { commit?: boolean }): void {
    if (this.phase === 'settling') this.catchInternal();
    if (this.phase === 'discrete') {
      // Taking over a discrete zoom mid-flight (should be gated; still safe).
      this.cancelAnimation(null);
      this.phase = 'tracking';
    }
    // Do not promote idle → tracking: zoom-snap ticks and other hot writes
    // must not leave a stale tracking phase after the gesture ends.

    this.pose = {
      zoom: next.zoom,
      offsetX: next.offsetX,
      offsetY: next.offsetY,
    };
    this.writeTransform();
    this.notifyVisual();
    if (opts?.commit) this.notifyCommit();
  }

  /**
   * Instant pose replace without forcing `tracking` (slide reset, reduced motion).
   */
  replacePose(next: ZoomPose, opts?: { phase?: PosePhase }): void {
    this.cancelAnimation(null);
    this.pose = { ...next };
    this.phase = opts?.phase ?? 'idle';
    this.animatesZoom = false;
    this.writeTransform();
    this.notifyVisual();
    this.notifyCommit();
  }

  /**
   * Bake-playback settle. Starts WAAPI in the current turn from the pose
   * already on the element. Does not notify React until finish/catch.
   */
  settle(spec: SettleSpec): boolean {
    const el = this.el;
    if (!el) return false;

    // Adopt any in-flight animation's live pose first.
    if (this.anim) this.catchInternal();

    const fromPose = { ...this.pose };
    const from = poseTransform(fromPose);
    const to = poseTransform(spec.to);
    if (from === to && spec.path.length === 0) {
      this.pose = { ...spec.to };
      this.phase = 'idle';
      this.writeTransform();
      this.notifyVisual();
      this.notifyCommit();
      spec.onFinish?.();
      return false;
    }

    if (this.reducedMotion) {
      this.pose = { ...spec.to };
      this.phase = 'idle';
      this.writeTransform();
      this.notifyVisual();
      this.notifyCommit();
      spec.onFinish?.();
      return true;
    }

    const duration = Math.max(0, spec.durationMs);
    const keyframes: Keyframe[] = [
      { transform: from, offset: 0 },
      ...spec.path.map((p, i) => ({
        transform: poseTransform(p),
        offset: spec.pathOffsets[i],
      })),
      { transform: to, offset: 1 },
    ];

    try {
      // Pin only when needed — a redundant style write dirties the layer on the
      // release frame. KF0 must still equal the pose already on the element.
      if (el.style.transform !== from) {
        el.style.transform = from;
      }
      const anim = el.animate(keyframes, { duration, fill: 'forwards' });
      this.anim = anim;
      this.pathInfo = {
        poses: [fromPose, ...spec.path, spec.to],
        offsets: [0, ...spec.pathOffsets, 1],
        duration,
      };
      // tracking|idle → settling with no idle commit epoch in between.
      this.phase = 'settling';
      this.animatesZoom = spec.zoomChanges ?? false;
      // Keep `this.pose` at the release pose; getPose() reads the live path.
      // React commit store is NOT notified until finish — release frame stays free.
      this.notifyVisual();

      const land = () => {
        el.style.transform = to;
      };

      anim.onfinish = () => {
        if (this.anim !== anim) return;
        this.anim = null;
        this.pathInfo = null;
        this.animatesZoom = false;
        this.phase = 'idle';
        anim.onfinish = null;
        anim.oncancel = null;
        try {
          anim.commitStyles();
        } catch {
          land();
        }
        anim.cancel();
        land();
        this.pose = { ...spec.to };
        this.notifyVisual();
        this.notifyCommit();
        spec.onFinish?.();
      };
      anim.oncancel = () => {
        if (this.anim !== anim) return;
        this.anim = null;
        this.pathInfo = null;
        this.animatesZoom = false;
        // catchInternal / cancelAnimation own landing + notify
      };

      return true;
    } catch {
      this.pose = { ...spec.to };
      this.phase = 'idle';
      this.writeTransform();
      this.notifyVisual();
      this.notifyCommit();
      spec.onFinish?.();
      return false;
    }
  }

  /**
   * Discrete 2-keyframe zoom (double-tap, buttons). Blocks tracking until done.
   */
  discrete(spec: DiscreteSpec): boolean {
    const el = this.el;
    if (!el) return false;

    if (this.anim) this.catchInternal();

    const fromPose = { ...this.pose };
    const from = poseTransform(fromPose);
    const to = poseTransform(spec.to);
    if (from === to) {
      this.phase = 'idle';
      spec.onFinish?.();
      return false;
    }

    const duration = this.reducedMotion ? 0 : (spec.duration ?? this.defaultDiscreteDuration);

    if (this.reducedMotion || duration === 0) {
      this.pose = { ...spec.to };
      this.phase = 'idle';
      this.writeTransform();
      this.notifyVisual();
      this.notifyCommit();
      spec.onFinish?.();
      return true;
    }

    try {
      el.style.transform = from;
      const anim = el.animate(
        [
          { transform: from, easing: spec.easing ?? 'ease-in-out' },
          { transform: to },
        ],
        { duration, fill: 'forwards' },
      );
      this.anim = anim;
      this.pathInfo = {
        poses: [fromPose, spec.to],
        offsets: [0, 1],
        duration,
      };
      this.phase = 'discrete';
      this.animatesZoom = fromPose.zoom !== spec.to.zoom;
      // Commit the target pose immediately for public API / canZoom gates.
      // Visual still runs from→to via WAAPI; chrome samples getLiveAnimatedZoom.
      this.pose = { ...spec.to };
      // Commit before visual so chrome reads a fresh animatesZoom snapshot.
      this.notifyCommit();
      this.notifyVisual();

      const land = () => {
        el.style.transform = to;
      };

      anim.onfinish = () => {
        if (this.anim !== anim) return;
        this.anim = null;
        this.pathInfo = null;
        this.animatesZoom = false;
        this.phase = 'idle';
        anim.onfinish = null;
        anim.oncancel = null;
        try {
          anim.commitStyles();
        } catch {
          land();
        }
        anim.cancel();
        land();
        this.pose = { ...spec.to };
        this.notifyVisual();
        this.notifyCommit();
        spec.onFinish?.();
      };
      anim.oncancel = () => {
        if (this.anim !== anim) return;
        this.anim = null;
        this.pathInfo = null;
        this.animatesZoom = false;
      };

      return true;
    } catch {
      this.pose = { ...spec.to };
      this.phase = 'idle';
      this.writeTransform();
      this.notifyVisual();
      this.notifyCommit();
      spec.onFinish?.();
      return false;
    }
  }

  /**
   * Catch settle (or any interruptible animation) at the live pose and return
   * to direct writes. Discrete catch is allowed for safety but gesture gates
   * should prevent it.
   */
  catch(): ZoomPose | null {
    if (!this.anim) return null;
    return this.catchInternal();
  }

  /** Cancel any animation and freeze at live (or committed) pose. */
  cancel(): ZoomPose | null {
    if (!this.anim) return null;
    return this.catchInternal();
  }

  private catchInternal(): ZoomPose {
    const live = this.cancelAnimation(this.getPose());
    this.pose = live;
    this.phase = 'tracking';
    this.animatesZoom = false;
    this.writeTransform();
    this.notifyVisual();
    this.notifyCommit();
    return live;
  }

  private cancelAnimation(fallback: ZoomPose | null): ZoomPose {
    const anim = this.anim;
    const pathInfo = this.pathInfo;
    this.anim = null;
    this.pathInfo = null;
    if (!anim) return fallback ?? this.getPose();

    anim.onfinish = null;
    anim.oncancel = null;
    const el = this.el;
    const live = pathInfo
      ? livePoseOnPath(pathInfo, anim.currentTime)
      : el
        ? poseFromComputedTransform(getComputedStyle(el).transform)
        : null;
    anim.cancel();
    const pose = live ?? fallback ?? this.getPose();
    if (el) el.style.transform = poseTransform(pose);
    return pose;
  }

  private writeTransform(): void {
    if (!this.el) return;
    this.el.style.transform = poseTransform(this.pose);
  }

  private makeSnapshot(): PoseSnapshot {
    return {
      zoom: this.pose.zoom,
      offsetX: this.pose.offsetX,
      offsetY: this.pose.offsetY,
      phase: this.phase,
      animatesZoom: this.animatesZoom,
    };
  }

  private notifyVisual(): void {
    for (const l of this.visualListeners) l();
  }

  private notifyCommit(): void {
    this.snapshot = this.makeSnapshot();
    for (const l of this.commitListeners) l();
  }
}
