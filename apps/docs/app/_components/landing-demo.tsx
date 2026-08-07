'use client';

import { Lightbox } from 'ramka';

import {
  imgDims,
  LightboxGallery,
  triggerFocusClass,
  triggerMorphHideClass,
  type LightboxGalleryItem,
} from './lightbox-chrome';

/**
 * Mixed aspect ratios on purpose — the masonry grid reads like a real photo
 * wall, and the open morph is more impressive when the thumb and the slide
 * have different shapes.
 *
 * Tile shapes are forced with CSS `aspect-ratio` + `object-cover` (the morph
 * bridges a cropped trigger to the full image), so each breakpoint gets its
 * own column math regardless of the source dimensions:
 *
 *   mobile, 2 cols of 3:  0.75 + 1.25 + 1.0 = 1.0 + 0.7 + 1.3  (balanced)
 *   md+, 3 cols of 2:     1.25 + 0.75 | 1.4 + 1.0 | 1.2 + 0.8
 *                         = 2.0 | 2.4 | 2.0  (middle column sticks out)
 *
 * The md+ shapes deliberately invert each source's orientation (landscape
 * photos get portrait tiles and vice versa) so every open morphs across
 * aspect ratios instead of just scaling up.
 */
const images: (LightboxGalleryItem & { tileClass: string })[] = [
  {
    src: 'https://picsum.photos/seed/ramka-a/1600/1067',
    thumb: 'https://picsum.photos/seed/ramka-a/800/533',
    alt: 'Person standing in a sunlit meadow at golden hour',
    caption: 'Golden hour in the meadow',
    tileClass: 'aspect-[4/3] md:aspect-[4/5]',
  },
  {
    src: 'https://picsum.photos/seed/ramka-b/1200/1500',
    thumb: 'https://picsum.photos/seed/ramka-b/800/1000',
    alt: 'Seashells scattered along the shoreline',
    caption: 'Seashells on the shore',
    tileClass: 'aspect-[4/5] md:aspect-[4/3]',
  },
  {
    src: 'https://picsum.photos/seed/ramka-c/1400/1400',
    thumb: 'https://picsum.photos/seed/ramka-c/800/800',
    alt: 'Curved building facade in black and white',
    caption: 'Curved facade, in monochrome',
    tileClass: 'aspect-square md:aspect-[5/7]',
  },
  {
    src: 'https://picsum.photos/seed/ramka-d/1200/1600',
    thumb: 'https://picsum.photos/seed/ramka-d/800/1067',
    alt: 'Airplane crossing a purple sky above the clouds',
    caption: 'Above the clouds at dusk',
    tileClass: 'aspect-square',
  },
  {
    src: 'https://picsum.photos/seed/ramka-e/1600/1000',
    thumb: 'https://picsum.photos/seed/ramka-e/800/500',
    alt: 'Fog rolling over dark hills',
    caption: 'Fog rolling over the valley',
    tileClass: 'aspect-[10/7] md:aspect-[5/6]',
  },
  {
    src: 'https://picsum.photos/seed/ramka-f/1300/1600',
    thumb: 'https://picsum.photos/seed/ramka-f/800/985',
    alt: 'Aerial view of a road entering twin forest tunnels',
    caption: 'Twin tunnels from above',
    tileClass: 'aspect-[10/13] md:aspect-[5/4]',
  },
];

/** Landing hero demo — masonry triggers + the full docs viewer chrome. */
export function LandingDemo() {
  return (
    <Lightbox.Root
      // Same pairing as the Photos app example: instant repositioning is
      // invisible behind the solid backdrop, and the close morph always lands
      // on an on-screen tile instead of jumping to one scrolled away.
      scrollTriggerIntoView={[
        { type: 'onChange', behavior: 'instant' },
        { type: 'onOpenComplete', behavior: 'instant' },
      ]}
    >
      <div className="columns-2 gap-3 md:columns-3 md:gap-4">
        {images.map((img, i) => (
          <Lightbox.Trigger
            key={img.src}
            index={i}
            // scroll-margin gives scrollTriggerIntoView breathing room: with
            // `block: 'nearest'` the page scrolls minimally, which would leave
            // the tile flush with the viewport edge — and the close morph
            // starting right at the edge. This keeps it comfortably inset.
            className={`mb-3 block w-full break-inside-avoid scroll-my-12 overflow-hidden rounded-xl bg-neutral-100 p-0 md:mb-4 md:rounded-2xl dark:bg-neutral-900 ${triggerMorphHideClass} ${triggerFocusClass}`}
          >
            {({ imageRef }) => (
              <img
                ref={imageRef}
                {...imgDims(img.thumb)}
                src={img.thumb}
                alt={img.alt}
                loading="eager"
                draggable={false}
                className={`block h-auto w-full select-none object-cover transition-transform duration-300 ease-out hover:scale-[1.02] ${img.tileClass}`}
              />
            )}
          </Lightbox.Trigger>
        ))}
      </div>
      <LightboxGallery items={images} ariaLabel="ramka demo gallery" backdrop="solid" />
    </Lightbox.Root>
  );
}
