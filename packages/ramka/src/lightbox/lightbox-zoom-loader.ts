'use client';

import type { ComponentType } from 'react';

import type { ZoomEngineProps } from './lightbox-zoom';

export interface ZoomRuntime {
  /** Behaviour only — renders no DOM, so it can arrive at any time. */
  ZoomEngine: ComponentType<ZoomEngineProps>;
}

let cached: ZoomRuntime | null = null;
let pending: Promise<ZoomRuntime> | null = null;

function loadZoomRuntime(): Promise<ZoomRuntime> {
  if (cached) return Promise.resolve(cached);
  pending ??= import('./lightbox-zoom-runtime').then(
    (mod) => {
      cached = { ZoomEngine: mod.ZoomEngine };
      return cached;
    },
    (error: unknown) => {
      // See lightbox-morph-loader: a remembered rejection would disable zoom
      // for the rest of the page, so let the next open try again.
      pending = null;
      throw error;
    },
  );
  return pending;
}

function getZoomRuntimeSync(): ZoomRuntime | null {
  return cached;
}

function prefetchZoomRuntime(): void {
  // Best-effort warm-up — see lightbox-morph-loader.
  loadZoomRuntime().catch(() => {});
}

export { loadZoomRuntime, getZoomRuntimeSync, prefetchZoomRuntime };
