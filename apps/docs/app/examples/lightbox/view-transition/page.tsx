'use client';

import { Lightbox } from 'ramka';

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

export default function ViewTransitionPage() {
  return (
    <ExampleShell
      title="View transition morph"
      description={
        <>
          With <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">viewTransition</code>{' '}
          on Root, the clicked trigger thumbnail morphs into the lightbox item using the View Transitions API. On
          close, it morphs back. Set <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">crossfade</code>{' '}
          on the Trigger when the thumbnail and full image look different. Falls back to a normal fade when the API or
          prefers-reduced-motion say so.
        </>
      }
    >
      <Lightbox.Root viewTransition>
        <LightboxTriggerGrid>
          {lightboxImages.map((img, i) => (
            <Lightbox.Trigger
              key={img.id}
              index={i}
              crossfade
              className="block overflow-hidden rounded-2xl transition-opacity duration-[200ms] ease-out-expo data-[morph-target]:opacity-0"
            >
              <LightboxTriggerImage src={img.thumb} alt={img.alt} />
            </Lightbox.Trigger>
          ))}
        </LightboxTriggerGrid>

        <LightboxOverlay />

        <LightboxFrame ariaLabel="Photo gallery with view transition morph">
          <LightboxCloseButton />

          <StackedItemGroup>
            {lightboxImages.map((img, i) => (
              <Lightbox.Item key={img.id} index={i} className={stackedItemClass}>
                <LightboxFullImage src={img.src} alt={img.alt} />
              </Lightbox.Item>
            ))}
          </StackedItemGroup>

          <LightboxNavBar />
        </LightboxFrame>
      </Lightbox.Root>
    </ExampleShell>
  );
}
