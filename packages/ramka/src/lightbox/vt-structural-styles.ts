import { VIEW_TRANSITION_NAME, VT_COMPOSITOR_HOLD_ATTR } from './vt-constants';
import { LightboxDocumentCssVars, LightboxThumbnailStripCssVars } from './lightbox-css-vars';
import {
  LightboxDocumentDataAttributes,
  LightboxSlidesDataAttributes,
  LightboxTriggerDataAttributes,
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
  const crossfade = LightboxDocumentDataAttributes.crossfade;
  const morphTarget = LightboxTriggerDataAttributes.morphTarget;
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

  return `
/* Isolate the lightbox morph from the rest of the page. startViewTransition
   captures the WHOLE document, so any consumer element carrying its own
   view-transition-name would be lifted into a separate group and painted on
   the VT layer over the backdrop. Neutralize every name while the morph runs;
   the morph target re-declares its name inline with !important, which
   outranks this author-!important rule on specificity. */
:root[${vt}] * {
  view-transition-name: none !important;
}

/* Hide the live morph source while the VT layer owns its pixels (the library
   sets ${morphTarget} on the resolved morph element). Without this the
   original trigger shows doubled under the morphing snapshot. The fade-back
   covers the close handover; it is killed DURING the transition so it can't
   be captured mid-flight in the root snapshot. */
[${morphTarget}] {
  opacity: 0;
  transition: opacity 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

:root[${vt}] [${morphTarget}] {
  transition: none;
}

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

  /* Shape morph is CSS-only: JS writes the from/to radius vars; the group
     owns clipping for the whole transition. The 'from' radius is the cascade
     base (not only a keyframe) so frame 0 can't flash the 0px fallback. */
  @keyframes ramka-morph-border-radius {
    to {
      border-radius: var(${vars.morphBorderRadiusTo}, 0px);
    }
  }

  ${groupPseudo} {
    overflow: hidden;
    border-radius: var(${vars.morphBorderRadiusFrom}, 0px);
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

  /* Compositor hold (Android Blink) — set by the composited morph BEFORE the
     pseudo tree's first commit, released in the same commit that installs the
     replacement animations (or on any bail back to the stock morph). A paused
     animation never ticks on the compositor, so the swap window between
     capture and upgrade cannot paint torn frames: without this, Chrome runs
     the UA transform track and the opacity dissolves on the compositor while
     the box and the overflow clip stay main-threaded, and a close-time stall
     renders the photo as a hard-cut slice (stale clip), makes it vanish, or
     completes a crossfade dissolve against frozen geometry. Held frames show
     the exact from-state, i.e. the fully-open lightbox. Placed after the
     crossfade rules so it beats their \`animation: revert !important\` at
     equal specificity. */
  :root[${VT_COMPOSITOR_HOLD_ATTR}]${groupPseudo},
  :root[${VT_COMPOSITOR_HOLD_ATTR}]${oldPseudo},
  :root[${VT_COMPOSITOR_HOLD_ATTR}]${newPseudo},
  :root[${VT_COMPOSITOR_HOLD_ATTR}]::view-transition-old(root),
  :root[${VT_COMPOSITOR_HOLD_ATTR}]::view-transition-new(root) {
    animation-play-state: paused !important;
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
