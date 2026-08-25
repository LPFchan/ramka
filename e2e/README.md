# Browser tests

Real-browser coverage for the parts of the lightbox that jsdom cannot execute:
View Transitions, zoom, touch gestures and pull to dismiss.

Run them with `pnpm test:e2e` (build first — `pnpm test:e2e:build`).

## The matrix, and why each row is here

| Project          | Engine                | Flips                                    |
| ---------------- | --------------------- | ---------------------------------------- |
| `chromium`       | Desktop Chrome        | baseline morph, zoom, wheel              |
| `webkit`         | Desktop Safari        | `GestureEvent` → the Safari morph paths  |
| `firefox`        | Desktop Firefox (153) | `isFirefox()` → the Gecko VT workarounds |
| `android-chrome` | Pixel 7 (Chromium)    | `isAndroidBlinkSnapshotRoot()` + touch   |
| `ios-safari`     | iPhone 15 (WebKit)    | WebKit **with** touch, mobile viewport   |

Each row also asserts **which composited-morph path** it takes: WebKit gets
generated CSS animations, every other engine gets WAAPI. Without that, a silent
fall back to the stock morph would look exactly like success. The stock path is
covered too, via the library's own `?vtstock` escape hatch — which is also what
proves those assertions discriminate rather than pass vacuously.

The mobile rows are not duplicates of the desktop ones. They exist because the
library branches on the platform, and those branches are unreachable otherwise —
`isAndroidBlinkSnapshotRoot()` is what makes close hold the overlay mounted until
`finished` and makes open wait for the URL-bar settle, and nothing on desktop
turns it on.

## What this does not cover

Worth stating plainly, because the project names invite the wrong conclusion.

**These are emulated viewports in automation builds, not devices.** Playwright's
WebKit is not Safari, and a Chromium with a Pixel 7 user agent is not Android
Chrome. What the mobile projects verify is that the platform-specific _code paths
execute and behave_, not that the platform bugs they exist to work around are
actually defeated.

Specifically still unverified, and needing a real device:

- **The iOS Safari address-bar interaction.** `vt-touch-guard` exists because
  panning during a morph makes Safari expand its address bar and resize the
  viewport mid-transition. Headless WebKit has no address bar, so the bug cannot
  be reproduced and the guard cannot be shown to work.
- **Real Android Blink compositing.** Same shape of problem: no URL bar to move,
  so the snapshot-root abort the settle wait prevents never occurs here.
- **Genuinely low-end hardware.** `low-end-device.spec.ts` covers the branch by
  overriding the two navigator hints the gate reads, which is faithful to the
  gate but says nothing about how the morph performs on a slow device.
- **Firefox on Android**, which has its own gate combination (`isFirefox()` true,
  `isAndroidBlinkSnapshotRoot()` false) and no Playwright project.

Closing those needs a device lab or a device cloud, driven against a deployed
build. Until then they are manual checks before a release.

## Layout

- `*.spec.ts` — desktop projects.
- `mobile/` — phone viewport with touch. Note the zoom buttons and thumbnail
  strip are hidden below `md` in the demo gallery, so these specs drive gestures
  and the Close button instead.
- `mobile/touch/` — needs a real touch sequence, which means CDP, which means
  Chromium. The `ios-safari` project ignores this directory. A synthetic-event
  fallback was considered and rejected: it would test our own event dispatch
  rather than the browser's gesture handling.

## Two Playwright bugs worked around

Both are automation-tool limits, not library limits.

- Horizontal `mouse.wheel` segfaults Playwright's WebKit — the process dies and
  the failure surfaces on whatever spec runs next. Scoped to a single
  `test.skip`, because vertical wheel is fine there (the ctrl+wheel zoom test
  uses it).
- `touchscreen` can only tap, so drags go through
  `Input.dispatchTouchEvent` over CDP.
