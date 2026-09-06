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

/**
 * The hoistable element itself, typed once for the whole library. `href` and
 * `precedence` on `<style>` exist only in `@types/react` 19 — under the
 * React 18 typecheck leg the raw JSX fails even though the element never
 * renders there (every use sits behind the version gate above). The cast is
 * the whole trick: it IS `'style'`, so React 19 hoists it exactly as if the
 * intrinsic had been written inline. `nonce` is plain HTMLAttributes and
 * typed in both majors, but rides along here for the same call sites.
 */
interface HoistableStyleProps {
  href: string;
  precedence: string;
  nonce?: string | undefined;
  children: string;
}

const HoistableStyle = 'style' as unknown as React.FunctionComponent<HoistableStyleProps>;

export { HoistableStyle, REACT_SUPPORTS_STYLE_HOISTING };
