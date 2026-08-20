import { globSync } from 'node:fs';

import { defineConfig } from 'tsup';

// One output module per source module (`bundle: false`) rather than a handful
// of merged chunks. Merging pins every part together — `Lightbox.Root` and
// `Lightbox.ThumbnailStrip` land in the same module, so no consumer bundler can
// drop the parts an app doesn't use. Preserving the module graph lets them, and
// it also keeps each file's `'use client'` directive, which bundling strips.
//
// The cost is that esbuild passes relative specifiers through unchanged, so
// `scripts/fix-dist-specifiers.mjs` adds the extensions afterwards.
//
// Declarations come from `tsc -p tsconfig.build.json`, not tsup: tsup's dts
// generator synthesises the `Lightbox` namespace and, with `bundle: false`,
// emits `declare const` aliases for type-only exports (`LightboxRootProps`
// et al.), which consumers can't compile against. `tsc` mirrors the module
// graph the rest of this build preserves anyway.
const entry = globSync('src/**/*.{ts,tsx}').filter((file) => !/\.test\.|test-utils|test-setup/.test(file));

export default defineConfig({
  entry,
  format: ['esm', 'cjs'],
  dts: false,
  sourcemap: true,
  clean: true,
  bundle: false,
  target: 'es2020',
  external: ['react', 'react-dom', /^@base-ui\/react/],
  outExtension: ({ format }) => ({
    js: format === 'cjs' ? '.cjs' : '.js',
  }),
});
