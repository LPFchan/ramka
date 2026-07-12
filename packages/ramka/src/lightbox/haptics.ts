'use client';

// ---------------------------------------------------------------------------
// Haptics
//
// A thin, SSR-safe wrapper over the Web Vibration API. Support is limited
// (Android Chrome/Firefox yes; iOS Safari deliberately never exposes
// `navigator.vibrate`), so every call is a best-effort no-op when unavailable.
//
// Durations are tuned to mimic Apple's *light* impact / selection feedback: a
// single, crisp sub-frame tick rather than a buzzing rumble. On iOS these are
// exactly the moments UIKit plays a haptic — e.g. a pinch rubber-banding back
// to its bound — so the intent maps 1:1 even though the API itself doesn't.
// ---------------------------------------------------------------------------

/** Named patterns (ms) so call sites read intent, not magic numbers. */
const HAPTIC_PATTERNS = {
  /** A rubber-banded gesture (e.g. over-zoom) releasing and snapping back. */
  snap: 10,
} as const;

type HapticPattern = keyof typeof HAPTIC_PATTERNS;

/**
 * Fires a short device vibration for the given semantic pattern. No-ops when
 * the Vibration API is unavailable (SSR, iOS Safari, desktops without a
 * vibrator). Safe to call from any gesture handler.
 */
function triggerHaptic(pattern: HapticPattern = 'snap'): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }
  try {
    navigator.vibrate(HAPTIC_PATTERNS[pattern]);
  } catch {
    // Some engines throw if called outside a user-activation context; the
    // feedback is non-essential, so swallow it.
  }
}

export { triggerHaptic, HAPTIC_PATTERNS };
export type { HapticPattern };
