'use client';

import * as React from 'react';
import { Lightbox } from 'ramka';

import { ExampleShell } from '../../../_components/example-shell';
import {
  LightboxGallery,
  triggerFocusClass,
  triggerMorphHideClass,
} from '../../../_components/lightbox-chrome';

/**
 * Same masonry + unknown-dimension triggers as the Moodboard demo, but the
 * lightbox track uses `slidesLayout="snug"`: each snap box is inscribed to the
 * media aspect (not full viewport width), with a gap between cards. Chrome
 * insets live on the Slides scroller so the slide hugs the image.
 */
const THUMB_WIDTH = 400;
/** The fullscreen image fetches this many times bigger (same aspect ratio). */
const FULL_SCALE = 2;

function thumbUrl(seed: string, w: number, h: number) {
  const scale = THUMB_WIDTH / w;
  return `https://picsum.photos/seed/${seed}/${Math.round(w * scale)}/${Math.round(h * scale)}`;
}

function fullUrl(seed: string, w: number, h: number) {
  const scale = (THUMB_WIDTH / w) * FULL_SCALE;
  return `https://picsum.photos/seed/${seed}/${Math.round(w * scale)}/${Math.round(h * scale)}`;
}

const images = (
  [
    { id: 'mb-s-01', w: 600, h: 900, alt: 'Foggy pine ridge at dawn', caption: 'Dawn ridge' },
    { id: 'mb-s-02', w: 900, h: 600, alt: 'Empty coastal highway', caption: 'Open road' },
    { id: 'mb-s-03', w: 800, h: 800, alt: 'Overhead of a linen breakfast table', caption: 'Slow morning' },
    { id: 'mb-s-04', w: 700, h: 1050, alt: 'Narrow sunlit alley', caption: 'Warm alley' },
    { id: 'mb-s-05', w: 1200, h: 700, alt: 'Wide desert dunes', caption: 'Dunes' },
    { id: 'mb-s-06', w: 640, h: 820, alt: 'Rain on a window', caption: 'Rainy glass' },
    { id: 'mb-s-07', w: 960, h: 640, alt: 'Calm lake reflection', caption: 'Still water' },
    { id: 'mb-s-08', w: 800, h: 1200, alt: 'Tall concrete staircase', caption: 'Ascent' },
    { id: 'mb-s-09', w: 1000, h: 1000, alt: 'Close-up of dried flowers', caption: 'Pressed petals' },
    { id: 'mb-s-10', w: 1100, h: 620, alt: 'Panoramic city skyline at dusk', caption: 'Dusk skyline' },
    { id: 'mb-s-11', w: 620, h: 900, alt: 'Single tree in a green field', caption: 'Lone tree' },
    { id: 'mb-s-12', w: 900, h: 900, alt: 'Textured stone wall', caption: 'Stonework' },
  ] as const
).map((img) => ({
  ...img,
  thumb: thumbUrl(img.id, img.w, img.h),
  src: fullUrl(img.id, img.w, img.h),
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

export default function MoodboardSnugPage() {
  const cols = useColumnCount();
  // Flex-column masonry (not CSS `columns`) — same rationale as Moodboard.
  const columns = React.useMemo(() => {
    const buckets: { tile: Tile; index: number }[][] = Array.from({ length: cols }, () => []);
    images.forEach((tile, i) => buckets[i % cols]!.push({ tile, index: i }));
    return buckets;
  }, [cols]);

  return (
    <ExampleShell
      title="Moodboard (snug slides)"
      description="Same masonry wall of unknown-dimension tiles as the Moodboard demo, but the lightbox track sizes each snap box to the media aspect instead of the full viewport. Slides sit as rounded cards with a gap between them — swipe to see neighbors peek beside the active image. Chrome insets live on the Slides scroller so the box hugs the photograph."
    >
      <Lightbox.Root
        loop
        scrollTriggerIntoView={[
          { type: 'onChange', behavior: 'instant' },
          { type: 'onOpenComplete', behavior: 'instant' },
        ]}
      >
        <div className="mx-auto flex max-w-2xl gap-4">
          {columns.map((column, ci) => (
            <div key={ci} className="flex min-w-0 flex-1 flex-col gap-4">
              {column.map(({ tile, index }) => (
                <Lightbox.Trigger
                  key={tile.id}
                  index={index}
                  className={`block w-full cursor-pointer overflow-hidden rounded-xl border-none bg-transparent p-0 ${triggerMorphHideClass} ${triggerFocusClass}`}
                >
                  {({ imageRef }) => (
                    <img
                      ref={imageRef}
                      src={tile.thumb}
                      alt={tile.alt}
                      loading="lazy"
                      className="block w-full rounded-xl bg-neutral-100 object-cover transition duration-200 hover:opacity-90 dark:bg-neutral-800"
                    />
                  )}
                </Lightbox.Trigger>
              ))}
            </div>
          ))}
        </div>

        <LightboxGallery
          items={images}
          ariaLabel="Moodboard photos"
          backdrop="solid"
          slidesLayout="snug"
        />
      </Lightbox.Root>
    </ExampleShell>
  );
}
