'use client';

import { imgDims } from '../../../_components/lightbox-chrome';
import { Lightbox as CssLightbox, type LightboxItem } from './css/lightbox';
import { Lightbox as TailwindLightbox } from './tailwind/lightbox';

/**
 * Both skin variants export the same component API, so this demo renders
 * either one — the docs page toggles between them. In your app, import ONE
 * variant (`./css/lightbox` or `./tailwind/lightbox`) directly.
 */
const lightboxVariants = { css: CssLightbox, tailwind: TailwindLightbox };

export type PresetVariant = keyof typeof lightboxVariants;

type StyledLightbox = (typeof lightboxVariants)[PresetVariant];

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
  {
    src: 'https://picsum.photos/seed/preset-trip-g/1600/1000',
    thumb: 'https://picsum.photos/seed/preset-trip-g/800/500',
    alt: 'Waterfall in the canyon',
    caption: 'Hidden waterfall',
    width: 1600,
    height: 1000,
  },
  {
    src: 'https://picsum.photos/seed/preset-trip-h/1200/1500',
    thumb: 'https://picsum.photos/seed/preset-trip-h/480/600',
    alt: 'Wildflowers on the hillside',
    caption: 'Wildflower meadow',
    width: 1200,
    height: 1500,
  },
  {
    src: 'https://picsum.photos/seed/preset-trip-i/1600/1000',
    thumb: 'https://picsum.photos/seed/preset-trip-i/800/500',
    alt: 'Kayaks on calm water',
    caption: 'Kayak at dawn',
    width: 1600,
    height: 1000,
  },
  {
    src: 'https://picsum.photos/seed/preset-trip-j/1200/1200',
    thumb: 'https://picsum.photos/seed/preset-trip-j/600/600',
    alt: 'Sunset over the lake',
    caption: 'Golden hour',
    width: 1200,
    height: 1200,
  },
  {
    src: 'https://picsum.photos/seed/preset-trip-k/1600/1000',
    thumb: 'https://picsum.photos/seed/preset-trip-k/800/500',
    alt: 'Boardwalk through the marsh',
    caption: 'Coastal marsh',
    width: 1600,
    height: 1000,
  },
  {
    src: 'https://picsum.photos/seed/preset-trip-l/1200/1500',
    thumb: 'https://picsum.photos/seed/preset-trip-l/480/600',
    alt: 'Fire lookout tower',
    caption: 'Summit lookout',
    width: 1200,
    height: 1500,
  },
];

/**
 * App-level demos only — not part of the copy-paste package.
 * Import the styled Lightbox from `./lightbox`, then compose triggers like this.
 *
 * 1. +N overlay tile with `crossfade` + `morphTo="closest"`
 * 2. Child morph via `morphRef` (chrome stays put)
 * 3. Whole-trigger morph + crossfade (card → photo)
 */
export function DefaultPresetDemo({ variant = 'css' }: { variant?: PresetVariant }) {
  const Lightbox = lightboxVariants[variant];

  return (
    <div className="flex w-full max-w-md flex-col gap-8">
      <AlbumPlusNMorph Lightbox={Lightbox} />
      <ListingCardMorph Lightbox={Lightbox} />
      <UserCardMorph Lightbox={Lightbox} />
    </div>
  );
}

/** Whole trigger morphs (default); `crossfade="both"` dissolves card ↔ photo. */
function UserCardMorph({ Lightbox }: { Lightbox: StyledLightbox }) {
  const portrait = trip[0]!;

  return (
    // `awaitImageDecode={false}` throughout: every thumb is the same photo at
    // lower res (same seed + aspect), so the placeholder bridge is seamless
    // and the morph can start immediately instead of waiting on decode.
    <Lightbox.Root awaitImageDecode={false}>
      <p className="mb-2 text-xs font-medium tracking-wide text-neutral-500 uppercase">
        Whole trigger morph
      </p>
      <Lightbox.Trigger
        index={0}
        crossfade="both"
        className="flex w-44 flex-col items-center gap-3 rounded-2xl border border-neutral-300 bg-white p-4 text-center shadow-[0_1px_2px_rgb(0_0_0/0.06),0_4px_12px_rgb(0_0_0/0.06)] dark:border-neutral-600 dark:bg-neutral-800 dark:shadow-[0_1px_2px_rgb(0_0_0/0.4),0_4px_16px_rgb(0_0_0/0.35)]"
      >
        {({ imageRef }) => (
          <>
            <img
              ref={imageRef}
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
          </>
        )}
      </Lightbox.Trigger>
      <Lightbox.Gallery items={[portrait]} ariaLabel="Maya Chen portrait" />
    </Lightbox.Root>
  );
}

/**
 * Trigger wraps the card; `morphRef` (+ `imageRef`) on the photo so only that
 * child morphs — title / price stay put (`data-morph-target` on the image).
 */
function ListingCardMorph({ Lightbox }: { Lightbox: StyledLightbox }) {
  const listing = trip[1]!;

  return (
    <Lightbox.Root awaitImageDecode={false}>
      <p className="mb-2 text-xs font-medium tracking-wide text-neutral-500 uppercase">
        Child morph via morphRef
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
 * 2×2 grid; extras behind +N. Overlay trigger uses `crossfade="both"`;
 * `morphTo="closest"` on close from overflow slides. Corner radius lives on
 * each Trigger so the VT morph can animate it.
 */
function AlbumPlusNMorph({ Lightbox }: { Lightbox: StyledLightbox }) {
  const extra = trip.length - 4;

  return (
    <Lightbox.Root morphTo="closest" awaitImageDecode={false}>
      <p className="mb-2 text-xs font-medium tracking-wide text-neutral-500 uppercase">
        +N overlay with crossfade
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
