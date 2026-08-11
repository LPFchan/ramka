'use client';

import { notFound } from 'next/navigation';
import * as React from 'react';
import { useLightboxContext } from 'ramka';

import { imgDims } from '../../../_components/lightbox-chrome';
import { Lightbox, type LightboxItem } from '../../presets/default/lightbox';

import { OverlayTestPanel } from './overlay-test-panel';

const ASPECTS: ReadonlyArray<readonly [number, number]> = [
  [1200, 800],
  [800, 1200],
  [1200, 1200],
  [1600, 900],
  [1000, 1250],
  [1300, 975],
];

const SLIDE_COUNT = 16;
const TRIGGER_COUNT = 8;

const slides: LightboxItem[] = Array.from({ length: SLIDE_COUNT }, (_, i) => {
  const [w, h] = ASPECTS[i % ASPECTS.length]!;
  const thumbScale = 320 / Math.max(w, h);
  const tw = Math.round(w * thumbScale);
  const th = Math.round(h * thumbScale);
  return {
    id: `overlay-debug-${i}`,
    src: `https://picsum.photos/seed/ramka-overlay-${i}/${w}/${h}`,
    thumb: `https://picsum.photos/seed/ramka-overlay-${i}/${tw}/${th}`,
    alt: `Overlay test slide ${i + 1}`,
    caption: `Slide ${i + 1} · ${w}×${h}`,
    width: w,
    height: h,
  };
});

function itemAspectRatio(item: LightboxItem) {
  return item.width / item.height;
}

function OverlayPanelBridge() {
  const { activeIndex, itemCount } = useLightboxContext();
  return <OverlayTestPanel slideIndex={activeIndex} slideCount={itemCount} />;
}

function OverlayDebugGallery({ items }: { items: LightboxItem[] }) {
  const [slidesLayout, setSlidesLayout] = React.useState<'bleed' | 'snug'>('bleed');
  const snug = slidesLayout === 'snug';

  const snugEdgeRatios =
    snug && items.length > 0
      ? {
          start: itemAspectRatio(items[0]!),
          end: itemAspectRatio(items[items.length - 1]!),
        }
      : null;

  return (
    <Lightbox.Portal>
      <Lightbox.Backdrop />
      <Lightbox.Content
        aria-label="Lightbox overlay compatibility test"
        className={snug ? 'lb-content-snug' : undefined}
      >
        <Lightbox.Slides
          key={slidesLayout}
          aria-label="Full-size images"
          preload={2}
          className={snug ? 'lb-slides-snug' : undefined}
          style={
            snugEdgeRatios
              ? ({
                  '--lightbox-snug-ratio-start': snugEdgeRatios.start,
                  '--lightbox-snug-ratio-end': snugEdgeRatios.end,
                } as React.CSSProperties)
              : undefined
          }
        >
          {items.map((item, i) => {
            const ratio = itemAspectRatio(item);
            return (
              <Lightbox.Slide
                key={item.id ?? i}
                className={snug ? 'lb-slide-snug' : undefined}
                style={
                  snug
                    ? ({ '--lightbox-snug-ratio': ratio } as React.CSSProperties)
                    : undefined
                }
              >
                <Lightbox.Item index={i} caption={item.caption ?? item.alt}>
                  <Lightbox.Zoom maxZoom={6}>
                    <Lightbox.Media width={item.width} height={item.height}>
                      <img
                        width={item.width}
                        height={item.height}
                        src={item.src}
                        alt={item.alt}
                        loading="eager"
                        draggable={false}
                      />
                    </Lightbox.Media>
                  </Lightbox.Zoom>
                </Lightbox.Item>
              </Lightbox.Slide>
            );
          })}
        </Lightbox.Slides>

        <OverlayPanelBridge />

        <div className="lb-top-right lb-chrome-pull-hide">
          <button
            type="button"
            className="lb-control lb-control-md lb-control-layout"
            aria-pressed={snug}
            aria-label={snug ? 'Switch to full-bleed slides' : 'Switch to snug slides'}
            onClick={() => setSlidesLayout(snug ? 'bleed' : 'snug')}
          >
            {/* Icon mirrors the CURRENT layout, matching the default preset. */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden>
              {snug ? (
                <>
                  <rect x="8.5" y="7" width="7" height="10" rx="1.5" />
                  <path d="M4 9v6M20 9v6" strokeLinecap="round" />
                </>
              ) : (
                <rect x="4" y="7" width="16" height="10" rx="1.5" />
              )}
            </svg>
          </button>
          <div className="lb-control-group lb-control-md">
            <Lightbox.ZoomOut />
            <Lightbox.ZoomIn />
          </div>
          <Lightbox.Close />
        </div>

        <div className="lb-bottom lb-chrome-pull-hide">
          <div className="lb-caption-group">
            <Lightbox.Caption />
            <Lightbox.Counter>{({ current, total }) => `${current} of ${total}`}</Lightbox.Counter>
          </div>
          <Lightbox.ThumbnailStrip className="lb-thumbnail-strip-desktop">
            <Lightbox.ThumbnailStripTrack aria-label="Photo thumbnails">
              {items.map((item, i) => (
                <Lightbox.Thumbnail key={item.id ?? i} index={i}>
                  <img src={item.thumb} alt={item.alt} draggable={false} />
                </Lightbox.Thumbnail>
              ))}
            </Lightbox.ThumbnailStripTrack>
            <span className="lb-thumbnail-strip-indicator" aria-hidden />
          </Lightbox.ThumbnailStrip>
        </div>
      </Lightbox.Content>
    </Lightbox.Portal>
  );
}

/**
 * Dev-only: default preset lightbox with shadcn / Base UI overlays inside the
 * viewer — dialog stacking, dropdown menus, tooltips vs focus trap & inert slides.
 */
export default function LightboxOverlaysDebugPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
      <header>
        <p className="text-[11px] font-semibold tracking-widest text-amber-700 uppercase dark:text-amber-400">
          Debug · development only
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Lightbox + shadcn overlays
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
          Default preset gallery with {SLIDE_COUNT} slides. Open the lightbox and use the floating
          panel to exercise Base UI dialog, dropdown menu, and tooltip portaled inside the modal
          viewer.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          What to verify
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
          <li>Overlays render above slides and below / above nested dialogs as expected</li>
          <li>Arrow keys and swipe still change slides while a dropdown is closed</li>
          <li>Escape dismisses nested dialog first, then the lightbox</li>
          <li>Tab focus stays inside the topmost open overlay</li>
          <li>Inactive slides stay inert — no stranded focus on hidden slide controls</li>
          <li>Pinch-zoom hides chrome but overlay panel remains reachable</li>
        </ul>
      </section>

      <Lightbox.Root>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {slides.slice(0, TRIGGER_COUNT).map((item, i) => (
            <Lightbox.Trigger
              key={item.id}
              index={i}
              className="block overflow-hidden rounded-lg border border-neutral-300 bg-neutral-100 p-0 dark:border-neutral-700 dark:bg-neutral-800"
            >
              {({ imageRef }) => (
                <img
                  ref={imageRef}
                  {...imgDims(item.thumb)}
                  src={item.thumb}
                  alt={item.alt}
                  className="aspect-[4/3] w-full object-cover"
                />
              )}
            </Lightbox.Trigger>
          ))}
        </div>
        <p className="text-xs text-neutral-500">
          Triggers show {TRIGGER_COUNT} thumbnails; the lightbox contains all {SLIDE_COUNT} slides.
        </p>
        <OverlayDebugGallery items={slides} />
      </Lightbox.Root>
    </div>
  );
}
