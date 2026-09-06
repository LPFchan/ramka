import * as React from 'react';

/**
 * `<style href precedence>` hoistables shipped in React 19: hoisted into
 * `<head>` (server and client) and deduped by `href`, so constant-text rules
 * cost one tag per document forever. React 18 has no hoisting — the element
 * renders IN PLACE, once per component instance: a 200-trigger grid would ship
 * ~200 identical inline `<style>` tags (tens of KB of server HTML), register
 * as many live stylesheets, and shift consumers' structural selectors
 * (`:nth-child` and friends) by one preceding sibling per part.
 *
 * So the hoistable delivery is gated to React 19+. React 18 keeps the
 * CSSOM-only delivery every release before the hoistables shipped — one
 * unstyled server paint on pages that server-render an open lightbox, exactly
 * the React 18 baseline consumers already had. The check is version-stable,
 * so server and client always agree and hydration stays clean.
 */
const REACT_SUPPORTS_STYLE_HOISTING = Number.parseInt(React.version, 10) >= 19;

export { REACT_SUPPORTS_STYLE_HOISTING };
