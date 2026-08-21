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
let requested = false;

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

/**
 * Called once when `lightbox-zoom.tsx` is evaluated — i.e. only in bundles that
 * actually pull in `Lightbox.Zoom`.
 *
 * Root and Trigger cannot see the element tree they will eventually render, so
 * without this they prefetch the engine for every gallery, zoomable or not.
 * Module evaluation is the earliest signal available and it beats Root's mount
 * effect, which is the prefetch that matters (see `prefetchZoomRuntime`).
 */
function requestZoomRuntime(): void {
  requested = true;
}

/**
 * Warm the engine chunk ahead of the first `Lightbox.Zoom` mount, so Zoom
 * renders the engine directly instead of the placeholder. The swap between the
 * two remounts `Lightbox.Media` and drops Item's placeholder canvas mid-open,
 * which is the whole reason to prefetch rather than wait.
 *
 * No-op until `requestZoomRuntime` has run: a gallery without `Lightbox.Zoom`
 * has nothing to swap, so the download would be pure waste. `loadZoomRuntime`
 * stays unconditional — Zoom's own mount effect must work even here, because a
 * consumer can lazy-load their zoomable slide well after Root mounted.
 */
function prefetchZoomRuntime(): void {
  if (!requested) return;
  void loadZoomRuntime();
}

export { loadZoomRuntime, getZoomRuntimeSync, prefetchZoomRuntime, requestZoomRuntime };
