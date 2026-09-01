'use client';

import Image from 'next/image';
import * as Lightbox from '@ramka/react/lightbox';

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
  ramkaJ,
  ramkaK,
  ramkaL,
  ramkaM,
  ramkaN,
} from './images.generated';
import {
  LightboxGallery,
  triggerFocusClass,
  type LightboxGalleryItem,
} from './lightbox-chrome';

/**
 * Landing gallery. Three morph flavors on one clean wall:
 *
 * - Most tiles are deliberately cross-aspect: wide tiles hold portrait
 *   sources and portrait tiles hold wide ones, so opening visibly morphs the
 *   frame (wide -> tall or tall -> wide) instead of just scaling up. Every
 *   tile is a plain CENTER `object-cover` crop of the same file the viewer
 *   shows — the morph snapshots paint with center cover, so any
 *   `object-position` nudge would visibly reframe mid-animation (see
 *   docs/lightbox/view-transitions "Source aspect" / "Trigger crossfade").
 *   Sources were picked so their center crop frames the subject.
 * - The beach and wedding tiles keep their natural wide aspect (their
 *   subjects sit off-center in the master photos, so no portrait center-crop
 *   survives) and show the plain same-shape morph for contrast.
 * - The last tile is a "+2" stack: two more photos hide behind it, and
 *   `crossfade="both"` dissolves the overlaid tile into the clean photo
 *   instead of stretching the "+2" badge (morphTo="closest" on Root brings
 *   closes from hidden items back to this tile).
 *
 * Column math (height ratios = 1/aspect): every column has the same tile
 * count per breakpoint, so vertical gaps cancel and equal ratio sums make
 * the wall a perfect rectangle. Sums are EXACT fractions — keep them exact
 * when swapping aspects:
 * - Desktop (4 cols x 3): 2/3+5/4+7/12 | 1+9/16+15/16 | 3/5+6/5+7/10 |
 *   9/16+5/4+11/16 = 2.5 each.
 * - Mobile (3 cols x 4): 2/3+5/4+7/12+1 | 9/16+1+11/16+5/4 |
 *   3/4+9/16+5/4+15/16 = 3.5 each.
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
    tileClass: 'aspect-[3/2]',
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
    src: ramkaJ,
    thumb: ramkaJ,
    alt: 'Father carrying a child along a sandy beach',
    caption: 'Beach walk, kid in tow',
    tileClass: 'aspect-[12/7]',
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
    // Cross-aspect showcase: portrait 3:4 source in a wide 16:9 tile. The sky
    // survives the crop, and the open morphs wide -> tall.
    tileClass: 'aspect-video',
    breakClass: 'break-before-column md:break-before-auto',
  },
  {
    src: ramkaK,
    thumb: ramkaK,
    alt: 'Brutalist concrete tower against a pale sky',
    caption: 'Concrete against a pale sky',
    tileClass: 'aspect-square md:aspect-[16/15]',
    breakClass: '',
  },
  {
    src: ramkaE,
    thumb: ramkaE,
    alt: 'Fog rolling over dark hills',
    caption: 'Fog rolling over the valley',
    tileClass: 'aspect-[16/11] md:aspect-[5/3]',
    breakClass: 'md:break-before-column',
  },
  {
    src: ramkaF,
    thumb: ramkaF,
    alt: 'Aerial view of a road entering twin forest tunnels',
    caption: 'Twin tunnels from above',
    tileClass: 'aspect-[4/5] md:aspect-[5/6]',
    breakClass: '',
  },
  {
    src: ramkaG,
    thumb: ramkaG,
    alt: 'Bride seen through the windows of a vintage car',
    caption: 'Through the wedding car window',
    tileClass: 'aspect-[4/3] md:aspect-[10/7]',
    breakClass: 'break-before-column md:break-before-auto',
  },
  {
    src: ramkaL,
    thumb: ramkaL,
    alt: 'Out-of-focus city lights glowing at dusk',
    caption: 'City lights, out of focus',
    tileClass: 'aspect-video',
    breakClass: 'md:break-before-column',
  },
  {
    src: ramkaN,
    thumb: ramkaN,
    alt: 'Husky dog in a harness looking into the distance',
    caption: 'Husky on the lookout',
    tileClass: 'aspect-[4/5]',
    breakClass: '',
  },
  {
    src: ramkaH,
    thumb: ramkaH,
    alt: 'Sandstone hoodoos under a summer sky',
    caption: 'Hoodoos under a summer sky — Bryce Canyon',
    tileClass: 'aspect-[16/15] md:aspect-[16/11]',
    breakClass: '',
  },
];

/**
 * Behind the "+2" tile — no triggers of their own, so the destination Image
 * carries the blur-up placeholder (no trigger thumb to bridge from).
 */
const hiddenImages: LightboxGalleryItem[] = [
  {
    src: ramkaM,
    thumb: ramkaM,
    alt: 'Patches of snow on a mossy forest floor',
    caption: 'First snow in the forest',
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

/**
 * Landing hero demo — masonry triggers + a +N stack + the docs viewer chrome.
 *
 * `eager` loads every tile up front: right for the landing hero where the
 * grid IS the LCP, wrong for pages that embed the demo below the fold.
 */
export function LandingDemo({ eager = true }: { eager?: boolean }) {
  const lastIndex = visibleImages.length - 1;

  return (
    <Lightbox.Root
      // Closing from a hidden item (no trigger of its own) morphs back to
      // the nearest registered trigger — the "+2" stack tile.
      morphTo="closest"
      // Every trigger wires its image via `imageRef`, so the thumb bridges
      // the open morph as a placeholder — no need to hold the morph for the
      // full-res decode.
      awaitImageDecode={false}
      // Same pairing as the Photos app example: instant repositioning is
      // invisible behind the solid backdrop, and the close morph always lands
      // on an on-screen tile instead of jumping to one scrolled away.
      scrollTriggerIntoView={[
        { type: 'onChange', behavior: 'instant' },
        { type: 'onOpenComplete', behavior: 'instant' },
      ]}
      // The testimonial frame's glass lighting redraws its canvas while the
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
      <div className="columns-3 gap-2 md:columns-4 md:gap-3">
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
              className={`mb-2 grid w-full break-inside-avoid scroll-my-12 overflow-hidden rounded-lg bg-neutral-100 p-0 after:pointer-events-none after:z-20 after:col-start-1 after:row-start-1 after:rounded-[inherit] after:shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.1)] after:content-[''] md:mb-3 md:rounded-xl dark:bg-neutral-900 dark:after:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.12)] ${img.breakClass} ${triggerFocusClass}`}
            >
              {({ imageRef }) => (
                <>
                  <Image
                    ref={imageRef}
                    src={img.thumb}
                    alt={img.alt}
                    placeholder="blur"
                    sizes="(min-width: 768px) 25vw, 33vw"
                    loading={eager ? 'eager' : 'lazy'}
                    draggable={false}
                    className={`col-start-1 row-start-1 block h-full w-full select-none object-cover ${img.tileClass}`}
                  />
                  {isStack ? (
                    <span
                      aria-hidden
                      className="z-10 col-start-1 row-start-1 flex items-center justify-center bg-black/35 text-3xl font-semibold tracking-tight text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.45)] md:text-4xl"
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
      {/* Peek (snug) is the first-visit default; the toggle + localStorage take over from there. */}
      <LightboxGallery
        items={allImages}
        ariaLabel="ramka demo gallery"
        backdrop="solid"
        slidesLayout="snug"
        layoutToggle
      />
    </Lightbox.Root>
  );
}
