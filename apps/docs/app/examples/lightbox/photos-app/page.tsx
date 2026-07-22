'use client';

import * as React from 'react';
import { flushSync } from 'react-dom';
import Image from 'next/image';
import { Lightbox } from 'ramka';
import { Heart, Minus, Plus } from 'lucide-react';

import {
  imgDims,
  LightboxGallery,
  triggerFocusClass,
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
                className={`relative block aspect-square cursor-pointer overflow-hidden bg-transparent p-0 md:scroll-mt-16 ${triggerMorphHideClass} ${triggerFocusClass}`}
              >
                {({ imageRef }) => (
                  <>
                    <img ref={imageRef} {...imgDims(photo.thumb)} src={photo.thumb} alt={photo.alt} loading="lazy" className="block size-full object-cover" />
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

        <LightboxGallery
          items={photos}
          ariaLabel="Library photos"
          renderItem={(photo) => (
            <Lightbox.Zoom
              maxZoom={6}
              className="px-0 pt-[calc(env(safe-area-inset-top,0px)+3.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+3.5rem)] md:px-8 md:pt-[calc(env(safe-area-inset-top,0px)+3.5rem)] md:pb-[calc(env(safe-area-inset-bottom,0px)+7.5rem)]"
            >
              <Lightbox.Media
                width={imgDims(photo.src)?.width ?? 1600}
                height={imgDims(photo.src)?.height ?? 1200}
                className="overflow-hidden rounded-none md:rounded-lg"
              >
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  width={imgDims(photo.src)?.width ?? 1600}
                  height={imgDims(photo.src)?.height ?? 1200}
                  sizes="100vw"
                  priority
                  unoptimized
                  draggable={false}
                  className="size-full select-none"
                />
              </Lightbox.Media>
            </Lightbox.Zoom>
          )}
        />
      </Lightbox.Root>
    </div>
  );
}
