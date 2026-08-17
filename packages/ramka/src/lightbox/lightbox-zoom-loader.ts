'use client';

import type { ComponentType } from 'react';

import type { LightboxZoomEngineProps } from './lightbox-zoom';

export interface ZoomRuntime {
  LightboxZoomEngine: ComponentType<LightboxZoomEngineProps>;
}

let cached: ZoomRuntime | null = null;
let pending: Promise<ZoomRuntime> | null = null;

function loadZoomRuntime(): Promise<ZoomRuntime> {
  if (cached) return Promise.resolve(cached);
  pending ??= import('./lightbox-zoom-runtime').then((mod) => {
    cached = { LightboxZoomEngine: mod.LightboxZoomEngine };
    return cached;
  });
  return pending;
}

function getZoomRuntimeSync(): ZoomRuntime | null {
  return cached;
}

function prefetchZoomRuntime(): void {
  void loadZoomRuntime();
}

/** Test-only: drop the in-memory engine so the next Zoom mount loads cold. */
function resetZoomRuntimeForTests(): void {
  cached = null;
  pending = null;
}

export { loadZoomRuntime, getZoomRuntimeSync, prefetchZoomRuntime, resetZoomRuntimeForTests };
