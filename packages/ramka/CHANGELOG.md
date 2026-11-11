# Changelog

All notable changes to `@ramka/react` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- `Lightbox.Slides` no longer lands on another slide when the window is
  resized or a phone is rotated. After the relayout the browser's own
  re-centring `scroll` and `scrollend` arrive before ResizeObserver callbacks,
  and were read against the old slide geometry; deep in a gallery that picked
  a slide up to a dozen or more away. Slides now notices the viewport size
  changed when those events arrive and re-measures and re-pins the active
  slide first.

## [0.0.2] - 2026-11-09

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
  translates every slide by `activeIndex × (100% + gap)`; the post-hydration
  commit retires the transform, writes the real scroll offset, and re-notifies
  scroll-linked chrome (ThumbnailStrip holds `data-positioned` back while the
  shift is on), all in one commit — and a stray pre-retire frame is
  pixel-identical to the real offset by construction. The real offset
  is never written while the stand-in is applied and the stand-in renders
  exclusively for server paint + hydration (a `useSyncExternalStore` hydration
  check), with scroll snap suppressed while it is on — each guard closes a
  real engine interaction: WebKit includes transformed boxes in the
  scrollable-overflow area, so under the shift `scrollWidth` shrinks and a
  jump gets clamped slides short (Safari painted the wrong slide and strip
  until a later correction); Chromium's scroll-snap target tracking captures
  the slide _visually_ at a written offset and re-aligns to it — the wrong
  slide — once the transform leaves; and Gecko restores element scroll
  offsets across reloads before first paint, so while the shift is on the
  scrollport is not a scroll container at all (`overflow: clip` on both
  axes — restored offset + transform had double-shifted Firefox reloads to
  slide 2×index, or to the blank region past the preload window). Opt-in,
  for scrollport-wide (bleed) tracks only; mirror the track's `gap` into
  `--lightbox-ssr-slide-gap`. RTL-aware.
- Independent of the opt-in, `Lightbox.Item` now marks the active item in
  server HTML (`data-ssr-active`) and `Lightbox.Slides` ships a
  `scroll-initial-target` rule for it, so engines that support the property
  (Chromium) scroll a server-rendered open lightbox to the correct slide
  before first paint for ANY slide widths — including content-sized (snug)
  layouts the transform shift cannot serve. Other engines keep the
  hydration-time jump. All SSR stamps (`data-ssr-shift`, `data-ssr-active`,
  the trigger's `data-morph-target`) are rendered by the hydration pass too
  and retired right after, so they hydrate without React 19's
  attribute-mismatch warning. **Migration note:** if you hand-rolled a first-paint
  transform stand-in for SSR-open pages (the pattern the URL-synced state example
  demonstrated before this release), delete it and pass `ssrSlideShift`
  instead — on Chromium the new native initial scroll and a custom transform
  would BOTH move the track, painting a blank until hydration. The library
  suppresses `scroll-initial-target` under its own `data-ssr-shift` only.
- `Lightbox.Root count`: the total number of items, used until the mounted
  `Lightbox.Item`s have registered themselves. Registration happens in
  effects, which never run during server rendering (and land only after the
  first client paint), so a page that renders an open lightbox before then
  painted `Lightbox.Counter` as "6 / 0" and boundary-disabled `Lightbox.Next`
  / `Lightbox.Previous` (with `loop` off). Pass the item total to make that
  first paint correct; the live registry takes over the moment any item
  mounts, so a stale value can't outlive hydration.
- `Lightbox.Caption` children are now the pre-registration fallback: rendered
  only while the caption registry is empty (server paints, and the first
  client paint of an already-open lightbox — items register captions in
  effects, which run after it). Pass the initially-active item's caption so
  deep-link pages paint it on first paint. The moment any item registers,
  the registry wins and the fallback never renders again. Previously children
  passed to `Lightbox.Caption` were silently discarded.
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

- Navigation and open/close commits no longer re-render the whole gallery.
  `Lightbox.Item`, `Lightbox.Trigger`, and `Lightbox.Thumbnail` — the parts a
  gallery renders once per photo — used to read `open`/`activeIndex` straight
  from the root context, so every index change re-rendered all of them: O(n)
  React work per swipe, and a visible pre-transition freeze at ~1000 items
  (the view-transition open/close wraps its commit in `flushSync`, so that
  work sat directly on the morph's snapshot capture). These parts now
  subscribe to derived primitives ("am I active", "am I in the preload
  window") via `useSyncExternalStore`, so a navigation commit re-renders
  O(preload) parts regardless of gallery size, and the open/close flush drops
  the per-item work that isn't part of its contract (all triggers still
  re-render on open/close — they flip `data-*-open` and `aria-controls`).
  No API changes; render-prop timing of `active`/`visible` is unchanged
  within each commit.
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
- Licensed under the MIT License. The `license` prop on `Lightbox.Root` and the `LicenseType` export are removed.

### Fixed

- Safari 18.4 and earlier: morphs from a CSS multicol gallery now start
  and land on the clicked trigger, including tiles outside the first
  column. WebKit captured fragmented boxes at their pre-fragmentation
  position; the composited morph re-anchors that endpoint to the live
  element (#90).
- Android Chrome: morphs no longer open shifted up by the expanded
  address bar. The multicol correction above now runs only on WebKit.
  Blink's view-transition translate is already in snapshot space, and
  rewriting it from a viewport rect moved the morph by the bar height
  (#92).
- Open/close morphs no longer stall the main thread on pages with a large DOM
  (most visible in Safari — e.g. a docs page with thousands of links and a
  single-image lightbox). The morph pipeline used to write per-morph CSS custom
  properties inline on `<html>` and adopt/un-adopt stylesheets around every
  transition; in WebKit each of those is a full-document restyle, which showed
  up as 75–175ms freezes before, during, and after the animation. Timing
  presets and snapshot opacities now live in static rules published on the
  `::view-transition` pseudo-element (keyed off the existing root attributes),
  the border-radius pair is written inline only when its value actually
  changes, `Lightbox.Media`'s fill rules are adopted once per document instead
  of per mount, and the composited-morph WebKit path delivers its per-morph
  `@keyframes` through one persistent constructed stylesheet (keyframe inserts
  don't trigger a document restyle in WebKit) with cleanup deferred to idle
  time. No API changes.
- `scrollTriggerIntoView` `onChange` scrolls were silently cancelled when a
  consumer re-render landed inside the 120ms debounce (typical for controlled,
  URL-synced galleries passing inline config literals). The config is now read
  through a ref and resolved at fire time (#81).
- iOS Safari: touching the slides mid rubber-band bounce (e.g. overscrolling
  past the first slide, then starting a pull-to-dismiss during the bounce-back)
  froze every scroll-gated gesture — pull, pinch, thumbnails, keyboard — until
  the next gesture that happened to scroll. WebKit can drop `scrollend` when a
  bounce-back overlaps a touch that doesn't itself scroll, and that event was
  the only release for the in-flight-swipe lock. When the last finger lifts
  while the lock is held, a quiet-gap fallback now guarantees the release;
  `scrollend` remains the fast path and trackpad semantics are unchanged (#83).

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

[0.0.2]: https://github.com/arturbien/ramka/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/arturbien/ramka/releases/tag/v0.0.1
