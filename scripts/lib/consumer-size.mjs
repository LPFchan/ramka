// Shared measurement for "what does a consumer actually ship".
//
// Two callers depend on this: probe-consumer.mjs prints the human table, and
// size-report.mjs diffs two builds for the PR comment. The scenario list lives
// here so those two can never drift — and because the minimal-composition debug
// page quotes these numbers in its prose.
// esbuild and rollup are root devDependencies rather than transitive finds, so
// these are plain specifiers. They used to be absolute paths into pnpm's store
// with the version baked in, which broke the moment anything bumped the version
// that happened to be installed.
import * as esbuild from 'esbuild';
import { rollup } from 'rollup';
import { gzipSync } from 'node:zlib';
import { writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, basename, isAbsolute, resolve as resolvePath } from 'node:path';

export const repoRoot = resolvePath(import.meta.dirname, '../..');

export const SCENARIOS = {
  everything: `import * as Lightbox from 'LIB'; export default Object.values(Lightbox);`,
  'typical viewer (6 parts)': `import * as Lightbox from 'LIB';
    export default [Lightbox.Root, Lightbox.Trigger, Lightbox.Portal,
                    Lightbox.Content, Lightbox.Item, Lightbox.Media];`,
  'viewer + thumbnails': `import * as Lightbox from 'LIB';
    export default [Lightbox.Root, Lightbox.Trigger, Lightbox.Portal, Lightbox.Content,
                    Lightbox.Item, Lightbox.Media, Lightbox.Slides, Lightbox.Slide,
                    Lightbox.ThumbnailGroup, Lightbox.Thumbnail, Lightbox.Close];`,
  'just Root': `import * as Lightbox from 'LIB'; export default Lightbox.Root;`,
  'one data-attribute enum': `import * as Lightbox from 'LIB';
    export default Lightbox.LightboxItemDataAttributes;`,
  // Mirrors apps/docs/app/(docs)/debug/minimal-composition — a swipeable,
  // zoomable, morphing viewer with chrome. Keep the two in sync; the page
  // quotes this number.
  'minimal-composition page': `import * as Lightbox from 'LIB';
    export default [Lightbox.Root, Lightbox.Trigger, Lightbox.Portal, Lightbox.Content,
                    Lightbox.Slides, Lightbox.Slide, Lightbox.Item, Lightbox.Media,
                    Lightbox.Zoom, Lightbox.ZoomIn, Lightbox.ZoomOut,
                    Lightbox.Previous, Lightbox.Next, Lightbox.Close, Lightbox.Counter];`,
};

// The scenario whose lazy chunks stand in for the engines. `everything` pulls
// every dynamic import, so it enumerates all of them.
export const LAZY_SCENARIO = 'everything';

// Only the peer dependencies are free: a consumer already ships React. Runtime
// dependencies are not — leaving them external would hide their bytes, which is
// exactly what happened while `@base-ui/react` was a dependency and the totals
// below excluded its prop merging and element rendering.
const isExternal = (id) => ['react', 'react-dom', 'react/jsx-runtime'].includes(id);

// Bundler-style resolution for relative specifiers: try as-is, then common
// extensions, then directory index. Real consumer bundlers all do this, so a
// build that emits extensionless specifiers still resolves for them.
const resolver = (unmeasured) => ({
  name: 'relative-resolver',
  resolveId(source, importer) {
    if (!importer) return null;
    // A bare specifier that is not a peer is a runtime dependency: bytes the
    // consumer downloads. This probe cannot resolve one, so it falls out of the
    // totals — which is how `@base-ui/react` stayed invisible here for as long
    // as it was a dependency. Report it instead of hiding it.
    if (!source.startsWith('.') && !isAbsolute(source)) {
      unmeasured.add(source);
      return null;
    }
    const abs = resolvePath(dirname(importer), source);
    const candidates = [abs, `${abs}.js`, `${abs}.cjs`, `${abs}.mjs`, join(abs, 'index.js'), join(abs, 'index.cjs')];
    for (const c of candidates) {
      if (existsSync(c) && statSync(c).isFile()) return c;
    }
    return null;
  },
});

// Walk static import edges from the entry chunk; import() edges stay lazy.
function partition(chunks, entryName) {
  const eager = new Set([entryName]);
  for (let changed = true; changed; ) {
    changed = false;
    for (const n of [...eager]) {
      for (const imp of chunks.get(n).imports ?? []) {
        if (chunks.has(imp) && !eager.has(imp)) {
          eager.add(imp);
          changed = true;
        }
      }
    }
  }
  return {
    eager: [...eager],
    lazy: [...chunks.keys()].filter((n) => !eager.has(n)),
  };
}

async function sizes(code) {
  const { code: min } = await esbuild.transform(code, { minify: true, format: 'esm', target: 'es2020' });
  return { min: Buffer.byteLength(min), gz: gzipSync(Buffer.from(min), { level: 9 }).length };
}

// A dynamic-import chunk is named after the module that started it, which is
// what makes `lightbox-zoom-runtime` legible in a report.
const chunkLabel = (chunk) =>
  chunk.name ?? (chunk.facadeModuleId ? basename(chunk.facadeModuleId, '.js') : chunk.fileName);

/**
 * Bundle one scenario against one built copy of the library.
 *
 * @returns eager payload size, each lazily-loaded chunk on its own, and any
 * runtime dependency whose bytes the totals therefore leave out.
 */
export async function measureScenario({ entry, code, tag, tmpBase }) {
  const dir = join(tmpBase, tag.replace(/\W+/g, '_'));
  mkdirSync(dir, { recursive: true });
  const app = join(dir, 'app.js');
  writeFileSync(app, code.replaceAll('LIB', entry));

  const unmeasured = new Set();
  const bundle = await rollup({
    input: app,
    external: isExternal,
    plugins: [resolver(unmeasured)],
    // The package declares "sideEffects": false.
    treeshake: { moduleSideEffects: false },
    onwarn: () => {},
  });
  const { output } = await bundle.generate({ format: 'es' });
  await bundle.close();

  const chunks = new Map(output.filter((c) => c.type === 'chunk').map((c) => [c.fileName, c]));
  const entryName = [...chunks.values()].find((c) => c.isEntry).fileName;
  const { eager, lazy } = partition(chunks, entryName);

  const eagerSizes = await sizes(eager.map((n) => chunks.get(n).code).join('\n'));
  const lazyChunks = [];
  for (const name of lazy) {
    lazyChunks.push({ label: chunkLabel(chunks.get(name)), ...(await sizes(chunks.get(name).code)) });
  }
  lazyChunks.sort((a, b) => b.gz - a.gz);

  return { ...eagerSizes, lazyCount: lazy.length, lazyChunks, unmeasured: [...unmeasured] };
}
