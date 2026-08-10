import { LightboxDocumentDataAttributes } from './lightbox-data-attributes';

// ---------------------------------------------------------------------------
// View transition timing: easing math + the curated preset table.
//
// The morph deliberately does NOT read consumer CSS for duration/easing — its
// motion is a vetted design decision (see the preset table below). Consumers
// pick a preset via `viewTransition` on `Lightbox.Root`; the Root promotes the
// preset's timing to `documentElement` (as `--lightbox-vt-*` vars + a preset
// data attribute) so the composited morph, the stock CSS fallback, the
// crossfade dissolve and the root snapshot fade all run the same clock.
// ---------------------------------------------------------------------------

type EasingFn = (t: number) => number;

/** Numeric cubic-bezier evaluator (bisection on the x polynomial). */
function cubicBezierEasing(x1: number, y1: number, x2: number, y2: number): EasingFn {
  const sample = (t: number, p1: number, p2: number) =>
    ((1 - 3 * p2 + 3 * p1) * t * t * t) + ((3 * p2 - 6 * p1) * t * t) + (3 * p1 * t);
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 32; i++) {
      const cx = sample(t, x1, x2);
      if (Math.abs(cx - x) < 1e-6) break;
      if (cx < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sample(t, y1, y2);
  };
}

/**
 * Apple-style protected ease-out: a brief low-travel wind-up followed by a
 * cubic ease-out entered at PEAK velocity, C1-continuous at the junction.
 *
 * Why not a plain bezier: Apple motion has no perceptible ease-in — it moves
 * at full speed immediately and spends most of its duration decelerating.
 * But on iOS, accelerated animations on a fresh view-transition layer tree
 * fast-forward past Core Animation's multi-frame first commit: the first
 * *displayed* frame lands ~100ms into the curve, and no anchoring trick
 * moves that (see the WebKit branch in vt-composited-morph's `upgrade`). A
 * true ease-out would teleport its fastest stretch. So the curve protects
 * exactly that window:
 *
 *   - wind-up `[0..a]`: `q·(p/a)^k` — near-still, carrying only `q` of the
 *     travel, with `k` chosen so velocity is continuous into the next phase.
 *   - settle `[a..1]`: cubic ease-out over the remaining `1-q` travel.
 *
 * On iOS the swallowed leading edge IS the wind-up, so visible motion begins
 * at maximum velocity and settles long — the Apple signature. Elsewhere the
 * wind-up reads as a short natural gather before the launch.
 *
 * `a` (wind-up fraction of duration) should cover the skip (~100ms); `q`
 * (wind-up travel) trades skip invisibility against desktop responsiveness.
 */
function protectedEaseOut(a: number, q: number): EasingFn {
  const k = (3 * (1 - q) * a) / (q * (1 - a));
  return (p) => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    if (p < a) return q * Math.pow(p / a, k);
    const u = (p - a) / (1 - a);
    return q + (1 - q) * (1 - Math.pow(1 - u, 3));
  };
}

/**
 * Damped-spring step response normalized to play out over the duration —
 * what UIKit actually runs for Photos-style zoom transitions
 * (`usingSpringWithDamping:`) and the iOS 18 fluid zoom. `zeta` is the
 * damping ratio: 1 = critically damped (no overshoot), <1 overshoots
 * slightly (0.8 is the widely documented Photos-zoom value). The decay
 * constant is fixed so the spring has visually settled at p=1, and the
 * output is normalized to end exactly at 1.
 */
function springEase(zeta: number): EasingFn {
  const z = Math.min(Math.max(zeta, 0.2), 1);
  if (z >= 1) {
    // Critical: y = 1 - (1 + A·p)·e^(-A·p); A picked so y(1) ≈ 0.999.
    const A = 9.2;
    const end = 1 - (1 + A) * Math.exp(-A);
    return (p) =>
      p <= 0 ? 0 : p >= 1 ? 1 : (1 - (1 + A * p) * Math.exp(-A * p)) / end;
  }
  // Underdamped: envelope e^(-α·p) with α = ζω; α picked so it has decayed
  // to ~0.1% at p=1.
  const alpha = 6.9;
  const omega = alpha / z;
  const wd = omega * Math.sqrt(1 - z * z);
  const f = (p: number) => Math.exp(-alpha * p) * (Math.cos(wd * p) + (alpha / wd) * Math.sin(wd * p));
  const end = 1 - f(1);
  return (p) => (p <= 0 ? 0 : p >= 1 ? 1 : (1 - f(p)) / end);
}

