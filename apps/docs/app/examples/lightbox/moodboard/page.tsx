'use client';

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
const FULL_SCALE = 4;

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

export default function MoodboardPage() {
  return (
    <ExampleShell
      title="Moodboard"
      description="A masonry wall of images with unknown dimensions — no width/height attributes and no reserved aspect ratio, so each tile is sized only once its pixels load. Each tile fetches a small thumbnail while the lightbox loads a 4× larger version of the same photo, so opening one paints the cached thumbnail as a placeholder while the big image downloads. This stresses the morph's size-resolution fallback (an un-sized box crossfades instead of shrinking to a corner) and the trigger-thumbnail placeholder that bridges the blank frame."
    >
      <Lightbox.Root viewTransition awaitImageDecode={360}>
        {/* CSS columns masonry: tiles keep their natural aspect once loaded and
            flow into whichever column is shortest. `break-inside-avoid` keeps a
            tile from splitting across columns. */}
        <div className="mx-auto max-w-2xl columns-2 gap-4 sm:columns-3 *:mb-4">
          {images.map((img, i) => (
            <Lightbox.Trigger
              key={img.id}
              index={i}
              className="block w-full break-inside-avoid cursor-pointer overflow-hidden rounded-xl border-none bg-transparent p-0"
            >
              {({ triggerImageRef }) => (
                <img
                  ref={triggerImageRef}
                  src={img.thumb}
                  alt={img.alt}
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
