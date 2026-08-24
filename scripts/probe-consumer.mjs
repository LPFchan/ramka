// Measures what a real consumer pays for a given built copy of ramka.
//
// Usage: node scripts/probe-consumer.mjs <label>=<path/to/dist/lightbox/lightbox.js> ...
//
// Point it at the flat parts module — the one published as `@ramka/react/lightbox` —
// and mirror how consumers import it (`import * as Lightbox`). Measuring a
// namespace re-exported by the package instead would inflate the esbuild
// numbers for reasons that have nothing to do with the code under test; see
// probe-export-shape.mjs.
//
// For each consumer scenario it reports the *eager* payload (entry chunk plus
// everything statically reachable from it); the lazily `import()`ed engine
// chunks are excluded because they are only fetched on demand.
import { gzipSync } from 'node:zlib';
import { writeFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve as resolvePath } from 'node:path';

const root = import.meta.url.replace(/scripts\/[^/]+$/, '');
const esbuild = await import(
  new URL('./node_modules/.pnpm/esbuild@0.28.1/node_modules/esbuild/lib/main.js', root).href
);
const { rollup } = await import(
  new URL('./node_modules/.pnpm/rollup@4.60.4/node_modules/rollup/dist/es/rollup.js', root).href
);

const targets = process.argv.slice(2).map((a) => {
  const i = a.indexOf('=');
  return { label: a.slice(0, i), entry: a.slice(i + 1) };
});
if (!targets.length) {
  console.error('usage: probe-consumer.mjs <label>=<dist/lightbox/lightbox.js> ...');
  process.exit(1);
}

const SCENARIOS = {
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

const base = '/tmp/consumer-probe';
rmSync(base, { recursive: true, force: true });

const isExternal = (id) => ['react', 'react-dom', 'react/jsx-runtime'].includes(id) || id.startsWith('@base-ui/');

// Bundler-style resolution for relative specifiers: try as-is, then common
// extensions, then directory index. Real consumer bundlers all do this, so a
// build that emits extensionless specifiers still resolves for them.
const resolverPlugin = {
  name: 'relative-resolver',
  resolveId(source, importer) {
    if (!importer || !source.startsWith('.')) return null;
    const abs = resolvePath(dirname(importer), source);
    const candidates = [abs, `${abs}.js`, `${abs}.cjs`, `${abs}.mjs`, join(abs, 'index.js'), join(abs, 'index.cjs')];
    for (const c of candidates) {
      if (existsSync(c) && statSync(c).isFile()) return c;
    }
    return null;
  },
};

// Walk static import edges from the entry chunk; import() edges stay lazy.
function eagerCode(chunks, entryName) {
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
    code: [...eager].map((n) => chunks.get(n).code).join('\n'),
    lazyCount: chunks.size - eager.size,
  };
}

async function viaRollup(entry, code, tag) {
  const dir = join(base, tag);
  mkdirSync(dir, { recursive: true });
  const app = join(dir, 'app.js');
  writeFileSync(app, code.replaceAll('LIB', entry));
  const bundle = await rollup({
    input: app,
    external: isExternal,
    plugins: [resolverPlugin],
    // The package declares "sideEffects": false.
    treeshake: { moduleSideEffects: false },
    onwarn: () => {},
  });
  const { output } = await bundle.generate({ format: 'es' });
  await bundle.close();
  const chunks = new Map(output.filter((c) => c.type === 'chunk').map((c) => [c.fileName, c]));
  const entryName = [...chunks.values()].find((c) => c.isEntry).fileName;
  const { code: eager, lazyCount } = eagerCode(chunks, entryName);
  const { code: min } = await esbuild.transform(eager, {
    minify: true,
    format: 'esm',
    target: 'es2020',
  });
  return {
    min: Buffer.byteLength(min),
    gz: gzipSync(Buffer.from(min), { level: 9 }).length,
    lazyCount,
  };
}

const kb = (n) => (n / 1024).toFixed(1);
const width = 19;

console.log('Rollup consumer — eager payload, min / gzip (lazy engine chunks excluded)\n');
console.log(`${'scenario'.padEnd(26)}${targets.map((t) => t.label.padEnd(width)).join('')}`);
for (const [label, code] of Object.entries(SCENARIOS)) {
  const cells = [];
  for (const t of targets) {
    const r = await viaRollup(t.entry, code, `${t.label}-${label}`.replace(/\W+/g, '_'));
    cells.push(`${kb(r.min)}K / ${kb(r.gz)}K`.padEnd(width));
  }
  console.log(`${label.padEnd(26)}${cells.join('')}`);
}
