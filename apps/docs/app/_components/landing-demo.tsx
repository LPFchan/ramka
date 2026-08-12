'use client';

import Image from 'next/image';
import { Lightbox } from 'ramka';

import { setGlassShinePaused } from './broken-glass-shine';
import {
  ramkaA,
  ramkaB,
  ramkaC,
  ramkaD,
  ramkaE,
  ramkaF,
  ramkaG,
  ramkaH,
  ramkaI,
} from './images.generated';
import {
  LightboxGallery,
  triggerFocusClass,
  type LightboxGalleryItem,
} from './lightbox-chrome';

/**
 * Landing gallery. Three morph flavors on one clean wall:
 *
 * - Most photo tiles keep their natural aspect ratio on md+ (no important
 *   pixels cropped away) and open with the plain image morph.
 * - The plane tile is the cross-aspect showcase: a portrait 3:4 source shown
 *   as a wide cinematic tile (sky crops beautifully), so opening it morphs
 *   wide -> tall.
 * - The last tile is a "+2" stack: two more photos hide behind it, and
 *   `crossfade="both"` dissolves the overlaid tile into the clean photo
 *   instead of stretching the "+2" badge (morphTo="closest" on Root brings
 *   closes from hidden items back to this tile).
 *
 * Column math (height ratios): desktop is 2-3-2 with the middle column
 * sticking out — 0.67+1.25 | 1.0+0.6+0.63 | 1.23+0.63 = 1.92 | 2.23 | 1.86.
 * Mobile is 3+4 with mild aspect nudges (never inverting orientation):
 * 0.75+1.25+1.0 = 3.0 | 0.6+0.7+1.1+0.63 = 3.03.
 *
 * Every tile carries an explicit `aspect-ratio`, and the column split is
 * forced with `break-before: column` per breakpoint (`breakClass`) —
 * Safari's column balancer deals tiles unevenly when left to its own devices.
 */
const visibleImages: (LightboxGalleryItem & { tileClass: string; breakClass: string })[] = [
  {
    src: ramkaA,
    thumb: ramkaA,
    alt: 'Person standing in a sunlit meadow at golden hour',
    caption: 'Golden hour in the meadow',
    tileClass: 'aspect-[4/3] md:aspect-[3/2]',
    breakClass: '',
  },
  {
    src: ramkaB,
    thumb: ramkaB,
    alt: 'Seashells scattered along the shoreline',
    caption: 'Seashells on the shore',
    tileClass: 'aspect-[4/5]',
    breakClass: '',
  },
  {
    src: ramkaC,
    thumb: ramkaC,
    alt: 'Curved building facade in black and white',
    caption: 'Curved facade, in monochrome',
    tileClass: 'aspect-square',
    breakClass: 'md:break-before-column',
  },
  {
    src: ramkaD,
    thumb: ramkaD,
    alt: 'Airplane crossing a purple sky above the clouds',
    caption: 'Above the clouds at dusk',
    // Cross-aspect showcase: portrait 3:4 source in a wide 5:3 tile. The sky
    // survives the crop, and the open morphs wide -> tall.
    tileClass: 'aspect-[5/3]',
    breakClass: 'break-before-column md:break-before-auto',
  },
  {
    src: ramkaE,
    thumb: ramkaE,
    alt: 'Fog rolling over dark hills',
    caption: 'Fog rolling over the valley',
    tileClass: 'aspect-[10/7] md:aspect-[8/5]',
    breakClass: '',
  },
  {
    src: ramkaF,
    thumb: ramkaF,
    alt: 'Aerial view of a road entering twin forest tunnels',
    caption: 'Twin tunnels from above',
    tileClass: 'aspect-[10/11] md:aspect-[13/16]',
    breakClass: 'md:break-before-column',
  },
  {
    src: ramkaG,
    thumb: ramkaG,
    alt: 'Bride seen through the windows of a vintage car',
    caption: 'Through the wedding car window',
    tileClass: 'aspect-[8/5]',
    breakClass: '',
  },
];

/**
 * Behind the "+2" tile — no triggers of their own, so the destination Image
 * carries the blur-up placeholder (no trigger thumb to bridge from).
 */
