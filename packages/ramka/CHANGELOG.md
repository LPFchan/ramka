# Changelog

All notable changes to `@ramka/react` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Server-rendered open lightboxes are now first-class: `Lightbox.Media`'s
  fill rules and the morph-target hide rule ship in server HTML (as deduped
  hoistable `<style>` tags on React 19), so a page that server-renders an open
  viewer (e.g. a Next.js deep link with `Portal container={null}`) letterboxes
  correctly and hides the active trigger on the very first paint. Strict-CSP
  environments keep the previous CSSOM-only delivery.
- `Lightbox.ThumbnailStrip` exposes `data-positioned` once the track has been
  positioned against the Slides scroller, so skins can hide the strip until it
  cannot paint at a stale offset (relevant to server-rendered open pages).
- `Lightbox.Slides ssrSlideShift`: server-rendered open lightboxes paint the
  deep-linked slide — not slide 0 — before hydration. A scroll offset cannot
  be serialized into HTML, so the server HTML instead carries a transform that
  translates every slide by `activeIndex × (100% + gap)`; hydration swaps the
  real scroll offset in and drops the transform in the same pre-paint commit.
  The stand-in renders exclusively for server paint + hydration (a
  `useSyncExternalStore` hydration check) and suppresses scroll snap while
  applied — both matter: writing the real scroll offset under still-translated
  slides lets engines with scroll-snap target tracking (Chromium) capture the
  slide *visually* at that offset (slide `2×index`) and silently re-align to
  it once the transform leaves, committing the wrong index. Opt-in, for
  scrollport-wide (bleed) tracks only; mirror the track's `gap` into
  `--lightbox-ssr-slide-gap`. RTL-aware.
- Independent of the opt-in, `Lightbox.Item` now marks the active item in
  server HTML (`data-ssr-active`) and `Lightbox.Slides` ships a
  `scroll-initial-target` rule for it, so engines that support the property
  (Chromium) scroll a server-rendered open lightbox to the correct slide
  before first paint for ANY slide widths — including content-sized (snug)
  layouts the transform shift cannot serve. Other engines keep the
  hydration-time jump.
- `Lightbox.CSPProvider`: pass your page's per-request CSP nonce and every
  inline `<style>` tag the library renders (media fill, morph-target hide,
  SSR initial slide) carries it, so strict `style-src` policies keep the
  first-paint rules instead of falling back to post-hydration CSSOM delivery.
  Wrap it around everything that renders lightbox parts, including detached
  `Lightbox.Trigger`s outside any Root. Server-rendered tags additionally
  need the nonce on the render call (React 19.2+
  `renderToPipeableStream(el, { nonce: { style } })`); client-inserted tags
  carry it unconditionally. See the Content Security Policy docs page.

### Changed

- **The active trigger is now visually hidden while the lightbox is open on
  every path, including `viewTransition={false}`, browsers without the View
  Transition API, and low-end devices.** Previously the
  `[data-morph-target] { opacity: 0 }` rule only existed after the first
  morph of the session, so non-View-Transition consumers never saw the hide.
  The rule now ships eagerly, making "the trigger is hidden while its item is
  active" the contract everywhere — consistent cross-browser, and required for
  server-rendered open pages. To opt back into a visible active trigger,
  override with a higher-specificity rule (the delivered rule is
  single-attribute specificity): e.g.
  `.my-grid [data-morph-target] { opacity: 1; transition: none; }`.

### Fixed

- `scrollTriggerIntoView` `onChange` scrolls were silently cancelled when a
  consumer re-render landed inside the 120ms debounce (typical for controlled,
  URL-synced galleries passing inline config literals). The config is now read
  through a ref and resolved at fire time (#81).

## [0.0.1] - 2026-09-02

Initial public release. The API is early (`0.0.x`) and may still change.

### Added

- Headless, unstyled Lightbox primitives for React 18 and 19: `Root`, `Trigger`, `Portal`, `Backdrop`, `Content`, `Stage`, `Slides`, `Slide`, `Item`, `Media`, `Zoom`, `ZoomIn`, `ZoomOut`, `Previous`, `Next`, `Close`, `Counter`, `Caption`, `ThumbnailGroup`, `Thumbnail`, `ThumbnailStrip`, `ThumbnailStripTrack`.
- Shared-element View Transition morph from trigger to item (and back), with a crossfade fallback where the View Transition API is missing or reduced motion is requested.
- Native CSS scroll-snap slides rather than a transform-emulated carousel, including RTL.
- Pinch, double-tap, trackpad, and keyboard zoom with pan, rubber-banding, and snap-back.
- Pull-to-dismiss on touch and trackpad, interruptible and aware of zoom and in-flight swipes.
- Zero installed runtime dependencies. Morph, zoom, and pull engines lazy-load on demand.
- Dual license: GPL-3.0-only, or a paid proprietary license ([ramka.dev/license](https://ramka.dev/license)). Declare the one in use on `Lightbox.Root` with `license="gpl"` or `license="commercial"`.
- CycloneDX SBOM shipped as `sbom.cdx.json`. Releases are published from GitHub Actions with npm provenance.

[0.0.1]: https://github.com/arturbien/ramka/releases/tag/v0.0.1
