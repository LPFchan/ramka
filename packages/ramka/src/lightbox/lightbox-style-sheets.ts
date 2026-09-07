// ---------------------------------------------------------------------------
// Delivering the library's view-transition CSS without an inline <style>.
//
// A constructed stylesheet is CSSOM, not markup, so CSP's `style-src` never
// sees it: no nonce, no `unsafe-inline`, and it applies cleanly under
// `style-src 'self'; style-src-attr 'none'` — the strictest style policy there
// is. Verified on Chrome 151 and WebKit 26.5, including that an adopted sheet
// styles the `::view-transition-*` pseudo tree, which is the part that had to
// hold for any of this to be worth doing.
//
// It matters most for the per-transition morph keyframes, whose content is
// computed fresh from measured geometry on every open. A hash allowlist can
// never cover those, so before this the only options were `unsafe-inline` or a
// broken morph.
//
// Cascade note: adopted sheets sort AFTER every document stylesheet, where the
// old <style> element was PREPENDED to <head> to sort before them. So ramka now
// wins a head-on tie that a consumer used to win. The documented override
// surface is unaffected — a consumer setting `--lightbox-vt-*` still reaches
// these rules, because custom-property resolution does not care where the
// consuming rule was declared — and `!important` still beats our normal
// declarations. What changes is that our own `!important` rules got harder to
// outrank, which for the load-bearing isolation rule is the direction we want.
//
// Everything here runs on the view-transition path only, and View Transitions
// (Chrome 111, Safari 18.2) postdate constructed stylesheets (Chrome 73,
// Safari 16.4, Firefox 101) in every shipping engine — so no browser can reach
// this code without support. The <style> fallback is for jsdom, which ships the
// CSSStyleSheet constructor but not `replaceSync`.
// ---------------------------------------------------------------------------

interface LibrarySheet {
  release(): void;
}

const NOOP: LibrarySheet = { release() {} };

function supportsConstructedSheets(): boolean {
  return (
    typeof CSSStyleSheet === 'function' &&
    typeof CSSStyleSheet.prototype.replaceSync === 'function' &&
    document.adoptedStyleSheets != null
  );
}

function adopt(css: string): LibrarySheet {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  // Assigned rather than pushed: the mutable-array form of adoptedStyleSheets
  // is newer than the property itself, and assignment works on both.
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  return {
    release() {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
    },
  };
}

function appendStyleElement(css: string, marker: string, prepend: boolean): LibrarySheet {
  const el = document.createElement('style');
  el.setAttribute(marker, '');
  el.textContent = css;
  if (prepend) document.head.insertBefore(el, document.head.firstChild);
  else document.head.appendChild(el);
  return {
    release() {
      el.remove();
    },
  };
}

/**
 * Add a sheet the caller will remove again — the per-media fill rules and the
 * per-transition morph keyframes, both scoped to something that goes away.
 */
function insertLibrarySheet(css: string, marker: string): LibrarySheet {
  if (typeof document === 'undefined') return NOOP;
  return supportsConstructedSheets() ? adopt(css) : appendStyleElement(css, marker, false);
}

// `ensureLibrarySheet` lives in its own module (vt-style-sheets.ts) because
// its once-per-document, never-removed semantics are the opposite of this
// module's caller-removes contract. (Both now ship in the eager bundle:
// Trigger imports `ensureLibrarySheet` for the morph-target hide rule.)
export { adopt, appendStyleElement, insertLibrarySheet, supportsConstructedSheets };
export type { LibrarySheet };