/**
 * Spring with a protected launch: a gentle quadratic wind-up covering the
 * iOS commit-skip window (`a` fraction of duration, `q` of the travel),
 * handing its exit velocity INTO the spring as initial velocity — the same
 * trick Apple's interruptible transitions use to inject gesture velocity
 * into a spring. On iOS the swallowed leading edge is the wind-up, so the
 * visible motion is a pure Photos-style spring settle.
 */
function protectedSpring(zeta: number, a: number, q: number): EasingFn {
  const z = Math.min(Math.max(zeta, 0.2), 1);
  // Wind-up exit velocity (dy/du in spring-segment time units).
  const vSeg = ((2 * q) / a) * (1 - a);
  const v = vSeg / (1 - q);
  let seg: (u: number) => number;
  if (z >= 1) {
    const A = 9.2;
    const C = A - v; // y'(0) continuity
    const f = (u: number) => Math.exp(-A * u) * (1 + C * u);
    const end = 1 - f(1);
    seg = (u) => (1 - f(u)) / end;
  } else {
    const alpha = 6.9;
    const omega = alpha / z;
    const wd = omega * Math.sqrt(1 - z * z);
    const B = (alpha - v) / wd;
    const f = (u: number) => Math.exp(-alpha * u) * (Math.cos(wd * u) + B * Math.sin(wd * u));
    const end = 1 - f(1);
    seg = (u) => (1 - f(u)) / end;
  }
  return (p) => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    if (p < a) return q * Math.pow(p / a, 2);
    return q + (1 - q) * seg((p - a) / (1 - a));
  };
}

/** Names a consumer can pass as `viewTransition` on `Lightbox.Root`. */
type LightboxViewTransitionPreset = 'default' | 'snappy' | 'relaxed' | 'spring';

interface ViewTransitionTimingSpec {
  /** Total morph duration in ms — also drives the crossfade and root fade. */
  duration: number;
  /** Exact numeric curve sampled by the composited morph. */
  ease: EasingFn;
  /**
   * CSS equivalent (or nearest bezier approximation for springs) for tracks
   * the composited morph does not drive: the stock `::view-transition-group`
   * fallback and the trigger↔item crossfade dissolve.
   */
  cssEasing: string;
  /** CSS easing for the root snapshot fade (`::view-transition-old/new(root)`). */
  cssRootEasing: string;
  /** Human-readable timing summary for debug traces. */
  label: string;
}

/** easeOutExpo — the root fade wants a fast dissolve regardless of preset. */
const ROOT_FADE_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';

const bezierSpec = (
  duration: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): ViewTransitionTimingSpec => ({
  duration,
  ease: cubicBezierEasing(x1, y1, x2, y2),
  cssEasing: `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`,
  cssRootEasing: ROOT_FADE_EASING,
  label: `${duration}ms cubic-bezier(${x1},${y1},${x2},${y2})`,
});

/**
 * The curated timing presets. Every entry was A/B tested on-device (iPhone
 * incl. Low Power Mode, Android Firefox) against the pre-composited-morph
 * timing (340ms sheet curve, cubic-bezier(.32,.72,0,1)). All are "skip-safe":
 * enough travel is moved out of WebKit's swallowed first ~100ms (see the
 * WebKit branch in vt-composited-morph's `upgrade`) that the start doesn't
 * teleport, while keeping a fast middle and long settle.
 *
 * This table is the reason timing is a preset, not free-form CSS: arbitrary
 * curves (anything with a hot launch) teleport on iOS and there is no
 * runtime workaround.
 */
const VIEW_TRANSITION_PRESETS: Record<LightboxViewTransitionPreset, ViewTransitionTimingSpec> = {
  /** The sheet-curve family with a tamed launch — the shipped default. */
  default: bezierSpec(360, 0.44, 0.58, 0, 1),
  /** Same family, hotter launch and standard length — reads quicker. */
  snappy: bezierSpec(340, 0.38, 0.66, 0, 1),
  /** Softer launch and longer settle — calmer, editorial feel. */
  relaxed: bezierSpec(400, 0.48, 0.5, 0, 1),
  /** Critically damped spring with a protected launch — Photos-style settle. */
  spring: {
    duration: 450,
    ease: protectedSpring(1, 0.22, 0.08),
    // Nearest bezier to the visible (post-wind-up) spring settle.
    cssEasing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    cssRootEasing: ROOT_FADE_EASING,
    label: '450ms protected-spring(1,.22,.08)',
  },
};

