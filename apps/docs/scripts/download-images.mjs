/**
 * Downloads every remote demo image used by the docs site into
 * `app/_assets/photos/`, and generates one `images.generated.ts` module per
 * consumer directory with literal static imports — so Next.js can emit
 * `blurDataURL` + intrinsic dimensions at build time.
 *
 * The presets demos are the exception: they serve plain files from
 * `public/photos/` (referenced as string URLs, no next/image), derived from
 * these assets — picsum.photos became unreliable (ERR_BLOCKED_BY_ORB /
 * hanging connections), and preset code must stay copy-pasteable outside
 * Next.js.
 *
 *   node scripts/download-images.mjs            # download missing + write modules
 *   node scripts/download-images.mjs --force    # re-download everything
 *
 * Sources & licenses:
 * - picsum.photos — serves Unsplash-licensed photography (free to download
 *   and use; https://unsplash.com/license via https://picsum.photos).
 * - upload.wikimedia.org — Blender open-movie posters, CC-BY 3.0
 *   (c) Blender Foundation (bigbuckbunny.org / elephantsdream.org /
 *   sintel.org / tearsofsteel.org).
 * - assets.mixkit.co — video poster frames, Mixkit License (free use).
 * - i.pravatar.cc — placeholder avatar (CC0 sources).
 * - cdn.jsdelivr.net — Khronos glTF-Sample-Assets screenshots (model
 *   licenses permit redistribution; see the KhronosGroup/glTF-Sample-Assets
 *   repository).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(__dirname, '..');
const assetsDir = path.join(docsRoot, 'app/_assets/photos');

const FORCE = process.argv.includes('--force');

/** @type {Map<string, string>} asset name -> remote URL */
const downloads = new Map();

/** Register a picsum seed at its canonical (largest-used) size. */
function picsum(name, w, h) {
  downloads.set(`${name}.jpg`, `https://picsum.photos/seed/${name}/${w}/${h}`);
  return `${name}.jpg`;
}

function remote(fileName, url) {
  downloads.set(fileName, url);
  return fileName;
}

/* ── Picsum manifests ────────────────────────────────────────────────────── */

// app/_data/lightbox-images.ts
const lb = [1, 2, 3, 4, 5, 6].map((i) => picsum(`lb${i}`, 1200, 800));

// app/_components/landing-demo.tsx
// Most sources deliberately DON'T match their tile's aspect (wide tiles get
// portrait sources and vice versa) so the open morph visibly changes shape —
// see the landing-demo.tsx comment.
const landing = {
  ramkaA: picsum('ramka-a', 1200, 1600),
  ramkaB: picsum('ramka-b', 1600, 1067),
  ramkaC: picsum('ramka-c', 1600, 1000),
  ramkaD: picsum('ramka-d', 1200, 1600),
  ramkaE: picsum('ramka-e', 1200, 1600),
  ramkaF: picsum('ramka-f', 1600, 1000),
  // ramka-g stays wide: the bride's face sits at the left of the master, so
  // portrait center-crops decapitate the composition.
  ramkaG: picsum('ramka-g', 1600, 1000),
  ramkaH: picsum('ramka-h', 1200, 1500),
  ramkaI: picsum('ramka-i', 1600, 1600),
  // ramka-j stays wide: the father walks at the right edge of the master
  // photo, so any portrait center-crop cuts him in half.
  ramkaJ: picsum('ramka-j', 1600, 900),
  ramkaK: picsum('ramka-k', 1200, 1600),
  ramkaL: picsum('ramka-l', 1600, 1600),
  ramkaM: picsum('ramka-m', 1600, 1000),
  ramkaN: picsum('ramka-n', 1200, 1600),
};

// app/(docs)/docs/lightbox/*.tsx
const docsLightbox = {
  docsHeroA: picsum('docs-hero-a', 1200, 800),
  docsHeroB: picsum('docs-hero-b', 1200, 800),
  docsHeroC: picsum('docs-hero-c', 1200, 800),
  morph1: picsum('morph1', 1200, 800),
  morph2: picsum('morph2', 1200, 800),
  morph3: picsum('morph3', 1200, 800),
  morph4: picsum('morph4', 1200, 800),
  morph5: picsum('morph5', 1200, 800),
  xfadeA: picsum('xfade-a', 1500, 1000),
  // Center-square of xfade-a (checked in). Used by the view-transitions
  // source-aspect Don’t demo — same scene, different intrinsic aspect.
  xfadeASquare: 'xfade-a-square.jpg',
  xfadeB: picsum('xfade-b', 1500, 1000),
  xfadeC: picsum('xfade-c', 1500, 1000),
  xfadeD: picsum('xfade-d', 1500, 1000),
  xfadeE: picsum('xfade-e', 1500, 1000),
  xfadeF: picsum('xfade-f', 1500, 1000),
  xfadeG: picsum('xfade-g', 1500, 1000),
  xfadeAva: picsum('xfade-ava', 900, 1200),
  xfadeJules: picsum('xfade-jules', 900, 1200),
  xfadeSam: picsum('xfade-sam', 900, 1200),
  xfadeMei: picsum('xfade-mei', 900, 1200),
  bbbPoster: remote(
    'bbb-poster.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Big_buck_bunny_poster_big.jpg/500px-Big_buck_bunny_poster_big.jpg',
  ),
};

