import { VIEW_TRANSITION_NAME } from './vt-constants';
import { LightboxDocumentCssVars, LightboxThumbnailStripCssVars } from './lightbox-css-vars';
import {
  LightboxDocumentDataAttributes,
  LightboxSlidesDataAttributes,
} from './lightbox-data-attributes';
import { VIEW_TRANSITION_PRESETS } from './vt-timing';
import { ensureLibrarySheet } from './vt-style-sheets';

// ---------------------------------------------------------------------------
// Injected structural view-transition styles.
//
// Everything a morph needs from CSS is mechanical — isolation, group clipping,
// snapshot fitting, var-driven timing — with zero skin decisions in it, so the
// library owns it. Consumers write NO view-transition CSS; skins may still
// read the library-written vars (`--lightbox-vt-*`, `data-ramka-vt-preset`)
// for their own fades.
//
// Override story: skins tune this through the `--lightbox-vt-*` custom
// properties every rule below reads, which works no matter where this sheet
// sits in the cascade. Overriding a rule outright needs higher specificity or
// `!important`, since the sheet is adopted and so sorts after consumer CSS —
// see lightbox-style-sheets.ts. The isolation rule's `!important` is load-bearing
// (see below) and should not be beaten at all.
// ---------------------------------------------------------------------------

const STYLE_MARKER = 'data-ramka-lightbox-vt-styles';

