# Android Chrome: `env(safe-area-inset-*)` on a covering `position: fixed` fires `window.resize` with unchanged viewport sizes

**File at:** https://issues.chromium.org/issues/new

**Suggested components:** `Blink>Viewport`, `Blink>CSS`, `UI>Browser>Mobile`, `Blink>ViewTransitions`

**OS:** Android 14 (Pixel 6 Pro; also Android Emulator)

**Chrome version:** 151 (stable). Also reproduced on the Mac Android emulator.

**Type:** Bug

---

## Title (paste)

Android: env(safe-area-inset-*) on a viewport-filling position:fixed overlay fires window.resize (unchanged innerHeight) and skips View Transitions

---

## Summary

On Chrome Android, inserting or removing a **viewport-filling `position: fixed` layer that uses `env(safe-area-inset-*)`** (including an **unused** custom property whose value is `calc(... + env(safe-area-inset-top))`) causes Chrome to:

1. Fire **`window.resize`** even though `innerWidth` / `innerHeight` / `visualViewport` width & height **do not change**.
2. Often **not** fire `visualViewport.resize`.
3. If this happens **inside** a same-document View Transition (old capture → unmount overlay in the update callback → new capture), skip the transition:

   ```
   InvalidStateError: Transition was aborted because of invalid state
   ```

   (`ViewTransitionStyleTracker::SnapshotRootDidChangeSize`)

A **plain** overlay with the same geometry does **not** do this:

```css
position: fixed;
inset: 0;
overflow: hidden;
```

Chrome is treating the `env(safe-area-inset-*)` overlay as a **browser-controls / dynamic safe-area client**. Mounting or destroying that layout box pokes URL-bar / inset machinery.

This is **not** a real viewport resize. CSSOM View only fires `resize` when the viewport actually resizes.

Requires the **URL bar to be showing**, which on Chrome Android means a **classic layout viewport** (Next default: `width=device-width, initial-scale=1`). With `viewport-fit=cover` the layout viewport is larger, the URL bar is typically overlaying/hidden, and this overlay often does **not** fire.

Related Chrome work: **Dynamic safe area insets** ([crbug 324436581](https://crbug.com/324436581), [I2S](https://groups.google.com/a/chromium.org/g/blink-dev/c/hXkimpjYaMg)) — `env(safe-area-inset-*)` tracks browser-control shown ratio on Android. A covering fixed layer that *mentions* those env vars appears to opt the document into that path even when the vars are unused.

A follow-on of this twitch is the sibling View Transition bug (`01-android-vt-url-bar-aborts-transition.md`): once controls move, snapshot-root size is not invariant.

---

## Expected

- Inserting/removing `position: fixed; inset: 0` must not fire `window.resize` unless the viewport size actually changes.
- Mentioning `env(safe-area-inset-*)` on that layer (padding **or** an unused custom property) must not change that.
- `display: none` / `remove()` of that layer mid-View-Transition must not skip the transition when JS viewport metrics are unchanged.
- `visibility: hidden` already keeps the layout box; that path is quiet (good). `display: none` / `remove()` should be equally quiet if sizes did not change.

---

## Actual

On a long docs-like page with the URL bar **visible**:

| Overlay | `window.resize` on append | on `display: none` |
|---|---|---|
| `position:fixed; inset:0; overflow:hidden` | 0 | 0 |
| same + `padding-top/bottom: env(safe-area-inset-*)` | 1 | 1 |
| unused `--lightbox-inset-top: calc(4rem + env(safe-area-inset-top, 0px))` | 1 | 1 |
| unused `--x: env(safe-area-inset-top)` (bare, not in `calc()`) | 0 | 0 |
| `top: env(safe-area-inset-top)` (not a covering inset) | 0 | 0 |
| covering box with those custom props overridden to `0px` | 0 | 0 |

On a `resize` that fires, logged `inner` and `vv` sizes are **identical** before and after (e.g. both `448×867`). CDP layout metrics also unchanged.

`visibility: hidden` / `opacity: 0` / shrinking the box / `position: static` → **no** resize.  
`display: none` / `element.remove()` of that Content box → **yes**.

Emptying the overlay’s children still fires — it is the **covering layout box**, not descendants.

If the overlay is `display: none`’d inside `startViewTransition`’s update callback: `ready` may succeed, then `finished` in ~8ms (skipped morph) vs ~375ms if the box is kept (`visibility: hidden`) until `finished`.

---

## Steps to reproduce

1. Open `02-safe-area-inset-fixed-overlay-fires-resize.html` in Chrome Android (HTTP, tab in the foreground).
2. Stay at the **top** of the page so the URL bar is showing.
3. Tap the blue button.

It appends a covering `position:fixed; inset:0; overflow:hidden` box with unused `--lightbox-inset-*: calc(4rem + env(safe-area-inset-*))`, locks `<html>` overflow, flushes layout, waits two frames, then `display:none`s the box (overflow still locked). That is lightbox close without a View Transition.

**Fail:** red `FAKE RESIZE` (viewport size did not change).

**Pass:** green `OK  no resize`.

---

## Reduced test case

[`02-safe-area-inset-fixed-overlay-fires-resize.html`](./02-safe-area-inset-fixed-overlay-fires-resize.html) — tap the button.



---

## Additional information

**Product context:** docs lightbox sets `--lightbox-inset-top/bottom: calc(4rem + env(safe-area-inset-*))` on the fullscreen dialog (`.lightbox-demo-content`). Library Content does **not** set `env()`; skins do. Unmounting that dialog inside the VT close callback skipped the morph. Keeping it mounted with `visibility: hidden` until `finished` works (layout box stays; Blink already hides the live tree during VT).

**Workaround for authors:** put `env(safe-area-inset-*)` on **inner chrome** (close button, caption padding), not on the viewport-filling overlay. Still need the sibling URL-bar VT workaround if the bar is already moving.

**Workaround in the engine’s clients:** do not `display: none` / unmount a covering `env()` overlay between old and new VT capture.

**Suggested fix:** registering `env(safe-area-inset-*)` on a `position: fixed` covering box must not enqueue a viewport resize or browser-controls update when inset **values** and FrameView size did not change. Unused custom properties that happen to mention `env(safe-area-inset-*)` inside `calc()` should not opt the page into controls participation. If a synthetic resize is required internally, it must not change View Transition snapshot-root size and must not be observable as `window.resize` when CSSOM viewport dimensions are unchanged.

---

## References

- Dynamic safe area insets: https://crbug.com/324436581
- I2S: https://groups.google.com/a/chromium.org/g/blink-dev/c/hXkimpjYaMg
- CSSOM `resize`: only when the viewport is resized (https://drafts.csswg.org/cssom-view/#event-resize)
- VT skip if snapshot containing block changes: https://github.com/w3c/csswg-drafts/issues/8045 , https://crbug.com/1404957
- Sibling bug (URL bar / SCB not invariant): `01-android-vt-url-bar-aborts-transition.md`