// examples/lightbox/photos-app — 48 photos cycling six aspect ratios.
const PHOTOS_APP_ASPECTS = [
  [1600, 1067],
  [1067, 1600],
  [1600, 1600],
  [1600, 900],
  [1200, 1600],
  [1600, 1200],
];
const photosApp = Array.from({ length: 48 }, (_, i) => {
  const [w, h] = PHOTOS_APP_ASPECTS[i % PHOTOS_APP_ASPECTS.length];
  return picsum(`ramka-photos-${i}`, w, h);
});

// examples/lightbox/infinite-scroll — the simulated feed API pages through
// the photos-app pool (same already-downloaded assets, no extra bytes); the
// demo cycles it to keep the feed endless.
const infiniteScroll = photosApp;

// examples/lightbox/url-synced-state — full size = source scaled to 800px wide
// (matches the old fullUrl() logic: (400 / w) * 2).
const URL_SYNCED_STATE_DEFS = [
  ['mb-01', 600, 900],
  ['mb-02', 900, 600],
  ['mb-03', 800, 800],
  ['mb-04', 700, 1050],
  ['mb-05', 1200, 700],
  ['mb-06', 640, 820],
  ['mb-07', 960, 640],
  ['mb-08', 800, 1200],
  ['mb-09', 1000, 1000],
  ['mb-10', 1100, 620],
  ['mb-11', 620, 900],
  ['mb-12', 900, 900],
];
const urlSyncedState = URL_SYNCED_STATE_DEFS.map(([id, w, h]) =>
  picsum(id, 800, Math.round((h * 800) / w)),
);

// examples/lightbox/text-message
const textMessage = [1, 2, 3].map((i) => picsum(`msg${i}`, 1200, 1600));

// examples/lightbox/film-trailers — Wikimedia Commons posters (CC-BY,
// Blender Foundation). BBB poster shared with the crossfade docs demo.
const filmTrailers = {
  bbbPoster: docsLightbox.bbbPoster,
  edPoster: remote(
    'ed-poster.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/ElephantsDreamPoster.jpg/500px-ElephantsDreamPoster.jpg',
  ),
  sintelPoster: remote(
    'sintel-poster.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Sintel_poster.jpg/500px-Sintel_poster.jpg',
  ),
  tosPoster: remote(
    'tos-poster.png',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Tos-poster.png/500px-Tos-poster.png',
  ),
};

// debug/double-click-open
const doubleClick = {
  dblA: picsum('ramka-dbl-a', 1400, 900),
  dblB: picsum('ramka-dbl-b', 900, 1400),
  dblC: picsum('ramka-dbl-c', 1200, 1200),
  dblD: picsum('ramka-dbl-d', 1600, 900),
  dblE: picsum('ramka-dbl-e', 1000, 1250),
  dblF: picsum('ramka-dbl-f', 1300, 975),
};

// debug/real-estate-listing
const realEstate = {
  propHero: picsum('prop-hero', 1400, 900),
  propKitchen: picsum('prop-kitchen', 1400, 900),
  propBed: picsum('prop-bed', 900, 1400),
  propBath: picsum('prop-bath', 900, 1400),
  propTerrace: picsum('prop-terrace', 1400, 900),
  propDining: picsum('prop-dining', 1400, 900),
  propOffice: picsum('prop-office', 900, 1200),
  propPool: picsum('prop-pool', 1400, 900),
  propGarden: picsum('prop-garden', 1400, 900),
  propExt: picsum('prop-ext', 900, 1400),
  agentClaire: remote('agent-claire.jpg', 'https://i.pravatar.cc/150?u=agent-claire'),
};

