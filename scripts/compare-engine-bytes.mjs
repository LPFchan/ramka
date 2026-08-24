// Attributes minified bytes to the original modules of ramka's morph/zoom
// engines and of PhotoSwipe's opener/gesture subsystems, so the two can be
// compared on the same footing.
//
// PhotoSwipe ships one unminified bundle, so its per-module numbers can only be
// had by pulling each original module out of `sourcesContent` in the shipped
// sourcemap and minifying it on its own. That slightly overstates it — a real
// bundle-wide minify renames across module boundaries and drops more — so treat
// PhotoSwipe's per-module figures as a mild upper bound and the group totals as
// the comparable numbers. ramka's come from an esbuild metafile, which already
// attributes post-minification bytes per module.
//
// Usage: node scripts/compare-engine-bytes.mjs

import * as esbuild from 'esbuild';
import { readFileSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import { gzipSync } from 'node:zlib';

const repoRoot = resolvePath(import.meta.dirname, '..');
const PSWP = '/tmp/lightbox-bench/node_modules/photoswipe/dist';

const gz = (s) => gzipSync(Buffer.from(s), { level: 9 }).length;

// ---------------------------------------------------------------- PhotoSwipe
const map = JSON.parse(readFileSync(join(PSWP, 'photoswipe.esm.js.map'), 'utf8'));
const pswpModules = new Map();
for (const [i, source] of map.sources.entries()) {
  const name = source.replace('../../../src/js/', '');
  const raw = map.sourcesContent[i] ?? '';
  // Strip the ESM import/export syntax esbuild would resolve away anyway, so
  // an isolated minify does not fail on unresolved specifiers.
  const stripped = raw
    .replace(/^\s*import\s[^;]*;$/gm, '')
    .replace(/^\s*export\s+default\s+/gm, 'const __d = ')
    .replace(/^\s*export\s+/gm, '');
  let min = stripped;
  try {
    min = (await esbuild.transform(stripped, { minify: true, loader: 'js' })).code;
  } catch {
    // Fall back to comment-stripped source if the fragment will not parse.
    min = stripped.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  }
  pswpModules.set(name, { min: Buffer.byteLength(min), code: min, raw: Buffer.byteLength(raw) });
}

const PSWP_GROUPS = {
  'open/close transition': [
    'opener.js',
    'slide/get-thumb-bounds.js',
    'slide/placeholder.js',
    'util/css-animation.js',
    'util/animations.js',
  ],
  'zoom + pan': [
    'gestures/gestures.js',
    'gestures/drag-handler.js',
    'gestures/zoom-handler.js',
    'gestures/tap-handler.js',
    'slide/zoom-level.js',
    'slide/pan-bounds.js',
    'slide/slide.js',
    'scroll-wheel.js',
    'util/spring-easer.js',
    'util/spring-animation.js',
  ],
  'carousel (excluded from zoom)': ['main-scroll.js'],
  'keyboard (excluded from zoom)': ['keyboard.js'],
};

// ------------------------------------------------------------------- ramka
const ramkaBuild = await esbuild.build({
  entryPoints: [join(repoRoot, 'packages/ramka/src/index.ts')],
  bundle: true,
  splitting: true,
  format: 'esm',
  target: 'es2020',
  minify: true,
  outdir: '/tmp/ramka-engine-compare',
  external: ['react', 'react-dom', 'react/jsx-runtime', '@base-ui/react/*'],
  metafile: true,
  write: false,
  jsx: 'automatic',
  logLevel: 'error',
});

const ramkaModules = new Map();
for (const info of Object.values(ramkaBuild.metafile.outputs)) {
  for (const [input, { bytesInOutput }] of Object.entries(info.inputs ?? {})) {
    const key = input.replace('packages/ramka/src/lightbox/', '');
    ramkaModules.set(key, (ramkaModules.get(key) ?? 0) + bytesInOutput);
  }
}

const RAMKA_GROUPS = {
  'open/close transition': [
    'use-view-transition-morph.ts',
    'vt-composited-morph.ts',
    'vt-structural-styles.ts',
    'vt-timing.ts',
    'vt-touch-guard.ts',
    'vt-morph-radius.ts',
    'vt-morph-radius.ts',
    'scroll-trigger.ts',
    'is-firefox.ts',
    'is-android-blink.ts',
    'morph-target.ts',
    'vt-constants.ts',
  ],
  'zoom + pan': [
    'use-zoom-gestures.ts',
    'pose-controller.ts',
    'zoom-session.ts',
    'lightbox-zoom-runtime.tsx',
    'gesture-math.ts',
    'zoom-chrome.ts',
    'gesture-shared.ts',
    'haptics.ts',
  ],
};

// ------------------------------------------------------------------ report
const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);

const report = (title, groups, lookup) => {
  console.log(`\n### ${title}`);
  for (const [group, files] of Object.entries(groups)) {
    let total = 0;
    const rows = [];
    for (const file of [...new Set(files)]) {
      const bytes = lookup(file);
      if (bytes == null) {
        rows.push([`${file}  (NOT FOUND)`, 0]);
        continue;
      }
      total += bytes;
      rows.push([file, bytes]);
    }
    rows.sort((a, b) => b[1] - a[1]);
    console.log(`\n  ${group} — ${(total / 1024).toFixed(1)} KB minified`);
    for (const [file, bytes] of rows) {
      if (bytes < 150) continue;
      console.log(`    ${padL(bytes, 7)}  ${pad(file, 34)}`);
    }
  }
};

report('PhotoSwipe 5.4.4 (per-module minify from sourcemap)', PSWP_GROUPS, (f) =>
  pswpModules.get(f)?.min,
);
report('ramka (esbuild metafile attribution)', RAMKA_GROUPS, (f) => ramkaModules.get(f));

// Group totals side by side, with gzip on the concatenation of each group so
// the number is comparable to what a consumer downloads.
console.log('\n\n### Side by side\n');
console.log(
  pad('subsystem', 34) + padL('ramka min', 12) + padL('pswp min', 11) + padL('ratio', 8),
);
console.log('-'.repeat(65));
for (const group of ['open/close transition', 'zoom + pan']) {
  const r = [...new Set(RAMKA_GROUPS[group])].reduce((a, f) => a + (ramkaModules.get(f) ?? 0), 0);
  const p = [...new Set(PSWP_GROUPS[group])].reduce(
    (a, f) => a + (pswpModules.get(f)?.min ?? 0),
    0,
  );
  console.log(
    pad(group, 34) +
      padL((r / 1024).toFixed(1), 12) +
      padL((p / 1024).toFixed(1), 11) +
      padL(`${(r / p).toFixed(2)}x`, 8),
  );
}

const pswpGz = (group) =>
  gz([...new Set(PSWP_GROUPS[group])].map((f) => pswpModules.get(f)?.code ?? '').join('\n'));
console.log('\nPhotoSwipe group gzip (concatenated, minified):');
for (const group of ['open/close transition', 'zoom + pan']) {
  console.log(`  ${pad(group, 34)}${padL((pswpGz(group) / 1024).toFixed(1), 7)} KB gz`);
}
console.log('\nExcluded from PhotoSwipe zoom on purpose (ramka bills these elsewhere):');
for (const group of ['carousel (excluded from zoom)', 'keyboard (excluded from zoom)']) {
  const p = PSWP_GROUPS[group].reduce((a, f) => a + (pswpModules.get(f)?.min ?? 0), 0);
  console.log(`  ${pad(group, 34)}${padL((p / 1024).toFixed(1), 7)} KB min`);
}
