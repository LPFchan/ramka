'use client';

import * as React from 'react';
import { Lightbox } from 'ramka';

import { ExampleShell } from '../../../_components/example-shell';
import {
  LightboxCaptionLine,
  LightboxCloseButton,
  LightboxFrame,
  LightboxNavBar,
  LightboxOverlay,
  StackedItemGroup,
  stackedItemClass,
} from '../../../_components/lightbox-chrome';

/**
 * Unlike the other examples, these images carry NO known dimensions: the markup
 * sets no `width`/`height` attributes and reserves no `aspect-ratio`, so every
 * box is sized only once its pixels load — the "user-uploaded / CMS" scenario
 * where aspect ratios aren't known ahead of time.
 *
 * To stress the placeholder path, the trigger and the lightbox item fetch the
 * SAME photo (same seed → same aspect) at DIFFERENT sizes: a small thumbnail
 * for the grid and a much larger image for the fullscreen view. When you open a
 * tile, the small (already-decoded) thumbnail is painted as the item image's
 * background and bridges the blank frame while the big version downloads.
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
    { id: 'mb-01', w: 600, h: 900, alt: 'Foggy pine ridge at dawn', caption: 'Dawn ridge' },
    { id: 'mb-02', w: 900, h: 600, alt: 'Empty coastal highway', caption: 'Open road' },
    { id: 'mb-03', w: 800, h: 800, alt: 'Overhead of a linen breakfast table', caption: 'Slow morning' },
    { id: 'mb-04', w: 700, h: 1050, alt: 'Narrow sunlit alley', caption: 'Warm alley' },
    { id: 'mb-05', w: 1200, h: 700, alt: 'Wide desert dunes', caption: 'Dunes' },
    { id: 'mb-06', w: 640, h: 820, alt: 'Rain on a window', caption: 'Rainy glass' },
    { id: 'mb-07', w: 960, h: 640, alt: 'Calm lake reflection', caption: 'Still water' },
    { id: 'mb-08', w: 800, h: 1200, alt: 'Tall concrete staircase', caption: 'Ascent' },
    { id: 'mb-09', w: 1000, h: 1000, alt: 'Close-up of dried flowers', caption: 'Pressed petals' },
    { id: 'mb-10', w: 1100, h: 620, alt: 'Panoramic city skyline at dusk', caption: 'Dusk skyline' },
    { id: 'mb-11', w: 620, h: 900, alt: 'Single tree in a green field', caption: 'Lone tree' },
    { id: 'mb-12', w: 900, h: 900, alt: 'Textured stone wall', caption: 'Stonework' },
  ] as const
).map((img) => ({
  ...img,
  thumb: thumbUrl(img.id, img.w, img.h),
  full: fullUrl(img.id, img.w, img.h),
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
      description="A masonry wall of images with unknown dimensions — no width/height attributes and no reserved aspect ratio, so each tile is sized only once its pixels load. Each tile fetches a small thumbnail while the lightbox loads a 4× larger version of the same photo, so opening one paints the cached thumbnail as a placeholder while the big image downloads. This stresses the morph's size-resolution fallback (an un-sized box crossfades instead of shrinking to a corner) and the trigger-thumbnail placeholder that bridges the blank frame."
    >
      <Lightbox.Root viewTransition awaitImageDecode={360}>
        {/* Flex-column masonry (not CSS `columns`) — see useColumnCount above for
            why. Tiles keep their natural aspect once loaded; round-robin keeps a
            balanced-ish layout without measuring heights. */}
        <div className="mx-auto flex max-w-2xl gap-4">
          {columns.map((column, ci) => (
            <div key={ci} className="flex min-w-0 flex-1 flex-col gap-4">
              {column.map(({ tile, index }) => (
                <Lightbox.Trigger
                  key={tile.id}
                  index={index}
                  className="block w-full cursor-pointer overflow-hidden rounded-xl border-none bg-transparent p-0"
                >
                  {({ triggerImageRef }) => (
                    <img
                      ref={triggerImageRef}
                      src={tile.thumb}
                      alt={tile.alt}
                      loading="lazy"
                      // No width/height and no aspect-ratio on purpose. The neutral
                      // fill gives the not-yet-loaded tile a clean look instead of a
                      // collapsed 0-height sliver.
                      className="block w-full rounded-xl bg-neutral-100 object-cover transition duration-200 hover:opacity-90 dark:bg-neutral-800"
                    />
                  )}
                </Lightbox.Trigger>
              ))}
            </div>
          ))}
        </div>

        <LightboxOverlay />

        <LightboxFrame ariaLabel="Moodboard">
          <LightboxCloseButton />

          <StackedItemGroup>
            {images.map((img, i) => (
              <Lightbox.Item key={img.id} index={i} caption={img.caption} className={stackedItemClass}>
                {({ imageRef }) => (
                  <img
                    ref={imageRef}
                    src={img.full}
                    alt={img.alt}
                    loading="eager"
                    // Sized purely by the image's own pixels, capped to the
                    // viewport. `imageRef` marks it as the morph destination and
                    // the placeholder paint target.
                    className="max-h-[85vh] max-w-[92vw] rounded-lg object-contain"
                  />
                )}
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
