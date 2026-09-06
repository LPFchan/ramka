import {
  LightboxItemDataAttributes,
  LightboxSlideDataAttributes,
  LightboxSlidesDataAttributes,
} from './lightbox-data-attributes';
import { LightboxSlidesCssVars } from './lightbox-css-vars';

// ---------------------------------------------------------------------------
// SSR initial slide — first-paint positioning for pages that server-render an
// OPEN lightbox (deep links rendering `Portal container={null}`).
//
// A scroller's scroll offset cannot be serialized into HTML, so a
// server-rendered open viewer always paints with the track at offset 0: the
// wrong slide (or a blank one, past the `preload` window) until hydration
// jumps the scroller. Two cooperating strategies close that gap:
//
// 1. `scroll-initial-target` (automatic, any layout, Chromium-only for now).
//    `Lightbox.Item` stamps `data-ssr-active` on the active item during server
//    rendering; the rule below tells the browser to scroll the nearest
//    scroller (the Slides scrollport) to it during initial layout — before
//    first paint, with full knowledge of every slide's real width, so it works
//    for content-sized (snug) layouts too. Engines without the property
//    ignore it and keep the hydration-jump behavior.
//
// 2. The transform shift (`Slides ssrSlideShift`, opt-in, every browser,
//    scrollport-wide slides only). While `data-ssr-shift` is on the
//    scrollport, every slide is translated by
//    `activeIndex × (100% + gap) × sign` — `translateX` percentages resolve
//    against the slide's own width, which in a bleed layout IS the scrollport,
//    so the active slide lands at scroll offset 0 exactly, with no measuring.
//    The library writes `--lightbox-ssr-index` and the direction sign inline;
//    the consumer mirrors the track's `gap` into `--lightbox-ssr-slide-gap`
//    (the one thing CSS cannot read by itself). Slides removes the attribute
//    in its mount layout effect right after the real scroll jump — same
//    commit, one paint, no flash. Transforms don't affect scroll geometry or
//    the `offsetLeft` measurements Slides uses, so nothing else notices.
//
// When both are active (Chromium + opt-in), the shift wins: the second rule
// disables `scroll-initial-target`, otherwise the browser's initial scroll
// AND the transform would each move the track one slide-distance — showing a
// blank. The shift is kept as the winner because it is the strategy that
// works everywhere, so first paint is identical across browsers.
//
// Delivery: a hoistable `<style href precedence>` from `Lightbox.Slides`
// (React 19+, deduped by href — see react-style-hoisting.ts). There is
// deliberately NO CSSOM fallback copy: these rules only matter for the server
// paint, and both attributes are gone by the end of the hydration commit, so
// a client-injected copy could never match anything. Where the tag is
// unavailable (React 18) or refused (strict CSP), the feature degrades to
// the pre-existing behavior — correct slide after the hydration jump.
// ---------------------------------------------------------------------------

/** `href` of the hoistable `<style>` rendered by Slides (React dedupes). */
const SSR_INITIAL_SLIDE_HREF = 'ramka-ssr-initial-slide';

const SSR_INITIAL_SLIDE_CSS =
  // Strategy 1: browser-computed initial scroll to the active item.
  `[${LightboxItemDataAttributes.ssrActive}]{scroll-initial-target:nearest;}` +
  // Strategy 2 overrides strategy 1 — both moving the track would double-shift.
  `[${LightboxSlidesDataAttributes.ssrShift}] ` +
  `[${LightboxItemDataAttributes.ssrActive}]{scroll-initial-target:none;}` +
  // Strategy 2: the transform shift (scrollport-wide slides only).
  `[${LightboxSlidesDataAttributes.ssrShift}] [${LightboxSlideDataAttributes.slide}]{` +
  `transform:translateX(calc(` +
  `var(${LightboxSlidesCssVars.ssrIndex},0) * ` +
  `var(${LightboxSlidesCssVars.ssrShiftSign},-1) * ` +
  `(100% + var(${LightboxSlidesCssVars.ssrSlideGap},0px))` +
  `));` +
  `}`;

export { SSR_INITIAL_SLIDE_CSS, SSR_INITIAL_SLIDE_HREF };
