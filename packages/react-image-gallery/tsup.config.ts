import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: { resolve: false },
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2020',
  external: ['react', 'react-dom', '@base-ui/react'],
  outExtension: ({ format }) => ({
    js: format === 'cjs' ? '.cjs' : '.js',
  }),
});
