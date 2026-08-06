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
 */
const images: LightboxGalleryItem[] = [
  {
    src: 'https://picsum.photos/seed/ramka-a/1600/1067',
    thumb: 'https://picsum.photos/seed/ramka-a/800/533',
    alt: 'Person standing in a sunlit meadow at golden hour',
    caption: 'Golden hour in the meadow',
  },
  {
    src: 'https://picsum.photos/seed/ramka-b/1200/1500',
    thumb: 'https://picsum.photos/seed/ramka-b/800/1000',
    alt: 'Seashells scattered along the shoreline',
    caption: 'Seashells on the shore',
  },
  {
    src: 'https://picsum.photos/seed/ramka-c/1400/1400',
    thumb: 'https://picsum.photos/seed/ramka-c/800/800',
    alt: 'Curved building facade in black and white',
    caption: 'Curved facade, in monochrome',
  },
  {
    src: 'https://picsum.photos/seed/ramka-d/1200/1600',
    thumb: 'https://picsum.photos/seed/ramka-d/800/1067',
    alt: 'Airplane crossing a purple sky above the clouds',
    caption: 'Above the clouds at dusk',
  },
  {
    src: 'https://picsum.photos/seed/ramka-e/1600/1000',
    thumb: 'https://picsum.photos/seed/ramka-e/800/500',
    alt: 'Fog rolling over dark hills',
    caption: 'Fog rolling over the valley',
  },
  {
    src: 'https://picsum.photos/seed/ramka-f/1300/1600',
    thumb: 'https://picsum.photos/seed/ramka-f/800/985',
    alt: 'Aerial view of a road entering twin forest tunnels',
    caption: 'Twin tunnels from above',
  },
];

/** Landing hero demo — masonry triggers + the full docs viewer chrome. */
export function LandingDemo() {
  return (
    <Lightbox.Root>
      <div className="columns-2 gap-3 md:columns-3 md:gap-4">
        {images.map((img, i) => (
          <Lightbox.Trigger
            key={img.src}
            index={i}
            className={`mb-3 block w-full break-inside-avoid overflow-hidden rounded-xl bg-neutral-100 p-0 md:mb-4 md:rounded-2xl dark:bg-neutral-900 ${triggerMorphHideClass} ${triggerFocusClass}`}
          >
            {({ imageRef }) => (
              <img
                ref={imageRef}
                {...imgDims(img.thumb)}
                src={img.thumb}
                alt={img.alt}
                loading="eager"
                draggable={false}
                className="block w-full select-none transition-transform duration-300 ease-out hover:scale-[1.02]"
              />
            )}
          </Lightbox.Trigger>
        ))}
      </div>
      <LightboxGallery items={images} ariaLabel="ramka demo gallery" />
    </Lightbox.Root>
  );
}