function isViewTransitionPreset(value: unknown): value is LightboxViewTransitionPreset {
  return typeof value === 'string' && value in VIEW_TRANSITION_PRESETS;
}

/**
 * Resolve a `viewTransition` prop value to its timing spec. `true` (and any
 * unknown string, defensively) maps to the default preset.
 */
function resolveViewTransitionTiming(
  preset: boolean | LightboxViewTransitionPreset | undefined,
): ViewTransitionTimingSpec {
  return isViewTransitionPreset(preset)
    ? VIEW_TRANSITION_PRESETS[preset]
    : VIEW_TRANSITION_PRESETS.default;
}

/**
 * Parse the undocumented `window.__RAMKA_VT_TIMING__` debug override (docs
 * wire this to `?vttiming=...`), four formats:
 *   - `'duration,x1,y1,x2,y2'` — plain cubic-bezier, e.g. `360,.44,.58,0,1`
 *   - `'duration,out,a,q'` — protected ease-out, e.g. `350,out,.28,.1`
 *   - `'duration,spring,zeta'` — UIKit-style spring, e.g. `500,spring,.8`
 *   - `'duration,pspring,zeta,a,q'` — spring with protected launch,
 *     e.g. `500,pspring,.8,.2,.08`
 */
function parseDebugTimingOverride(): { duration: number; ease: EasingFn; label: string } | null {
  if (typeof window === 'undefined') return null;
  const raw = (window as unknown as Record<string, unknown>).__RAMKA_VT_TIMING__;
  if (typeof raw !== 'string') return null;
  const parts = raw.split(',').map((p) => p.trim());
  const nums = parts.map((p) => Number.parseFloat(p));
  if (parts.length === 5 && nums.every((n) => Number.isFinite(n)) && nums[0]! > 0) {
    return {
      duration: nums[0]!,
      ease: cubicBezierEasing(nums[1]!, nums[2]!, nums[3]!, nums[4]!),
      label: `${nums[0]}ms cubic-bezier(${parts.slice(1).join(',')})`,
    };
  }
  if (
    parts.length === 4 &&
    parts[1] === 'out' &&
    Number.isFinite(nums[0]) &&
    nums[0]! > 0 &&
    Number.isFinite(nums[2]) &&
    Number.isFinite(nums[3])
  ) {
    return {
      duration: nums[0]!,
      ease: protectedEaseOut(nums[2]!, nums[3]!),
      label: `${nums[0]}ms protected-out(${nums[2]},${nums[3]})`,
    };
  }
  if (
    parts.length === 3 &&
    parts[1] === 'spring' &&
    Number.isFinite(nums[0]) &&
    nums[0]! > 0 &&
    Number.isFinite(nums[2])
  ) {
    return {
      duration: nums[0]!,
      ease: springEase(nums[2]!),
      label: `${nums[0]}ms spring(${nums[2]})`,
    };
  }
  if (
    parts.length === 5 &&
    parts[1] === 'pspring' &&
    Number.isFinite(nums[0]) &&
    nums[0]! > 0 &&
    [nums[2], nums[3], nums[4]].every((n) => Number.isFinite(n))
  ) {
    return {
      duration: nums[0]!,
      ease: protectedSpring(nums[2]!, nums[3]!, nums[4]!),
      label: `${nums[0]}ms protected-spring(${nums[2]},${nums[3]},${nums[4]})`,
    };
  }
  return null;
}

/**
 * The morph's active timing, identical in every browser. Precedence:
 *   1. `window.__RAMKA_VT_TIMING__` debug override (live-tunable, undocumented)
 *   2. the Root's `viewTransition` preset, published on `documentElement` as
 *      `data-ramka-vt-preset` for the duration of the transition
 *   3. the `default` preset
 */
function morphTiming(): { duration: number; ease: EasingFn; label: string } {
  const override = parseDebugTimingOverride();
  if (override) return override;
  const presetAttr =
    typeof document !== 'undefined'
      ? document.documentElement.getAttribute(LightboxDocumentDataAttributes.viewTransitionPreset)
      : null;
  const { duration, ease, label } = resolveViewTransitionTiming(
    isViewTransitionPreset(presetAttr) ? presetAttr : undefined,
  );
  return { duration, ease, label };
}

export {
  morphTiming,
  resolveViewTransitionTiming,
  isViewTransitionPreset,
  VIEW_TRANSITION_PRESETS,
};
export type { LightboxViewTransitionPreset, ViewTransitionTimingSpec, EasingFn };
