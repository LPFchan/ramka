'use client';

import { notFound } from 'next/navigation';
import * as React from 'react';
import { Lightbox, useLightboxItemContext, useLightboxSizes } from 'ramka';

import {
  LightboxGallery,
  type LightboxGalleryItem,
  triggerFocusClass,
} from '../../../_components/lightbox-chrome';

/** Resting slot. 400px × 2× DPR = 800w at 1× zoom, so 2× / 4× still have a larger candidate. */
const SIZES_BASE = '400px';

type Swatch = {
  w: number;
  h: number;
  color: string;
  label: string;
  src: string;
};

type DemoItem = LightboxGalleryItem & {
  sizesBase: string;
  swatches: Swatch[];
  srcSet: string;
};

function makeItem(
  id: string,
  alt: string,
  pairs: readonly { w: number; h: number; color: string; label: string }[],
): DemoItem {
  const swatches: Swatch[] = pairs.map((p) => ({
    ...p,
    src: `/srcset-swatches/${id}-${p.w}.svg`,
  }));
  const largest = swatches[swatches.length - 1]!;
  const thumb = swatches[0]!;
  const fallback = swatches[1] ?? thumb;
  return {
    id,
    alt,
    caption: alt,
    width: largest.w,
    height: largest.h,
    src: fallback.src,
    thumb: thumb.src,
    sizesBase: SIZES_BASE,
    swatches,
    srcSet: swatches.map((s) => `${s.src} ${s.w}w`).join(', '),
  };
}

const ITEMS: DemoItem[] = [
  makeItem('landscape', 'Landscape 4∶3 — warm steps', [
    { w: 400, h: 300, color: '#ef4444', label: '400w' },
    { w: 800, h: 600, color: '#f59e0b', label: '800w' },
    { w: 1600, h: 1200, color: '#10b981', label: '1600w' },
    { w: 3200, h: 2400, color: '#3b82f6', label: '3200w' },
  ]),
  makeItem('portrait', 'Portrait 3∶4 — cool steps', [
    { w: 300, h: 400, color: '#7c3aed', label: '300w' },
    { w: 600, h: 800, color: '#ec4899', label: '600w' },
    { w: 1200, h: 1600, color: '#06b6d4', label: '1200w' },
    { w: 2400, h: 3200, color: '#84cc16', label: '2400w' },
  ]),
];

type HudState = {
  zoom: number;
  sizes: string;
  label: string;
  color: string;
  width: number;
  height: number;
  dpr: number;
  currentSrc: string;
};

function matchSwatch(swatches: Swatch[], currentSrc: string): Swatch | undefined {
  return swatches.find((s) => currentSrc.includes(`-${s.w}.svg`));
}

/**
 * Chromium/WebKit often keep the first srcset pick when only `sizes` changes.
 * Re-assigning srcset after sizes is the smallest kick that re-runs the UA picker.
 */
function reselectSrcset(img: HTMLImageElement, sizes: string, srcset: string) {
  img.sizes = sizes;
  img.removeAttribute('srcset');
  img.setAttribute('srcset', srcset);
}

function SrcsetSwatch({
  item,
  zoom,
  onHud,
}: {
  item: DemoItem;
  zoom: number;
  onHud: (next: HudState) => void;
}) {
  const sizes = useLightboxSizes(item.sizesBase);
  const active = useLightboxItemContext()?.active ?? false;
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const [currentSrc, setCurrentSrc] = React.useState('');

  const syncSrc = React.useCallback(() => {
    const src = imgRef.current?.currentSrc ?? '';
    setCurrentSrc((prev) => (prev === src ? prev : src));
  }, []);

  React.useLayoutEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    reselectSrcset(img, sizes, item.srcSet);
    syncSrc();
  }, [item.srcSet, sizes, syncSrc]);

  React.useEffect(() => {
    if (!active) return;
    const swatch = matchSwatch(item.swatches, currentSrc);
    onHud({
      zoom,
      sizes,
      label: swatch?.label ?? '…',
      color: swatch?.color ?? '#737373',
      width: swatch?.w ?? 0,
      height: swatch?.h ?? 0,
      dpr: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
      currentSrc: swatch?.src.split('/').pop() ?? currentSrc,
    });
  }, [active, currentSrc, item.swatches, onHud, sizes, zoom]);

  return (
    <img
      ref={imgRef}
      src={item.src}
      srcSet={item.srcSet}
      sizes={sizes}
      width={item.width}
      height={item.height}
      alt={item.alt}
      loading="eager"
      decoding="async"
      draggable={false}
      className="select-none"
      onLoad={syncSrc}
    />
  );
}

