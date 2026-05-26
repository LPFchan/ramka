'use client';

import { Lightbox } from 'ramka';
import { ZoomIn, ZoomOut } from 'lucide-react';

import { lightboxImages } from '../../../_data/lightbox-images';
import { ExampleShell } from '../../../_components/example-shell';
import {
  LightboxCloseButton,
  LightboxFrame,
  LightboxNavBar,
  LightboxOverlay,
  LightboxTriggerGrid,
  LightboxTriggerImage,
  StackedItemGroup,
  stackedItemClass,
} from '../../../_components/lightbox-chrome';

const zoomButton =
  'inline-flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-30';

export default function WithZoomPage() {
  return (
    <ExampleShell
      title="With zoom"
      description={
        <>
          Wrap a media element in <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">Lightbox.Zoom</code>{' '}
          to get pinch (touch), Ctrl+wheel and trackpad zoom, double-click toggle, drag-to-pan, momentum, and elastic
          bounds — all on the client side, all unstyled.{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">Lightbox.ZoomIn</code> and{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">Lightbox.ZoomOut</code>{' '}
          consume the zoom context.
        </>
      }
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

        <LightboxFrame ariaLabel="Photo gallery with zoom">
          <LightboxCloseButton />

          <StackedItemGroup>
            {lightboxImages.map((img, i) => (
              <Lightbox.Item key={img.id} index={i} className={stackedItemClass}>
                <Lightbox.Zoom
                  className="h-full w-full"
                  wrapperClassName="flex h-full w-full items-center justify-center"
                  overlay={
                    <div className="pointer-events-none absolute right-4 top-4 z-10 flex flex-col gap-2">
                      <Lightbox.ZoomIn className={`pointer-events-auto ${zoomButton}`}>
                        <ZoomIn aria-hidden className="h-4 w-4" />
                      </Lightbox.ZoomIn>
                      <Lightbox.ZoomOut className={`pointer-events-auto ${zoomButton}`}>
                        <ZoomOut aria-hidden className="h-4 w-4" />
                      </Lightbox.ZoomOut>
                    </div>
                  }
                >
                  <img
                    src={img.src}
                    alt={img.alt}
                    loading="eager"
                    className="max-h-[75vh] max-w-[90vw] select-none rounded-lg object-contain"
                    draggable={false}
                  />
                </Lightbox.Zoom>
              </Lightbox.Item>
            ))}
          </StackedItemGroup>

          <LightboxNavBar />
        </LightboxFrame>
      </Lightbox.Root>
    </ExampleShell>
  );
}
