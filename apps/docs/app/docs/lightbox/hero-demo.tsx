'use client';

import { Lightbox } from 'ramka';

import {
  LightboxCloseButton,
  LightboxFrame,
  LightboxFullImage,
  LightboxNavBar,
  LightboxOverlay,
  StackedItemGroup,
  stackedItemClass,
  triggerFocusClass,
  triggerMorphHideClass,
} from '../../_components/lightbox-chrome';

const images = [
  {
    src: 'https://picsum.photos/seed/docs-hero-a/1200/800',
    thumb: 'https://picsum.photos/seed/docs-hero-a/400/400',
    alt: 'Mountain ridge',
  },
  {
    src: 'https://picsum.photos/seed/docs-hero-b/1200/800',
    thumb: 'https://picsum.photos/seed/docs-hero-b/400/400',
    alt: 'Coastal path',
  },
  {
    src: 'https://picsum.photos/seed/docs-hero-c/1200/800',
    thumb: 'https://picsum.photos/seed/docs-hero-c/400/400',
    alt: 'Forest light',
  },
];

function imgDims(url: string) {
  const m = url.match(/\/(\d+)\/(\d+)$/);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : undefined;
}

/** Compact live demo for the Lightbox docs hero. */
export function LightboxHeroDemo() {
  return (
    <Lightbox.Root>
      <div className="grid max-w-md grid-cols-3 gap-2">
        {images.map((img, i) => (
          <Lightbox.Trigger
            key={img.src}
            index={i}
            className={`block aspect-square overflow-hidden rounded-lg bg-transparent p-0 ${triggerMorphHideClass} ${triggerFocusClass}`}
          >
            {({ imageRef }) => (
              <img
                ref={imageRef}
                {...imgDims(img.thumb)}
                src={img.thumb}
                alt={img.alt}
                className="block size-full object-cover"
              />
            )}
          </Lightbox.Trigger>
        ))}
      </div>
      <LightboxOverlay />
      <LightboxFrame ariaLabel="Lightbox hero demo">
        <LightboxCloseButton />
        <StackedItemGroup>
          {images.map((img, i) => (
            <Lightbox.Item key={img.src} index={i} className={stackedItemClass}>
              <LightboxFullImage src={img.src} alt={img.alt} />
            </Lightbox.Item>
          ))}
        </StackedItemGroup>
        <LightboxNavBar />
      </LightboxFrame>
    </Lightbox.Root>
  );
}
