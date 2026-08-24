// Compares what ramka costs a consumer against the popular alternatives.
//
// Fairness rules, since these libraries are not shaped alike:
//
//   * Every library goes through the same two bundlers with the same settings.
//     Two, not one, because ramka is the only entry here that publishes its
//     parts behind an `export * as Lightbox` namespace, and bundlers disagree
//     sharply about whether `Lightbox.Root` can be tree-shaken. Reporting a
//     single bundler would either flatter ramka or libel it.
//   * `react` / `react-dom` are external everywhere — a React app already pays
//     for them. Everything else is bundled, including ramka's `@base-ui/react`
//     dependency, which is a real cost ramka pushes onto consumers.
//   * CSS counts. Four of the five ship stylesheets that are mandatory for the
//     thing to look like a lightbox at all; ramka ships none, which is a genuine
//     advantage in bytes and a genuine cost in work. Reported in its own column
//     so neither fact is hidden.
//   * Lazily `import()`ed code is separated from the eager payload, because a
//     chunk fetched on first open is not the same as bytes in the entry.
//   * Three feature tiers, so a headless kit is not credited for being small
//     while doing less:
//       minimal   — open/close a full-screen image, prev/next, swipe
//       parity    — the above plus pinch-zoom, thumbnails, captions, counter
//       everything — every plugin the library ships
//
// Usage: node scripts/bench-lightbox-libs.mjs
// Expects the competitors installed in /tmp/lightbox-bench (see BENCH_DIR).