function Hud({ state }: { state: HudState | null }) {
  if (!state) return null;
  return (
    <div className="pointer-events-none absolute left-3 top-[calc(0.75rem+env(safe-area-inset-top,0))] z-30 max-w-[min(100%-1.5rem,22rem)] rounded-xl border border-black/10 bg-white/80 px-3 py-2 font-mono text-[11px] leading-relaxed text-neutral-800 shadow-sm backdrop-blur-md dark:border-white/15 dark:bg-neutral-950/70 dark:text-neutral-100">
      <div className="flex items-center gap-2">
        <span
          className="inline-block size-3 shrink-0 rounded-sm ring-1 ring-black/20 dark:ring-white/30"
          style={{ background: state.color }}
        />
        <span className="font-semibold tracking-wide">{state.label}</span>
        {state.width > 0 ? (
          <span className="text-neutral-500 dark:text-neutral-400">
            {state.width}×{state.height}
          </span>
        ) : null}
      </div>
      <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 text-neutral-600 dark:text-neutral-300">
        <span>zoom</span>
        <span>{state.zoom.toFixed(2)}x</span>
        <span>sizes</span>
        <span>{state.sizes}</span>
        <span>src</span>
        <span className="truncate">{state.currentSrc || '…'}</span>
        <span>dpr</span>
        <span>{state.dpr}</span>
      </div>
    </div>
  );
}

/**
 * Dev-only: prove `useLightboxSizes` updates `sizes` at 2× / 4× zoom so the
 * browser can pick a denser `srcset` candidate. Each candidate is a unique
 * color + labeled SVG so a refetch is obvious.
 */
export default function SrcsetZoomDebugPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const [hud, setHud] = React.useState<HudState | null>(null);
  const onHud = React.useCallback((next: HudState) => {
    setHud((prev) =>
      prev &&
      prev.zoom === next.zoom &&
      prev.sizes === next.sizes &&
      prev.label === next.label &&
      prev.color === next.color &&
      prev.width === next.width &&
      prev.height === next.height &&
      prev.dpr === next.dpr &&
      prev.currentSrc === next.currentSrc
        ? prev
        : next,
    );
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
      <header>
        <p className="text-[11px] font-semibold tracking-widest text-amber-700 uppercase dark:text-amber-400">
          Debug · development only
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Srcset zoom
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
          <code className="text-sm">useLightboxSizes(&apos;{SIZES_BASE}&apos;)</code> scales the
          native <code className="text-sm">sizes</code> attribute at snapped 2× / 4× zoom. The
          browser then re-picks from <code className="text-sm">srcset</code>. Each candidate is a
          flat SVG with its own fill and painted dimensions — when the file changes, the color and
          label change with it.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">What to verify</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
          <li>
            Open at 1× — HUD <code className="text-xs">sizes</code> is{' '}
            <code className="text-xs">{SIZES_BASE}</code>. On a 2× display that should select the
            second swatch (800w / 600w).
          </li>
          <li>Zoom to 2× (double-click or Zoom in) — color / label step up one candidate</li>
          <li>Zoom to 4× — another step. Checker cells get finer; the painted size in the image updates</li>
          <li>
            A 400px base is intentional so 1× does not already consume the largest file on a retina
            screen (<code className="text-xs">100vw × dpr</code> often would)
          </li>
          <li>
            <code className="text-xs">maxZoom={'{4}'}</code> is set explicitly — auto max-zoom would
            cap at the <em>currently loaded</em> file&apos;s native pixels and block the upgrade
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Candidates</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {ITEMS.map((item) => (
            <div key={item.id}>
              <p className="mb-2 text-xs font-medium text-neutral-500">{item.alt}</p>
              <div className="flex flex-wrap gap-2">
                {item.swatches.map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center gap-2 rounded-lg border border-neutral-200 px-2 py-1.5 text-xs dark:border-neutral-800"
                  >
                    <span className="size-4 rounded-sm" style={{ background: s.color }} />
                    <span className="font-mono tabular-nums">
                      {s.label}
                      <span className="text-neutral-400">
                        {' '}
                        {s.w}×{s.h}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Lightbox.Root loop viewTransition>
        <div className="grid max-w-lg grid-cols-2 gap-4">
          {ITEMS.map((item, i) => (
            <Lightbox.Trigger key={item.id} index={i} className={`${triggerFocusClass} overflow-hidden rounded-2xl`}>
              {({ imageRef }) => (
                <img
                  ref={imageRef}
                  src={item.thumb}
                  alt={item.alt}
                  width={item.swatches[0]!.w}
                  height={item.swatches[0]!.h}
                  className="block aspect-4/3 w-full object-cover"
                />
              )}
            </Lightbox.Trigger>
          ))}
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          {ITEMS.length} tiles · pinch, double-click, or use Zoom in / Zoom out
        </p>

        <LightboxGallery
          items={ITEMS}
          ariaLabel="Srcset zoom debug gallery"
          maxZoom={4}
          thumbnails="never"
          overlay={<Hud state={hud} />}
          renderItem={(item) => {
            const demo = ITEMS.find((entry) => entry.id === item.id);
            if (!demo) return null;
            return (
              <Lightbox.Zoom maxZoom={4}>
                {({ zoom }) => (
                  <Lightbox.Media
                    width={demo.width}
                    height={demo.height}
                    className="overflow-hidden rounded-none md:rounded-lg"
                  >
                    <SrcsetSwatch item={demo} zoom={zoom} onHud={onHud} />
                  </Lightbox.Media>
                )}
              </Lightbox.Zoom>
            );
          }}
        />
      </Lightbox.Root>
    </div>
  );
}