const hiddenImages: LightboxGalleryItem[] = [
  {
    src: ramkaH,
    thumb: ramkaH,
    alt: 'Sandstone hoodoos under a summer sky',
    caption: 'Hoodoos under a summer sky — Bryce Canyon',
    destinationBlur: true,
  },
  {
    src: ramkaI,
    thumb: ramkaI,
    alt: 'The Leaning Tower of Pisa at dusk',
    caption: 'The leaning arches of Pisa',
    destinationBlur: true,
  },
];

const allImages: LightboxGalleryItem[] = [...visibleImages, ...hiddenImages];

/** Landing hero demo — masonry triggers + a +N stack + the docs viewer chrome. */
export function LandingDemo() {
  const lastIndex = visibleImages.length - 1;

  return (
    <Lightbox.Root
      // Closing from a hidden item (no trigger of its own) morphs back to
      // the nearest registered trigger — the "+2" stack tile.
      morphTo="closest"
      // Same pairing as the Photos app example: instant repositioning is
      // invisible behind the solid backdrop, and the close morph always lands
      // on an on-screen tile instead of jumping to one scrolled away.
      scrollTriggerIntoView={[
        { type: 'onChange', behavior: 'instant' },
        { type: 'onOpenComplete', behavior: 'instant' },
      ]}
      // The sponsor frame's glass lighting redraws its canvas while the
      // cursor moves, and every redraw during a View Transition forces a
      // fresh layer snapshot. Pause it the moment the viewer opens and
      // resume only after the close transition fully lands (a close
      // interrupted by a reopen never fires the complete callback, so the
      // lighting stays paused through the whole session).
      onOpenChange={(open: boolean) => {
        if (open) setGlassShinePaused(true);
      }}
      onOpenChangeComplete={(open: boolean) => {
        if (!open) setGlassShinePaused(false);
      }}
    >
      <div className="columns-2 gap-3 md:columns-3 md:gap-4">
        {visibleImages.map((img, i) => {
          const isStack = i === lastIndex;
          return (
            <Lightbox.Trigger
              key={img.alt}
              index={i}
              // The stack tile's content (photo + "+2" scrim) doesn't match
              // the clean slide, so dissolve both ways instead of morphing.
              crossfade={isStack ? 'both' : undefined}
              aria-label={isStack ? `Show ${hiddenImages.length} more photos` : undefined}
              // scroll-margin gives scrollTriggerIntoView breathing room: with
              // `block: 'nearest'` the page scrolls minimally, which would leave
              // the tile flush with the viewport edge — and the close morph
              // starting right at the edge. This keeps it comfortably inset.
              // Overlays (the "+2" scrim and the ::after hairline) are stacked
              // via grid cells, not position:absolute — abspos children of
              // multicol items don't paint reliably in Safari.
              // The ::after draws an Apple-style 0.5px inset outline so dark
              // photos don't bleed into the dark-mode background (and bright
              // ones into light mode).
              className={`mb-3 grid w-full break-inside-avoid scroll-my-12 overflow-hidden rounded-xl bg-neutral-100 p-0 after:pointer-events-none after:z-20 after:col-start-1 after:row-start-1 after:rounded-[inherit] after:shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.1)] after:content-[''] md:mb-4 md:rounded-2xl dark:bg-neutral-900 dark:after:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.12)] ${img.breakClass} ${triggerFocusClass}`}
            >
              {({ imageRef }) => (
                <>
                  <Image
                    ref={imageRef}
                    src={img.thumb}
                    alt={img.alt}
                    placeholder="blur"
                    sizes="(min-width: 768px) 33vw, 50vw"
                    loading="eager"
                    draggable={false}
                    className={`col-start-1 row-start-1 block h-full w-full select-none object-cover ${img.tileClass}`}
                  />
                  {isStack ? (
                    <span
                      aria-hidden
                      className="z-10 col-start-1 row-start-1 flex items-center justify-center bg-black/40 text-2xl font-medium tracking-tight text-white"
                    >
                      +{hiddenImages.length}
                    </span>
                  ) : null}
                </>
              )}
            </Lightbox.Trigger>
          );
        })}
      </div>
      <LightboxGallery items={allImages} ariaLabel="ramka demo gallery" backdrop="solid" />
    </Lightbox.Root>
  );
}