// debug/thumbnail-strip — 24 photos cycling six aspect ratios.
const STRIP_ASPECTS = [
  [1200, 800],
  [800, 1200],
  [1200, 1200],
  [1400, 788],
  [1000, 1250],
  [1300, 975],
];
const thumbnailStrip = Array.from({ length: 24 }, (_, i) => {
  const [w, h] = STRIP_ASPECTS[i % STRIP_ASPECTS.length];
  return picsum(`ramka-strip-${i}`, w, h);
});

// debug/lightbox-overlays — 16 slides cycling six aspect ratios.
const OVERLAY_ASPECTS = [
  [1200, 800],
  [800, 1200],
  [1200, 1200],
  [1600, 900],
  [1000, 1250],
  [1300, 975],
];
const overlays = Array.from({ length: 16 }, (_, i) => {
  const [w, h] = OVERLAY_ASPECTS[i % OVERLAY_ASPECTS.length];
  return picsum(`ramka-overlay-${i}`, w, h);
});

// debug/dynamic-items — fixed pool cycled by item serial (was unbounded
// runtime-generated picsum seeds).
const DYNAMIC_ASPECTS = [
  [1200, 800],
  [800, 1200],
  [1200, 1200],
  [1600, 900],
];
const dynamicPool = Array.from({ length: 12 }, (_, i) => {
  const [w, h] = DYNAMIC_ASPECTS[i % DYNAMIC_ASPECTS.length];
  return picsum(`ramka-dynamic-pool-${i}`, w, h);
});

// debug/moodboard-snug — photos scaled to 800px wide like the moodboard,
// plus Mixkit video posters and Khronos GLB screenshots.
const MOODBOARD_SNUG_DEFS = [
  ['mb-s-01', 600, 900],
  ['mb-s-02', 900, 600],
  ['mb-s-03', 800, 800],
  ['mb-s-04', 700, 1050],
  ['mb-s-05', 1200, 700],
  ['mb-s-06', 640, 820],
  ['mb-s-07', 960, 640],
  ['mb-s-08', 800, 1200],
];
const moodboardSnug = MOODBOARD_SNUG_DEFS.map(([id, w, h]) =>
  picsum(id, 800, Math.round((h * 800) / w)),
);
const glbAssetBase = 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models';
const moodboardSnugExtras = {
  inksPoster: remote('mixkit-inks-poster.jpg', 'https://assets.mixkit.co/videos/44793/44793-thumb-720-0.jpg'),
  plasticinePoster: remote(
    'mixkit-plasticine-poster.jpg',
    'https://assets.mixkit.co/videos/47332/47332-thumb-720-0.jpg',
  ),
  shoeScreenshot: remote(
    'glb-shoe-screenshot.jpg',
    `${glbAssetBase}/MaterialsVariantsShoe/screenshot/screenshot.jpg`,
  ),
  bottleScreenshot: remote(
    'glb-bottle-screenshot.jpg',
    `${glbAssetBase}/WaterBottle/screenshot/screenshot.jpg`,
  ),
  chairScreenshot: remote(
    'glb-chair-screenshot.jpg',
    `${glbAssetBase}/ChairDamaskPurplegold/screenshot/screenshot.jpg`,
  ),
};

// app/debug/vt-motion
const vtMotion = picsum('ramka-vt-motion', 1200, 800);

/* ── Generated modules ───────────────────────────────────────────────────── */

/**
 * @type {Array<{
 *   out: string;
 *   named?: Record<string, string>;
 *   arrays?: Record<string, string[]>;
 * }>}
 * `named`: exportName -> asset file. `arrays`: exportName -> asset files.
 */
