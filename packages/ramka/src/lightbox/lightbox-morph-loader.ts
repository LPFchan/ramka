'use client';

import type { ViewTransitionMorph, ViewTransitionMorphConfig } from './use-view-transition-morph';

export interface MorphRuntime {
  createViewTransitionMorph: (getConfig: () => ViewTransitionMorphConfig) => ViewTransitionMorph;
  ensureVtStructuralStyles: () => void;
  /** Adopt every once-only VT sheet at idle — see lightbox-morph-runtime.ts. */
  prewarmVtStyles: () => void;
}

let cached: MorphRuntime | null = null;
let pending: Promise<MorphRuntime> | null = null;

function loadMorphRuntime(): Promise<MorphRuntime> {
  if (cached) return Promise.resolve(cached);
  pending ??= import('./lightbox-morph-runtime').then(
    (mod) => {
      cached = mod;
      return mod;
    },
    (error: unknown) => {
      // Forget the failure so the next attempt can refetch. Holding the
      // rejected promise here would make one transient miss (a deploy landing
      // mid-session, a flaky connection, a blocked CDN) permanent for the rest
      // of the page's life — every later open would reuse the rejection.
      // Whether the retry reaches the network is the bundler's call: webpack
      // and Turbopack drop failed chunks and refetch, while native ESM records
      // the failure in the module map, so callers must still degrade rather
      // than rely on a retry succeeding.
      pending = null;
      throw error;
    },
  );
  return pending;
}

function getMorphRuntimeSync(): MorphRuntime | null {
  return cached;
}

function prefetchMorphRuntime(): void {
  // Best-effort warm-up: a failure here is not an error, the open path retries
  // and degrades on its own. Swallowed so it never lands in the consumer's
  // unhandled-rejection reporting.
  //
  // Prewarming the styles as soon as the chunk lands piggybacks on the same
  // idle window: adopting the once-only sheets costs a full-document restyle
  // in WebKit, which must not wait for the first open (see prewarmVtStyles).
  loadMorphRuntime().then(
    (runtime) => runtime.prewarmVtStyles(),
    () => {},
  );
}

export { loadMorphRuntime, getMorphRuntimeSync, prefetchMorphRuntime };
