'use client';

import type { ForwardRefExoticComponent, RefAttributes } from 'react';

import type { LightboxZoomProps, LightboxZoomRef } from './lightbox-zoom';

export interface ZoomRuntime {
  LightboxZoomEngine: ForwardRefExoticComponent<
    LightboxZoomProps & RefAttributes<LightboxZoomRef>
  >;
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

export { loadZoomRuntime, getZoomRuntimeSync, prefetchZoomRuntime };
