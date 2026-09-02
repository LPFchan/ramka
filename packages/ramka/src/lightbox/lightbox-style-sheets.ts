import { LightboxDocumentDataAttributes } from './lightbox-data-attributes';
import { scheduleWarmUp } from './schedule-warm-up';

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

// ---------------------------------------------------------------------------
// Dynamic rule channels — how SHORT-LIVED css (per-media fill rules, per-morph
// vars, per-transition keyframes) reaches the document.
//
// The naive delivery — one constructed sheet per insertion, adopted and later
// removed — makes WebKit restyle the ENTIRE document on every open and close.
// Measured on a 16k-element page (Safari/WebKit 26, ~2020 MacBook):
//
// - Any `document.adoptedStyleSheets` array change once a sheet containing
//   @keyframes is adopted (ramka's structural sheet is): full-document
//   restyle, ~110ms. Both directions — adding AND removing.
// - `CSSStyleSheet.insertRule` IS invalidation-analyzed and scoped (0–4ms),
//   but only when a single sheet is mutated per style flush, and only when
//   @keyframes and style rules are not mixed into the same sheet.
// - `CSSStyleSheet.deleteRule` is never analyzed: always a full restyle.
// - `CSSStyleDeclaration.setProperty` on an existing rule: always a full
//   restyle (so rules are inserted/deleted, never mutated).
//
// Blink/Gecko scope all of these fine; WebKit is the design constraint. Hence:
//
// - One PERSISTENT sheet per concern ("channel"), all adopted in a single
//   assignment (one one-time churn, ideally pre-paid at idle warm-up via
//   {@link prewarmDynamicStyleSheets}). Keyframes get their own channel so
//   they never share a sheet with style rules.
// - Insertions go through `insertRule` on the channel's sheet.
// - Deletions are deferred to idle time and batched — the unavoidable full
//   restyle they cause in WebKit lands when nothing is animating, instead of
//   inside a morph's capture window. Until then stale rules are inert: every
//   dynamic rule is scoped (per-media ids, `::view-transition` pseudos,
//   uniquely-named keyframes), and a successor rule for the same purpose
//   sorts later in the sheet, winning the cascade tie.
//
// Callers that need several batches in one task (the composited morph inserts
// keyframes AND a vars rule) must force a style flush between channels to keep
// WebKit's one-analyzed-sheet-per-flush fast path — see vt-composited-morph.ts.
// ---------------------------------------------------------------------------

type DynamicSheetChannel = 'media-fill' | 'morph-vars' | 'morph-keyframes' | 'composited-vars';

const DYNAMIC_CHANNELS: readonly DynamicSheetChannel[] = [
  'media-fill',
  'morph-vars',
  'morph-keyframes',
  'composited-vars',
];

let channelSheets: Map<DynamicSheetChannel, CSSStyleSheet> | null = null;

function ensureChannelSheets(): Map<DynamicSheetChannel, CSSStyleSheet> | null {
  if (typeof document === 'undefined' || !supportsConstructedSheets()) return null;
  if (channelSheets) return channelSheets;
  channelSheets = new Map();
  const sheets: CSSStyleSheet[] = [];
  for (const channel of DYNAMIC_CHANNELS) {
    const sheet = new CSSStyleSheet();
    channelSheets.set(channel, sheet);
    sheets.push(sheet);
  }
  // One assignment for all channels: every adopted-array change is a
  // full-document restyle in WebKit, so they are never adopted one by one.
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, ...sheets];
  return channelSheets;
}

/**
 * Pre-pay the one-time adopted-array churn for the dynamic channels at a
 * harmless moment (idle warm-up) instead of inside the first open.
 */
function prewarmDynamicStyleSheets(): void {
  ensureChannelSheets();
}

/** Rules whose owners released them, awaiting the idle deletion batch. */
const pendingRuleDeletes = new Set<CSSRule>();
let ruleCleanupScheduled = false;

function flushPendingRuleDeletes(): void {
  ruleCleanupScheduled = false;
  if (pendingRuleDeletes.size === 0 || !channelSheets) return;
  // Never during a morph: `deleteRule` is a full-document restyle in WebKit
  // and would stall the capture or the running animation. Stale rules are
  // inert (see the channel docblock), so waiting is free.
  if (document.documentElement.hasAttribute(LightboxDocumentDataAttributes.viewTransition)) {
    scheduleRuleCleanup();
    return;
  }
  for (const sheet of channelSheets.values()) {
    for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
      if (pendingRuleDeletes.has(sheet.cssRules[i]!)) sheet.deleteRule(i);
    }
  }
  pendingRuleDeletes.clear();
}

function scheduleRuleCleanup(): void {
  if (ruleCleanupScheduled) return;
  ruleCleanupScheduled = true;
  scheduleWarmUp(flushPendingRuleDeletes);
}

/**
 * Add short-lived rules the caller will release again. Constructed-sheet path:
 * `insertRule` into the channel's persistent sheet now, batched `deleteRule`
 * at idle after release. Fallback (jsdom): a marker-attributed <style> element
 * per call, removed synchronously on release.
 */
function insertDynamicRules(
  channel: DynamicSheetChannel,
  rules: readonly string[],
  marker: string,
): LibrarySheet {
  if (typeof document === 'undefined') return NOOP;
  const sheets = ensureChannelSheets();
  if (!sheets) return appendStyleElement(rules.join('\n'), marker, false);

  const sheet = sheets.get(channel)!;
  const inserted: CSSRule[] = [];
  for (const rule of rules) {
    try {
      const index = sheet.insertRule(rule, sheet.cssRules.length);
      inserted.push(sheet.cssRules[index]!);
    } catch {
      // The engine refused the rule text (unknown selector/at-rule syntax).
      // Skip it — every dynamic rule is a progressive enhancement over a
      // still-working baseline (stock morph, intrinsic media sizing).
    }
  }
  let released = false;
  return {
    release() {
      if (released) return;
      released = true;
      for (const rule of inserted) pendingRuleDeletes.add(rule);
      scheduleRuleCleanup();
    },
  };
}

/**
 * Test hook: forget the channel sheets and pending deletions. jsdom tests stub
 * `document.adoptedStyleSheets` per test, which would otherwise leave the
 * cached channels adopted into a discarded array.
 */
function resetDynamicSheetChannelsForTests(): void {
  channelSheets = null;
  pendingRuleDeletes.clear();
  ruleCleanupScheduled = false;
}

// `ensureLibrarySheet` lives in its own module (vt-style-sheets.ts) so the
// once-only machinery stays in the lazy morph chunk instead of riding along in
// the eager bundle, which only needs the dynamic channels for Media.
export {
  adopt,
  appendStyleElement,
  insertDynamicRules,
  prewarmDynamicStyleSheets,
  resetDynamicSheetChannelsForTests,
  supportsConstructedSheets,
};
export type { DynamicSheetChannel, LibrarySheet };
