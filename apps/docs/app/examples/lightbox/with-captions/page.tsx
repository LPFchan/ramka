'use client';

import { Lightbox } from 'ramka';

import { lightboxImages } from '../../../_data/lightbox-images';
import { ExampleShell } from '../../../_components/example-shell';
import {
  LightboxCaptionLine,
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

export default function WithCaptionsPage() {
  return (
    <ExampleShell
      title="With captions"
      description="Each Lightbox.Item registers a caption through the caption prop. Lightbox.Caption reads the active item's caption and announces changes via aria-live."
    >
      <Lightbox.Root>
        <LightboxTriggerGrid>
          {lightboxImages.map((img, i) => (
            <Lightbox.Trigger key={img.id} index={i} className="block overflow-hidden rounded-2xl">
              <LightboxTriggerImage src={img.thumb} alt={img.alt} />
            </Lightbox.Trigger>
          ))}
        </LightboxTriggerGrid>

        <LightboxOverlay />

        <LightboxFrame ariaLabel="Captioned photo gallery">
          <LightboxCloseButton />

          <StackedItemGroup>
            {lightboxImages.map((img, i) => (
              <Lightbox.Item key={img.id} index={i} caption={img.caption} className={stackedItemClass}>
                <LightboxFullImage src={img.src} alt={img.alt} />
              </Lightbox.Item>
            ))}
          </StackedItemGroup>

          <LightboxNavBar />
          <LightboxCaptionLine />
        </LightboxFrame>
      </Lightbox.Root>
    </ExampleShell>
  );
}
