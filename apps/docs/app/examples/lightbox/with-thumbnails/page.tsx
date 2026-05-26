'use client';

import { Lightbox } from 'react-image-gallery';

import { lightboxImages } from '../../../_data/lightbox-images';
import { ExampleShell } from '../../../_components/example-shell';
import {
  LightboxCloseButton,
  LightboxFrame,
  LightboxFullImage,
  LightboxNavBar,
  LightboxOverlay,
  LightboxTriggerGrid,
  LightboxTriggerImage,
  StackedItemGroup,
  stackedItemClass,
} from '../../../_components/lightbox-chrome';

export default function WithThumbnailsPage() {
  return (
    <ExampleShell
      title="With thumbnails"
      description="Lightbox.ThumbnailGroup is a tablist of Lightbox.Thumbnail buttons with arrow-key navigation, roving tabindex, and aria-selected wired up for free."
    >
      <Lightbox.Root loop>
        <LightboxTriggerGrid>
          {lightboxImages.map((img, i) => (
            <Lightbox.Trigger key={img.id} index={i} className="block overflow-hidden rounded-2xl">
              <LightboxTriggerImage src={img.thumb} alt={img.alt} />
            </Lightbox.Trigger>
          ))}
        </LightboxTriggerGrid>

        <LightboxOverlay />

        <LightboxFrame ariaLabel="Photo gallery with thumbnails">
          <LightboxCloseButton />

          <StackedItemGroup>
            {lightboxImages.map((img, i) => (
              <Lightbox.Item key={img.id} index={i} className={stackedItemClass}>
                <LightboxFullImage src={img.src} alt={img.alt} />
              </Lightbox.Item>
            ))}
          </StackedItemGroup>

          <LightboxNavBar />

          <Lightbox.ThumbnailGroup className="flex gap-2 overflow-x-auto px-4 pb-6 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {lightboxImages.map((img, i) => (
              <Lightbox.Thumbnail
                key={img.id}
                index={i}
                aria-label={`Show ${img.alt}`}
                className="relative shrink-0 overflow-hidden rounded-md outline-none ring-offset-2 ring-offset-black transition focus-visible:ring-2 focus-visible:ring-white/70 data-[active]:ring-2 data-[active]:ring-white"
              >
                <img src={img.thumb} alt="" className="block h-14 w-14 object-cover" />
              </Lightbox.Thumbnail>
            ))}
          </Lightbox.ThumbnailGroup>
        </LightboxFrame>
      </Lightbox.Root>
    </ExampleShell>
  );
}
