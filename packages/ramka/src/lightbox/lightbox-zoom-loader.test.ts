import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stand in for the engine chunk, so a prefetch resolves in a microtask instead
// of however long Vite needs to transform the real module graph. That is what
// lets the disarmed case below wait exactly as long as the armed one.
vi.mock('./lightbox-zoom-runtime', () => ({ LightboxZoomEngine: () => null }));

// The gate is a module-level flag armed by evaluating `lightbox-zoom.tsx`, so
// each case needs a fresh registry — and the loader has to be imported
// dynamically, since a static import at the top of this file would pin one
// shared instance across all of them.
beforeEach(() => {
  vi.resetModules();
});

/** Flush the microtasks a resolved dynamic import needs, plus a macrotask. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('zoom engine prefetch gate', () => {
  it('ignores prefetch requests when Lightbox.Zoom is not in the bundle', async () => {
    const loader = await import('./lightbox-zoom-loader');

    loader.prefetchZoomRuntime();
    await settle();

    // The sibling case proves this wait is long enough to have caught a load.
    expect(loader.getZoomRuntimeSync()).toBeNull();
  });

  it('prefetches once Lightbox.Zoom has been evaluated', async () => {
    // Importing the part is what a consumer's bundle does; the module arms the
    // gate on evaluation, with no help from Root.
    await import('./lightbox-zoom');
    const loader = await import('./lightbox-zoom-loader');

    loader.prefetchZoomRuntime();
    await settle();

    expect(loader.getZoomRuntimeSync()).not.toBeNull();
  });

  it('still loads on demand when the gate was never armed', async () => {
    // Zoom's own mount effect calls `loadZoomRuntime` directly. That path stays
    // unconditional so a consumer can lazy-load a zoomable slide long after
    // Root mounted and missed its chance to prefetch.
    const loader = await import('./lightbox-zoom-loader');

    const runtime = await loader.loadZoomRuntime();

    expect(runtime.LightboxZoomEngine).toBeDefined();
    expect(loader.getZoomRuntimeSync()).toBe(runtime);
  });
});