const modules = [
  {
    out: 'app/_data/images.generated.ts',
    arrays: { lightboxImageFiles: lb },
  },
  {
    out: 'app/_components/images.generated.ts',
    named: landing,
  },
  {
    out: 'app/(docs)/docs/lightbox/images.generated.ts',
    named: docsLightbox,
  },
  {
    out: 'app/(docs)/examples/lightbox/photos-app/images.generated.ts',
    arrays: { photoImages: photosApp },
  },
  {
    out: 'app/(docs)/examples/lightbox/infinite-scroll/images.generated.ts',
    arrays: { feedImages: infiniteScroll },
  },
  {
    out: 'app/(docs)/examples/lightbox/url-synced-state/images.generated.ts',
    arrays: { galleryImages: urlSyncedState },
  },
  {
    out: 'app/(docs)/examples/lightbox/text-message/images.generated.ts',
    arrays: { messageImageFiles: textMessage },
  },
  {
    out: 'app/(docs)/examples/lightbox/film-trailers/images.generated.ts',
    named: filmTrailers,
  },
  {
    out: 'app/(docs)/debug/double-click-open/images.generated.ts',
    named: doubleClick,
  },
  {
    out: 'app/(docs)/debug/real-estate-listing/images.generated.ts',
    named: realEstate,
  },
  {
    out: 'app/(docs)/debug/thumbnail-strip/images.generated.ts',
    arrays: { stripImages: thumbnailStrip },
  },
  {
    out: 'app/(docs)/debug/lightbox-overlays/images.generated.ts',
    arrays: { overlayImages: overlays },
  },
  {
    out: 'app/(docs)/debug/dynamic-items/images.generated.ts',
    arrays: { dynamicPoolImages: dynamicPool },
  },
  {
    out: 'app/(docs)/debug/moodboard-snug/images.generated.ts',
    named: moodboardSnugExtras,
    arrays: { moodboardSnugImages: moodboardSnug },
  },
  {
    out: 'app/debug/vt-motion/images.generated.ts',
    named: { vtMotionPhoto: vtMotion },
  },
];

/* ── Download ────────────────────────────────────────────────────────────── */

async function downloadOne(fileName, url) {
  const dest = path.join(assetsDir, fileName);
  if (!FORCE && fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    return { fileName, skipped: true };
  }
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024) {
    throw new Error(`Suspiciously small response (${buf.length}B) for ${url}`);
  }
  fs.writeFileSync(dest, buf);
  return { fileName, skipped: false, bytes: buf.length };
}

async function downloadAll() {
  fs.mkdirSync(assetsDir, { recursive: true });
  const entries = [...downloads.entries()];
  const CONCURRENCY = 8;
  let downloaded = 0;
  let skipped = 0;
  let index = 0;
  const failures = [];

  async function worker() {
    while (index < entries.length) {
      const [fileName, url] = entries[index++];
      try {
        const result = await downloadOne(fileName, url);
        if (result.skipped) skipped++;
        else {
          downloaded++;
          console.log(`  ✓ ${fileName} (${Math.round(result.bytes / 1024)} kB)`);
        }
      } catch (err) {
        failures.push({ fileName, url, err });
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  if (failures.length) {
    for (const { fileName, url, err } of failures) {
      console.error(`  ✗ ${fileName} — ${url}\n    ${err.message ?? err}`);
    }
    throw new Error(`${failures.length} download(s) failed`);
  }
  console.log(`Downloaded ${downloaded}, skipped ${skipped} (already present), total ${entries.length}.`);
}

/* ── Codegen ─────────────────────────────────────────────────────────────── */

function identifierFor(fileName) {
  const base = fileName.replace(/\.[a-z]+$/i, '');
  const camel = base.replace(/[-_.]+(\w)/g, (_, c) => c.toUpperCase());
  return /^\d/.test(camel) ? `img${camel}` : camel;
}

function writeModule({ out, named = {}, arrays = {} }) {
  const outPath = path.join(docsRoot, out);
  const relToAssets = path
    .relative(path.dirname(outPath), assetsDir)
    .split(path.sep)
    .join('/');

  const imports = new Map(); // fileName -> local identifier
  const used = new Set();
  const importFor = (fileName) => {
    let id = imports.get(fileName);
    if (id) return id;
    id = identifierFor(fileName);
    while (used.has(id)) id = `${id}_`;
    used.add(id);
    imports.set(fileName, id);
    return id;
  };

  const namedLines = Object.entries(named).map(([exportName, fileName]) => {
    const id = importFor(fileName);
    return id === exportName ? `export { ${id} };` : `export { ${id} as ${exportName} };`;
  });

  const arrayLines = Object.entries(arrays).map(([exportName, files]) => {
    const ids = files.map((f) => importFor(f));
    return `export const ${exportName} = [\n${ids.map((id) => `  ${id},`).join('\n')}\n];`;
  });

  const importLines = [...imports.entries()].map(
    ([fileName, id]) => `import ${id} from '${relToAssets}/${fileName}';`,
  );

  const content = `/**
 * AUTO-GENERATED by apps/docs/scripts/download-images.mjs — do not edit.
 * Static imports so Next.js emits blurDataURL + intrinsic dimensions.
 */
${importLines.join('\n')}

${[...namedLines, ...arrayLines].join('\n')}
`;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content);
  console.log(`Wrote ${out} (${imports.size} image(s))`);
}

async function main() {
  await downloadAll();
  for (const mod of modules) writeModule(mod);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
