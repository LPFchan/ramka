'use client';

import * as React from 'react';
import { Lightbox, ScrollGallery } from 'ramka';

import { lightboxImages } from '../../../_data/lightbox-images';
import { ExampleShell } from '../../../_components/example-shell';
import {
  LightboxCaptionLine,
  LightboxCloseButton,
  LightboxFrame,
  LightboxOverlay,
  LightboxTriggerGrid,
  LightboxTriggerImage,
} from '../../../_components/lightbox-chrome';

/**
 * Inline style overrides applied to <Lightbox.Item> when it's also used
 * as a <ScrollGallery.Item> — the default stacked / absolute positioning
 * is replaced with normal flow + scroll snap so items lay out side by
 * side in the scroll viewport.
 */
const scrollItemStyle: React.CSSProperties = {
  position: 'relative',
  inset: 'auto',
  visibility: 'visible',
  animation: 'none',
  scrollSnapAlign: 'center',
  flexShrink: 0,
  width: '100vw',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 20px',
  boxSizing: 'border-box',
};

export default function WithScrollGalleryPage() {
  const [activeIndex, setActiveIndex] = React.useState(0);

  return (
    <ExampleShell
      title="With scroll gallery"
      description={
        <>
          A <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">ScrollGallery</code> lives
          inside the lightbox content, sharing the active index with{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">Lightbox</code>. The same{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">Lightbox.ItemGroup</code> is
          rendered as a <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">ScrollGallery.Viewport</code>{' '}
          via the polymorphic <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">render</code> prop, so swiping,
          keyboard arrows, and the bottom thumbnails are all kept in sync. With{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">wheelToClose</code> on the content, a
          two-finger vertical swipe on a trackpad pulls the image down to dismiss — horizontal swipes still scroll the
          gallery.
        </>
      }
    >
      <Lightbox.Root loop viewTransition value={activeIndex} onValueChange={setActiveIndex}>
        <LightboxTriggerGrid>
          {lightboxImages.map((img, i) => (
            <Lightbox.Trigger key={img.id} index={i} crossfade className="block overflow-hidden rounded-2xl">
              <LightboxTriggerImage src={img.thumb} alt={img.alt} />
            </Lightbox.Trigger>
          ))}
        </LightboxTriggerGrid>

        <LightboxOverlay />

        <LightboxFrame
          ariaLabel="Photo gallery with scroll gallery"
          className="flex flex-col items-stretch"
          wheelToClose
        >
          <LightboxCloseButton />

          <ScrollGallery.Root value={activeIndex} onValueChange={setActiveIndex}>
            <Lightbox.ItemGroup
              render={<ScrollGallery.Viewport aria-label="Full-size images" />}
              preload={lightboxImages.length}
              className="flex flex-1 overflow-x-auto overscroll-x-contain [scroll-snap-type:x_mandatory] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {lightboxImages.map((img, i) => (
                <Lightbox.Item
                  key={img.id}
                  index={i}
                  caption={img.caption}
                  render={<ScrollGallery.Item />}
                  style={scrollItemStyle}
                >
                  <img
                    src={img.src}
                    alt={img.alt}
                    className="max-h-[75vh] max-w-full rounded-lg object-contain"
                  />
                </Lightbox.Item>
              ))}
            </Lightbox.ItemGroup>

            <LightboxCaptionLine />

            <ScrollGallery.ScrollMarkerGroup
              aria-label="Photo thumbnails"
              className="flex justify-center gap-2 px-3 pb-3"
            >
              {lightboxImages.map((img, i) => (
                <ScrollGallery.ScrollMarker
                  key={img.id}
                  index={i}
                  className="h-14 w-14 overflow-hidden rounded-md border-2 border-transparent p-0 opacity-50 transition data-[active]:border-white data-[active]:opacity-100"
                >
                  <img src={img.thumb} alt={img.alt} className="h-full w-full object-cover" />
                </ScrollGallery.ScrollMarker>
              ))}
            </ScrollGallery.ScrollMarkerGroup>
          </ScrollGallery.Root>
        </LightboxFrame>
      </Lightbox.Root>
    </ExampleShell>
  );
}
