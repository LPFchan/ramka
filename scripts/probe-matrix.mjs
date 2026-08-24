// Full matrix: publish shape (pre-bundled vs preserved modules) x entry shape
// (namespace only vs namespace + flat named exports), measured with both an
// esbuild consumer and a Rollup consumer.
//
// Answers: which combination actually lets a consumer drop unused parts?
import { gzipSync } from 'node:zlib';
import { writeFileSync, mkdirSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

const root = import.meta.url.replace(/scripts\/[^/]+$/, '');
const esbuild = await import(
  new URL('./node_modules/.pnpm/esbuild@0.28.1/node_modules/esbuild/lib/main.js', root).href
);
const { rollup } = await import(
  new URL('./node_modules/.pnpm/rollup@4.60.4/node_modules/rollup/dist/es/rollup.js', root).href
);

const src = new URL('./packages/ramka/src/', root).pathname;
const base = '/tmp/matrix-probe';
rmSync(base, { recursive: true, force: true });
mkdirSync(base, { recursive: true });

const EXTERNAL = ['react', 'react-dom', 'react/jsx-runtime', '@base-ui/react/*'];
const isExternal = (id) =>
  ['react', 'react-dom', 'react/jsx-runtime'].includes(id) || id.startsWith('@base-ui/');

const PARTS = [
  ['Root', 'lightbox-root', 'LightboxRoot'],
  ['Trigger', 'lightbox-trigger', 'LightboxTrigger'],
  ['Portal', 'lightbox-portal', 'LightboxPortal'],
  ['Content', 'lightbox-content', 'LightboxContent'],
  ['Backdrop', 'lightbox-backdrop', 'LightboxBackdrop'],
  ['Close', 'lightbox-close', 'LightboxClose'],
  ['Stage', 'lightbox-stage', 'LightboxStage'],
  ['Item', 'lightbox-item', 'LightboxItem'],
  ['Media', 'lightbox-media', 'LightboxMedia'],
  ['Slides', 'lightbox-slides', 'LightboxSlides'],
  ['Slide', 'lightbox-slide', 'LightboxSlide'],
  ['Previous', 'lightbox-previous', 'LightboxPrevious'],
  ['Next', 'lightbox-next', 'LightboxNext'],
  ['Counter', 'lightbox-counter', 'LightboxCounter'],
  ['Caption', 'lightbox-caption', 'LightboxCaption'],
  ['ThumbnailGroup', 'lightbox-thumbnail-group', 'LightboxThumbnailGroup'],
  ['Thumbnail', 'lightbox-thumbnail', 'LightboxThumbnail'],
  ['ThumbnailStrip', 'lightbox-thumbnail-strip', 'LightboxThumbnailStrip'],
  ['ThumbnailStripTrack', 'lightbox-thumbnail-strip-track', 'LightboxThumbnailStripTrack'],
  ['Zoom', 'lightbox-zoom', 'LightboxZoom'],
  ['ZoomIn', 'lightbox-zoom-in', 'LightboxZoomIn'],
  ['ZoomOut', 'lightbox-zoom-out', 'LightboxZoomOut'],
];

// Two candidate library entry files, written into src so relative imports work.
const entryFiles = {
  namespace: join(src, '__probe-entry-namespace.ts'),
  flat: join(src, '__probe-entry-flat.ts'),
  flatonly: join(src, '__probe-entry-flatonly.ts'),
};
const flatLines = PARTS.map(
  ([a, f, n]) => `export { ${n} as Lightbox${a} } from './lightbox/${f}';`,
).join('\n');
writeFileSync(entryFiles.namespace, `export * as Lightbox from './lightbox/lightbox';\n`);
// namespace kept for DX + flat names added (non-breaking)
writeFileSync(
  entryFiles.flat,
  `export * as Lightbox from './lightbox/lightbox';\n${flatLines}\n`,
);
// flat names only, namespace removed (breaking)
writeFileSync(entryFiles.flatonly, `${flatLines}\n`);

// ---- build the four publish shapes ---------------------------------------
const shapes = {};
for (const entryShape of ['namespace', 'flat', 'flatonly']) {
  // pre-bundled, like tsup today
  const bundledDir = join(base, `dist-bundled-${entryShape}`);
  await esbuild.build({
    entryPoints: [entryFiles[entryShape]],
    bundle: true,
    splitting: true,
    format: 'esm',
    target: 'es2020',
    jsx: 'automatic',
    external: EXTERNAL,
    outdir: bundledDir,
    logLevel: 'error',
  });
  shapes[`bundled/${entryShape}`] = join(
    bundledDir,
    `${basename(entryFiles[entryShape], '.ts')}.js`,
  );

  // preserved modules (one output file per source module)
  const preservedDir = join(base, `dist-preserved-${entryShape}`);
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.|test-utils|test-setup/.test(e.name))
        files.push(p);
    }
  };
  walk(src);
  await esbuild.build({
    entryPoints: files,
    bundle: false,
    format: 'esm',
    target: 'es2020',
    jsx: 'automatic',
    outdir: preservedDir,
    outbase: src,
    logLevel: 'error',
  });
  shapes[`preserved/${entryShape}`] = join(
    preservedDir,
    `${basename(entryFiles[entryShape], '.ts')}.js`,
  );
}

