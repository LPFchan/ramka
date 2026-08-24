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
//
// tsup globs an entry array itself, so this stays off `node:fs` — reading the
// tree with `globSync` required Node 22 and broke the build on CI's Node 20.
export default defineConfig({
  entry: ['src/**/*.{ts,tsx}', '!src/**/*.test.*', '!src/**/*test-utils*', '!src/**/*test-setup*'],
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
