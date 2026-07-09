'use client';

import * as React from 'react';
import { Lightbox, ScrollGallery } from 'ramka';
import { X, ZoomIn, ZoomOut } from 'lucide-react';

import { ExampleShell } from '../../../_components/example-shell';

/**
 * The canonical, real-world lightbox — deliberately self-contained (no
 * shared docs helpers, inline data) so the whole composition can be read
 * top-to-bottom and iterated on in one place.
 *
 * It mirrors a production media lightbox: swipe navigation via a
 * `ScrollGallery` viewport, thumbnails on desktop only, a View Transition
 * morph from the trigger, and per-item pinch/scroll/keyboard zoom.
 *
 * The only state lifted here is `activeIndex`, shared between
 * `Lightbox.Root` and the inner `ScrollGallery.Root`. Chrome (top controls
 * + thumbnails) is hidden while zoomed purely through CSS: `Lightbox.Zoom`
 * sets `data-zoomed` on the Content element, and the chrome targets an
 * ancestor with `[[data-zoomed]_&]`.
 */

interface GalleryImage {
  id: number;
  src: string;
  thumb: string;
  alt: string;
  caption: string;
}

// Mixed aspect ratios (landscape, portrait, square) to exercise
// object-contain sizing and morphs across differing crops.
const images: GalleryImage[] = [
  {
    id: 1,
    src: 'https://picsum.photos/seed/rg-1/1600/1000',
    thumb: 'https://picsum.photos/seed/rg-1/400/400',
    alt: 'Mountain range under a wide morning sky',
    caption: 'First light over the ridgeline',
  },
  {
    id: 2,
    src: 'https://picsum.photos/seed/rg-2/900/1400',
    thumb: 'https://picsum.photos/seed/rg-2/400/400',
    alt: 'Tall waterfall in a narrow gorge',
    caption: 'A vertical drop through the gorge',
  },
  {
    id: 3,
    src: 'https://picsum.photos/seed/rg-3/1200/1200',
    thumb: 'https://picsum.photos/seed/rg-3/400/400',
    alt: 'Overhead shot of a coastline',
    caption: 'Where the tide meets the rocks',
  },
  {
    id: 4,
    src: 'https://picsum.photos/seed/rg-4/1600/900',
    thumb: 'https://picsum.photos/seed/rg-4/400/400',
    alt: 'Rolling fields at golden hour',
    caption: 'Golden hour across the valley',
  },
  {
    id: 5,
    src: 'https://picsum.photos/seed/rg-5/1000/1400',
    thumb: 'https://picsum.photos/seed/rg-5/400/400',
    alt: 'Dense forest canopy from below',
    caption: 'Looking up through the canopy',
  },
  {
    id: 6,
    src: 'https://picsum.photos/seed/rg-6/1500/1000',
    thumb: 'https://picsum.photos/seed/rg-6/400/400',
    alt: 'Quiet lake reflecting the hills',
    caption: 'Still water at dusk',
  },
];

const iconButton =
  'inline-flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-30 pointer-events-auto';

// Turns a stacked/absolute <Lightbox.Item> into a normal in-flow
// <ScrollGallery.Item> that lays out side by side and snaps to center.
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

