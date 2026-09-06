'use client';

import * as React from 'react';

/**
 * Carries the per-request CSP style nonce to every part that renders a
 * hoistable `<style>` tag (`Lightbox.Media`, `Lightbox.Trigger`,
 * `Lightbox.Slides`). A dedicated context — NOT a `Lightbox.Root` prop — so a
 * single provider above the whole app also reaches detached Triggers rendered
 * outside any Root (the handle pattern). That coverage matters beyond the
 * detached tag itself: hoistables dedupe by `href`, and under a nonce-enforced
 * render a tag instance without the nonce is dropped by React, so one
 * uncovered Trigger can degrade a rule every covered instance relies on.
 */
const LightboxCSPContext = React.createContext<string | undefined>(undefined);

/** Style nonce for hoistable `<style>` tags; `undefined` outside a provider. */
function useLightboxStyleNonce(): string | undefined {
  return React.useContext(LightboxCSPContext);
}

interface LightboxCSPProviderProps {
  /**
   * The per-request CSP nonce (the value behind `'nonce-…'` in the
   * `style-src` / `style-src-elem` directive). Stamped on every inline
   * `<style>` tag the lightbox renders so strict-CSP pages keep the
   * first-paint rules (media fill, active-trigger hide, SSR initial slide).
   */
  nonce?: string;
  children?: React.ReactNode;
}

/**
 * Provides the CSP nonce for the inline `<style>` tags Ramka renders —
 * mirrors Base UI's `CSPProvider`. Wrap it around everything that renders
 * lightbox parts (typically the app root), including detached
 * `Lightbox.Trigger`s living outside a `Lightbox.Root`.
 *
 * Server rendering contract (React 19.2+): React only emits the nonce on
 * hoisted styles when the SAME value is also passed to the render call —
 * `renderToPipeableStream(el, { nonce: { style } })` (frameworks own this
 * call; in Next.js the nonce comes from CSP middleware). With the provider
 * alone the tags render without a nonce; with the render option alone React
 * drops the un-nonced tags. Older React (18–19.1) ignores the nonce prop on
 * precedence styles, which simply keeps today's baseline: the tag is refused
 * under strict CSP and the CSSOM fallback (invisible to CSP) covers
 * everything after hydration.
 *
 * Only the three constant-text hoistables are affected. Ramka's runtime
 * styling goes through constructed stylesheets, which CSP does not police,
 * so no nonce is needed there.
 */
function LightboxCSPProvider(props: LightboxCSPProviderProps) {
  const { nonce, children } = props;
  return <LightboxCSPContext.Provider value={nonce}>{children}</LightboxCSPContext.Provider>;
}

export { LightboxCSPProvider, useLightboxStyleNonce };
export type { LightboxCSPProviderProps };
