import {
  LightboxDocumentDataAttributes,
  LightboxTriggerDataAttributes,
} from './lightbox-data-attributes';

// ---------------------------------------------------------------------------
// Morph-target hide — the rule that keeps the live trigger invisible while its
// item is active (and while the VT layer owns its pixels during a morph).
//
// This used to live in the injected VT structural sheet, which only loads when
// the morph engine starts a transition. That left a real gap: a page that
// server-renders an open lightbox (deep links with `Portal container={null}`)
// hydrates with `data-morph-target` set but NO transition has run yet, so no
// rule hid the trigger — it stayed visible behind the viewer until the first
// morph of the session. Extracted here so `Lightbox.Trigger` can deliver it
// eagerly on every page that renders a trigger:
//
// - a hoistable `<style href precedence>` (constant text — dedupes to one tag
//   across all triggers and remounts) puts it in server HTML for a correct
//   first paint, and
// - a CSSOM copy (see `ensureLibrarySheet`) covers strict-CSP environments
//   that refuse the inline tag.
//
// The fade-back transition covers the close handover; it is killed DURING a
// transition so it can't be captured mid-flight in the root snapshot.
// ---------------------------------------------------------------------------

/** Marker for the `<style>` fallback in environments without CSSOM sheets. */
const MORPH_TARGET_HIDE_MARKER = 'data-ramka-morph-target-hide';

/** `href` of the hoistable `<style>` rendered by every Trigger (React dedupes). */
const MORPH_TARGET_HIDE_HREF = 'ramka-morph-target-hide';

const MORPH_TARGET_HIDE_CSS =
  `[${LightboxTriggerDataAttributes.morphTarget}]{` +
  `opacity:0;transition:opacity 200ms cubic-bezier(0.16, 1, 0.3, 1);` +
  `}` +
  `:root[${LightboxDocumentDataAttributes.viewTransition}] ` +
  `[${LightboxTriggerDataAttributes.morphTarget}]{transition:none;}`;

export { MORPH_TARGET_HIDE_CSS, MORPH_TARGET_HIDE_HREF, MORPH_TARGET_HIDE_MARKER };
