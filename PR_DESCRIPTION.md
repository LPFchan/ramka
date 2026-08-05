# Smooth, velocity-continuous button/keyboard zoom

## Problem

Zooming via the zoom buttons or keyboard shortcuts (`+` / `-` / `⌘0`) felt choppy when triggered in quick succession — i.e. pressing again while the previous zoom animation was still running.

Discrete zoom was a raw 2-keyframe `ease-in-out` WAAPI tween. Every press hard-cancelled the in-flight animation at the live pose and started a brand-new 300ms tween **from zero velocity**, re-entering the slow ease-in phase each time. Rapid presses produced a visible stutter instead of one continuous motion.

## Approach

Bake the discrete zoom curve into explicit WAAPI keyframes (the same compositor-playback pattern already used for release settle via `bakeSettlePath`), which makes the live pose **and velocity** analytically recoverable at any interrupt point. Then:

- **Uninterrupted press — unchanged feel.** The bake reproduces the exact original 300ms CSS `cubic-bezier(0.42, 0, 0.58, 1)` curve, sampled parametrically (bezier `x` becomes the keyframe time offset, `y` the progress), so a single press is visually identical to before.
- **Press during an ongoing zoom — velocity carry.** The in-flight animation is caught at its live pose and live zoom velocity, and a new 300ms curve is baked whose initial slope matches that velocity (cubic Hermite with zero end slope, so the landing keeps the same soft ease-out character). Hammering the button now reads as one continuous accelerating motion. A large carried velocity may slightly overshoot the target mid-curve and ease back — the intended elastic interrupt feel.

Target stepping is untouched: each press still compounds from the committed target (1 → 2 → 4), and poses still ride the focal-stable matrix-lerp line WAAPI interpolated before. Double-tap and `⌘0` reset go through the same path and inherit the continuity for free. Playback stays on the compositor (immune to rAF throttling and main-thread jank).

## Changes

- `gesture-math.ts`
  - New `bakeDiscreteZoomPath({ from, to, vZoom?, durationMs })`: exact `ease-in-out` sampling from rest, velocity-matched cubic Hermite on interrupts (tangent capped by `DISCRETE_ZOOM_MAX_CARRY_TANGENT`). Returns `null` for degenerate zero-zoom-delta moves (callers fall back to the plain tween).
- `pose-controller.ts`
  - `DiscreteSpec` accepts an optional pre-baked `path` / `pathOffsets`; `discrete()` plays it as matrix keyframes with linear easing (physics is in the samples). The 2-keyframe eased tween remains as the no-path fallback. Phase stays `'discrete'`, so all existing gesture gating (wheel swallow, tracking block, `whenZoomAnimationSettled`) is untouched.
  - New `getLiveZoomVelocity()` (finite difference over the live keyframe path, zoom units/s) and `getDefaultDiscreteDuration()`.
- `zoom-session.ts`
  - `changeZoom` (non-rapid) and `reset` now go through `startDiscreteZoom`: capture live velocity, cancel at the live pose, rebake, and hand the path to `controller.discrete()`. `whenZoomAnimationSettled` waiters survive retargets and flush when the final animation lands.

No public API changes; reduced motion behavior is unchanged (instant pose write).

## Tests

- `gesture-math.test.ts`: `bakeDiscreteZoomPath` — exact bezier reproduction from rest (symmetric midpoint, slow-in start), mirror zoom-out, velocity carry, bounded overshoot with ease-back, focal-stable matrix-lerp invariant for offsets, strictly increasing keyframe offsets, degenerate-delta fallback.
- `pose-controller.test.ts`: path-based `discrete()` keyframe construction, live multi-sample path sampling (`getLiveAnimatedZoom`), `getLiveZoomVelocity` mid-flight and idle.
- `zoom-session.test.ts` (new): baked eased path for button zoom, mid-flight retarget starts at the live visual zoom with carried velocity (no backward jump, targets compound 1 → 2 → 4), `zoomOut` retargets an in-flight `zoomIn` without a jump, waiters flush only after the final retarget lands, reduced-motion stays instant.

All 448 package tests pass; typecheck clean.

## Verification against the live docs playground (Playwright)

- **Single-press fidelity**: recorded scale per frame for one press from rest; max deviation from the original `ease-in-out` curve was **0.0008** in scale — visually identical to the previous behavior.
- **Rapid-press continuity**: 4 presses at 120ms intervals; zero backward scale steps before the peak, and smoothed velocity stayed above **8 scale/s** through every retarget window (previously it collapsed to ~0 at each press as the ease-in restarted).
