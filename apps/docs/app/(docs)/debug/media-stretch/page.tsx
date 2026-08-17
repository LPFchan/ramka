'use client';

import { notFound } from 'next/navigation';
import * as React from 'react';
import { Lightbox } from 'ramka';

/** Small intrinsic size on purpose: if Media wrongly used natural pixels
 *  instead of the cqw/cqh fit-box, the image would stay tiny in a large stage.
 *  Upscaling to fill the stage proves “fill available space”. */
const WIDTH = 320;
const HEIGHT = 180;
const RATIO = WIDTH / HEIGHT;

/** Inline SVG — no network / redirect flakiness. Distinctive 16:9 stripes. */
const SRC =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#38bdf8"/>
          <stop offset="50%" stop-color="#e879f9"/>
          <stop offset="100%" stop-color="#fbbf24"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
        font-family="ui-sans-serif,system-ui" font-size="28" fill="white" fill-opacity="0.9">
        ${WIDTH}×${HEIGHT}
      </text>
    </svg>`,
  );

type LimitAxis = 'width' | 'height' | 'exact';

type Check = {
  id: string;
  label: string;
  pass: boolean;
  detail?: string;
};

type Measure = {
  container: { w: number; h: number; ratio: number };
  media: { w: number; h: number; display: string; ratio: number };
  img: { w: number; h: number; opacity: string; visibility: string };
  expected: { w: number; h: number };
  limit: LimitAxis;
  checks: Check[];
  allPass: boolean;
};

const PRESETS: { id: string; label: string; w: number; h: number; hint: string }[] = [
  { id: 'wide', label: 'Wide', w: 720, h: 280, hint: 'height-limited → side gaps' },
  { id: 'tall', label: 'Tall', w: 280, h: 480, hint: 'width-limited → top/bottom gaps' },
  { id: 'square', label: 'Square', w: 360, h: 360, hint: 'width-limited (16:9 inside)' },
  { id: 'match', label: '16:9', w: 640, h: 360, hint: 'exact aspect → no gaps' },
];

function near(a: number, b: number, eps = 1.5) {
  return Math.abs(a - b) <= eps;
}

/** Visible leftover vs subpixel/near-exact. Must match limit classification
 *  and the letterbox check — a tighter “exact” epsilon than this gap threshold
 *  false-fails while dragging through 16:9 (1px leftover, still called
 *  width/height-limited). */
const LETTERBOX_PX = 2;

function expectedFitBox(cw: number, ch: number) {
  // Mirrors Media: width = min(100cqw, 100cqh * ratio); height from aspect-ratio.
  const widthLimited = cw <= ch * RATIO;
  const w = widthLimited ? cw : ch * RATIO;
  const h = w / RATIO;
  const gapX = Math.max(0, cw - w);
  const gapY = Math.max(0, ch - h);
  const limit: LimitAxis =
    gapX < LETTERBOX_PX && gapY < LETTERBOX_PX ? 'exact' : widthLimited ? 'width' : 'height';
  return { w, h, limit };
}

/**
 * Dev-only: prove Media’s structural `display: grid` stretches a direct `<img>`
 * child to the fit-box, and that the fit-box letterboxes inside a resizable
 * size container.
 */
export default function MediaStretchDebugPage() {
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const mediaRef = React.useRef<HTMLDivElement | null>(null);
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const ignorePresetClearRef = React.useRef(false);
  const [measure, setMeasure] = React.useState<Measure | null>(null);
  const [presetId, setPresetId] = React.useState<string | null>('wide');

  const applyPreset = React.useCallback((w: number, h: number, id: string) => {
    const stage = stageRef.current;
    if (!stage) return;
    ignorePresetClearRef.current = true;
    stage.style.width = `${w}px`;
    stage.style.height = `${h}px`;
    setPresetId(id);
  }, []);

  const read = React.useCallback(() => {
    const stage = stageRef.current;
    const media = mediaRef.current;
    const img = imgRef.current;
    if (!stage || !media || !img) return;

    // cqw/cqh resolve against the size container’s *content box*.
    // getBoundingClientRect() is the border box — a 1px border on each side
    // would falsely inflate expected width by 2px (exactly the failure mode
    // we hit with the dashed stage border).
    const cw = stage.clientWidth;
    const ch = stage.clientHeight;
    const mr = media.getBoundingClientRect();
    const ir = img.getBoundingClientRect();
    const mediaCs = getComputedStyle(media);
    const imgCs = getComputedStyle(img);
    const { w: expectedW, h: expectedH, limit } = expectedFitBox(cw, ch);
    const mediaRatio = mr.height > 0 ? mr.width / mr.height : 0;
    const containerRatio = ch > 0 ? cw / ch : 0;

    const gapX = Math.max(0, cw - mr.width);
    const gapY = Math.max(0, ch - mr.height);

    const checks: Check[] = [
      {
        id: 'grid',
        label: 'Media is display: grid',
        pass: mediaCs.display === 'grid',
        detail: mediaCs.display,
      },
      {
        id: 'stretch',
        label: 'img fills Media (no size-full)',
        pass: near(mr.width, ir.width) && near(mr.height, ir.height) && mr.width > 0,
        detail: `Δ ${Math.abs(mr.width - ir.width).toFixed(1)}×${Math.abs(mr.height - ir.height).toFixed(1)}px`,
      },
      {
        id: 'aspect',
        label: `Media keeps ${WIDTH}:${HEIGHT} aspect`,
        pass: near(mediaRatio, RATIO, 0.02),
        detail: `ratio ${mediaRatio.toFixed(4)} (want ${RATIO.toFixed(4)})`,
      },
      {
        id: 'fit',
        label: 'Fit-box matches min(cqw, cqh × w/h)',
        pass: near(mr.width, expectedW) && near(mr.height, expectedH),
        detail: `got ${mr.width.toFixed(1)}×${mr.height.toFixed(1)}, want ${expectedW.toFixed(1)}×${expectedH.toFixed(1)}`,
      },
      {
        id: 'visible',
        label: 'img stays visible',
        pass: imgCs.opacity !== '0' && imgCs.visibility !== 'hidden',
        detail: `opacity ${imgCs.opacity}, visibility ${imgCs.visibility}`,
      },
      {
        id: 'upscale',
        label: `Upscales past intrinsic ${WIDTH}×${HEIGHT}`,
        pass: expectedW > WIDTH + 1 ? mr.width > WIDTH + 1 : true,
        detail:
          expectedW > WIDTH + 1
            ? `Media ${mr.width.toFixed(0)}px wide (intrinsic ${WIDTH})`
            : 'stage smaller than intrinsic — N/A',
      },
      {
        id: 'letterbox',
        label:
          limit === 'exact'
            ? 'Exact aspect — no letterbox gaps'
            : limit === 'width'
              ? 'Width-limited — gaps on top/bottom'
              : 'Height-limited — gaps on sides',
        pass:
          limit === 'exact'
            ? gapX < LETTERBOX_PX && gapY < LETTERBOX_PX
            : limit === 'width'
              ? gapY >= LETTERBOX_PX && gapX < LETTERBOX_PX
              : gapX >= LETTERBOX_PX && gapY < LETTERBOX_PX,
        detail: `container gaps ${gapX.toFixed(1)}×${gapY.toFixed(1)}px`,
      },
    ];

    setMeasure({
      container: { w: cw, h: ch, ratio: containerRatio },
      media: { w: mr.width, h: mr.height, display: mediaCs.display, ratio: mediaRatio },
      img: {
        w: ir.width,
        h: ir.height,
        opacity: imgCs.opacity,
        visibility: imgCs.visibility,
      },
      expected: { w: expectedW, h: expectedH },
      limit,
      checks,
      allPass: checks.every((c) => c.pass),
    });
  }, []);

  React.useLayoutEffect(() => {
    applyPreset(720, 280, 'wide');
  }, [applyPreset]);

  React.useLayoutEffect(() => {
    read();
    const stage = stageRef.current;
    const media = mediaRef.current;
    if (!stage || !media) return;
    const ro = new ResizeObserver(() => {
      if (ignorePresetClearRef.current) {
        ignorePresetClearRef.current = false;
      } else {
        setPresetId(null);
      }
      read();
    });
    ro.observe(stage);
    ro.observe(media);
    window.addEventListener('resize', read);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', read);
    };
  }, [read]);

  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400">
          Debug · development only
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Media stretch + letterbox
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
          Drag the stage’s bottom-right handle (or use presets) to change the size container. Media
          uses a small {WIDTH}×{HEIGHT} source (same 16:9 aspect). It should still upscale to fill the
          stage’s inscribed fit-box — if it stayed {WIDTH}px wide, fill is broken.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => applyPreset(p.w, p.h, p.id)}
            title={p.hint}
            className={
              presetId === p.id
                ? 'rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800'
            }
          >
            {p.label}
            <span className="ml-1.5 text-xs opacity-60">
              {p.w}×{p.h}
            </span>
          </button>
        ))}
      </div>

      <div
        className={
          measure == null
            ? 'rounded-lg border border-neutral-200 px-4 py-3 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400'
            : measure.allPass
              ? 'rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
              : 'rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100'
        }
      >
        {measure == null ? (
          'Measuring…'
        ) : (
          <div className="space-y-2">
            <p className="font-medium">{measure.allPass ? 'All checks passing' : 'Some checks failing'}</p>
            <p className="text-xs opacity-80">
              container {measure.container.w.toFixed(0)}×{measure.container.h.toFixed(0)} (r{' '}
              {measure.container.ratio.toFixed(3)}) · Media {measure.media.w.toFixed(0)}×
              {measure.media.h.toFixed(0)} · limit {measure.limit}
            </p>
            <ul className="mt-2 space-y-1">
              {measure.checks.map((c) => (
                <li key={c.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className={c.pass ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}>
                    {c.pass ? '✓' : '✗'}
                  </span>
                  <span>{c.label}</span>
                  {c.detail ? <span className="text-xs opacity-70">{c.detail}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="relative max-w-full">
        <div
          ref={stageRef}
          className="flex max-w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-neutral-300 bg-neutral-200/80 dark:border-neutral-600 dark:bg-neutral-800/80"
          // Size container for Media’s cqw/cqh fit-box (Zoom normally provides this).
          // `resize: both` — drag the corner to letterbox / pillarbox.
          style={{
            containerType: 'size',
            resize: 'both',
            width: 720,
            height: 280,
            minWidth: 160,
            minHeight: 120,
            maxWidth: '100%',
          }}
        >
          <Lightbox.Media
            ref={mediaRef}
            width={WIDTH}
            height={HEIGHT}
            className="outline outline-2 outline-offset-[-2px] outline-sky-500"
            data-testid="debug-media"
          >
            {/* Intentionally no size-full / w-full / h-full */}
            <img
              ref={imgRef}
              width={WIDTH}
              height={HEIGHT}
              src={SRC}
              alt="Stretch probe"
              onLoad={read}
              className="outline outline-2 outline-offset-[-4px] outline-fuchsia-500"
              data-testid="debug-img"
            />
          </Lightbox.Media>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Resize handle: bottom-right corner of the dashed stage. Gray = unused container (letterbox /
          pillarbox).
        </p>
      </div>

      <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
        <li>
          <span className="text-sky-600 dark:text-sky-400">Blue outline</span> — Media host (fit-box)
        </li>
        <li>
          <span className="text-fuchsia-600 dark:text-fuchsia-400">Pink outline</span> — img (should
          coincide with blue)
        </li>
        <li>
          Fit formula: <code className="text-xs">min(100cqw, 100cqh × {RATIO.toFixed(4)})</code> +{' '}
          <code className="text-xs">aspect-ratio: {WIDTH} / {HEIGHT}</code>
        </li>
      </ul>
    </div>
  );
}
