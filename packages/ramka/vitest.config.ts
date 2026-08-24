import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/render/**'],
      // Text only: the html/json reporters would write a coverage directory on
      // every local run for a report nobody opens.
      reporter: ['text'],
      // `src/render` is forked from Base UI rather than written here, so it has
      // no consumer-visible surface of its own to notice a regression through:
      // every part renders through it, and a subtle break in prop merging or
      // ref forwarding surfaces as a mystery bug in a gallery. Hold it at full
      // coverage, and keep the exclusions to code a browser cannot reach.
      thresholds: { '**': { statements: 100, branches: 100, functions: 100, lines: 100 } },
    },
  },
});
