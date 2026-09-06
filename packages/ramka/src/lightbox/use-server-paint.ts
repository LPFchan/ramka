'use client';

import * as React from 'react';

/** Store that never notifies — the snapshot pair below is the whole story. */
function emptySubscribe(): () => void {
  return () => {};
}

/**
 * `true` while the markup on screen is server HTML: the server render and the
 * hydration render both read the server snapshot, so anything gated on this
 * matches byte-for-byte and can't trip React's hydration-mismatch diff (a
 * `typeof window` gate can: React 19 warns on attributes the server rendered
 * but the hydration render didn't). React's post-hydration store consistency
 * check then re-renders with the client snapshot (`false`), un-rendering the
 * gated output — note that check is registered as a PASSIVE effect, so the
 * flip lands after the hydration commit, usually but not provably before its
 * paint. Pure client mounts read `false` from the very first render.
 *
 * Used for the SSR-only stamps (`data-ssr-shift`, `data-ssr-active`,
 * `data-morph-target`) that exist to make a server-rendered OPEN lightbox
 * paint correctly before hydration.
 */
export function useIsServerPaint(): boolean {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => false,
    () => true,
  );
}
