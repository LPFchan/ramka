'use client';

import * as React from 'react';
import { flushSync } from 'react-dom';
import Image from 'next/image';
import { Lightbox } from 'ramka';
import { Heart, Minus, Plus, X, ZoomIn, ZoomOut } from 'lucide-react';

import {
  lightboxChromeButton,
  lightboxChromeButtonMd,
  triggerMorphHideClass,
} from '../../../_components/lightbox-chrome';

/**
 * A macOS Photos–style app surface: a dense grid of square thumbnails under a
 * sticky, blurred toolbar. The whole page *is* the app — no docs chrome. The
 * toolbar `−`/`+` buttons change the grid density (crossfaded via a View
 * Transition), and tapping any photo opens the same fullscreen viewer used by
 * the `responsive-gallery` demo: swipe navigation, desktop thumbnails, a View
 * Transition morph, pinch / scroll / keyboard zoom, and pull-to-dismiss.
 */

interface Photo {
  id: string;
  thumb: string;
  src: string;
  alt: string;
  caption: string;
  favorite?: boolean;
}

// Varied full-size aspect ratios so the viewer shows each photo at its natural
// shape. The grid triggers stay square (the thumbnail is a centered crop of the
// same source image), so only the full-size `src` dimensions differ.
const ASPECTS: ReadonlyArray<readonly [width: number, height: number]> = [
  [1600, 1067], // 3:2 landscape
  [1067, 1600], // 2:3 portrait
  [1600, 1600], // square
  [1600, 900], // 16:9 wide
  [1200, 1600], // 3:4 portrait
  [1600, 1200], // 4:3 landscape
];

// Scale an aspect ratio down so its longest edge is `THUMB_EDGE`px. The thumb
// must share the full-size image's aspect ratio (just lower res) so both are
// the *same* picsum crop — otherwise the trigger→viewer morph would crossfade
// between differently-cropped images.
const THUMB_EDGE = 500;

const photos: Photo[] = Array.from({ length: 48 }, (_, i) => {
  const [w, h] = ASPECTS[i % ASPECTS.length]!;
  const scale = THUMB_EDGE / Math.max(w, h);
  const thumbW = Math.round(w * scale);
  const thumbH = Math.round(h * scale);
  return {
    id: `photo-${i}`,
    thumb: `https://picsum.photos/seed/ramka-photos-${i}/${thumbW}/${thumbH}`,
    src: `https://picsum.photos/seed/ramka-photos-${i}/${w}/${h}`,
    alt: `Photo ${i + 1}`,
    caption: `July ${(i % 28) + 1}, 2024`,
    favorite: i === 0 || i === 15 || i === 24,
  };
});

/**
 * Intrinsic pixel dimensions encoded in a picsum URL (`…/{width}/{height}`).
 * Spread onto `<img>` as `width`/`height` so the box (and aspect ratio) is
 * reserved before the pixels load — which keeps the morph target sized on slow
 * connections and prevents layout shift.
 */
function imgDims(url: string) {
  const m = url.match(/\/(\d+)\/(\d+)$/);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : undefined;
}

/** Intrinsic aspect ratio (w/h) from the URL, falling back to 16/9. */
function imgAspect(url: string): number {
  const d = imgDims(url);
  return d ? d.width / d.height : 16 / 9;
}

/**
 * Wrapper style for the "largest rectangle of the given aspect ratio that fits
 * inside the container" trick. The parent must set `container-type: size` so
 * `cqw`/`cqh` resolve to its box. Width is the smaller of the full container
 * width and the width that would make the height equal the container height;
 * `aspect-ratio` then derives a height that never exceeds it.
 * `--lb-inset-w`/`--lb-inset-h` leave room for the overlapping chrome.
 *
 * This keeps the box correctly sized *before the image loads* — unlike
 * `size: auto`, which collapses an unloaded `<img>` to 0×0 and would skip the
 * open morph on a slow connection. Sizing is the consumer's responsibility —
 * the lightbox primitives stay headless.
 */
function fitBoxStyle(ratio: number): React.CSSProperties {
  return {
    width: `min(calc(100cqw - var(--lb-inset-w, 0px)), calc((100cqh - var(--lb-inset-h, 0px)) * ${ratio}))`,
    aspectRatio: `${ratio}`,
  };
}

// Small toolbar buttons (grid density).
const toolbarButton =
  'inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-600 transition hover:bg-black/5 disabled:pointer-events-none disabled:opacity-30 dark:text-neutral-300 dark:hover:bg-white/10';

// Grid density (columns). Fewer columns = larger photos. The zoom buttons
// step between these bounds; `+` grows the photos, `−` shrinks them.
const MIN_COLUMNS = 2;
const MAX_COLUMNS = 10;
const DEFAULT_COLUMNS = 5;

const clampColumns = (c: number) => Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, c));

