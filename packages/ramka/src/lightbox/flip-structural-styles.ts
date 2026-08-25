import { LightboxTriggerDataAttributes } from './lightbox-data-attributes';
import { ensureLibrarySheet } from './vt-style-sheets';

// ---------------------------------------------------------------------------
// Injected structural styles for the FLIP morph.
//
// Almost nothing, compared to vt-structural-styles.ts — and that is the point.
// A FLIP morph animates real elements, so there are no pseudo-element
// contracts to declare: no name isolation (nothing captures the document), no
// snapshot sizing/blending rules, no root-snapshot retiming. The geometry,
// radius and dissolve all arrive as inline styles + WAAPI keyframes from
// flip-morph.ts.
//
// What is left is the one rule both engines need: hide the live trigger while
// something else is painting its pixels.
// ---------------------------------------------------------------------------

const STYLE_MARKER = 'data-ramka-lightbox-flip-styles';

/**
 * Document marker for an in-flight FLIP morph, mirroring
 * `data-ramka-view-transition`'s `opening` / `closing` values.
 *
 * Deliberately a *separate* attribute rather than reusing that one: skins carry
 * workarounds keyed on it that only make sense for a snapshot (the stories
 * preset flattens 3D-transformed neighbours because Safari's VT capture
 * ignores `backface-visibility`, for instance). Live elements don't need them,
 * and firing those rules here would be a behaviour difference that has nothing
 * to do with the morph being compared.
 *
 * Not a member of `LightboxDocumentDataAttributes` while the engine is behind a
 * flag — that enum is the generated public attribute contract.
 */
const FLIP_ATTR = 'data-ramka-flip';

function buildCss(): string {
  const morphTarget = LightboxTriggerDataAttributes.morphTarget;

  return `
/* Hide the live morph source while the destination element is painting its
   pixels, so the trigger never shows doubled underneath the morph. Identical
   to the view-transition sheet's rule — including killing the fade-back
   mid-morph: on open the destination starts exactly on top of the trigger and
   only ever grows away from it, and on close it lands back on top, so both
   handovers happen fully occluded. A 200ms fade would be visible either side
   of that. */
[${morphTarget}] {
  opacity: 0;
  transition: opacity 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

:root[${FLIP_ATTR}] [${morphTarget}] {
  transition: none;
}
`;
}

/**
 * Add the FLIP structural stylesheet once per document.
 *
 * Called as a morph starts (client only). Delivered as a constructed
 * stylesheet so it survives a strict CSP — see lightbox-style-sheets.ts.
 */
function ensureFlipStructuralStyles(): void {
  // Prepend only applies to the <style> fallback; an adopted sheet always
  // sorts last regardless.
  ensureLibrarySheet(STYLE_MARKER, buildCss, true);
}

export { ensureFlipStructuralStyles, FLIP_ATTR };