function buildCss(): string {
  const vt = LightboxDocumentDataAttributes.viewTransition;
  const isolate = LightboxDocumentDataAttributes.viewTransitionIsolate;
  const crossfade = LightboxDocumentDataAttributes.crossfade;
  const slides = LightboxSlidesDataAttributes.slides;
  const vars = LightboxDocumentCssVars;
  const def = VIEW_TRANSITION_PRESETS.default;
  const groupPseudo = `::view-transition-group(${VIEW_TRANSITION_NAME})`;
  const oldPseudo = `::view-transition-old(${VIEW_TRANSITION_NAME})`;
  const newPseudo = `::view-transition-new(${VIEW_TRANSITION_NAME})`;
  // Fallbacks mirror the default preset so the CSS is correct even if a rule
  // fires before promotion (it can't in practice — belt and braces).
  const duration = `var(${vars.vtDuration}, ${def.duration}ms)`;
  const easing = `var(${vars.vtEasing}, ${def.cssEasing})`;
  const closeEasing = `var(${vars.vtCrossfadeCloseEasing}, ${def.cssCrossfadeCloseEasing})`;
  const rootEasing = `var(${vars.vtRootEasing}, ${def.cssRootEasing})`;
  // Complementary dissolve as a fraction of the morph. After this, fill-mode
  // both holds old at 0 / new at 1 so a dissimilar trigger (avatar, +N
  // overlay) does not ghost through the size settle. Same clock on both
  // snapshots — plus-lighter stays opaque.
  const dissolveDuration = `calc(${duration} * 0.48)`;

  // Per-preset timing publication. The preset table is finite, so the timing
  // vars every rule below reads can be STATIC rules keyed on the
  // `data-ramka-vt-preset` attribute the morph sets — no per-morph stylesheet
  // delivery at all. Published on `::view-transition` (the pseudo-tree root,
  // inherited by every pseudo below it), never on `documentElement`: an
  // inherited custom property changing on `<html>` restyles the whole
  // document, which WebKit resolves with no fast path (tracked upstream,
  // WebKit PR #60512). And as static rules, never per-morph inserts: WebKit
  // full-restyles the document on any style-rule insert into an adopted sheet
  // (only @keyframes inserts are invalidation-scoped — see
  // buildMorphRadiusKeyframes in use-view-transition-morph.ts).
  const presetTimingRules = (
    Object.entries(VIEW_TRANSITION_PRESETS) as Array<
      [string, (typeof VIEW_TRANSITION_PRESETS)['default']]
    >
  )
    .map(
      ([name, spec]) => `:root[${LightboxDocumentDataAttributes.viewTransitionPreset}="${name}"]::view-transition {
  ${vars.vtDuration}: ${spec.duration}ms;
  ${vars.vtEasing}: ${spec.cssEasing};
  ${vars.vtCrossfadeCloseEasing}: ${spec.cssCrossfadeCloseEasing};
  ${vars.vtRootEasing}: ${spec.cssRootEasing};
}`,
    )
    .join('\n');

  return `
/* Preset timing — static per-preset publication (see above). */
${presetTimingRules}

/* Hard-cut snapshot opacities (Trigger omits crossfade), static per phase.
   The item is the single visible, animated layer in both directions and
   never crossfades the trigger. But on OPEN the old (trigger) snapshot stays
   opaque underneath as a paint fallback — never 0: the destination item is
   revealed inside the VT callback right before its snapshot is captured, and
   if that freshly revealed layer isn't rasterized in time the new snapshot
   is blank for a frame (a compositing race, worst on mobile Safari). With
   old hidden there'd be a one-frame flash of empty space; with old opaque, a
   blank new falls back to the trigger — and when new IS painted it fully
   occludes old, so the trigger is never seen animating. On CLOSE the old
   (item) snapshot is the visible layer and new (the trigger) is hard-cut to
   0 so a scrolled-away/unpainted trigger can't ghost over the item. */
:root[${vt}="opening"]:not([${crossfade}])::view-transition {
  ${vars.morphOldOpacity}: 1;
  ${vars.morphNewOpacity}: 1;
}
:root[${vt}="closing"]:not([${crossfade}])::view-transition {
  ${vars.morphOldOpacity}: 1;
  ${vars.morphNewOpacity}: 0;
}

/* Isolate the lightbox morph from the rest of the page. startViewTransition
   captures the WHOLE document, so any consumer element carrying its own
   view-transition-name would be lifted into a separate group and painted on
   the VT layer over the backdrop. Neutralize every name while the morph runs;
   the morph target re-declares its name inline with !important, which
   outranks this author-!important rule on specificity.

   Armed via its own attribute — NOT ${vt} — and only when the page actually
   declares foreign names (see vt-name-isolation.ts). Flipping a root
   attribute that a universal descendant rule keys on restyles the entire
   document, which on large DOMs is the dominant cost of starting a morph in
   WebKit; pages with no names to neutralize skip that bill entirely. */
:root[${isolate}] * {
  view-transition-name: none !important;
}

/* The morph-target hide rule (opacity zero plus its during-VT transition
   kill) is NOT in this sheet: it must exist before any morph runs — a page
   that server-renders an open lightbox has a morph target but no transition
   yet — so Lightbox.Trigger delivers it eagerly. See morph-target-hide.ts. */

@media (prefers-reduced-motion: no-preference) {
  /* Root snapshot cross-fade — the page-behind transition. Kept as a SINGLE
     root group: WebKit rasterizes each named group on the CPU. Lightbox
     chrome (thumbnails, zoom controls) fades with this snapshot — never as
     its own fullscreen named group. */
  :root[${vt}]::view-transition-old(root),
  :root[${vt}]::view-transition-new(root) {
    animation-duration: ${duration};
    animation-timing-function: ${rootEasing};
  }

  /* Shape morph is CSS-only: each morph inserts a same-name @keyframes rule
     carrying its CONCRETE from/to radii into the dynamic channel sheet (which
     sorts after this one, so it shadows this inert fallback — the last
     duplicate @keyframes name in cascade order wins). The group owns clipping
     for the whole transition; fill-mode "both" applies the from radius on
     frame 0, so no cascade base is needed. */
  @keyframes ramka-morph-border-radius {
    from, to {
      border-radius: 0px;
    }
  }

  ${groupPseudo} {
    overflow: hidden;
    animation-name: -ua-view-transition-group-anim-${VIEW_TRANSITION_NAME}, ramka-morph-border-radius;
    animation-duration: ${duration};
    animation-timing-function: ${easing};
    animation-fill-mode: both;
    z-index: 2;
  }

  /* Hard-cut default (Trigger omits crossfade). Cover keeps same-image crops
     coherent; kill the UA dissolve and drive opacity from library vars. */
  ${oldPseudo},
  ${newPseudo} {
    object-fit: cover;
    width: 100%;
    height: 100%;
    animation: none !important;
    mix-blend-mode: normal;
  }

  ${oldPseudo} {
    opacity: var(${vars.morphOldOpacity}, 1);
  }

  ${newPseudo} {
    opacity: var(${vars.morphNewOpacity}, 0);
  }

  /* Dissolve path (Trigger crossfade): restore the UA fade, plus-lighter
     blend, fill so circular triggers don't balloon under cover. Re-timed to
     the preset vars so the dissolve runs on the morph's clock (the UA
     default would end at 250ms, mid-morph). Open uses the morph ease-out so
     the destination appears promptly while the group grows; close uses a
     modest ease-out (not the morph curve — that flashes a stretched trigger
     in the first frames, and a strong ease-in holds the item too long).
     Both phases share one complementary 1→0 / 0→1 pair on a shorter window
     so the outgoing snapshot is gone before the size settle (a face or +N
     overlay must not ghost until t=1). Do not delay one snapshot relative
     to the other — that leaves a window where opacities no longer sum to 1.

     Fill-mode both: the UA fades run with fill none, so a finished fade
     snaps the old snapshot back to its base opacity of 1 — and the
     composited group replacement can outlive the fades by a frame (its
     animations attach one style flush later), which painted a fully-opaque
     trigger snapshot blended over the item for that frame. Holding the end
     state closes the gap. */
  :root[${crossfade}]${oldPseudo},
  :root[${crossfade}]${newPseudo} {
    object-fit: fill;
    mix-blend-mode: plus-lighter;
    animation: revert !important;
    animation-duration: ${dissolveDuration} !important;
    animation-timing-function: ${easing} !important;
    animation-fill-mode: both !important;
    opacity: revert;
  }

  :root[${vt}="closing"][${crossfade}]${oldPseudo},
  :root[${vt}="closing"][${crossfade}]${newPseudo} {
    animation-timing-function: ${closeEasing} !important;
  }
}

/* Thumb-jump slides crossfade — the element-scoped view transition started by
   ThumbnailStrip's selectViewTransition. Tunable via the select-vt vars. */
[${slides}]::view-transition-group(root) {
  animation-duration: var(${LightboxThumbnailStripCssVars.selectVtDuration}, 0.4s);
  animation-timing-function: var(${LightboxThumbnailStripCssVars.selectVtEasing}, cubic-bezier(0.22, 1, 0.36, 1));
}

[${slides}]::view-transition-old(root),
[${slides}]::view-transition-new(root) {
  mix-blend-mode: normal;
  height: 100%;
  overflow: clip;
}
`;
}

/**
 * Add the structural view-transition stylesheet once per document.
 *
 * Called when the morph engine starts a transition (client only — safe under
 * SSR). Delivered as a constructed stylesheet so it survives a strict CSP; see
 * vt-style-sheets.ts for what that costs in cascade order.
 *
 * All selectors are gated behind transition-time attributes or lightbox part
 * markers, so timing can never flash unstyled content.
 */
function ensureVtStructuralStyles(): void {
  // Prepend only applies to the <style> fallback; an adopted sheet always
  // sorts last regardless.
  ensureLibrarySheet(STYLE_MARKER, buildCss, true);
}

export { ensureVtStructuralStyles };
