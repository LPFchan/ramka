'use client';

import { imgDims } from '../../_components/lightbox-chrome';
import { Lightbox, type LightboxItem } from './lightbox';

/** Demo seed data — dims are explicit (package Gallery requires them). */
const trip: LightboxItem[] = [
  {
    src: 'https://picsum.photos/seed/preset-trip-a/1200/1200',
    thumb: 'https://picsum.photos/seed/preset-trip-a/400/400',
    alt: 'Maya on the ridge',
    caption: 'Maya Chen',
    width: 1200,
    height: 1200,
  },
  {
    src: 'https://picsum.photos/seed/preset-trip-b/1600/1000',
    thumb: 'https://picsum.photos/seed/preset-trip-b/800/500',
    alt: 'Cliffside road at sunset',
    caption: 'Cliffside road at sunset',
    width: 1600,
    height: 1000,
  },
  {
    src: 'https://picsum.photos/seed/preset-trip-c/1600/1000',
    thumb: 'https://picsum.photos/seed/preset-trip-c/800/500',
    alt: 'Turquoise cove',
    caption: 'A turquoise cove',
    width: 1600,
    height: 1000,
  },
  {
    src: 'https://picsum.photos/seed/preset-trip-d/1200/1500',
    thumb: 'https://picsum.photos/seed/preset-trip-d/480/600',
    alt: 'Trail through pines',
    caption: 'Through the pines',
    width: 1200,
    height: 1500,
  },
  {
    src: 'https://picsum.photos/seed/preset-trip-e/1600/1000',
    thumb: 'https://picsum.photos/seed/preset-trip-e/800/500',
    alt: 'Camp under the stars',
    caption: 'Camp under the stars',
    width: 1600,
    height: 1000,
  },
  {
    src: 'https://picsum.photos/seed/preset-trip-f/1200/1200',
    thumb: 'https://picsum.photos/seed/preset-trip-f/600/600',
    alt: 'Morning coffee on the rocks',
    caption: 'Morning on the rocks',
    width: 1200,
    height: 1200,
  },
];

/**
 * App-level demos only — not part of the copy-paste package.
 * Import the styled Lightbox from `./lightbox`, then compose triggers like this.
 *
 * 1. User card → portrait (`crossfade="both"` — whole card morphs)
 * 2. Listing card (`morphRef` on the photo — title/price stay put)
 * 3. Album grid with +N (`crossfade="both"` + `morphTo="closest"`)
 */
export function DefaultPresetDemo() {
  return (
    <div className="flex w-full max-w-md flex-col gap-8">
      <UserCardMorph />
      <ListingCardMorph />
      <AlbumPlusNMorph />
    </div>
  );
}

/** User card — the whole card is the morph origin and crossfades into the photo. */
function UserCardMorph() {
  const portrait = trip[0]!;

  return (
    <Lightbox.Root>
      <p className="mb-2 text-xs font-medium tracking-wide text-neutral-500 uppercase">
        User card → image
      </p>
      <Lightbox.Trigger
        index={0}
        crossfade="both"
        className="flex w-44 flex-col items-center gap-3 rounded-2xl border border-neutral-300 bg-white p-4 text-center shadow-[0_1px_2px_rgb(0_0_0/0.06),0_4px_12px_rgb(0_0_0/0.06)] dark:border-neutral-600 dark:bg-neutral-800 dark:shadow-[0_1px_2px_rgb(0_0_0/0.4),0_4px_16px_rgb(0_0_0/0.35)]"
      >
        <img
          {...imgDims(portrait.thumb)}
          src={portrait.thumb}
          alt=""
          className="size-16 rounded-full object-cover"
        />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            Maya Chen
          </span>
          <span className="block text-xs text-neutral-500">@mayachen</span>
          <span className="mt-1 block text-xs text-neutral-600 dark:text-neutral-400">
            Photographer
          </span>
        </span>
      </Lightbox.Trigger>
      <Lightbox.Gallery items={[portrait]} ariaLabel="Maya Chen portrait" />
    </Lightbox.Root>
  );
}

