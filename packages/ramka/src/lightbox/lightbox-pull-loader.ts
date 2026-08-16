'use client';

import type { PullToDismissOptions } from './use-pull-to-dismiss';

export interface PullRuntime {
  PullToDismiss: (props: PullToDismissOptions) => null;
}

let cached: PullRuntime | null = null;
let pending: Promise<PullRuntime> | null = null;

function loadPullRuntime(): Promise<PullRuntime> {
  if (cached) return Promise.resolve(cached);
  pending ??= import('./lightbox-pull-runtime').then((mod) => {
    cached = { PullToDismiss: mod.PullToDismiss };
    return cached;
  });
  return pending;
}

function getPullRuntimeSync(): PullRuntime | null {
  return cached;
}

function prefetchPullRuntime(): void {
  void loadPullRuntime();
}

export { loadPullRuntime, getPullRuntimeSync, prefetchPullRuntime };
