'use client';

import { notFound } from 'next/navigation';
import * as React from 'react';
import { Lightbox } from 'ramka';
import { X } from 'lucide-react';

import {
  imgDims,
  lightboxChromeButton,
  triggerFocusClass,
  triggerMorphHideClass,
} from '../../_components/lightbox-chrome';

import './strips.css';

type Photo = {
  id: string;
  src: string;
  thumb: string;
  alt: string;
  caption: string;
  aspect: number;
};

const ASPECTS: ReadonlyArray<readonly [number, number]> = [
  [1200, 800], // 3:2
  [800, 1200], // 2:3
  [1200, 1200], // 1:1
  [1400, 788], // ~16:9
  [1000, 1250], // 4:5
  [1300, 975], // 4:3
];

const photos: Photo[] = ASPECTS.map(([w, h], i) => {
  const thumbScale = 320 / Math.max(w, h);
  const tw = Math.round(w * thumbScale);
  const th = Math.round(h * thumbScale);
  return {
    id: `strip-demo-${i}`,
    src: `https://picsum.photos/seed/ramka-strip-${i}/${w}/${h}`,
    thumb: `https://picsum.photos/seed/ramka-strip-${i}/${tw}/${th}`,
    alt: `Photo ${i + 1}`,
    caption: `Frame ${i + 1}`,
    aspect: w / h,
  };
});

const TILTS = [-3.5, 2.2, -1.4, 3.1, -2.6, 1.8];

const chromePullHide =
  'transition-opacity duration-200 [[data-pulling]_&]:pointer-events-none [[data-pulling]_&]:opacity-0 [[data-pull-dismissing]_&]:pointer-events-none [[data-pull-dismissing]_&]:opacity-0';

function DemoShell({
  title,
  description,
  contentClassName,
  strip,
}: {
  title: string;
  description: string;
  /** Sets `--lightbox-inset-bottom` for this strip’s chrome height. */
  contentClassName: string;
  strip: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-[0_1px_0_rgb(0_0_0/0.03)] dark:border-neutral-800 dark:bg-neutral-950/60 dark:shadow-none sm:p-6">
      <header className="mb-4 max-w-xl">
        <h2 className="text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          {description}
        </p>
      </header>

      <Lightbox.Root loop awaitImageDecode={350}>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {photos.map((photo, i) => (
            <Lightbox.Trigger
              key={photo.id}
              index={i}
              className={`relative aspect-square overflow-hidden rounded-lg bg-neutral-100 ${triggerFocusClass} dark:bg-neutral-900`}
            >
              <img
                {...(imgDims(photo.thumb) ?? {})}
                src={photo.thumb}
                alt={photo.alt}
                className={`h-full w-full object-cover ${triggerMorphHideClass}`}
                draggable={false}
              />
            </Lightbox.Trigger>
          ))}
        </div>

        <Lightbox.Portal>
          <Lightbox.Backdrop className="lightbox-demo-backdrop lightbox-demo-backdrop-light fixed inset-0" />
          <Lightbox.Content
            aria-label={title}
            pullToClose
            className={`lightbox-demo-content ${contentClassName} fixed inset-0 flex flex-col overscroll-contain outline-none`}
          >
            <Lightbox.Slides
              aria-label="Full-size images"
              preload={1}
              className="lightbox-demo-slides flex-1 gap-5 [&::-webkit-scrollbar]:hidden md:gap-0"
            >
              {photos.map((photo, i) => {
                const dims = imgDims(photo.src);
                return (
                  <Lightbox.Slide key={photo.id} className="lightbox-demo-slide-pad h-full">
                    <Lightbox.Item index={i} caption={photo.caption}>
                      <Lightbox.Zoom maxZoom={4}>
                        <Lightbox.Media
                          {...(dims ?? {})}
                          className="overflow-hidden rounded-none md:rounded-lg"
                        >
                          <img
                            {...(dims ?? {})}
                            src={photo.src}
                            alt={photo.alt}
                            loading="eager"
                            draggable={false}
                            className="select-none"
                          />
                        </Lightbox.Media>
                      </Lightbox.Zoom>
                    </Lightbox.Item>
                  </Lightbox.Slide>
                );
              })}
            </Lightbox.Slides>

            <div
              className={`absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-30 ${chromePullHide}`}
            >
              <Lightbox.Close className={lightboxChromeButton} aria-label="Close">
                <X aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </Lightbox.Close>
            </div>

            <div
              className={`pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 px-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] [[data-zoomed]_&]:opacity-0 ${chromePullHide}`}
            >
              <Lightbox.Caption className="pointer-events-auto block min-h-[1.1rem] max-w-full truncate px-4 text-center text-sm font-medium text-neutral-800 drop-shadow-[0_1px_1px_rgb(255_255_255/0.7)] dark:text-neutral-100 dark:drop-shadow-[0_1px_2px_rgb(0_0_0/0.65)]" />
              <div className="pointer-events-auto w-full flex justify-center">{strip}</div>
            </div>
          </Lightbox.Content>
        </Lightbox.Portal>
      </Lightbox.Root>
    </section>
  );
}

