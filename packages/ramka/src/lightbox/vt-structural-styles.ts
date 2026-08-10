import { VIEW_TRANSITION_NAME } from './lightbox-context';
import { LightboxDocumentCssVars, LightboxThumbnailStripCssVars } from './lightbox-css-vars';
import {
  LightboxDocumentDataAttributes,
  LightboxSlidesDataAttributes,
  LightboxTriggerDataAttributes,
} from './lightbox-data-attributes';
import { VIEW_TRANSITION_PRESETS } from './vt-timing';

// ---------------------------------------------------------------------------
// Injected structural view-transition styles.
//
// Everything a morph needs from CSS is mechanical — isolation, group clipping,
// snapshot fitting, var-driven timing — with zero skin decisions in it, so the
// library owns it. Consumers write NO view-transition CSS; skins may still
// read the library-written vars (`--lightbox-vt-*`, `data-ramka-vt-preset`)
// for their own fades.
//
// Override story: the <style> element is PREPENDED to <head>, so any consumer
// stylesheet loads after it and wins ties by source order (or trivially by
// specificity). The lone exception is the isolation rule's `!important`, which
// is load-bearing (see below) and should not be casually beaten.
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
  const rootEasing = `var(${vars.vtRootEasing}, ${def.cssRootEasing})`;

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
     root group: WebKit rasterizes each named group on the CPU. */
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
     the preset vars so the dissolve runs on the morph's clock/curve (the UA
     default would end at 250ms, mid-morph). Fill-mode both: the UA fades run
     with fill none, so a finished fade snaps the old snapshot back to its
     base opacity of 1 — and the composited group replacement can outlive the
     fades by a frame (its animations attach one style flush later), which
     painted a fully-opaque trigger snapshot blended over the item for that
     frame. Holding the end state closes the gap. */
  :root[${crossfade}]${oldPseudo},
  :root[${crossfade}]${newPseudo} {
    object-fit: fill;
    mix-blend-mode: plus-lighter;
    animation: revert !important;
    animation-duration: ${duration} !important;
    animation-timing-function: ${easing} !important;
    animation-fill-mode: both !important;
    opacity: revert;
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
 * Inject the structural view-transition stylesheet once per document.
 *
 * Called from `Lightbox.Root` on mount (client only — safe under SSR). The
 * <style> element is inserted at the START of <head> so every consumer
 * stylesheet cascades after it: overriding any injected default takes an
 * ordinary CSS rule of equal specificity, no `!important` fights.
 *
 * All selectors are gated behind transition-time attributes or lightbox part
 * markers, so injection timing can never flash unstyled content.
 */
function ensureVtStructuralStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.head.querySelector(`style[${STYLE_MARKER}]`)) return;
  const style = document.createElement('style');
  style.setAttribute(STYLE_MARKER, '');
  style.textContent = buildCss();
  document.head.insertBefore(style, document.head.firstChild);
}

export { ensureVtStructuralStyles };
