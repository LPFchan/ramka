'use client';

import * as React from 'react';
import Image from 'next/image';
import { Lightbox } from 'ramka';

import { ExampleShell } from '../../../../_components/example-shell';
import {
  LightboxGallery,
  triggerFocusClass,
} from '../../../../_components/lightbox-chrome';
import { moodboardImages } from './images.generated';

/**
 * Every tile is a statically-imported local asset rendered through
 * `next/image`: the grid thumbnail gets a build-time `blurDataURL`
 * placeholder, and the fullscreen viewer reuses the SAME source at a higher
 * `sizes` so both are the same crop — opening a tile lets Ramka bridge the
 * already-decoded thumbnail while the larger candidate downloads.
 */
const images = (
  [
    { id: 'mb-01', alt: 'Foggy pine ridge at dawn', caption: 'Dawn ridge' },
    { id: 'mb-02', alt: 'Empty coastal highway', caption: 'Open road' },
    { id: 'mb-03', alt: 'Overhead of a linen breakfast table', caption: 'Slow morning' },
    { id: 'mb-04', alt: 'Narrow sunlit alley', caption: 'Warm alley' },
    { id: 'mb-05', alt: 'Wide desert dunes', caption: 'Dunes' },
    { id: 'mb-06', alt: 'Rain on a window', caption: 'Rainy glass' },
    { id: 'mb-07', alt: 'Calm lake reflection', caption: 'Still water' },
    { id: 'mb-08', alt: 'Tall concrete staircase', caption: 'Ascent' },
    { id: 'mb-09', alt: 'Close-up of dried flowers', caption: 'Pressed petals' },
    { id: 'mb-10', alt: 'Panoramic city skyline at dusk', caption: 'Dusk skyline' },
    { id: 'mb-11', alt: 'Single tree in a green field', caption: 'Lone tree' },
    { id: 'mb-12', alt: 'Textured stone wall', caption: 'Stonework' },
  ] as const
).map((img, i) => ({
  ...img,
  image: moodboardImages[i]!,
  thumb: moodboardImages[i]!,
  src: moodboardImages[i]!,
}));

type Tile = (typeof images)[number];

/** Responsive column count without CSS multicol (2 on mobile, 3 from `sm`). */
function useColumnCount() {
  const [cols, setCols] = React.useState(2);
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const update = () => setCols(mq.matches ? 3 : 2);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return cols;
}

export default function MoodboardPage() {
  const cols = useColumnCount();
  // Distribute tiles round-robin into flex columns. This intentionally avoids
  // CSS `columns` (multicol): opening the lightbox locks page scroll (hides the
  // scrollbar → width change) and toggles a document-wide view-transition-name
  // reset, either of which forces the background to re-layout DURING the
  // transition. Multicol re-balances every item on any such invalidation — one
  // of the heaviest layouts there is — which starves the morph/backdrop of
  // frames (worst on mobile Safari). A flex-column reflow is cheap by contrast.
  const columns = React.useMemo(() => {
    const buckets: { tile: Tile; index: number }[][] = Array.from({ length: cols }, () => []);
    images.forEach((tile, i) => buckets[i % cols]!.push({ tile, index: i }));
    return buckets;
  }, [cols]);

  return (
    <ExampleShell
      title="Moodboard"
      description="A masonry wall of next/image tiles — each grid thumbnail shows a build-time blurDataURL placeholder while its pixels load, then tapping a tile opens the same fullscreen viewer as the Photos-app demo: a swipeable, snapping scroller with pinch / scroll / keyboard zoom, desktop thumbnails, edge-to-edge images, and pull-to-dismiss. Trigger and viewer share the same local source image at different sizes (srcset picks the resolution), so opening one paints the cached thumbnail as a placeholder that bridges the blank frame while the larger candidate downloads."
    >
      <Lightbox.Root
        loop
        scrollTriggerIntoView={[
          { type: 'onChange', behavior: 'instant' },
          { type: 'onOpenComplete', behavior: 'instant' },
        ]}
      >
        {/* Flex-column masonry (not CSS `columns`) — see useColumnCount above for
            why. Tiles keep their natural aspect once loaded; round-robin keeps a
            balanced-ish layout without measuring heights. */}
        <div className="flex max-w-2xl gap-4">
          {columns.map((column, ci) => (
            <div key={ci} className="flex min-w-0 flex-1 flex-col gap-4">
              {column.map(({ tile, index }) => (
                <Lightbox.Trigger
                  key={tile.id}
                  index={index}
                  className={`block w-full cursor-pointer overflow-hidden rounded-xl border-none bg-transparent p-0 ${triggerFocusClass}`}
                >
                  {({ imageRef }) => (
                    <Image
                      ref={imageRef}
                      src={tile.image}
                      alt={tile.alt}
                      placeholder="blur"
                      sizes="(min-width: 640px) 224px, 50vw"
                      loading="lazy"
                      className="block h-auto w-full rounded-xl bg-neutral-100 object-cover transition duration-200 hover:opacity-90 dark:bg-neutral-800"
                    />
                  )}
                </Lightbox.Trigger>
              ))}
            </div>
          ))}
        </div>

        <LightboxGallery items={images} ariaLabel="Moodboard photos" backdrop="solid" />
      </Lightbox.Root>
    </ExampleShell>
  );
}