function BareStrip() {
  return (
    <Lightbox.ThumbnailStrip className="ts-debug-strip ts-debug-bare">
      <Lightbox.ThumbnailStripTrack aria-label="Thumbnails">
        {photos.map((photo, i) => (
          <Lightbox.Thumbnail key={photo.id} index={i}>
            <img src={photo.thumb} alt="" draggable={false} />
          </Lightbox.Thumbnail>
        ))}
      </Lightbox.ThumbnailStripTrack>
    </Lightbox.ThumbnailStrip>
  );
}

function CirclesStrip() {
  return (
    <Lightbox.ThumbnailStrip className="ts-debug-strip ts-debug-circles">
      <Lightbox.ThumbnailStripTrack aria-label="Thumbnails">
        {photos.map((photo, i) => (
          <Lightbox.Thumbnail key={photo.id} index={i}>
            <img src={photo.thumb} alt="" draggable={false} />
          </Lightbox.Thumbnail>
        ))}
      </Lightbox.ThumbnailStripTrack>
      <Lightbox.ThumbnailStripIndicator aria-hidden />
    </Lightbox.ThumbnailStrip>
  );
}

function ChipsStrip() {
  return (
    <Lightbox.ThumbnailStrip className="ts-debug-strip ts-debug-chips">
      <Lightbox.ThumbnailStripTrack aria-label="Slide index">
        {photos.map((photo, i) => (
          <Lightbox.Thumbnail key={photo.id} index={i}>
            {String(i + 1).padStart(2, '0')}
          </Lightbox.Thumbnail>
        ))}
      </Lightbox.ThumbnailStripTrack>
      <Lightbox.ThumbnailStripIndicator aria-hidden />
    </Lightbox.ThumbnailStrip>
  );
}

function PolaroidStrip() {
  return (
    <Lightbox.ThumbnailStrip className="ts-debug-strip ts-debug-polaroid">
      <Lightbox.ThumbnailStripTrack aria-label="Thumbnails">
        {photos.map((photo, i) => (
          <Lightbox.Thumbnail
            key={photo.id}
            index={i}
            style={{ ['--ts-tilt' as string]: `${TILTS[i % TILTS.length]}deg` }}
          >
            <img src={photo.thumb} alt="" draggable={false} />
          </Lightbox.Thumbnail>
        ))}
      </Lightbox.ThumbnailStripTrack>
      <Lightbox.ThumbnailStripIndicator aria-hidden>
        <span className="ts-debug-polaroid-tape" />
      </Lightbox.ThumbnailStripIndicator>
    </Lightbox.ThumbnailStrip>
  );
}

function FadeStrip() {
  return (
    <Lightbox.ThumbnailStrip className="ts-debug-strip ts-debug-fade">
      <Lightbox.ThumbnailStripTrack aria-label="Thumbnails">
        {photos.map((photo, i) => (
          <Lightbox.Thumbnail
            key={photo.id}
            index={i}
            style={{ ['--ts-aspect' as string]: String(photo.aspect) }}
          >
            <img src={photo.thumb} alt="" draggable={false} />
          </Lightbox.Thumbnail>
        ))}
      </Lightbox.ThumbnailStripTrack>
      <Lightbox.ThumbnailStripIndicator aria-hidden />
    </Lightbox.ThumbnailStrip>
  );
}

export default function ThumbnailStripDebugPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400">
          Debug · development only
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          ThumbnailStrip recipes
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
          Same unstyled primitive, different consumer CSS. Open any grid — the strip stays
          scroll-linked and midline-centered; only the skin changes.
        </p>
      </header>

      <DemoShell
        title="1 · Bare"
        description="Squares, gap, active opacity. No indicator — the smallest useful strip."
        contentClassName="ts-debug-content-bare"
        strip={<BareStrip />}
      />

      <DemoShell
        title="2 · Circles"
        description="Round thumbs with a stationary hairline ring on the midline."
        contentClassName="ts-debug-content-circles"
        strip={<CirclesStrip />}
      />

      <DemoShell
        title="3 · Index chips"
        description="No images in the strip — monospace indices, fill on the active chip."
        contentClassName="ts-debug-content-chips"
        strip={<ChipsStrip />}
      />

      <DemoShell
        title="4 · Polaroids"
        description="Tilted mattes that settle when centered — selection is a scrapbook tape tab, not a frame."
        contentClassName="ts-debug-content-polaroid"
        strip={<PolaroidStrip />}
      />

      <DemoShell
        title="5 · Edge fade"
        description="Per-thumb aspect widths, soft side mask, and a simple fixed frame."
        contentClassName="ts-debug-content-fade"
        strip={<FadeStrip />}
      />
    </div>
  );
}
