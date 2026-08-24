'use client';

import type { ViewTransitionMorph, ViewTransitionMorphConfig } from './use-view-transition-morph';

export interface MorphRuntime {
  createViewTransitionMorph: (getConfig: () => ViewTransitionMorphConfig) => ViewTransitionMorph;
  ensureVtStructuralStyles: () => void;
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
  loadMorphRuntime().catch(() => {});
}

export { loadMorphRuntime, getMorphRuntimeSync, prefetchMorphRuntime };
