'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ScrollGallery } from 'react-image-gallery';
import { ExampleShell } from '../../_components/example-shell';
import { IconButton } from '../../_components/icon-button';
import { productImages } from '../../_data/product-images';

export default function Page() {
  return (
    <ExampleShell
      title="Product gallery"
      description="A real-world product page layout: a main viewport with overlay nav and dash-style markers, plus a row of thumbnail markers below."
    >
      <div className="mx-auto max-w-md">
        <ScrollGallery.Root defaultValue={0}>
          <div className="relative">
            <ScrollGallery.Viewport
              aria-label="Product images"
              style={{
                display: 'flex',
                overflowX: 'auto',
                overscrollBehaviorX: 'contain',
                scrollSnapType: 'x mandatory',
                scrollbarWidth: 'none',
                borderRadius: 12,
                background: 'rgb(245 245 245)',
              }}
            >
              {productImages.map((img) => (
                <ScrollGallery.Item
                  key={img.id}
                  style={{ scrollSnapAlign: 'start', flexShrink: 0, width: '100%' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.src}
                    alt={img.alt}
                    className="aspect-square w-full select-none object-cover"
                    draggable={false}
                  />
                </ScrollGallery.Item>
              ))}
            </ScrollGallery.Viewport>

            <ScrollGallery.Previous
              aria-label="Previous image"
              className="absolute left-3 top-1/2 -translate-y-1/2"
              render={
                <IconButton className="border-transparent !bg-white/90 shadow-md backdrop-blur dark:!bg-neutral-900/90" />
              }
            >
              <ChevronLeft className="h-5 w-5" />
            </ScrollGallery.Previous>

            <ScrollGallery.Next
              aria-label="Next image"
              className="absolute right-3 top-1/2 -translate-y-1/2"
              render={
                <IconButton className="border-transparent !bg-white/90 shadow-md backdrop-blur dark:!bg-neutral-900/90" />
              }
            >
              <ChevronRight className="h-5 w-5" />
            </ScrollGallery.Next>

            <ScrollGallery.ScrollMarkerGroup
              aria-label="Choose image"
              className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur"
            >
              {productImages.map((_, i) => (
                <ScrollGallery.ScrollMarker
                  key={i}
                  index={i}
                  render={(props, state) => (
                    <button
                      {...props}
                      aria-label={`Image ${i + 1}`}
                      className={`h-1.5 cursor-pointer rounded-full border-0 p-0 transition-all ${
                        state.active ? 'w-6 bg-white' : 'w-1.5 bg-white/50'
                      }`}
                    />
                  )}
                />
              ))}
            </ScrollGallery.ScrollMarkerGroup>
          </div>

          <ScrollGallery.ScrollMarkerGroup aria-label="Thumbnails" className="mt-3 flex justify-center gap-2">
            {productImages.map((img, i) => (
              <ScrollGallery.ScrollMarker
                key={i}
                index={i}
                render={(props, state) => (
                  <button
                    {...props}
                    aria-label={`Thumbnail ${i + 1}`}
                    className={`h-14 w-14 cursor-pointer overflow-hidden rounded-md border-2 p-0 transition ${
                      state.active
                        ? 'border-neutral-900 dark:border-neutral-100'
                        : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.thumb} alt="" className="h-full w-full object-cover" draggable={false} />
                  </button>
                )}
              />
            ))}
          </ScrollGallery.ScrollMarkerGroup>
        </ScrollGallery.Root>
      </div>
    </ExampleShell>
  );
}
