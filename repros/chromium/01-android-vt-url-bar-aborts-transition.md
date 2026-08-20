# Android Chrome: same-document View Transition aborts when the URL bar moves

**File at:** https://issues.chromium.org/issues/new  
**Components:** `Blink>ViewTransitions`, `Internals>Views`  
**OS:** Android 14 (Pixel 6 Pro; Mac Android emulator)  
**Chrome:** 151 stable

---

## Title

Android: same-document View Transition aborts (`InvalidStateError`) because the snapshot root includes URL-bar outsets

## Summary

Found while working on a lightbox component library. `document.startViewTransition()` is skipped when the Android URL bar moves during capture or the animation:

```
InvalidStateError: Transition was aborted because of invalid state
```

That skip (`ViewTransitionStyleTracker::SnapshotRootDidChangeSize`, >1px) is specified for a **real** snapshot-containing-block resize ([CSSWG #8045](https://github.com/w3c/csswg-drafts/issues/8045), [crbug 1404957](https://crbug.com/1404957)).

The bug is that **Android’s snapshot root is not invariant to URL-bar show/hide**, which contradicts Blink’s own README:

> The snapshot root is invariant with respect to whether viewport widgets are shown or not

On Android (`ViewportEnabled`) it is FrameView size + browser-control outsets (`TopShownRatio` / `BottomShownRatio`). There is a TODO in `GetFixedToSnapshotViewportOutsets` that this needs synchronization with URL-bar animations ([eeefabc](https://github.com/chromium/chromium/commit/eeefabcd764a1ed3de9b0dcbd952de9fa0ca5474)).

Cross-document capture cancels the controls animation ([34b55ca](https://github.com/chromium/chromium/commit/34b55ca9b2e6045c65317cd82ac1337f7e63d4c4)). Same-document `startViewTransition()` does not. Desktop Chromium and WebKit do not abort.

## Expected

The transition completes (~UA duration) while the URL bar shows, hides, or is mid-animation.

## Actual

- `ready` rejects with `InvalidStateError`, **or**
- `ready` fulfills, then `finished` resolves in ~8–50ms (skip after activation).

Also observed with a half-open URL bar and no overlay (`innerHeight` 867 vs `visualViewport.height` 923 on Pixel).

## Steps

1. Chrome Android, tab in the foreground. **Do not use `viewport-fit=cover`** (that hides/overlays the URL bar and the test passes).
2. Open `01-android-vt-url-bar-aborts-transition.html`. Stay at the top so the URL bar is showing.
3. Tap the blue photo once.

The page mounts a covering `position:fixed` overlay that uses `env(safe-area-inset-*)` (see sibling bug), then `display:none`s it inside the close callback.

**Fail:** red `CLOSE SKIPPED` (`finished` ~50ms). Open often completes.  
**Pass:** green `OK`, both durations ~450ms. Desktop Chrome passes.

## Reduced test case

[`01-android-vt-url-bar-aborts-transition.html`](./01-android-vt-url-bar-aborts-transition.html)

## Notes

- A covering `env(safe-area-inset-*)` overlay can *start* the URL-bar twitch (sibling: `02-safe-area-inset-fixed-overlay-fires-resize.md`). A half-open URL bar aborts with no `env()` at all.
- Workaround: wait until `innerHeight` and `visualViewport.height` agree before `startViewTransition`; still races if the bar moves during capture.
- Suggested fix: compute snapshot root from fully-shown or fully-hidden extents, not the in-flight shown-ratio, matching the README.

## References

- README, “Viewport Sizes”: https://chromium.googlesource.com/chromium/src/+/HEAD/third_party/blink/renderer/core/view_transition/README.md
- Skip on resize: https://crbug.com/1404957
- Spec: https://drafts.csswg.org/css-view-transitions-1/#snapshot-containing-block
- Android SCB = FrameView + outsets: https://github.com/chromium/chromium/commit/eeefabcd764a1ed3de9b0dcbd952de9fa0ca5474
- Cross-document only: https://github.com/chromium/chromium/commit/34b55ca9b2e6045c65317cd82ac1337f7e63d4c4
