import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement matchMedia. We register a plain (non-vi.fn) stub
// here in global setup so it survives vi.restoreAllMocks() calls in afterEach
// hooks across the test suite. The in-test beforeEach hook keeps an
// `if (!window.matchMedia)` guard, so this definition is preserved.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// jsdom derives `navigator.hardwareConcurrency` from the HOST machine's CPU
// count. CI runners (e.g. GitHub Actions `ubuntu-latest`) expose only ~2 cores,
// which trips `isLowEndDevice()` — so the lightbox silently takes the non-View-
// Transition fallback path and every VT-dependent test fails on CI while passing
// on high-core dev machines. Pin a comfortably high core count (and device
// memory) so `isLowEndDevice()` is deterministically `false` everywhere. Plain
// (non-vi.fn) definitions so they survive `vi.restoreAllMocks()`; a test that
// needs the low-end path can override these locally.
if (typeof navigator !== 'undefined') {
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    writable: true,
    configurable: true,
    value: 8,
  });
  Object.defineProperty(navigator, 'deviceMemory', {
    writable: true,
    configurable: true,
    value: 8,
  });
}


// jsdom doesn't implement ResizeObserver. A plain no-op stub is enough for
// components that observe element size (e.g. Lightbox.Zoom's container
// measurement); tests that need to drive resize callbacks stub it themselves.
if (typeof globalThis !== 'undefined' && !globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Zoom and pull-to-close are lazy-loaded in production. Tests drive those
// engines on the first render, so warm the caches here (does not affect
// the published bundle).
const { loadZoomRuntime } = await import('./lightbox/lightbox-zoom-loader');
const { loadPullRuntime } = await import('./lightbox/lightbox-pull-loader');
await Promise.all([loadZoomRuntime(), loadPullRuntime()]);