import { gzipSync } from 'node:zlib';
import { readFileSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = resolvePath(import.meta.dirname, '..');
const BENCH_DIR = '/tmp/lightbox-bench';
const MODULES = join(BENCH_DIR, 'node_modules');
// ramka is not installed into the bench directory, so its entries are aliased
// straight at the workspace build. Both are needed: the parts ship as the
// `ramka/lightbox` subpath, the root holds the composition hooks.
const RAMKA_ENTRIES = {
  ramka: join(repoRoot, 'packages/ramka/dist/index.js'),
  'ramka/lightbox': join(repoRoot, 'packages/ramka/dist/lightbox/lightbox.js'),
};

const esbuild = await import(
  pathToFileURL(
    join(repoRoot, 'node_modules/.pnpm/esbuild@0.28.1/node_modules/esbuild/lib/main.js'),
  ).href
);
const { rollup } = await import(pathToFileURL(join(MODULES, 'rollup/dist/es/rollup.js')).href);
const nodeResolve = (
  await import(pathToFileURL(join(MODULES, '@rollup/plugin-node-resolve/dist/es/index.js')).href)
).nodeResolve;

if (!existsSync(MODULES)) {
  console.error(`Competitors not installed. Run:\n  mkdir -p ${BENCH_DIR} && cd ${BENCH_DIR} &&`);
  console.error(
    '  npm install yet-another-react-lightbox photoswipe react-photoswipe-gallery lightgallery @fancyapps/ui react react-dom',
  );
  process.exit(1);
}

const css = (...files) => files.map((f) => join(MODULES, f));

const RAMKA_MINIMAL = `Lightbox.Root, Lightbox.Trigger, Lightbox.Portal, Lightbox.Backdrop,
  Lightbox.Content, Lightbox.Slides, Lightbox.Slide, Lightbox.Item, Lightbox.Media,
  Lightbox.Close, Lightbox.Previous, Lightbox.Next`;
const RAMKA_PARITY = `${RAMKA_MINIMAL}, Lightbox.Zoom, Lightbox.ThumbnailGroup,
  Lightbox.Thumbnail, Lightbox.Caption, Lightbox.Counter`;

const YARL_ALL = [
  'captions',
  'counter',
  'download',
  'fullscreen',
  'inline',
  'share',
  'slideshow',
  'thumbnails',
  'video',
  'zoom',
];
const LG_ALL = [
  'autoplay',
  'comment',
  'fullscreen',
  'hash',
  'mediumZoom',
  'pager',
  'relativeCaption',
  'rotate',
  'share',
  'thumbnail',
  'video',
  'vimeoThumbnail',
  'zoom',
];
const LG_ALL_CSS = [
  'lightgallery.css',
  'lg-autoplay.css',
  'lg-comments.css',
  'lg-fullscreen.css',
  'lg-medium-zoom.css',
  'lg-pager.css',
  'lg-relative-caption.css',
  'lg-rotate.css',
  'lg-share.css',
  'lg-thumbnail.css',
  'lg-transitions.css',
  'lg-video.css',
  'lg-zoom.css',
].map((f) => `lightgallery/css/${f}`);

const named = (mods) =>
  mods.map((m, i) => `import P${i} from '${m}';`).join('\n') +
  `\nexport default [${mods.map((_, i) => `P${i}`).join(', ')}];`;

const SCENARIOS = [
  {
    lib: 'ramka',
    tier: 'minimal',
    code: `import * as Lightbox from 'ramka/lightbox';\nexport default [${RAMKA_MINIMAL}];`,
    css: [],
  },
  {
    lib: 'ramka',
    tier: 'parity',
    code: `import * as Lightbox from 'ramka/lightbox';\nexport default [${RAMKA_PARITY}];`,
    css: [],
  },
  {
    lib: 'ramka',
    tier: 'everything',
    code: `import * as Lightbox from 'ramka/lightbox';\nexport default Object.values(Lightbox);`,
    css: [],
  },

  {
    lib: 'yet-another-react-lightbox',
    tier: 'minimal',
    code: named(['yet-another-react-lightbox']),
    css: css('yet-another-react-lightbox/dist/styles.css'),
  },
  {
    lib: 'yet-another-react-lightbox',
    tier: 'parity',
    code: named([
      'yet-another-react-lightbox',
      ...['zoom', 'thumbnails', 'captions', 'counter'].map(
        (p) => `yet-another-react-lightbox/plugins/${p}`,
      ),
    ]),
    css: css(
      'yet-another-react-lightbox/dist/styles.css',
      'yet-another-react-lightbox/dist/plugins/thumbnails/thumbnails.css',
      'yet-another-react-lightbox/dist/plugins/captions/captions.css',
      'yet-another-react-lightbox/dist/plugins/counter/counter.css',
    ),
  },
  {
    lib: 'yet-another-react-lightbox',
    tier: 'everything',
    code: named([
      'yet-another-react-lightbox',
      ...YARL_ALL.map((p) => `yet-another-react-lightbox/plugins/${p}`),
    ]),
    css: css(
      'yet-another-react-lightbox/dist/styles.css',
      'yet-another-react-lightbox/dist/plugins/thumbnails/thumbnails.css',
      'yet-another-react-lightbox/dist/plugins/captions/captions.css',
      'yet-another-react-lightbox/dist/plugins/counter/counter.css',
    ),
  },

  {
    // The core already does zoom, counter, arrows and close; there is no
    // thumbnail strip or caption in it, and no plugin ships with the package,
    // so this single row is both its minimal and its richest configuration.
    lib: 'photoswipe (react-photoswipe-gallery)',
    tier: 'parity*',
    code: `import { Gallery, Item } from 'react-photoswipe-gallery';\nexport default [Gallery, Item];`,
    css: css('photoswipe/dist/photoswipe.css'),
  },

  {
    lib: 'lightgallery',
    tier: 'minimal',
    code: named(['lightgallery/react']),
    css: css('lightgallery/css/lightgallery.css'),
  },
  {
    lib: 'lightgallery',
    tier: 'parity',
    // Captions and the counter are core features here, so only zoom and the
    // thumbnail strip need plugins.
    code: named(['lightgallery/react', 'lightgallery/plugins/zoom', 'lightgallery/plugins/thumbnail']),
    css: css(
      'lightgallery/css/lightgallery.css',
      'lightgallery/css/lg-zoom.css',
      'lightgallery/css/lg-thumbnail.css',
    ),
  },
  {
    lib: 'lightgallery',
    tier: 'everything',
    code: named(['lightgallery/react', ...LG_ALL.map((p) => `lightgallery/plugins/${p}`)]),
    css: css(...LG_ALL_CSS),
  },

  {
    // Fancybox statically imports panzoom, carousel and eleven of its own
    // plugins (zoom, thumbs, toolbar, arrows, video, fullscreen, …), so there
    // is no smaller configuration to measure.
    lib: '@fancyapps/ui (fancybox)',
    tier: 'everything',
    code: `import { Fancybox } from '@fancyapps/ui';\nexport default Fancybox;`,
    css: css('@fancyapps/ui/dist/fancybox/fancybox.css'),
  },
];

const measureCss = async (files) => {
  if (!files.length) return { min: 0, gz: 0 };
  const parts = [];
  for (const file of files) {
    const { code } = await esbuild.transform(readFileSync(file, 'utf8'), {
      loader: 'css',
      minify: true,
    });
    parts.push(code);
  }
  const joined = parts.join('');
  return { min: Buffer.byteLength(joined), gz: gzipSync(Buffer.from(joined), { level: 9 }).length };
};

const work = join(BENCH_DIR, '.bench');
rmSync(work, { recursive: true, force: true });

const EXTERNAL = ['react', 'react-dom', 'react/jsx-runtime'];
const isExternal = (id) => EXTERNAL.includes(id) || id.startsWith('react-dom/') || id.startsWith('react/');

/**
 * Rollup has no notion of package.json `sideEffects`, so feed it the same
 * declarations webpack and esbuild read. Without this, Rollup keeps every
 * `React.forwardRef(...)` assignment it cannot prove pure and no library gets
 * tree-shaken at all — including the ones that correctly opted in.
 */
const sideEffectFreeCache = new Map();
function isSideEffectFree(id) {
  let dir = resolvePath(id, '..');
  for (let i = 0; i < 12; i += 1) {
    const manifest = join(dir, 'package.json');
    if (existsSync(manifest)) {
      if (!sideEffectFreeCache.has(manifest)) {
        let declared;
        try {
          declared = JSON.parse(readFileSync(manifest, 'utf8')).sideEffects;
        } catch {
          declared = undefined;
        }
        // An array lists the files that *do* have side effects; the patterns in
        // practice are extension globs like "*.css", so a suffix test covers it.
        const free =
          declared === false ||
          (Array.isArray(declared) &&
            !declared.some((p) => id.endsWith(p.replace(/^\*/, '')) || id.endsWith(p)));
        sideEffectFreeCache.set(manifest, free);
      }
      return sideEffectFreeCache.get(manifest);
    }
    const parent = resolvePath(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return false;
}

const minify = async (source) => {
  const { code } = await esbuild.transform(source, { minify: true, format: 'esm', target: 'es2020' });
  return code;
};

const sizeOf = (source) => ({
  min: Buffer.byteLength(source),
  gz: source ? gzipSync(Buffer.from(source), { level: 9 }).length : 0,
});

async function viaRollup({ entry }) {
  const stubCss = {
    name: 'stub-css',
    resolveId: (source) => (/\.(css|svg|png|gif|woff2?)$/.test(source) ? '\0empty' : null),
    load: (id) => (id === '\0empty' ? 'export default undefined;' : null),
  };
  const aliasRamka = {
    name: 'alias-ramka',
    resolveId: (source) => RAMKA_ENTRIES[source] ?? null,
  };

  const bundle = await rollup({
    input: entry,
    external: isExternal,
    plugins: [
      aliasRamka,
      stubCss,
      nodeResolve({ rootDir: BENCH_DIR, exportConditions: ['import', 'module', 'default'] }),
    ],
    treeshake: { moduleSideEffects: (id) => !isSideEffectFree(id) },
    onwarn: () => {},
  });
  const { output } = await bundle.generate({ format: 'es' });
  await bundle.close();

  const chunks = new Map(output.filter((c) => c.type === 'chunk').map((c) => [c.fileName, c]));
  const entryName = [...chunks.values()].find((c) => c.isEntry).fileName;
  const eager = new Set([entryName]);
  for (let changed = true; changed; ) {
    changed = false;
    for (const name of [...eager]) {
      for (const imp of chunks.get(name).imports ?? []) {
        if (chunks.has(imp) && !eager.has(imp)) {
          eager.add(imp);
          changed = true;
        }
      }
    }
  }
  const lazyNames = [...chunks.keys()].filter((n) => !eager.has(n));
  // Minify per chunk, then join: sibling chunks legitimately reuse top-level
  // names, so minifying the concatenation is a redeclaration error.
  const minifyAll = async (names) => {
    const parts = [];
    for (const name of names) parts.push(await minify(chunks.get(name).code));
    return parts.join('\n');
  };

  const detail = [];
  for (const name of lazyNames) {
    const chunk = chunks.get(name);
    const modules = Object.keys(chunk.modules ?? {}).map((m) => m.split('/').pop());
    detail.push({
      name,
      ...sizeOf(await minify(chunk.code)),
      // Largest module in the chunk names it well enough to be recognisable.
      label:
        modules
          .map((m) => [m, Object.values(chunk.modules)[modules.indexOf(m)]?.renderedLength ?? 0])
          .sort((a, b) => b[1] - a[1])[0]?.[0] ?? '?',
      moduleCount: modules.length,
    });
  }

  return {
    js: sizeOf(await minifyAll([...eager])),
    lazy: lazyNames.length ? sizeOf(await minifyAll(lazyNames)) : { min: 0, gz: 0 },
    lazyChunks: lazyNames.length,
    detail,
  };
}

async function viaEsbuild({ dir, entry }) {
  const result = await esbuild.build({
    absWorkingDir: BENCH_DIR,
    entryPoints: [entry],
    outdir: join(dir, 'out'),
    bundle: true,
    splitting: true,
    format: 'esm',
    target: 'es2020',
    minify: true,
    metafile: true,
    write: true,
    logLevel: 'silent',
    external: ['react', 'react-dom', 'react/*', 'react-dom/*'],
    alias: RAMKA_ENTRIES,
    // `@base-ui/react` lives in the ramka workspace, not the bench install.
    nodePaths: [join(repoRoot, 'node_modules'), join(repoRoot, 'packages/ramka/node_modules')],
    loader: { '.css': 'empty', '.svg': 'empty', '.png': 'empty', '.gif': 'empty' },
  });

  const outputs = result.metafile.outputs;
  const entryOut = Object.keys(outputs).find((k) => outputs[k].entryPoint);

  // Walk static edges for the eager set; `import()` edges are the lazy set.
  const eager = new Set([entryOut]);
  for (let changed = true; changed; ) {
    changed = false;
    for (const name of [...eager]) {
      for (const imp of outputs[name]?.imports ?? []) {
        if (imp.kind === 'import-statement' && outputs[imp.path] && !eager.has(imp.path)) {
          eager.add(imp.path);
          changed = true;
        }
      }
    }
  }
  const lazy = Object.keys(outputs).filter((k) => !eager.has(k) && k.endsWith('.js'));
  const read = (names) => names.map((n) => readFileSync(join(BENCH_DIR, n), 'utf8')).join('\n');

  return {
    js: sizeOf(read([...eager])),
    lazy: lazy.length ? sizeOf(read(lazy)) : { min: 0, gz: 0 },
    lazyChunks: lazy.length,
  };
}

async function measure({ lib, tier, code, css: cssFiles }) {
  const id = `${lib}-${tier}`.replace(/\W+/g, '_');
  const dir = join(work, id);
  mkdirSync(dir, { recursive: true });
  const entry = join(dir, 'entry.js');
  writeFileSync(entry, code);

  return {
    lib,
    tier,
    rollup: await viaRollup({ entry }),
    esbuild: await viaEsbuild({ dir, entry }),
    css: await measureCss(cssFiles),
  };
}

const rows = [];
for (const scenario of SCENARIOS) rows.push(await measure(scenario));

const kb = (n) => (n === 0 ? '—' : (n / 1024).toFixed(1));
const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);
const cell = (m) => (m.gz ? `${kb(m.gz)}` : '—');

const total = (b, cssM) => b.js.gz + b.lazy.gz + cssM.gz;

for (const [bundler, label] of [
  ['rollup', 'Rollup 4 (what Vite ships in production)'],
  ['esbuild', 'esbuild 0.28'],
]) {
  console.log(`\n### ${label}`);
  console.log('KB gzipped. react/react-dom external; everything else bundled.\n');
  console.log(
    pad('library', 38) +
      pad('tier', 12) +
      padL('eager JS', 11) +
      padL('lazy JS', 10) +
      padL('CSS', 8) +
      padL('total', 8),
  );
  console.log('-'.repeat(87));
  for (const r of rows) {
    const b = r[bundler];
    console.log(
      pad(r.lib, 38) +
        pad(r.tier, 12) +
        padL(cell(b.js), 11) +
        padL(b.lazy.gz ? `${cell(b.lazy)} /${b.lazyChunks}` : '—', 10) +
        padL(cell(r.css), 8) +
        padL(kb(total(b, r.css)), 8),
    );
  }
}

// Deferred is not the same as avoided, so name the lazy chunks: whether each is
// fetched by a default configuration decides if the "total" column is the number
// that matters or an upper bound nobody hits.
for (const r of rows.filter((x) => x.rollup.detail?.length)) {
  console.log(`\nLazy chunks — ${r.lib} ${r.tier}:`);
  for (const d of r.rollup.detail) {
    console.log(`  ${pad(d.label, 34)}${padL(kb(d.gz), 6)} KB gz  (${d.moduleCount} modules)`);
  }
}

console.log('\n"lazy JS" is `gz / chunk count` — fetched on demand, not in the entry.');
console.log('"total" sums eager + lazy + CSS: everything a consumer eventually downloads.\n');

// The spread between bundlers is the story for any library whose parts hide
// behind a namespace export, so call it out rather than leaving it in the table.
console.log('Bundler sensitivity (eager JS, Rollup → esbuild):');
for (const r of rows) {
  const a = r.rollup.js.gz;
  const b = r.esbuild.js.gz;
  const delta = a === 0 ? 0 : Math.round(((b - a) / a) * 100);
  console.log(
    `  ${pad(`${r.lib} ${r.tier}`, 50)}${padL(kb(a), 6)} → ${padL(kb(b), 6)}  ${delta > 0 ? `+${delta}%` : `${delta}%`}`,
  );
}
