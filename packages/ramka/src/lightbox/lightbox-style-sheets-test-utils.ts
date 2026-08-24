// jsdom ships the CSSStyleSheet constructor but neither `replaceSync` nor
// `document.adoptedStyleSheets`, so the library falls back to a <style> element
// there. This stub stands in for a browser that has both, which is the only way
// to assert the CSP guarantee: that nothing reaches the document as markup.

const CSS_TEXT = new WeakMap<CSSStyleSheet, string>();

interface ConstructedSheetsStub {
  /** CSS of every adopted sheet, in cascade order. */
  adoptedCss(): string[];
  restore(): void;
}

function stubConstructedSheets(): ConstructedSheetsStub {
  const proto = CSSStyleSheet.prototype;
  const previousReplaceSync = 'replaceSync' in proto ? proto.replaceSync : undefined;
  proto.replaceSync = function replaceSync(this: CSSStyleSheet, css: string) {
    CSS_TEXT.set(this, css);
  };
  Object.defineProperty(document, 'adoptedStyleSheets', {
    configurable: true,
    writable: true,
    value: [] as CSSStyleSheet[],
  });

  return {
    adoptedCss: () => document.adoptedStyleSheets.map((sheet) => CSS_TEXT.get(sheet) ?? ''),
    restore() {
      if (previousReplaceSync) proto.replaceSync = previousReplaceSync;
      else delete (proto as Partial<CSSStyleSheet>).replaceSync;
      delete (document as Partial<Document>).adoptedStyleSheets;
      // The once-per-document guard lives on `document`, which outlives a
      // single test; drop it so the next one starts clean.
      delete (document as unknown as Record<symbol, unknown>)[Symbol.for('ramka.vt.adoptedMarkers')];
    },
  };
}

export { stubConstructedSheets };
export type { ConstructedSheetsStub };
