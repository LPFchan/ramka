# Chromium bug reports (Android View Transitions)

Found while working on a lightbox component library. Two bugs on **Pixel 6 Pro / Android 14 / Chrome 151** (same on the Mac emulator). Desktop Chrome and Safari do not hit them.

Skip-on-real-resize is specified ([CSSWG #8045](https://github.com/w3c/csswg-drafts/issues/8045), [crbug 1404957](https://crbug.com/1404957)). These are Android treating URL-bar motion / overlay teardown as a snapshot-root resize when JS viewport size has not changed.

| # | Report | Reduced HTML |
|---|--------|----------------|
| 1 | [01-android-vt-url-bar-aborts-transition.md](./01-android-vt-url-bar-aborts-transition.md) | [01-….html](./01-android-vt-url-bar-aborts-transition.html) — tap the photo |
| 2 | [02-safe-area-inset-fixed-overlay-fires-resize.md](./02-safe-area-inset-fixed-overlay-fires-resize.md) | [02-….html](./02-safe-area-inset-fixed-overlay-fires-resize.html) — tap the button |

File as **two issues**. #2 can trigger #1; a half-open URL bar also aborts with no `env()`.

`pnpm dev`, Chrome Android, URL bar showing, no `viewport-fit=cover`:

- `/debug/chromium`
- `/debug/chromium-url-bar.html` (copy of 01)
- `/debug/chromium-safe-area-resize.html` (copy of 02)

Static files live under `apps/docs/public/debug/`. Edit the HTML in both places.
