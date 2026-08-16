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
  pending ??= import('./lightbox-morph-runtime').then((mod) => {
    cached = mod;
    return mod;
  });
  return pending;
}

function getMorphRuntimeSync(): MorphRuntime | null {
  return cached;
}

function prefetchMorphRuntime(): void {
  void loadMorphRuntime();
}

export { loadMorphRuntime, getMorphRuntimeSync, prefetchMorphRuntime };
