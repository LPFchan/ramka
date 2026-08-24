'use client';

import Image from 'next/image';
import * as Lightbox from '@ramka/react/lightbox';

import {
  LightboxGallery,
  triggerFocusClass,
} from '../../../_components/lightbox-chrome';
import { docsHeroA, docsHeroB, docsHeroC } from './images.generated';

const images = [
  { src: docsHeroA, thumb: docsHeroA, alt: 'Mountain ridge' },
  { src: docsHeroB, thumb: docsHeroB, alt: 'Coastal path' },
  { src: docsHeroC, thumb: docsHeroC, alt: 'Forest light' },
];

/** Compact live demo for the Lightbox docs hero. */
export function LightboxHeroDemo() {
  return (
    <Lightbox.Root>
      <div className="grid max-w-md grid-cols-3 gap-2">
        {images.map((img, i) => (
          <Lightbox.Trigger
            key={img.alt}
            index={i}
            className={`block aspect-square overflow-hidden rounded-lg bg-transparent p-0 ${triggerFocusClass}`}
          >
            {({ imageRef }) => (
              <Image
                ref={imageRef}
                src={img.thumb}
                alt={img.alt}
                placeholder="blur"
                sizes="150px"
                className="block size-full object-cover"
              />
            )}
          </Lightbox.Trigger>
        ))}
      </div>
      <LightboxGallery items={images} ariaLabel="Lightbox hero demo" />
    </Lightbox.Root>
  );
}
