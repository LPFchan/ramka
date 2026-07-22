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

export default function LazyLoadingPage() {
  return (
    <ExampleShell
      title="Lazy loading"
      docsHref="/docs/lightbox/composition#item-group"
      docsLabel="Item / ItemGroup API"
      description={
        <>
          Pass <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">preload={'{0}'}</code>{' '}
          to <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">Lightbox.ItemGroup</code>{' '}
          so only the active item renders, then use the{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">Lightbox.Item</code> render
          prop to show a placeholder for inactive items. Useful for very heavy items (4K photos, video) where eagerly
          mounting every slide would be wasteful.
        </>
      }
    >
      <Lightbox.Root>
        <LightboxTriggerGrid>
          {lightboxImages.map((img, i) => (
            <Lightbox.Trigger key={img.id} index={i} crossfade="both" className={`block overflow-hidden rounded-2xl ${triggerMorphHideClass} ${triggerFocusClass}`}>
              <LightboxTriggerImage src={img.thumb} alt={img.alt} />
            </Lightbox.Trigger>
          ))}
        </LightboxTriggerGrid>

        <LightboxOverlay />

        <LightboxFrame ariaLabel="Lazy-loaded gallery">
          <LightboxCloseButton />

          <StackedItemGroup preload={0}>
            {lightboxImages.map((img, i) => (
              <Lightbox.Item
                key={img.id}
                index={i}
                caption={`Lazy: ${img.caption}`}
                className={stackedItemClass}
              >
                {({ active }) =>
                  active ? (
                    <LightboxFullImage src={img.src} alt={img.alt} />
                  ) : (
                    <div className="flex h-[150px] w-[200px] items-center justify-center text-sm text-white/50">
                      Loading…
                    </div>
                  )
                }
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
