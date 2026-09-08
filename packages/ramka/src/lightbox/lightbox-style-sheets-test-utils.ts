// jsdom ships the CSSStyleSheet constructor but neither `replaceSync` nor
// `document.adoptedStyleSheets`, so the library falls back to a <style> element
// there. This stub stands in for a browser that has both, which is the only way
// to assert the CSP guarantee: that nothing reaches the document as markup.

const CSS_TEXT = new WeakMap<CSSStyleSheet, string>();
const CSS_RULES = new WeakMap<CSSStyleSheet, string[]>();

interface ConstructedSheetsStub {
  /** CSS of every adopted sheet, in cascade order. */
  adoptedCss(): string[];
  restore(): void;
}

function stubConstructedSheets(): ConstructedSheetsStub {
  const proto = CSSStyleSheet.prototype;
  const previousReplaceSync = 'replaceSync' in proto ? proto.replaceSync : undefined;
  const previousInsertRule = Object.getOwnPropertyDescriptor(proto, 'insertRule');
  const previousDeleteRule = Object.getOwnPropertyDescriptor(proto, 'deleteRule');
  const previousCssRules = Object.getOwnPropertyDescriptor(proto, 'cssRules');
  const rulesOf = (sheet: CSSStyleSheet): string[] => {
    let rules = CSS_RULES.get(sheet);
    if (!rules) CSS_RULES.set(sheet, (rules = []));
    return rules;
  };
  proto.replaceSync = function replaceSync(this: CSSStyleSheet, css: string) {
    CSS_TEXT.set(this, css);
    CSS_RULES.set(this, []);
  };
  // The composited morph inserts/deletes @keyframes on a constructed sheet
  // (rule-level ops are the only cheap mutation in WebKit); jsdom's cssom
  // cannot parse into a constructed sheet, so track rule text here too.
  Object.defineProperty(proto, 'insertRule', {
    configurable: true,
    writable: true,
    value(this: CSSStyleSheet, rule: string, index = 0) {
      rulesOf(this).splice(index, 0, rule);
      return index;
    },
  });
  Object.defineProperty(proto, 'deleteRule', {
    configurable: true,
    writable: true,
    value(this: CSSStyleSheet, index: number) {
      rulesOf(this).splice(index, 1);
    },
  });
  Object.defineProperty(proto, 'cssRules', {
    configurable: true,
    get(this: CSSStyleSheet) {
      return rulesOf(this);
    },
  });
  Object.defineProperty(document, 'adoptedStyleSheets', {
    configurable: true,
    writable: true,
    value: [] as CSSStyleSheet[],
  });

  return {
    adoptedCss: () =>
      document.adoptedStyleSheets.map(
        (sheet) => CSS_TEXT.get(sheet) ?? rulesOf(sheet).join('\n'),
      ),
    restore() {
      if (previousReplaceSync) proto.replaceSync = previousReplaceSync;
      else delete (proto as Partial<CSSStyleSheet>).replaceSync;
      for (const [name, desc] of [
        ['insertRule', previousInsertRule],
        ['deleteRule', previousDeleteRule],
        ['cssRules', previousCssRules],
      ] as const) {
        if (desc) Object.defineProperty(proto, name, desc);
        else delete (proto as unknown as Record<string, unknown>)[name];
      }
      delete (document as Partial<Document>).adoptedStyleSheets;
      // The once-per-document guard lives on `document`, which outlives a
      // single test; drop it so the next one starts clean.
      delete (document as unknown as Record<symbol, unknown>)[Symbol.for('ramka.vt.adoptedMarkers')];
    },
  };
}

export { stubConstructedSheets };
export type { ConstructedSheetsStub };