export default function ResponsiveGalleryPage() {
  const [activeIndex, setActiveIndex] = React.useState(0);

  return (
    <ExampleShell
      title="Responsive gallery"
      description={
        <>
          The canonical real-world lightbox, built as one self-contained component: swipe navigation, thumbnails on
          desktop only, a View Transition morph from the trigger, and pinch / scroll / keyboard zoom. While zoomed, the
          chrome fades out via the{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">[data-zoomed]</code> attribute
          that <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">Lightbox.Zoom</code> sets
          on the content element.
        </>
      }
    >
      <Lightbox.Root loop viewTransition value={activeIndex} onValueChange={setActiveIndex}>
        {/* Trigger grid */}
        <div className="grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img, i) => (
            <Lightbox.Trigger
              key={img.id}
              index={i}
              crossfade
              className="block cursor-pointer overflow-hidden rounded-2xl border-none bg-transparent p-0 transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
            >
              <img src={img.thumb} alt={img.alt} className="block aspect-square w-full object-cover" />
            </Lightbox.Trigger>
          ))}
        </div>

        {/* Scrim. `data-pulling:transition-none` lets the pull-to-dismiss
            gesture drive opacity 1:1 with the finger — the transition is only
            for the open/close fade, and would otherwise make the drag fade lag. */}
        <Lightbox.Backdrop className="fixed inset-0 z-40 bg-black/90 opacity-0 transition-opacity duration-300 data-[open]:opacity-100 data-pulling:transition-none starting:data-[open]:opacity-0" />

        {/* Fullscreen viewer */}
        <Lightbox.Content
          aria-label="Responsive photo gallery"
          className="fixed inset-0 z-50 flex flex-col opacity-0 outline-none transition-opacity duration-200 data-[open]:opacity-100 starting:data-[open]:opacity-0"
        >
          <ScrollGallery.Root value={activeIndex} onValueChange={setActiveIndex} scrollBehavior="instant">
            {/* Swipeable, snapping viewport of full-size images */}
            <Lightbox.ItemGroup
              render={<ScrollGallery.Viewport aria-label="Full-size images" />}
              preload={images.length}
              className="flex flex-1 overflow-x-auto overscroll-x-contain [scroll-snap-type:x_mandatory] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {images.map((img, i) => (
                <Lightbox.Item
                  key={img.id}
                  index={i}
                  caption={img.caption}
                  render={<ScrollGallery.Item />}
                  style={scrollItemStyle}
                >
                  <Lightbox.Zoom
                    maxZoom={6}
                    className="flex h-full w-full items-center justify-center"
                    wrapperClassName="flex h-full w-full items-center justify-center"
                  >
                    <img
                      src={img.src}
                      alt={img.alt}
                      loading="eager"
                      draggable={false}
                      className="max-h-[calc(100%-6rem)] max-w-[calc(100%-2rem)] select-none rounded-lg object-contain md:max-h-[calc(100%-11rem)] md:max-w-[calc(100%-4rem)]"
                    />
                  </Lightbox.Zoom>
                </Lightbox.Item>
              ))}
            </Lightbox.ItemGroup>

            {/* Top-right controls — hidden while zoomed */}
            <div className="absolute right-3 top-3 z-10 flex gap-2 transition-opacity duration-200 [[data-zoomed]_&]:pointer-events-none [[data-zoomed]_&]:opacity-0">
              <Lightbox.ZoomOut className={iconButton} aria-label="Zoom out">
                <ZoomOut aria-hidden className="h-4 w-4" />
              </Lightbox.ZoomOut>
              <Lightbox.ZoomIn className={iconButton} aria-label="Zoom in">
                <ZoomIn aria-hidden className="h-4 w-4" />
              </Lightbox.ZoomIn>
              <Lightbox.Close className={iconButton} aria-label="Close">
                <X aria-hidden className="h-5 w-5" />
              </Lightbox.Close>
            </div>

            {/* Caption + thumbnails — thumbnails only render on desktop */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 px-3 pb-4 transition-opacity duration-200 [[data-zoomed]_&]:opacity-0">
              <Lightbox.Caption className="pointer-events-auto block min-h-[1.25rem] max-w-full truncate px-6 text-center text-sm text-white/80" />

              <ScrollGallery.ScrollMarkerGroup
                aria-label="Photo thumbnails"
                className="pointer-events-auto hidden justify-center gap-2 md:flex"
              >
                {images.map((img, i) => (
                  <ScrollGallery.ScrollMarker
                    key={img.id}
                    index={i}
                    className="h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 border-transparent p-0 opacity-50 transition data-[active]:border-white data-[active]:opacity-100"
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
