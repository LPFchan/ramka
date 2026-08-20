# Chromium bug reports (Android View Transitions)

Two engine bugs found while shipping ramka lightbox morphs on **Pixel 6 Pro / Android 14 / Chrome 151** (same on the Mac Android emulator). Desktop Chrome and Safari/WebKit do not hit them.

These are **not** “skip on real window resize.” That skip is specified ([CSSWG #8045](https://github.com/w3c/csswg-drafts/issues/8045), [crbug 1404957](https://crbug.com/1404957)). The bugs are that Android Chrome **treats URL-bar motion and overlay teardown as a snapshot-root resize** even when the page’s JS viewport has not changed.

| # | File | File at | One-line |
|---|------|---------|----------|
| 1 | [01-android-vt-url-bar-aborts-transition.md](./01-android-vt-url-bar-aborts-transition.md) | [issues.chromium.org](https://issues.chromium.org/issues/new) | SPA View Transition aborts while the Android URL bar is animating (`SnapshotRootDidChangeSize`) |
| 2 | [02-safe-area-inset-fixed-overlay-fires-resize.md](./02-safe-area-inset-fixed-overlay-fires-resize.md) | same | `env(safe-area-inset-*)` on a covering `position: fixed` fires `window.resize` with unchanged sizes and can skip a VT |

Each markdown is meant to be pasted into a **new Chromium issue** (one issue per file). Companion `.html` files are the reduced cases.

With `pnpm dev` running, open these on Chrome Android (URL bar visible, tab in the foreground):

- Launcher: `/debug/chromium`
- [1. URL bar aborts View Transition](/debug/chromium-url-bar.html) — same bytes as `01-android-vt-url-bar-aborts-transition.html`
- [2. env(safe-area-inset) overlay fires resize](/debug/chromium-safe-area-resize.html) — same bytes as `02-safe-area-inset-fixed-overlay-fires-resize.html`

Those two URLs are static files under `apps/docs/public/debug/` (no Next layout). If you edit a repro HTML, copy it to both places.

Do not file these as one bug. #2 can *trigger* #1, but a half-open URL bar aborts a morph with no `env()` at all.
