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
  triggerFocusClass,
  triggerMorphHideClass,
} from '../../../_components/lightbox-chrome';

export default function DefaultLightboxPage() {
  return (
    <ExampleShell
      title="Default lightbox"
      docsHref="/docs/lightbox"
      docsLabel="Lightbox documentation"
      description="A trigger grid opens an unstyled, headless modal. Every visual surface — backdrop, frame, controls — is plain Tailwind on top of Lightbox primitives."
    >
      <Lightbox.Root>
        <LightboxTriggerGrid>
          {lightboxImages.map((img, i) => (
            <Lightbox.Trigger key={img.id} index={i} className={`block overflow-hidden rounded-2xl ${triggerMorphHideClass} ${triggerFocusClass}`}>
              <LightboxTriggerImage src={img.thumb} alt={img.alt} />
            </Lightbox.Trigger>
          ))}
        </LightboxTriggerGrid>

        <LightboxOverlay />

        <LightboxFrame ariaLabel="Photo gallery">
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
