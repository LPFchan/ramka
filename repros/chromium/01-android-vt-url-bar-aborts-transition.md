# Android Chrome: same-document View Transition aborts while the URL bar is animating

**File at:** https://issues.chromium.org/issues/new

**Suggested components:** `Blink>ViewTransitions`, `Internals>Views`

**OS:** Android 14 (Pixel 6 Pro; also Android Emulator)

**Chrome version:** 151 (stable). Also reproduced on the Mac Android emulator.

**Type:** Bug

---

## Title (paste)

Android: same-document View Transition aborts (`InvalidStateError`) while the URL bar is animating because the snapshot root includes browser-control outsets

---

## Summary

On Android Chrome, a same-document `document.startViewTransition()` is skipped with:

```
InvalidStateError: Transition was aborted because of invalid state
```

if capture runs while the **URL bar is still moving** (or while `window.innerHeight` and `window.visualViewport.height` disagree).

This is `ViewTransitionStyleTracker::SnapshotRootDidChangeSize` (skip if snapshot root changes by **>1px** between old/new capture, or during the animation). That skip is specified for a **real** snapshot-containing-block resize ([CSSWG #8045](https://github.com/w3c/csswg-drafts/issues/8045), implemented as [crbug 1404957](https://crbug.com/1404957)).

The bug is that **Android’s snapshot root is not invariant to URL-bar show/hide**, which contradicts Blink’s own View Transitions README.

Blink README ([viewport sizes](https://chromium.googlesource.com/chromium/src/+/HEAD/third_party/blink/renderer/core/view_transition/README.md)):

> The snapshot root is invariant with respect to whether viewport widgets are shown or not, neither its position nor its size change.

On Android (`ViewportEnabled`), `GetSnapshotRootInFixedViewport` is **FrameView size + browser-control outsets**. Outsets use `BrowserControls::TopShownRatio()` / `BottomShownRatio()`:

```cc
// TODO(bokan): This assumes any shown ratio implies controls are shown. We
// many need to do some synchronization to make this work seamlessly with
// URL bar animations.
```

(`view_transition_style_tracker.cc`, `GetFixedToSnapshotViewportOutsets`)

The FrameView vs LayoutView split is itself called a kludge in [eeefabc](https://github.com/chromium/chromium/commit/eeefabcd764a1ed3de9b0dcbd952de9fa0ca5474):

> TODO(bokan): Differing behavior based on ViewportEnabled is a bit of a kludge…

**Desktop Chromium and WebKit do not abort** in this situation.

There is no dedicated crbug that says “SPA morph dies when the Android URL bar animates.” It falls out of skip-on-resize + this Android SCB formula. [crbug 1404957](https://crbug.com/1404957) is the *skip*, not this invariant failure.

Related (cross-document, not this SPA case): [34b55ca](https://github.com/chromium/chromium/commit/34b55ca9b2e6045c65317cd82ac1337f7e63d4c4) “vt: Fix snapshots when browser controls are animating” — that CL cancels the controls animation for **navigation** capture. Same-document `startViewTransition()` does not get that treatment.

---

## Expected

A same-document View Transition should complete (~UA default duration) while the URL bar shows, hides, or is mid-animation. Snapshot root size should stay stable, per Blink’s README.

`window.innerHeight` vs `visualViewport.height` disagreeing (URL bar overlay vs layout viewport) should not skip the transition.

---

## Actual

- `transition.ready` rejects with `InvalidStateError: Transition was aborted because of invalid state`, **or**
- `ready` fulfills, then `finished` resolves in ~8–50ms with no morph (skipped after activation).

Typical JS sizes while it fails (Pixel / emulator, URL bar half-open):

| | |
|---|---|
| `window.innerHeight` | 867 |
| `visualViewport.height` | 923 |

(Exact numbers vary with device / bar position.)

---

## Steps to reproduce

1. Serve `01-android-vt-url-bar-aborts-transition.html` over HTTP (not `file://`).
2. Open it in **Chrome Android**. The page is taller than the screen.
3. **Show the URL bar** (scroll to top, or fling down). Confirm the live readout: `innerH` and `vvH` often differ.
4. Flick-scroll **just enough** that the URL bar starts moving. **Immediately** tap **Start view transition**.
5. Watch the log.

**Control:** wait until `innerH` and `vvH` agree and stay still, then tap. The transition should run a full duration.

Hidden Chrome tabs (`document.hidden`) reject every VT — keep the tab foreground.

---

## Reduced test case

Companion file: [`01-android-vt-url-bar-aborts-transition.html`](./01-android-vt-url-bar-aborts-transition.html)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Android VT abort — URL bar / snapshot root</title>
  <style>
    html, body { margin: 0; }
    body { font: 15px/1.4 system-ui; padding: 16px 16px 200vh; }
    #box { width: 96px; height: 96px; background: #1a73e8; view-transition-name: box; }
    body.on #box { background: #d93025; transform: translate(40vw, 20vh) scale(2); }
    pre { font: 12px/1.35 ui-monospace, monospace; white-space: pre-wrap; }
    .row { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
  </style>
</head>
<body>
  <h1>URL-bar View Transition abort</h1>
  <p>Chrome Android: flick-scroll the URL bar, then immediately start a VT. Expect <code>InvalidStateError</code> / ~8ms <code>finished</code> while <code>innerH</code> ≠ <code>vvH</code>.</p>
  <div class="row">
    <button id="go">Start view transition</button>
    <button id="clear">Clear log</button>
  </div>
  <div id="box"></div>
  <pre id="live"></pre>
  <pre id="log"></pre>
  <script>
    const live = document.getElementById('live');
    const logEl = document.getElementById('log');
    const box = document.getElementById('box');
    function snap() {
      const vv = window.visualViewport;
      return {
        inner: window.innerWidth + '×' + window.innerHeight,
        vv: vv ? Math.round(vv.width) + '×' + Math.round(vv.height) : 'n/a',
        aligned: !vv || Math.abs(window.innerHeight - vv.height) <= 1,
      };
    }
    function line(msg) {
      const s = snap();
      logEl.textContent += `[${Math.round(performance.now())}] ${msg}  inner=${s.inner} vv=${s.vv} aligned=${s.aligned}\n`;
    }
    function tick() {
      const s = snap();
      live.textContent = `inner=${s.inner}  vv=${s.vv}  aligned=${s.aligned}\nUA: ${navigator.userAgent}`;
      requestAnimationFrame(tick);
    }
    tick();
    window.addEventListener('resize', () => line('window.resize'));
    window.visualViewport?.addEventListener('resize', () => line('visualViewport.resize'));
    document.getElementById('go').onclick = async () => {
      if (typeof document.startViewTransition !== 'function') {
        line('no startViewTransition');
        return;
      }
      line('startViewTransition');
      const t0 = performance.now();
      const t = document.startViewTransition(() => {
        document.body.classList.toggle('on');
      });
      t.ready.then(
        () => line('ready-ok +' + Math.round(performance.now() - t0) + 'ms'),
        (e) => line('ready-REJECT ' + e.name + ': ' + e.message + ' +' + Math.round(performance.now() - t0) + 'ms'),
      );
      t.finished.then(() => line('finished +' + Math.round(performance.now() - t0) + 'ms (UA morph is ~300–400ms; <<100ms = skipped)'));
    };
    document.getElementById('clear').onclick = () => { logEl.textContent = ''; };
  </script>
</body>
</html>
```

---

## Additional information

**Product context:** lightbox: thumbnail morphs into a fullscreen `position: fixed` overlay via `startViewTransition`. Open after a tiny scroll (URL bar half-open) aborted the morph.

**Workaround:** wait until `innerHeight` and `visualViewport.height` agree and stay still for several frames before `startViewTransition`. Ugly, and still races if the bar starts moving during capture.

**Not this bug:**

- Orientation change / real window resize (specified skip).
- `document.hidden` (tabs in the background skip VT).
- Putting `env(safe-area-inset-*)` on a covering overlay (separate bug: `02-safe-area-inset-fixed-overlay-fires-resize.md`). That overlay can *start* a URL-bar twitch and then hit **this** abort.

**Suggested fix:** make `GetSnapshotRootSize()` actually invariant to browser-control shown-ratio on Android, matching the README (outset from fully-shown / fully-hidden extents, not the in-flight FrameView + partial ratio). Same-document capture should not see a >1px SCB change solely because the URL bar is mid-animation.

---

## References

- Blink VT README, “Viewport Sizes”: https://chromium.googlesource.com/chromium/src/+/HEAD/third_party/blink/renderer/core/view_transition/README.md
- `SnapshotRootDidChangeSize` / skip on resize: https://crbug.com/1404957 , https://github.com/chromium/chromium/commit/88681081ef075ce3afa154369d9afafab43bc82a
- CSSWG skip-on-SCB-resize: https://github.com/w3c/csswg-drafts/issues/8045
- Spec: https://drafts.csswg.org/css-view-transitions-1/#snapshot-containing-block
- Android SCB = FrameView + outsets: https://github.com/chromium/chromium/commit/eeefabcd764a1ed3de9b0dcbd952de9fa0ca5474
- Cross-document controls animation (does not cover SPA): https://github.com/chromium/chromium/commit/34b55ca9b2e6045c65317cd82ac1337f7e63d4c4
- Snapshot containing block vs layout viewport (author-facing): https://www.bram.us/2025/03/04/view-transitions-snapshot-containing-block/
