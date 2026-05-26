'use client';

import * as React from 'react';
import { Lightbox, ScrollGallery } from 'react-image-gallery';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';

import { lightboxImages } from '../../../_data/lightbox-images';
import { ExampleShell } from '../../../_components/example-shell';

const navButton =
  'inline-flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-30 pointer-events-auto';

const scrollItemStyle: React.CSSProperties = {
  position: 'relative',
  inset: 'auto',
  visibility: 'visible',
  animation: 'none',
  scrollSnapAlign: 'center',
  flexShrink: 0,
  width: '100vw',
  height: '100%',
};

export default function ScrollGalleryWithZoomPage() {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [isZoomed, setIsZoomed] = React.useState(false);

  return (
    <ExampleShell
      title="Scroll gallery with zoom"
      description={
        <>
          Combine a horizontally-snapping <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">ScrollGallery</code>{' '}
          with a per-item <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">Lightbox.Zoom</code>.
          When any item is zoomed, the surrounding chrome (close button, thumbnails, caption) fades out via the{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">[data-zoomed]</code> selector
          on the root, leaving the photograph uncluttered.
        </>
      }
    >
      <Lightbox.Root loop viewTransition value={activeIndex} onValueChange={setActiveIndex}>
        <div className="grid max-w-md grid-cols-3 gap-3">
          {lightboxImages.map((img, i) => (
            <Lightbox.Trigger key={img.id} index={i} crossfade className="block cursor-pointer rounded-2xl border-none bg-transparent p-0">
              <img
                src={img.thumb}
                alt={img.alt}
                className="block h-28 w-full rounded-2xl object-cover"
              />
            </Lightbox.Trigger>
          ))}
        </div>

        <Lightbox.Backdrop className="lightbox-chrome-fade fixed inset-0 z-40 bg-black/85 opacity-0 transition-opacity duration-[340ms] ease-out-expo data-[open]:opacity-100 starting:data-[open]:opacity-0" />

        <Lightbox.Content
          aria-label="Photo gallery with scroll gallery and zoom"
          className="lightbox-chrome-fade fixed inset-0 z-50 flex flex-col items-stretch opacity-0 outline-none transition-opacity duration-[280ms] ease-out-expo data-[open]:opacity-100 starting:data-[open]:opacity-0"
        >
          <ScrollGallery.Root value={activeIndex} onValueChange={setActiveIndex} scrollBehavior="instant">
            <Lightbox.ItemGroup
              render={<ScrollGallery.Viewport aria-label="Full-size images" />}
              preload={lightboxImages.length}
              className="flex h-full overflow-x-auto overscroll-x-contain [scroll-snap-type:x_mandatory] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {lightboxImages.map((img, i) => (
                <Lightbox.Item
                  key={img.id}
                  index={i}
                  caption={img.caption}
                  render={<ScrollGallery.Item />}
                  style={scrollItemStyle}
                >
                  <Lightbox.Zoom
                    className="flex h-full w-full items-center justify-center"
                    wrapperClassName="flex h-full w-full items-center justify-center"
                    maxZoom={6}
                    onZoomChange={(z) => setIsZoomed(z > 1)}
                  >
                    <img
                      src={img.src}
                      alt={img.alt}
                      className="max-h-[calc(100%-160px)] max-w-[calc(100%-64px)] select-none rounded-lg object-contain"
                      draggable={false}
                    />
                  </Lightbox.Zoom>
                </Lightbox.Item>
              ))}
            </Lightbox.ItemGroup>

            {/* Top-right close + zoom controls (hidden while zoomed) */}
            <div
              data-zoomed={isZoomed || undefined}
              className="pointer-events-none absolute right-3 top-3 z-10 flex gap-2 transition-opacity duration-200 data-zoomed:opacity-0"
            >
              <Lightbox.ZoomOut className={navButton}>
                <ZoomOut aria-hidden className="h-4 w-4" />
              </Lightbox.ZoomOut>
              <Lightbox.ZoomIn className={navButton}>
                <ZoomIn aria-hidden className="h-4 w-4" />
              </Lightbox.ZoomIn>
              <Lightbox.Close className={navButton} aria-label="Close">
                <X aria-hidden className="h-5 w-5" />
              </Lightbox.Close>
            </div>

            {/* Bottom controls (also hidden while zoomed) */}
            <div
              data-zoomed={isZoomed || undefined}
              className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 px-3 pb-4 transition-opacity duration-200 data-zoomed:opacity-0"
            >
              <Lightbox.Caption className="pointer-events-auto block min-h-[1.25rem] max-w-full truncate px-6 text-center text-sm text-white/80" />

              <div className="pointer-events-auto flex items-center gap-3">
                <Lightbox.Previous className={navButton}>
                  <ChevronLeft aria-hidden className="h-5 w-5" />
                </Lightbox.Previous>
                <Lightbox.Counter className="min-w-[3.5rem] text-center font-mono text-sm tabular-nums text-white/70" />
                <Lightbox.Next className={navButton}>
                  <ChevronRight aria-hidden className="h-5 w-5" />
                </Lightbox.Next>
              </div>

              <ScrollGallery.ScrollMarkerGroup
                aria-label="Photo thumbnails"
                className="pointer-events-auto flex justify-center gap-2"
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
            </div>
          </ScrollGallery.Root>
        </Lightbox.Content>
      </Lightbox.Root>
    </ExampleShell>
  );
}
