// ---------------------------------------------------------------------------
// Foreign `view-transition-name` detection.
//
// The morph's isolation rule (`:root[data-ramka-vt-isolate] * {
// view-transition-name: none !important }`, see vt-structural-styles.ts)
// exists to keep consumer-named elements out of the capture — but arming a
// universal descendant rule via a root attribute invalidates style for the
// ENTIRE document. On large pages that recalculation is the dominant cost of
// starting a morph in WebKit (Blink resolves inherited-prop/attribute
// invalidation far more cheaply). Most pages declare no view-transition-names
// of their own, so the rule would neutralize nothing; detecting that case and
// leaving the rule unarmed removes the whole-document restyle without
// changing behavior on pages where isolation actually matters.
// ---------------------------------------------------------------------------

/**
 * Whether a declaration value counts as a foreign name. `none` declarations
 * are inert for capture purposes — this also skips the library's own
 * isolation rule when scanning `document.adoptedStyleSheets`.
 */
function isForeignNameValue(value: string): boolean {
  const v = value.trim();
  return v !== '' && v.toLowerCase() !== 'none';
}

/**
 * Recursive, duck-typed rule walk: style rules (including CSS nesting) via
 * `style`, grouping rules (`@media`, `@supports`, `@layer`, keyframes) via
 * `cssRules`, `@import` via `styleSheet`.
 */
function ruleDeclaresName(rule: CSSRule): boolean {
  const style = (rule as CSSStyleRule).style as CSSStyleDeclaration | undefined;
  if (style && isForeignNameValue(style.getPropertyValue('view-transition-name'))) {
    return true;
  }
  const child = (rule as CSSImportRule).styleSheet as CSSStyleSheet | null | undefined;
  if (child && sheetDeclaresName(child)) return true;
  const rules = (rule as CSSGroupingRule).cssRules as CSSRuleList | undefined;
  if (rules) {
    for (const nested of Array.from(rules)) {
      if (ruleDeclaresName(nested)) return true;
    }
  }
  return false;
}

function sheetDeclaresName(sheet: CSSStyleSheet): boolean {
  let rules: CSSRuleList;
  try {
    rules = sheet.cssRules;
  } catch {
    // Cross-origin sheet — unreadable. Treat as name-free: view-transition
    // names are app CSS (same-origin/inline in practice), while cross-origin
    // sheets are font/icon/widget CSS. Assuming the worst here would arm the
    // full-document isolation restyle for every page that loads any CDN
    // stylesheet, which is exactly the cost this module exists to avoid.
    return false;
  }
  for (const rule of Array.from(rules)) {
    if (ruleDeclaresName(rule)) return true;
  }
  return false;
}

/** Exported for tests: scan an arbitrary sheet list. */
export function sheetsDeclareViewTransitionName(
  sheets: Iterable<CSSStyleSheet>,
): boolean {
  for (const sheet of sheets) {
    if (sheetDeclaresName(sheet)) return true;
  }
  return false;
}

/**
 * Stylesheet scans are memoized on the sheet-list shape. Adding/removing a
 * sheet re-scans; editing rules inside an existing sheet via CSSOM does not
 * (acceptably conservative — pages that insertRule a view-transition-name
 * mid-session are vanishingly rare, and the failure mode is cosmetic: their
 * element rides the morph as its own group instead of being neutralized).
 */
let cache: { key: string; result: boolean } | null = null;

function sheetListKey(doc: Document): string {
  return `${doc.styleSheets.length}/${doc.adoptedStyleSheets?.length ?? 0}`;
}

/** Test-only: reset the memoized stylesheet scan. */
export function resetNameIsolationCache(): void {
  cache = null;
}

/**
 * Whether the page carries `view-transition-name`s the morph must neutralize.
 *
 * Inline styles are re-checked on every call (a single attribute-substring
 * query — microseconds even on large DOMs, and it also catches names our own
 * interrupted morphs may have left behind, where arming isolation is the
 * correct conservative answer). Stylesheets are scanned once and memoized —
 * see {@link cache}.
 */
export function pageNeedsNameIsolation(doc: Document = document): boolean {
  if (doc.querySelector('[style*="view-transition-name"]')) return true;
  const key = sheetListKey(doc);
  if (cache && cache.key === key) return cache.result;
  const result =
    sheetsDeclareViewTransitionName(Array.from(doc.styleSheets)) ||
    sheetsDeclareViewTransitionName(doc.adoptedStyleSheets ?? []);
  cache = { key, result };
  return result;
}
