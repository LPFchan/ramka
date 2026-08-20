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

Requires the **URL bar to be showing**. With the bar fully hidden (larger `innerHeight`, e.g. 891 vs 867 on the same device), the overlay often does **not** fire.

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

1. Serve `02-safe-area-inset-fixed-overlay-fires-resize.html` over HTTP.
2. Open in **Chrome Android**. Keep the **URL bar visible** (do not fling it away). Confirm `innerH` is the “bar showing” height.
3. Tap **Run A/B**.
4. A failing log line is `window.resize` whose `inner` / `vv` numbers **did not change**.
5. Tap **VT close (env overlay)** — unmounts the env overlay inside the VT callback. Expect skip (`finished` ≪ 100ms) vs **VT close (plain overlay)** which should morph.

If A/B is quiet, the URL bar is probably hidden — scroll to top and retry. The standalone tab with bar hidden (e.g. `innerHeight` 891) often does not fire; the same overlay on a scrolled page with bar showing does.

---

## Reduced test case

Companion file: [`02-safe-area-inset-fixed-overlay-fires-resize.html`](./02-safe-area-inset-fixed-overlay-fires-resize.html)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Android env(safe-area-inset) overlay → fake resize</title>
  <style>
    html, body { margin: 0; }
    body { font: 15px/1.4 system-ui; padding: 16px 16px 200vh; }
    .overlay {
      position: fixed; inset: 0; overflow: hidden;
      background: rgba(0,0,0,.35); z-index: 10;
    }
    .env-pad {
      padding-top: env(safe-area-inset-top, 0px);
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }
    .env-var {
      --lightbox-inset-top: calc(4rem + env(safe-area-inset-top, 0px));
      --lightbox-inset-bottom: calc(4rem + env(safe-area-inset-bottom, 0px));
    }
    .env-bare { --x: env(safe-area-inset-top); }
    pre { font: 12px/1.35 ui-monospace, monospace; white-space: pre-wrap; }
    .row { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
    #thumb { width: 96px; height: 64px; background: #1a73e8; }
  </style>
</head>
<body>
  <h1>env() overlay fake resize</h1>
  <p>Chrome Android + URL bar <strong>visible</strong>. Plain overlay should be 0/0. env() padding or unused <code>calc(... + env())</code> custom props should fire <code>window.resize</code> with unchanged sizes.</p>
  <div id="thumb"></div>
  <div class="row">
    <button data-kind="plain">Plain overlay</button>
    <button data-kind="env-pad">env() padding</button>
    <button data-kind="env-var">unused calc+env() vars</button>
    <button data-kind="env-bare">unused bare env() var</button>
    <button id="ab">Run A/B</button>
    <button id="vt-env">VT close (env overlay)</button>
    <button id="vt-plain">VT close (plain overlay)</button>
    <button id="clear">Clear</button>
  </div>
  <pre id="live"></pre>
  <pre id="log"></pre>
  <script>
    const logEl = document.getElementById('log');
    const live = document.getElementById('live');
    let overlay = null;
    let resizeCount = 0;
    function sizes() {
      const vv = window.visualViewport;
      return {
        inner: window.innerWidth + '×' + window.innerHeight,
        vv: vv ? Math.round(vv.width) + '×' + Math.round(vv.height) : 'n/a',
      };
    }
    function line(msg) {
      const s = sizes();
      logEl.textContent += `[${Math.round(performance.now())}] ${msg}  inner=${s.inner} vv=${s.vv} resizes=${resizeCount}\n`;
    }
    function tick() {
      const s = sizes();
      live.textContent = `inner=${s.inner}  vv=${s.vv}\nUA: ${navigator.userAgent}`;
      requestAnimationFrame(tick);
    }
    tick();
    window.addEventListener('resize', () => { resizeCount++; line('window.resize'); });
    window.visualViewport?.addEventListener('resize', () => line('visualViewport.resize'));
    function mount(kind) {
      unmount(false);
      overlay = document.createElement('div');
      overlay.className = 'overlay' + (kind === 'plain' ? '' : ' ' + kind);
      overlay.dataset.kind = kind;
      document.body.append(overlay);
      line('append ' + kind);
    }
    function unmount(none) {
      if (!overlay) return;
      const kind = overlay.dataset.kind;
      if (none) overlay.style.display = 'none';
      else overlay.remove();
      overlay = null;
      line((none ? 'display:none ' : 'remove ') + kind);
    }
    document.querySelectorAll('[data-kind]').forEach((btn) => {
      btn.onclick = () => {
        if (overlay) unmount(true);
        else mount(btn.dataset.kind);
      };
    });
    document.getElementById('ab').onclick = async () => {
      logEl.textContent = '';
      resizeCount = 0;
      for (const kind of ['plain', 'env-pad', 'env-var', 'env-bare']) {
        line('--- ' + kind);
        mount(kind);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        unmount(true);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      }
    };
    async function vtClose(kind) {
      if (typeof document.startViewTransition !== 'function') { line('no VT'); return; }
      mount(kind);
      overlay.style.visibility = 'hidden';
      document.getElementById('thumb').style.viewTransitionName = 'photo';
      const t0 = performance.now();
      const t = document.startViewTransition(() => {
        document.getElementById('thumb').style.viewTransitionName = '';
        overlay.style.visibility = 'visible';
        overlay.style.viewTransitionName = 'photo';
      });
      await t.finished;
      line('open finished +' + Math.round(performance.now() - t0) + 'ms');
      const t1 = performance.now();
      const tClose = document.startViewTransition(() => {
        overlay.style.viewTransitionName = '';
        document.getElementById('thumb').style.viewTransitionName = 'photo';
        overlay.style.display = 'none';
      });
      tClose.ready.then(
        () => line('close ready-ok'),
        (e) => line('close ready-REJECT ' + e.name + ': ' + e.message),
      );
      await tClose.finished;
      line('close finished +' + Math.round(performance.now() - t1) + 'ms (<<100ms = skipped)');
      document.getElementById('thumb').style.viewTransitionName = '';
      unmount(false);
    }
    document.getElementById('vt-env').onclick = () => vtClose('env-var');
    document.getElementById('vt-plain').onclick = () => vtClose('plain');
    document.getElementById('clear').onclick = () => { logEl.textContent = ''; resizeCount = 0; };
  </script>
</body>
</html>
```

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
