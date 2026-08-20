# Android Chrome: `env(safe-area-inset-*)` on a covering `position:fixed` fires `window.resize`

**File at:** https://issues.chromium.org/issues/new  
**Components:** `Blink>Viewport`, `Blink>CSS`, `UI>Browser>Mobile`, `Blink>ViewTransitions`  
**OS:** Android 14 (Pixel 6 Pro; Mac Android emulator)  
**Chrome:** 151 stable

---

## Title

Android: env(safe-area-inset-*) on a viewport-filling position:fixed overlay fires window.resize with unchanged innerHeight

## Summary

Found while working on a lightbox component library. Inserting or `display:none`’ing a viewport-filling `position:fixed` box that uses `env(safe-area-inset-*)` — including an **unused** custom property `calc(4rem + env(safe-area-inset-top, 0px))` — fires `window.resize` while `innerWidth` / `innerHeight` / `visualViewport` size **do not change**. `visualViewport.resize` often does not fire.

A plain `position:fixed; inset:0; overflow:hidden` overlay does **not**.

CSSOM View only fires `resize` when the viewport actually resizes. This looks like the overlay is treated as a [dynamic safe-area](https://crbug.com/324436581) / browser-controls client, and mounting or destroying that layout box pokes the URL bar.

If that happens inside `startViewTransition` (old capture → `display:none` in the callback → new capture), the transition is skipped (`SnapshotRootDidChangeSize`). Sibling: `01-android-vt-url-bar-aborts-transition.md`.

## Expected

No `window.resize` unless CSSOM viewport size changed. Unused `env(safe-area-inset-*)` on a covering box must not opt the page into controls updates. `display:none` / `remove()` must not skip a View Transition when JS sizes are unchanged. (`visibility:hidden` already keeps the layout box and is quiet.)

## Actual

URL bar **showing**, viewport `width=device-width, initial-scale=1` (no `viewport-fit=cover`):

| Overlay | resize on append | on `display:none` |
|---|---|---|
| `position:fixed; inset:0; overflow:hidden` | 0 | 0 |
| + `padding-top/bottom: env(safe-area-inset-*)` | 1 | 1 |
| unused `--x: calc(4rem + env(safe-area-inset-top, 0px))` | 1 | 1 |
| unused `--x: env(safe-area-inset-top)` (bare, not in `calc()`) | 0 | 0 |
| `top: env(safe-area-inset-top)` (not covering) | 0 | 0 |
| covering box, those props overridden to `0px` | 0 | 0 |

Logged `inner` / `vv` (and CDP layout metrics) are identical before and after. Emptying the overlay’s children still fires — it is the covering layout box.

`visibility:hidden` / `opacity:0` / shrinking the box → no resize.  
`display:none` / `remove()` → resize. Emulator: 2 fake `resize` events, size unchanged (`426×820`).

`viewport-fit=cover` uses a larger viewport (URL bar overlay/hidden, e.g. 844 vs 820) and this often does **not** fire.

## Steps

1. Chrome Android, tab in the foreground.
2. Open `02-safe-area-inset-fixed-overlay-fires-resize.html`. Stay at the top so the URL bar is showing.
3. Tap the blue button.

**Fail:** red `FAKE RESIZE` (size unchanged).  
**Pass:** green `OK  no resize`.

## Reduced test case

[`02-safe-area-inset-fixed-overlay-fires-resize.html`](./02-safe-area-inset-fixed-overlay-fires-resize.html)

## Notes

- Authors: put `env(safe-area-inset-*)` on inner chrome, not the fullscreen overlay; do not `display:none` that overlay between VT captures.
- Suggested fix: mentioning `env(safe-area-inset-*)` on a covering fixed box must not enqueue a viewport resize or controls update when inset values and FrameView size did not change. Unused `calc()` custom properties should not opt the page in.

## References

- Dynamic safe area insets: https://crbug.com/324436581
- I2S: https://groups.google.com/a/chromium.org/g/blink-dev/c/hXkimpjYaMg
- CSSOM `resize`: https://drafts.csswg.org/cssom-view/#event-resize
- VT skip on SCB resize: https://crbug.com/1404957
