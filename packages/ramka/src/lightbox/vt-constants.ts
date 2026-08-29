/**
 * Default upper bound (ms) for how long the open morph waits on the
 * destination image to decode. Used when `awaitImageDecode` is `true`.
 */
export const DEFAULT_DECODE_MAX_WAIT = 200;

/** Shared View Transition group name for the trigger ↔ item morph. */
export const VIEW_TRANSITION_NAME = 'lightbox-morph';

/**
 * Root attribute that pauses every view-transition animation through the
 * structural sheet (`animation-play-state: paused !important`).
 *
 * Set by the composited morph on Android Blink BEFORE the transition's first
 * frame and released in the same commit that installs the replacement
 * animations (or on any bail). A paused animation never ticks on the
 * compositor, so the UA animations cannot paint torn frames during the
 * capture→upgrade swap window — see the Android section of the
 * vt-composited-morph docblock.
 */
export const VT_COMPOSITOR_HOLD_ATTR = 'data-ramka-vt-hold';

export function supportsViewTransitions(): boolean {
  return (
    typeof document !== 'undefined' &&
    'startViewTransition' in document &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// A View Transition snapshots the whole document and crossfades it, which is
// comparatively heavy on constrained hardware. Below these thresholds we skip
// the morph and fall back to the plain (fade) path instead.
//
// `deviceMemory` reports 0.25–8 (GiB, capped); `< 4` targets ≤2 GiB devices.
// `hardwareConcurrency` `< 4` targets ≤3 logical cores. Both signals are
// advisory and coarse by design (privacy), so we only treat clearly low values
// as low-end and never downgrade a typical 4-core / 4 GiB+ machine.
const LOW_END_MEMORY_GIB = 4;
const LOW_END_CORE_COUNT = 4;

/**
 * Best-effort detection of a low-powered device via the Device Memory and
 * `hardwareConcurrency` hints. SSR-safe and defensive: when neither hint is
 * exposed (e.g. Safari/Firefox omit `deviceMemory`) it returns `false`, so the
 * richer View Transition path stays the default everywhere it's supported.
 */
export function isLowEndDevice(): boolean {
  if (typeof navigator === 'undefined') return false;

  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof deviceMemory === 'number' && deviceMemory < LOW_END_MEMORY_GIB) {
    return true;
  }

  const cores = navigator.hardwareConcurrency;
  if (typeof cores === 'number' && cores < LOW_END_CORE_COUNT) {
    return true;
  }

  return false;
}
