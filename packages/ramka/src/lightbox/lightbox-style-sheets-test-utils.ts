// jsdom ships the CSSStyleSheet constructor but neither `replaceSync` nor
// `document.adoptedStyleSheets`, so the library falls back to a <style> element
// there. This stub stands in for a browser that has both, which is the only way
// to assert the CSP guarantee: that nothing reaches the document as markup.
//
// It also stubs `insertRule` / `deleteRule` / `cssRules` (as a stable array of
// `{ cssText }` objects), because the dynamic rule channels deliver their
// short-lived CSS through CSSOM rule mutation rather than whole sheets — see
// lightbox-style-sheets.ts.

import { resetDynamicSheetChannelsForTests } from './lightbox-style-sheets';

const CSS_TEXT = new WeakMap<CSSStyleSheet, string>();
const RULES = new WeakMap<CSSStyleSheet, { cssText: string }[]>();

interface ConstructedSheetsStub {
  /** CSS of every adopted sheet (replaceSync text + inserted rules), in cascade order. */
  adoptedCss(): string[];
  restore(): void;
}

const STUBBED_KEYS = ['replaceSync', 'insertRule', 'deleteRule', 'cssRules'] as const;

function sheetRules(sheet: CSSStyleSheet): { cssText: string }[] {
  let rules = RULES.get(sheet);
  if (!rules) {
    rules = [];
    RULES.set(sheet, rules);
  }
  return rules;
}

function stubConstructedSheets(): ConstructedSheetsStub {
  const proto = CSSStyleSheet.prototype;
  const previous = STUBBED_KEYS.map(
    (key) => [key, Object.getOwnPropertyDescriptor(proto, key)] as const,
  );

  Object.defineProperties(proto, {
    replaceSync: {
      configurable: true,
      writable: true,
      value(this: CSSStyleSheet, css: string) {
        CSS_TEXT.set(this, css);
      },
    },
    insertRule: {
      configurable: true,
      writable: true,
      value(this: CSSStyleSheet, rule: string, index = 0) {
        sheetRules(this).splice(index, 0, { cssText: rule });
        return index;
      },
    },
    deleteRule: {
      configurable: true,
      writable: true,
      value(this: CSSStyleSheet, index: number) {
        sheetRules(this).splice(index, 1);
      },
    },
    cssRules: {
      configurable: true,
      get(this: CSSStyleSheet) {
        return sheetRules(this);
      },
    },
  });

  Object.defineProperty(document, 'adoptedStyleSheets', {
    configurable: true,
    writable: true,
    value: [] as CSSStyleSheet[],
  });

  return {
    adoptedCss: () =>
      document.adoptedStyleSheets.map((sheet) =>
        [CSS_TEXT.get(sheet) ?? '', ...sheetRules(sheet).map((rule) => rule.cssText)]
          .filter(Boolean)
          .join('\n'),
      ),
    restore() {
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(proto, key, descriptor);
        else delete (proto as unknown as Record<string, unknown>)[key];
      }
      delete (document as Partial<Document>).adoptedStyleSheets;
      // The once-per-document guard lives on `document`, which outlives a
      // single test; drop it so the next one starts clean. Same for the
      // module-level channel sheets, adopted into the array just deleted.
      delete (document as unknown as Record<symbol, unknown>)[Symbol.for('ramka.vt.adoptedMarkers')];
      resetDynamicSheetChannelsForTests();
    },
  };
}

export { stubConstructedSheets };
export type { ConstructedSheetsStub };
