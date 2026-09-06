import { adopt, appendStyleElement, supportsConstructedSheets } from './lightbox-style-sheets';

// The once-only sheets (view-transition structural styles, morph-target hide)
// are added once and never removed, unlike the per-media and per-transition
// ones. Historically this module only shipped in the lazily loaded morph
// chunk; since Trigger began delivering the morph-target hide rule eagerly it
// is part of the eager bundle on every page with a trigger (~40 lines, and
// its transitive imports were already eager via Media). It stays a separate
// module because the once-per-document semantics differ from
// lightbox-style-sheets.ts's caller-removes contract, not for chunking.

// Global so two copies of the library in one document still add the once-only
// sheets once, which is what the old `querySelector` guard gave us.
const ADOPTED_MARKERS = Symbol.for('ramka.vt.adoptedMarkers');

type MarkedDocument = Document & { [ADOPTED_MARKERS]?: Set<string> };

function adoptedMarkers(doc: MarkedDocument): Set<string> {
  return (doc[ADOPTED_MARKERS] ??= new Set());
}

/**
 * Add a sheet for the lifetime of the document, at most once per marker.
 *
 * `buildCss` is only called when the sheet is actually needed, so a repeat call
 * costs nothing.
 */
function ensureLibrarySheet(marker: string, buildCss: () => string, prepend = false): void {
  if (typeof document === 'undefined') return;
  if (supportsConstructedSheets()) {
    // An adopted sheet carries no attributes to look for, so the marker set
    // stands in for querying the document.
    const markers = adoptedMarkers(document);
    if (markers.has(marker)) return;
    markers.add(marker);
    adopt(buildCss());
    return;
  }
  if (document.head.querySelector(`style[${marker}]`)) return;
  appendStyleElement(buildCss(), marker, prepend);
}

export { ensureLibrarySheet };