const supportsViewTransitions = () =>
  typeof document !== 'undefined' &&
  typeof (document as Document & { startViewTransition?: unknown }).startViewTransition === 'function';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function PhotosAppPage() {
  const [columns, setColumns] = React.useState(DEFAULT_COLUMNS);

  const zoomTo = (next: number) => {
    const target = clampColumns(next);
    if (target === columns) return;

    if (!supportsViewTransitions() || prefersReducedMotion()) {
      setColumns(target);
      return;
    }

    // The grid carries a single `view-transition-name`, so the browser
    // captures it as one unit and simply crossfades the old layout into the
    // new one. `flushSync` commits the column change inside the transition.
    (document as Document & { startViewTransition: (cb: () => void) => unknown }).startViewTransition(() =>
      flushSync(() => setColumns(target)),
    );
  };

  const zoomIn = () => zoomTo(columns - 1);
  const zoomOut = () => zoomTo(columns + 1);

  return (
    <div className="min-h-screen bg-white dark:bg-[#1c1c1e] select-none">
      <Lightbox.Root
        viewTransition
        loop
        scrollTriggerIntoView={[
          { type: 'onChange', behavior: 'instant' },
          { type: 'onOpenComplete', behavior: 'instant' },
        ]}
        
      >
        {/* The sticky nav AND the grid share a single `view-transition-name` so
            the density crossfade captures them as ONE group. Naming only the
            grid would lift it onto the VT layer *above* the sticky header,
            covering it mid-transition. */}
        <div style={{ viewTransitionName: 'photos-grid' }}>
          {/* Sticky toolbar + fade gradient. The gradient strip lets the grid
              visibly fade away as it scrolls beneath the chrome. */}
          
            <div className="pointer-events-auto flex shrink-0 items-center gap-3 bg-white/70 px-4 py-3 backdrop-blur-xl dark:bg-[#1c1c1e]/70">
              <div className="flex flex-col leading-tight">
                <span className="text-lg font-bold tracking-tight text-neutral-900 dark:text-neutral-50">Library</span>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">Jul 15–16, 2024</span>
              </div>

              <div className="flex flex-1 items-center justify-end">
                <div className="flex items-center rounded-full bg-black/5 dark:bg-white/10">
                  <button
                    type="button"
                    aria-label="Smaller photos"
                    onClick={zoomOut}
                    disabled={columns >= MAX_COLUMNS}
                    className={toolbarButton}
                  >
                    <Minus aria-hidden className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Larger photos"
                    onClick={zoomIn}
                    disabled={columns <= MIN_COLUMNS}
                    className={toolbarButton}
                  >
                    <Plus aria-hidden className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          

          {/* The grid sits behind the sticky header; the negative margin pulls
              it up so the first rows start under the fading chrome. Every tile
              is a `Lightbox.Trigger`, so tapping one morphs into the viewer. */}
          <div
            className="grid gap-0.5"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {photos.map((photo, i) => (
              <Lightbox.Trigger
                key={photo.id}
                index={i}
                // scroll-margin clears the sticky toolbar so scrollTriggerIntoView
                // doesn't leave a tile tucked under it. On mobile the docs
                // MobileNav overlaps the toolbar and is handled by the document's
                // scroll-pt-14, so this only needs to kick in at md+.
                className={`relative block aspect-square cursor-pointer overflow-hidden bg-transparent p-0 md:scroll-mt-16 ${triggerMorphHideClass}`}
              >
                {({ triggerImageRef }) => (
                  <>
                    <img ref={triggerImageRef} {...imgDims(photo.thumb)} src={photo.thumb} alt={photo.alt} loading="lazy" className="block h-full w-full object-cover" />
                    {photo.favorite ? (
                      <Heart
                        aria-hidden
                        className="pointer-events-none absolute bottom-1.5 left-1.5 h-4 w-4 fill-white text-white drop-shadow"
                      />
                    ) : null}
                  </>
                )}
              </Lightbox.Trigger>
            ))}
          </div>
        </div>

        {/* Scrim. `data-pulling:transition-none` hands the fade to the
            pull-to-dismiss gesture, which drives it 1:1 with the finger via
            the `--lightbox-pull-progress` variable. */}
        <Lightbox.Backdrop className="fixed inset-0 z-40 bg-white opacity-0 transition-opacity duration-300 data-[open]:[opacity:calc(1_-_var(--lightbox-pull-progress,0)_*_0.6)] data-pulling:transition-none starting:opacity-0 dark:bg-black" />

        {/* Fullscreen viewer */}
        <Lightbox.Content
          aria-label="Library photos"
          className="fixed inset-0 z-50 flex flex-col overscroll-contain opacity-0 outline-none transition-opacity duration-200 data-[open]:opacity-100 starting:opacity-0"
          
        >
          {/* Swipeable, snapping viewport of full-size photos. `Lightbox.Slides`
              keeps every slide *box* mounted (so scroll extent is correct across
              all photos) while `preload` gates which slides render their heavy
              `Lightbox.Item` content. */}
          <Lightbox.Slides aria-label="Full-size photos" preload={2} className="flex-1 [&::-webkit-scrollbar]:hidden gap-5 md:gap-0">
            {photos.map((photo, i) => (
              // The snap box (Lightbox.Slide) and the drag target (Lightbox.Item)
              // are deliberately SEPARATE elements so a vertical pull-to-dismiss
              // transform never nudges the horizontal scroll-snap container.
              <Lightbox.Slide key={photo.id} className="relative h-full">
                <Lightbox.Item
                  index={i}
                  caption={photo.caption}
                  className="relative flex h-full w-full items-center justify-center"
                >
                  {({ imageRef }) => (
                    <Lightbox.Zoom
                      maxZoom={6}
                      // Asymmetric padding (not symmetric --lb-inset-h): top only
                      // needs the close/zoom row; bottom needs caption (+ thumbs
                      // on md). Safe-area is folded in for viewport-fit=cover.
                      className="flex h-full w-full items-center justify-center [container-type:size] px-0 pt-[calc(env(safe-area-inset-top,0px)+3.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+3.5rem)] md:px-8 md:pt-[calc(env(safe-area-inset-top,0px)+3.5rem)] md:pb-[calc(env(safe-area-inset-bottom,0px)+7.5rem)]"
                    >
                      {/* Consumer owns layout: the fit-box reserves the box up
                          front (see fitBoxStyle) so the morph target has a real
                          size before the image loads. `imageRef` attaches to a
                          next/image element — proof the ref-based placeholder
                          composes with framework image components while the
                          consumer keeps full control of sizing. */}
                      <div
                        className="relative shrink-0 [--lb-inset-h:0px] [--lb-inset-w:0px]"
                        style={fitBoxStyle(imgAspect(photo.src))}
                      >
                        <Image
                          ref={imageRef}
                          src={photo.src}
                          alt={photo.alt}
                          width={imgDims(photo.src)?.width ?? 1600}
                          height={imgDims(photo.src)?.height ?? 1200}
                          sizes="100vw"
                          priority
                          unoptimized
                          draggable={false}
                          className="h-full w-full select-none rounded-none object-contain md:rounded-lg"
                        />
                      </div>
                    </Lightbox.Zoom>
                  )}
                </Lightbox.Item>
              </Lightbox.Slide>
            ))}
          </Lightbox.Slides>

          {/* Top-right: zoom desktop-only; close always. On mobile, fade
              close while zoomed; on md+ stay visible. Also fade on pull. */}
          <div className="absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-10 flex gap-2 transition-[opacity,filter] duration-200 max-md:[[data-zoomed]_&]:pointer-events-none max-md:[[data-zoomed]_&]:opacity-0 max-md:[[data-zoomed]_&]:blur-[6px] [[data-pulling]_&]:pointer-events-none [[data-pulling]_&]:opacity-0 [[data-pulling]_&]:blur-[6px] [[data-pull-dismissing]_&]:pointer-events-none [[data-pull-dismissing]_&]:opacity-0 [[data-pull-dismissing]_&]:blur-[6px]">
            <Lightbox.ZoomOut className={lightboxChromeButtonMd} aria-label="Zoom out">
              <ZoomOut aria-hidden className="h-4 w-4" strokeWidth={2.25} />
            </Lightbox.ZoomOut>
            <Lightbox.ZoomIn className={lightboxChromeButtonMd} aria-label="Zoom in">
              <ZoomIn aria-hidden className="h-4 w-4" strokeWidth={2.25} />
            </Lightbox.ZoomIn>
            <Lightbox.Close className={lightboxChromeButton} aria-label="Close">
              <X aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.25} />
            </Lightbox.Close>
          </div>

          {/* Caption + thumbnails — thumbnails only render on desktop and
              scroll horizontally (there are many). Hidden while zoomed or
              pulling to dismiss. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 px-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] transition-[opacity,filter] duration-200 [[data-zoomed]_&]:opacity-0 [[data-zoomed]_&]:blur-[6px] [[data-pulling]_&]:opacity-0 [[data-pulling]_&]:blur-[6px] [[data-pull-dismissing]_&]:opacity-0 [[data-pull-dismissing]_&]:blur-[6px]">
            <Lightbox.Caption className="pointer-events-auto block min-h-[1.25rem] max-w-full truncate px-6 text-center text-sm text-black/70 dark:text-white/80" />

            <Lightbox.ThumbnailGroup
              aria-label="Photo thumbnails"
              className="pointer-events-auto hidden max-w-full gap-2 overflow-x-auto px-3 [scrollbar-width:none] md:flex [&::-webkit-scrollbar]:hidden"
            >
              {photos.map((photo, i) => (
                <Lightbox.Thumbnail
                  key={photo.id}
                  index={i}
                  className="h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 border-transparent p-0 opacity-50 transition data-[active]:border-black data-[active]:opacity-100 dark:data-[active]:border-white"
                >
                  <img {...imgDims(photo.thumb)} src={photo.thumb} alt={photo.alt} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                </Lightbox.Thumbnail>
              ))}
            </Lightbox.ThumbnailGroup>
          </div>
        </Lightbox.Content>
      </Lightbox.Root>
    </div>
  );
}