// ---- consumers ------------------------------------------------------------
const consumers = {
  'minimal viewer (6 parts)': {
    namespace: `import { Lightbox } from 'LIB';
      export default [Lightbox.Root, Lightbox.Trigger, Lightbox.Portal,
                      Lightbox.Content, Lightbox.Item, Lightbox.Media];`,
    flat: `import { LightboxRoot, LightboxTrigger, LightboxPortal,
                    LightboxContent, LightboxItem, LightboxMedia } from 'LIB';
      export default [LightboxRoot, LightboxTrigger, LightboxPortal,
                      LightboxContent, LightboxItem, LightboxMedia];`,
    flatonly: `import { LightboxRoot, LightboxTrigger, LightboxPortal,
                    LightboxContent, LightboxItem, LightboxMedia } from 'LIB';
      export default [LightboxRoot, LightboxTrigger, LightboxPortal,
                      LightboxContent, LightboxItem, LightboxMedia];`,
  },
  'just Root': {
    namespace: `import { Lightbox } from 'LIB'; export default Lightbox.Root;`,
    flat: `import { LightboxRoot } from 'LIB'; export default LightboxRoot;`,
    flatonly: `import { LightboxRoot } from 'LIB'; export default LightboxRoot;`,
  },
};

async function viaEsbuild(libPath, code, tag) {
  const dir = join(base, `eb-${tag}`);
  mkdirSync(dir, { recursive: true });
  const entry = join(dir, 'app.js');
  writeFileSync(entry, code.replaceAll('LIB', libPath));
  const out = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    splitting: true,
    minify: true,
    format: 'esm',
    target: 'es2020',
    external: EXTERNAL,
    outdir: join(dir, 'out'),
    metafile: true,
    logLevel: 'error',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  const info = new Map(Object.entries(out.metafile.outputs).map(([k, v]) => [basename(k), v]));
  const entryKey = [...info].find(([, v]) => v.entryPoint)[0];
  const eager = new Set([entryKey]);
  for (let changed = true; changed; ) {
    changed = false;
    for (const k of [...eager]) {
      for (const imp of info.get(k).imports ?? []) {
        const t = basename(imp.path);
        if (imp.kind === 'import-statement' && info.has(t) && !eager.has(t)) {
          eager.add(t);
          changed = true;
        }
      }
    }
  }
  const bufs = [...eager].map((k) => readFileSync(join(dir, 'out', k)));
  const all = Buffer.concat(bufs);
  return { min: all.length, gz: gzipSync(all, { level: 9 }).length };
}

async function viaRollup(libPath, code, tag) {
  const dir = join(base, `ro-${tag}`);
  mkdirSync(dir, { recursive: true });
  const entry = join(dir, 'app.js');
  writeFileSync(entry, code.replaceAll('LIB', libPath));
  const bundle = await rollup({
    input: entry,
    external: isExternal,
    treeshake: { moduleSideEffects: false },
    onwarn: () => {},
  });
  const { output } = await bundle.generate({ format: 'es' });
  await bundle.close();
  const chunks = new Map(output.filter((c) => c.type === 'chunk').map((c) => [c.fileName, c]));
  const entryName = [...chunks.values()].find((c) => c.isEntry).fileName;
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
  const src2 = [...eager].map((n) => chunks.get(n).code).join('\n');
  const { code: min } = await esbuild.transform(src2, {
    minify: true,
    format: 'esm',
    target: 'es2020',
  });
  return {
    min: Buffer.byteLength(min),
    gz: gzipSync(Buffer.from(min), { level: 9 }).length,
  };
}

const f = (r) => `${(r.min / 1024).toFixed(1)}K/${(r.gz / 1024).toFixed(1)}Kgz`;

for (const [cLabel, forms] of Object.entries(consumers)) {
  console.log(`\n### consumer: ${cLabel}   (eager payload, min/gzip)\n`);
  console.log(`${'publish shape'.padEnd(24)} ${'esbuild consumer'.padEnd(20)} rollup consumer`);
  for (const shapeKey of Object.keys(shapes)) {
    const entryShape = shapeKey.split('/')[1];
    const code = forms[entryShape];
    const tag = `${shapeKey.replace('/', '-')}-${cLabel.replace(/\W+/g, '_')}`;
    const eb = await viaEsbuild(shapes[shapeKey], code, tag);
    const ro = await viaRollup(shapes[shapeKey], code, tag);
    console.log(`${shapeKey.padEnd(24)} ${f(eb).padEnd(20)} ${f(ro)}`);
  }
}

for (const p of Object.values(entryFiles)) rmSync(p);
