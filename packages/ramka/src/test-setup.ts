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
