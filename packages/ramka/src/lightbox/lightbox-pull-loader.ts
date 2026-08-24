'use client';

import type { PullToDismissOptions } from './use-pull-to-dismiss';

export interface PullRuntime {
  PullToDismiss: (props: PullToDismissOptions) => null;
}

let cached: PullRuntime | null = null;
let pending: Promise<PullRuntime> | null = null;

function loadPullRuntime(): Promise<PullRuntime> {
  if (cached) return Promise.resolve(cached);
  pending ??= import('./lightbox-pull-runtime').then(
    (mod) => {
      cached = { PullToDismiss: mod.PullToDismiss };
      return cached;
    },
    (error: unknown) => {
      // See lightbox-morph-loader: a remembered rejection would disable
      // pull-to-dismiss for the rest of the page, so let the next open retry.
      pending = null;
      throw error;
    },
  );
  return pending;
}

function getPullRuntimeSync(): PullRuntime | null {
  return cached;
}

function prefetchPullRuntime(): void {
  // Best-effort warm-up — see lightbox-morph-loader.
  loadPullRuntime().catch(() => {});
}

export { loadPullRuntime, getPullRuntimeSync, prefetchPullRuntime };