/**
 * Listing card — the whole card is the Trigger, but only the photo morphs
 * (`morphRef` + `imageRef` on the media). Title / price / meta stay visible
 * because `data-morph-target` lands on the image, not the button.
 */
function ListingCardMorph() {
  const listing = trip[1]!;

  return (
    <Lightbox.Root>
      <p className="mb-2 text-xs font-medium tracking-wide text-neutral-500 uppercase">
        Listing card · child morph
      </p>
      <Lightbox.Trigger
        index={0}
        className="w-full overflow-hidden rounded-2xl border border-neutral-300 bg-white text-left shadow-[0_1px_2px_rgb(0_0_0/0.06),0_4px_12px_rgb(0_0_0/0.06)] dark:border-neutral-600 dark:bg-neutral-800 dark:shadow-[0_1px_2px_rgb(0_0_0/0.4),0_4px_16px_rgb(0_0_0/0.35)]"
      >
        {({ imageRef, morphRef }) => (
          <>
            <img
              ref={(node) => {
                imageRef(node);
                morphRef(node);
              }}
              {...imgDims(listing.thumb)}
              src={listing.thumb}
              alt={listing.alt}
              className="aspect-[16/10] w-full rounded-t-2xl object-cover"
            />
            <span className="block space-y-0.5 p-3">
              <span className="block text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                Cliffside cottage
              </span>
              <span className="block text-xs text-neutral-500">Big Sur, CA · Sleeps 4</span>
              <span className="block text-sm font-medium text-neutral-800 dark:text-neutral-200">
                $420 <span className="font-normal text-neutral-500">night</span>
              </span>
            </span>
          </>
        )}
      </Lightbox.Trigger>
      <Lightbox.Gallery
        items={[
          {
            ...listing,
            caption: 'Cliffside cottage · Big Sur',
          },
        ]}
        ariaLabel="Cliffside cottage"
      />
    </Lightbox.Root>
  );
}

/** Outer corners for a 2×2 grid — must live on the Trigger (morph reads its radius). */
function tileCornerClass(index: number) {
  return [
    'rounded-tl-xl rounded-tr-none rounded-br-none rounded-bl-none',
    'rounded-tl-none rounded-tr-xl rounded-br-none rounded-bl-none',
    'rounded-tl-none rounded-tr-none rounded-br-none rounded-bl-xl',
    'rounded-tl-none rounded-tr-none rounded-br-xl rounded-bl-none',
  ][index]!;
}

/**
 * Facebook-style 2×2 grid; extras collapse behind +N.
 * Overlay tile uses crossfade both ways; close from overflow slides uses closest trigger.
 * Corner radius is on each Trigger (not the parent) so the VT morph can animate it.
 */
function AlbumPlusNMorph() {
  const extra = trip.length - 4;

  return (
    <Lightbox.Root morphTo="closest">
      <p className="mb-2 text-xs font-medium tracking-wide text-neutral-500 uppercase">
        +N tile · crossfade
      </p>
      <div className="grid aspect-[3/2] w-full grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-xl">
        {trip.slice(0, 4).map((img, i) => {
          const showOverlay = i === 3 && extra > 0;
          return (
            <Lightbox.Trigger
              key={img.src}
              index={i}
              crossfade={showOverlay ? 'both' : undefined}
              className={`relative block min-h-0 min-w-0 overflow-hidden border-0 bg-transparent p-0 ${tileCornerClass(i)}`}
            >
              {({ imageRef }) => (
                <>
                  <img
                    ref={imageRef}
                    {...imgDims(img.thumb)}
                    src={img.thumb}
                    alt={img.alt}
                    className="absolute inset-0 size-full object-cover"
                  />
                  {showOverlay ? (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50">
                      <span className="text-2xl font-bold text-white">+{extra}</span>
                    </span>
                  ) : null}
                </>
              )}
            </Lightbox.Trigger>
          );
        })}
      </div>
      <Lightbox.Gallery items={trip} ariaLabel="Trip photos" />
    </Lightbox.Root>
  );
}
