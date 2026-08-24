# Default

Pick a styling flavor with the toggle: **Tailwind** is a single `lightbox.tsx` (utilities only, no stylesheet), **CSS** pairs `lightbox.tsx` with `lightbox.css`. Both export the identical styled `Lightbox` namespace — drop the **Package** files into a design-system entry, then compose triggers in your app. Gallery includes a top-right **Bleed / Snug** toggle (desktop) to switch between full-width and aspect-sized slide tracks. The **Example** tab shows the live preview (`+N` crossfade, child `morphRef`, whole-trigger morph) — it is app UI, not part of the skin.

## Source

```tsx presets/default/demo.tsx
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
```

```tsx presets/default/tailwind/lightbox.tsx
'use client';

/**
 * Default lightbox, Tailwind variant — single-file design-system package
 * entry (no CSS file to copy). A plain-CSS variant with the identical
 * component API lives in `../css/lightbox.tsx`.
 *
 * Re-exports ramka Lightbox primitives with this skin attached, plus composed
 * `Lightbox.Gallery` (bleed or snug slides, glass controls, desktop thumbnail strip).
 *
 * Conventions:
 * - Requires Tailwind CSS v4 (`starting:`, `not-*`, bare `data-*` variants)
 *   plus the shadcn `cn` helper and `lucide-react`.
 * - Variables named `--lightbox-*` are written by the ramka runtime (gesture
 *   progress, motion timing) — this file only reads them. Variables named
 *   `--lb-*` are this skin's own tokens, declared via arbitrary properties.
 * - Gesture-driven state rides on data attributes ramka sets on Content
 *   (`data-open`, `data-pulling`, `data-pull-dismissing`, `data-zoomed`),
 *   consumed here through the named `group/lb` on Content. All
 *   view-transition CSS (morph group, snapshots, crossfade) is injected by
 *   the library; the skin ships none of it.
 *
 * Package boundary: only the styled primitives + Gallery. Trigger layouts,
 * album grids, user cards, and other app UI belong in the consuming app
 * (docs: `demo.tsx`) — not in this module.
 */

import * as React from 'react';
import {
  GalleryHorizontalIcon,
  RectangleHorizontalIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from 'lucide-react';
import * as RamkaLightbox from '@ramka/react/lightbox';

import { cn } from '@/lib/utils';

/** Item shape for `Lightbox.Gallery` — pass real intrinsic pixel size. */
export type LightboxItem = {
  id?: string | number;
  src: string;
  thumb: string;
  alt: string;
  caption?: string;
  width: number;
  height: number;
};

export type SlidesLayout = 'bleed' | 'snug';

/**
 * The snug/bleed choice is a user preference, so it survives across galleries
 * and visits. Guarded reads/writes: localStorage throws in some private modes,
 * and `window` doesn't exist during SSR (the portal renders nothing while
 * closed, so the pre-hydration value is never visible anyway).
 */
const SLIDES_LAYOUT_STORAGE_KEY = 'ramka-lightbox-slides-layout';

function readStoredSlidesLayout(): SlidesLayout | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(SLIDES_LAYOUT_STORAGE_KEY);
    return value === 'snug' || value === 'bleed' ? value : null;
  } catch {
    return null;
  }
}

function storeSlidesLayout(layout: SlidesLayout) {
  try {
    window.localStorage.setItem(SLIDES_LAYOUT_STORAGE_KEY, layout);
  } catch {
    // Storage unavailable — the toggle still works for this session.
  }
}

function itemAspectRatio(item: LightboxItem): number {
  return item.width / item.height;
}

/* ── Shared class recipes ───────────────────────────────────────────────── */

/**
 * Glass control pill (iOS-style liquid glass). The focus ring rides on
 * box-shadow (the pill clips outlines poorly), so focus-visible restates the
 * resting shadows plus the ring. Hover/press tint is a background-image
 * overlay so one recipe serves both the standalone pills (which have a
 * background-color) and the transparent segments inside a control group.
 * Note `scale` in the transition list: Tailwind v4 scale utilities write the
 * `scale` property, not `transform`.
 */
const controlClass = cn(
  'inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full',
  'border border-black/20 bg-white/55 text-neutral-900',
  'shadow-[0_0.5px_1px_rgb(0_0_0/0.12),0_1px_2px_rgb(0_0_0/0.08),inset_0_0.5px_0_rgb(255_255_255/0.65)]',
  'backdrop-blur-[40px] backdrop-saturate-150',
  'transition-[background-color,box-shadow,transform,scale,opacity,color] duration-150 ease-out',
  'outline-none',
  'hover:[background-image:linear-gradient(rgb(0_0_0/0.05),rgb(0_0_0/0.05))]',
  'active:scale-[0.96] active:[background-image:linear-gradient(rgb(0_0_0/0.09),rgb(0_0_0/0.09))]',
  'focus-visible:shadow-[0_0_0_2px_rgb(0_0_0/0.25),0_0.5px_1px_rgb(0_0_0/0.12),0_1px_2px_rgb(0_0_0/0.08),inset_0_0.5px_0_rgb(255_255_255/0.65)]',
  'disabled:pointer-events-none disabled:opacity-30',
  '[&_svg]:block [&_svg]:size-4',
  'dark:border-white/25 dark:bg-neutral-900/45 dark:text-white',
  'dark:shadow-[0_0_0_0.5px_#000,0_0.5px_1px_rgb(0_0_0/0.45),0_1px_2px_rgb(0_0_0/0.35),inset_0_0.5px_0_rgb(255_255_255/0.14)]',
  'dark:hover:[background-image:linear-gradient(rgb(255_255_255/0.08),rgb(255_255_255/0.08))]',
  'dark:active:[background-image:linear-gradient(rgb(255_255_255/0.12),rgb(255_255_255/0.12))]',
  'dark:focus-visible:shadow-[0_0_0_2px_rgb(255_255_255/0.4),0_0_0_0.5px_#000,0_0.5px_1px_rgb(0_0_0/0.45),0_1px_2px_rgb(0_0_0/0.35),inset_0_0.5px_0_rgb(255_255_255/0.14)]',
);

/**
 * Joined capsule — one glass pill holding several segments (zoom −/+) with a
 * hairline divider, like iOS grouped controls. The pill owns the glass
 * chrome; segments (see `controlSegmentClass`) become flat, full-height hit
 * areas.
 */
const controlGroupClass = cn(
  'inline-flex items-stretch overflow-hidden rounded-full',
  'border border-black/20 bg-white/55',
  'shadow-[0_0.5px_1px_rgb(0_0_0/0.12),0_1px_2px_rgb(0_0_0/0.08),inset_0_0.5px_0_rgb(255_255_255/0.65)]',
  'backdrop-blur-[40px] backdrop-saturate-150',
  'dark:border-white/25 dark:bg-neutral-900/45',
  'dark:shadow-[0_0_0_0.5px_#000,0_0.5px_1px_rgb(0_0_0/0.45),0_1px_2px_rgb(0_0_0/0.35),inset_0_0.5px_0_rgb(255_255_255/0.14)]',
);

/**
 * Segment inside `controlGroupClass`: sheds its own glass chrome (the pill
 * owns it), doesn't shrink on press (the pill is one rigid control), and uses
 * an inset focus ring (the pill clips outset rings). Each segment is as wide
 * as the pill is tall → a two-segment capsule is exactly 2:1.
 */
const controlSegmentClass = cn(
  'relative h-auto w-9 rounded-none border-0 bg-transparent shadow-none',
  'backdrop-blur-none backdrop-saturate-100',
  'active:scale-100',
  'focus-visible:shadow-[inset_0_0_0_2px_rgb(0_0_0/0.25)]',
  'dark:bg-transparent dark:shadow-none',
  'dark:focus-visible:shadow-[inset_0_0_0_2px_rgb(255_255_255/0.4)]',
);

/** Hairline divider on the leading edge of a follow-up capsule segment. */
const controlSegmentDividerClass =
  'before:absolute before:inset-y-[22%] before:left-0 before:w-px before:bg-black/15 dark:before:bg-white/20';

/**
 * Chrome that gets out of the way during gestures. `visibility` (not just
 * opacity/pointer-events) keeps hidden controls out of the tab order; its 0s
 * flip is delayed to the end of the fade-out, instant on fade-in. Pull-to-
 * dismiss (and the dismiss animation) hides all gesture chrome; `starting:`
 * fades it in on open.
 */
const chromeGestureHideClass = cn(
  'visible opacity-100 [transition:opacity_200ms,visibility_0s_linear_0s] starting:opacity-0',
  'group-data-pulling/lb:invisible group-data-pulling/lb:opacity-0',
  'group-data-pulling/lb:[transition:opacity_200ms,visibility_0s_linear_200ms]',
  'group-data-pull-dismissing/lb:invisible group-data-pull-dismissing/lb:opacity-0',
  'group-data-pull-dismissing/lb:[transition:opacity_200ms,visibility_0s_linear_200ms]',
);

/* ── Styled primitives (design-system re-exports) ───────────────────────── */

function Root(props: React.ComponentProps<typeof RamkaLightbox.Root>) {
  return <RamkaLightbox.Root {...props} />;
}

function Trigger({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Trigger>) {
  return (
    <RamkaLightbox.Trigger
      data-slot="lightbox-trigger"
      className={cn(
        'cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
        className,
      )}
      {...props}
    />
  );
}

function Portal({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Portal>) {
  return (
    <RamkaLightbox.Portal
      data-slot="lightbox-portal"
      className={cn('[--lb-ease-out-expo:cubic-bezier(0.16,1,0.3,1)]', className)}
      {...props}
    />
  );
}

function Backdrop({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Backdrop>) {
  return (
    <RamkaLightbox.Backdrop
      data-slot="lightbox-backdrop"
      className={cn(
        // Solid — the page underneath is fully covered while open.
        'fixed inset-0 bg-white opacity-0 dark:bg-black',
        // Duration cascade: `--lightbox-pull-snap-*` exist only while a
        // cancelled pull-to-dismiss springs back (so the refade matches the
        // item's spring); otherwise `--lightbox-vt-duration` — the Root's
        // `viewTransition` preset timing, which the library always sets on
        // the Portal host. The 360ms literal is just a safety net.
        'transition-opacity',
        'duration-[var(--lightbox-pull-snap-duration,var(--lightbox-vt-duration,360ms))]',
        'ease-[var(--lightbox-pull-snap-easing,var(--lb-ease-out-expo))]',
        // `--lightbox-pull-progress` is 0 → 1 while pull-to-dismiss drags;
        // `starting:` fades from 0 on the first frame after [data-open].
        'data-open:opacity-[calc(1_-_var(--lightbox-pull-progress,0)*0.6)]',
        'data-open:starting:opacity-0',
        'data-pulling:transition-none', // follow the finger
        className,
      )}
      {...props}
    />
  );
}

function Content({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Content>) {
  return (
    <RamkaLightbox.Content
      data-slot="lightbox-content"
      className={cn(
        // `group/lb` publishes ramka's state attributes (data-pulling,
        // data-pull-dismissing, data-zoomed) to all chrome below.
        'group/lb fixed inset-0 flex flex-col overscroll-contain opacity-0 outline-none',
        // Same preset clock as the backdrop and the morph.
        'transition-opacity duration-[var(--lightbox-vt-duration,360ms)] ease-(--lb-ease-out-expo)',
        'data-open:opacity-100 data-open:starting:opacity-0',
        // Letterbox insets around the media (read by Slide padding and the
        // snug width formula). Mobile: equal top/bottom so the media is
        // vertically centered — 4rem clears the close-button row above and
        // the caption + counter below. Desktop: roomier, and the bottom adds
        // the thumbnail-strip row + one-line caption bar.
        '[--lb-inset-top:calc(4rem_+_env(safe-area-inset-top,0px))]',
        '[--lb-inset-bottom:calc(4rem_+_env(safe-area-inset-bottom,0px))]',
        '[--lb-inset-inline:0px]',
        'md:[--lb-inset-top:calc(4.5rem_+_env(safe-area-inset-top,0px))]',
        'md:[--lb-inset-bottom:calc(7.5rem_+_env(safe-area-inset-bottom,0px))]',
        'md:[--lb-inset-inline:3rem]',
        className,
      )}
      {...props}
    />
  );
}

function Close({ className, children, ...props }: React.ComponentProps<typeof RamkaLightbox.Close>) {
  return (
    <RamkaLightbox.Close
      data-slot="lightbox-close"
      // The ✕ glyph is optically lighter than the zoom glyphs — render larger.
      className={cn(controlClass, '[&_svg]:size-4.5', className)}
      aria-label="Close"
      {...props}
    >
      {children ?? <XIcon strokeWidth={2.25} />}
    </RamkaLightbox.Close>
  );
}

function Slides({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Slides>) {
  return (
    <RamkaLightbox.Slides
      data-slot="lightbox-slides"
      className={cn(
        'flex-1 gap-5 md:gap-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
      {...props}
    />
  );
}

function Slide({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Slide>) {
  return (
    <RamkaLightbox.Slide
      data-slot="lightbox-slide"
      className={cn(
        'h-full min-w-full flex-[0_0_100%] px-(--lb-inset-inline) pt-(--lb-inset-top) pb-(--lb-inset-bottom)',
        className,
      )}
      {...props}
    />
  );
}

function Item({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Item>) {
  return <RamkaLightbox.Item data-slot="lightbox-item" className={className} {...props} />;
}

function Media({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Media>) {
  return (
    <RamkaLightbox.Media
      data-slot="lightbox-media"
      className={cn('overflow-hidden md:rounded-lg [&_img]:select-none', className)}
      {...props}
    />
  );
}

function Zoom(props: React.ComponentProps<typeof RamkaLightbox.Zoom>) {
  return <RamkaLightbox.Zoom {...props} />;
}

function ZoomIn({ className, children, ...props }: React.ComponentProps<typeof RamkaLightbox.ZoomIn>) {
  return (
    <RamkaLightbox.ZoomIn
      data-slot="lightbox-zoom-in"
      className={cn(controlClass, 'max-md:hidden', className)}
      aria-label="Zoom in"
      {...props}
    >
      {children ?? <ZoomInIcon strokeWidth={2.25} />}
    </RamkaLightbox.ZoomIn>
  );
}

function ZoomOut({ className, children, ...props }: React.ComponentProps<typeof RamkaLightbox.ZoomOut>) {
  return (
    <RamkaLightbox.ZoomOut
      data-slot="lightbox-zoom-out"
      className={cn(controlClass, 'max-md:hidden', className)}
      aria-label="Zoom out"
      {...props}
    >
      {children ?? <ZoomOutIcon strokeWidth={2.25} />}
    </RamkaLightbox.ZoomOut>
  );
}

function Counter({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Counter>) {
  return (
    <RamkaLightbox.Counter
      data-slot="lightbox-counter"
      // md+: the thumbnail strip shows position, so the counter collapses to
      // sr-only and keeps only its aria-live announcement role.
      className={cn(
        'text-[0.6875rem] leading-[1.25] text-neutral-500 tabular-nums md:sr-only dark:text-neutral-400',
        className,
      )}
      {...props}
    />
  );
}

function Caption({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Caption>) {
  return (
    <RamkaLightbox.Caption
      data-slot="lightbox-caption"
      className={cn(
        'pointer-events-auto block max-w-full truncate text-[0.8125rem] leading-[1.25] font-medium text-neutral-900 select-text dark:text-neutral-50',
        className,
      )}
      {...props}
    />
  );
}

function ThumbnailStrip({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.ThumbnailStrip>) {
  return (
    <RamkaLightbox.ThumbnailStrip
      data-slot="lightbox-thumbnail-strip"
      className={cn(
        '[--lb-thumb-size:3.5rem] [--lb-strip-fade:32px]',
        // Soft edge fade over the scrolling thumbs (eased ramp, not linear).
        '[--lb-strip-mask:linear-gradient(to_right,rgb(0_0_0/0)_0,rgb(0_0_0/0.156)_calc(var(--lb-strip-fade)*0.25),rgb(0_0_0/0.5)_calc(var(--lb-strip-fade)*0.5),rgb(0_0_0/0.844)_calc(var(--lb-strip-fade)*0.75),#000_var(--lb-strip-fade),#000_calc(100%_-_var(--lb-strip-fade)),rgb(0_0_0/0.844)_calc(100%_-_var(--lb-strip-fade)*0.75),rgb(0_0_0/0.5)_calc(100%_-_var(--lb-strip-fade)*0.5),rgb(0_0_0/0.156)_calc(100%_-_var(--lb-strip-fade)*0.25),rgb(0_0_0/0)_100%)]',
        // pointer-events-auto counteracts the bottom band's click-through.
        'pointer-events-auto w-full min-w-0 self-stretch py-1',
        '[-webkit-mask-image:var(--lb-strip-mask)] [mask-image:var(--lb-strip-mask)]',
        className,
      )}
      {...props}
    />
  );
}

function ThumbnailStripTrack({
  className,
  ...props
}: React.ComponentProps<typeof RamkaLightbox.ThumbnailStripTrack>) {
  return (
    <RamkaLightbox.ThumbnailStripTrack
      data-slot="lightbox-thumbnail-strip-track"
      className={cn('flex w-max items-center gap-2', className)}
      {...props}
    />
  );
}

function Thumbnail({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Thumbnail>) {
  return (
    <RamkaLightbox.Thumbnail
      data-slot="lightbox-thumbnail"
      className={cn(
        'relative block size-(--lb-thumb-size) shrink-0 cursor-pointer overflow-hidden rounded-md',
        '[&_img]:block [&_img]:size-full [&_img]:object-cover',
        className,
      )}
      {...props}
    />
  );
}

function Previous(props: React.ComponentProps<typeof RamkaLightbox.Previous>) {
  return <RamkaLightbox.Previous {...props} />;
}

function Next(props: React.ComponentProps<typeof RamkaLightbox.Next>) {
  return <RamkaLightbox.Next {...props} />;
}

function ThumbnailGroup(props: React.ComponentProps<typeof RamkaLightbox.ThumbnailGroup>) {
  return <RamkaLightbox.ThumbnailGroup {...props} />;
}

/* ── Snug layout (aspect-sized cards + peeking neighbors) ───────────────── */

/*
 * Card width = the largest size that fits the letterbox at the item's aspect
 * ratio: min(scrollport width minus gutters, letterbox height × ratio). The
 * `--lb-snug-ratio*` values are per-item aspect ratios set inline by the
 * Gallery; cqw/cqh resolve against the Slides scrollport (the library makes
 * it a size container). -start/-end are the first/last item's ratios, needed
 * by the ::before/::after spacers so the first/last card can center in the
 * scrollport under scroll-snap.
 */
const snugSlidesClass = cn(
  '[--lb-snug-gap:1.25rem] gap-(--lb-snug-gap) md:gap-(--lb-snug-gap)',
  '[--lb-snug-width-start:min(calc(100cqw_-_2*var(--lb-inset-inline)),calc((100cqh_-_var(--lb-inset-top)_-_var(--lb-inset-bottom))*var(--lb-snug-ratio-start,1)))]',
  '[--lb-snug-width-end:min(calc(100cqw_-_2*var(--lb-inset-inline)),calc((100cqh_-_var(--lb-inset-top)_-_var(--lb-inset-bottom))*var(--lb-snug-ratio-end,1)))]',
  'md:before:pointer-events-none md:before:flex-[0_0_calc((100cqw_-_var(--lb-snug-width-start))/2_-_var(--lb-snug-gap))]',
  'md:after:pointer-events-none md:after:flex-[0_0_calc((100cqw_-_var(--lb-snug-width-end))/2_-_var(--lb-snug-gap))]',
);

const snugSlideClass = cn(
  // No horizontal padding on the card itself — the gutter lives in the width
  // formula only, so neighbors can peek right up to the card edge. z-0 is the
  // stacking baseline for the zoomed-card promotion below.
  'z-0 px-0',
  '[--lb-snug-width:min(calc(100cqw_-_2*var(--lb-inset-inline)),calc((100cqh_-_var(--lb-inset-top)_-_var(--lb-inset-bottom))*var(--lb-snug-ratio)))]',
  'md:w-(--lb-snug-width) md:min-w-0 md:flex-[0_0_auto]',
  // The zoomed active card paints above the peeking neighbors.
  'group-data-zoomed/lb:has-data-active:z-[1]',
);

/*
 * Neighbor cards dim as the active item is pulled to dismiss
 * (`--lightbox-pull-progress`) or zoomed (`--lightbox-zoom-progress`) — both
 * library-written, 0 → 1. `filter` tracks the gesture 1:1 (transitioning it
 * would lag the finger); `opacity` transitions so the pull snap-back resolves
 * on the same spring as the item.
 */
const snugItemClass = cn(
  'transition-opacity',
  'duration-[var(--lightbox-pull-snap-duration,500ms)]',
  'ease-[var(--lightbox-pull-snap-easing,var(--lb-ease-out-expo))]',
  'not-data-active:[--lb-neighbor-dim:max(var(--lightbox-pull-progress,0),var(--lightbox-zoom-progress,0))]',
  'not-data-active:opacity-[calc(1_-_var(--lightbox-pull-progress,0)*0.85)]',
  'not-data-active:[filter:opacity(calc(1_-_var(--lb-neighbor-dim)))_blur(calc(var(--lb-neighbor-dim)*6px))]',
  'group-data-pulling/lb:transition-none', // follow the finger
);

/* ── Composed Gallery (product chrome) ──────────────────────────────────── */

function GalleryThumbnailStrip({ items }: { items: LightboxItem[] }) {
  if (items.length <= 1) return null;

  return (
    // The strip is desktop-only; mobile shows the counter instead.
    <ThumbnailStrip className="max-md:hidden">
      <ThumbnailStripTrack aria-label="Photo thumbnails">
        {items.map((item, i) => (
          <Thumbnail key={item.id ?? i} index={i}>
            <img src={item.thumb} alt={item.alt} draggable={false} />
          </Thumbnail>
        ))}
      </ThumbnailStripTrack>
      {/* Decorative ring over the active tab — the track scrolls under it. */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 size-[calc(var(--lb-thumb-size)_+_8px)] -translate-x-1/2 -translate-y-1/2 rounded-[calc(0.375rem_+_2px)] border-2 border-black dark:border-white"
      />
    </ThumbnailStrip>
  );
}

/**
 * Default product chrome — Portal → Backdrop + Content → Slides/Zoom + glass
 * controls / caption + counter placard / desktop ThumbnailStrip. Supports bleed (full-width)
 * and snug (aspect-sized cards) via the top-right layout toggle or `slidesLayout`.
 */
function Gallery({
  items,
  ariaLabel,
  slidesLayout: slidesLayoutProp,
  onSlidesLayoutChange,
}: {
  items: LightboxItem[];
  ariaLabel: string;
  slidesLayout?: SlidesLayout;
  onSlidesLayoutChange?: (layout: SlidesLayout) => void;
}) {
  const [slidesLayoutInternal, setSlidesLayoutInternal] = React.useState<SlidesLayout>(
    () => readStoredSlidesLayout() ?? 'bleed',
  );
  const slidesLayout = slidesLayoutProp ?? slidesLayoutInternal;
  const snug = slidesLayout === 'snug';
  // Single item → no thumbnail strip → solo layout (tighter, centered bottom band).
  const solo = items.length <= 1;

  const setSlidesLayout = React.useCallback(
    (next: SlidesLayout) => {
      storeSlidesLayout(next);
      onSlidesLayoutChange?.(next);
      if (slidesLayoutProp === undefined) {
        setSlidesLayoutInternal(next);
      }
    },
    [onSlidesLayoutChange, slidesLayoutProp],
  );

  const toggleSlidesLayout = React.useCallback(() => {
    setSlidesLayout(slidesLayout === 'snug' ? 'bleed' : 'snug');
  }, [setSlidesLayout, slidesLayout]);

  const snugEdgeRatios =
    snug && items.length > 0
      ? {
          start: itemAspectRatio(items[0]!),
          end: itemAspectRatio(items[items.length - 1]!),
        }
      : null;

  return (
    <Portal>
      <Backdrop />
      <Content
        aria-label={ariaLabel}
        className={cn(
          // Snug: the horizontal inset is a scrollport gutter consumed by the
          // card width formula — not per-slide padding.
          snug && 'md:[--lb-inset-inline:2rem]',
          // Solo (single item — no thumbnail strip): only the caption placard
          // sits below, so match the top inset and keep the letterbox symmetric.
          solo && 'md:[--lb-inset-bottom:calc(4.5rem_+_env(safe-area-inset-bottom,0px))]',
        )}
      >
        <Slides
          key={slidesLayout}
          aria-label="Full-size images"
          preload={2}
          className={snug ? snugSlidesClass : undefined}
          style={
            snugEdgeRatios
              ? ({
                  '--lb-snug-ratio-start': snugEdgeRatios.start,
                  '--lb-snug-ratio-end': snugEdgeRatios.end,
                } as React.CSSProperties)
              : undefined
          }
        >
          {items.map((item, i) => {
            const ratio = itemAspectRatio(item);
            return (
              <Slide
                key={item.id ?? i}
                className={snug ? snugSlideClass : undefined}
                style={snug ? ({ '--lb-snug-ratio': ratio } as React.CSSProperties) : undefined}
              >
                <Item index={i} caption={item.caption ?? item.alt} className={snug ? snugItemClass : undefined}>
                  <Zoom maxZoom={6}>
                    <Media width={item.width} height={item.height}>
                      <img
                        width={item.width}
                        height={item.height}
                        src={item.src}
                        alt={item.alt}
                        loading="eager"
                        draggable={false}
                      />
                    </Media>
                  </Zoom>
                </Item>
              </Slide>
            );
          })}
        </Slides>

        <div
          className={cn(
            'absolute top-[calc(0.75rem_+_env(safe-area-inset-top,0px))] right-3 z-[1] flex gap-2',
            chromeGestureHideClass,
            // On mobile, zoom also hides the top controls — the media fills the screen.
            'max-md:group-data-zoomed/lb:invisible max-md:group-data-zoomed/lb:opacity-0',
            'max-md:group-data-zoomed/lb:[transition:opacity_200ms,visibility_0s_linear_200ms]',
          )}
        >
          {/* Layout toggle: the icon is a miniature of the CURRENT layout —
              snug shows a card with neighbours, bleed one wide slide. */}
          <button
            type="button"
            className={cn(controlClass, 'max-md:hidden [&_svg]:size-4.5')}
            aria-pressed={snug}
            aria-label={snug ? 'Switch to full-bleed slides' : 'Switch to snug slides'}
            onClick={toggleSlidesLayout}
          >
            {snug ? (
              <GalleryHorizontalIcon strokeWidth={2.25} />
            ) : (
              <RectangleHorizontalIcon strokeWidth={2.25} />
            )}
          </button>
          {/* Zoom −/+ share one capsule with a hairline divider. */}
          <div className={cn(controlGroupClass, 'max-md:hidden')}>
            <ZoomOut className={controlSegmentClass} />
            <ZoomIn className={cn(controlSegmentClass, controlSegmentDividerClass)} />
          </div>
          <Close />
        </div>

        <div
          className={cn(
            // Click-through the inset band; caption opts back in for text selection.
            'pointer-events-none absolute inset-x-0 bottom-0 z-[1] flex flex-col items-center gap-3',
            'px-3 pb-[calc(1rem_+_env(safe-area-inset-bottom,0px))]',
            chromeGestureHideClass,
            // Zoom hides the bottom placard (the zoomed media pans under it).
            'group-data-zoomed/lb:invisible group-data-zoomed/lb:opacity-0',
            'group-data-zoomed/lb:[transition:opacity_200ms,visibility_0s_linear_200ms]',
            // Solo (no strip): center the placard in the bottom inset band
            // instead of pinning it to the viewport edge.
            solo && 'min-h-(--lb-inset-bottom) justify-center pb-[env(safe-area-inset-bottom,0px)]',
          )}
        >
          {/*
            Caption under the media, placard-style. The counter is visible on
            mobile where there's no strip to show position; on md+ the strip
            covers that, so the counter collapses to sr-only and keeps only
            its aria-live announcement role.
          */}
          <div className="flex max-w-full flex-col items-center text-center">
            <Caption />
            {/* "1 of 1" is noise — skip the counter for single-item galleries. */}
            {solo ? null : <Counter>{({ current, total }) => `${current} of ${total}`}</Counter>}
          </div>
          <GalleryThumbnailStrip items={items} />
        </div>
      </Content>
    </Portal>
  );
}

/**
 * Styled Lightbox namespace — drop-in replacement for `import * as Lightbox from '@ramka/react/lightbox'`
 * with this preset’s styles and composed Gallery.
 */
export const Lightbox = {
  Root,
  Trigger,
  Portal,
  Backdrop,
  Content,
  Close,
  Slides,
  Slide,
  Item,
  Media,
  Zoom,
  ZoomIn,
  ZoomOut,
  Counter,
  Caption,
  ThumbnailStrip,
  ThumbnailStripTrack,
  Thumbnail,
  ThumbnailGroup,
  Previous,
  Next,
  Gallery,
};
```

```tsx presets/default/css/lightbox.tsx
'use client';

/**
 * Default lightbox, plain-CSS variant — design-system package entry
 * (copy with lightbox.css). A Tailwind variant with the identical component
 * API lives in `../tailwind/lightbox.tsx`.
 *
 * Re-exports ramka Lightbox primitives with this skin attached, plus composed
 * `Lightbox.Gallery` (bleed or snug slides, glass controls, desktop thumbnail strip).
 *
 * Package boundary: only the styled primitives + Gallery. Trigger layouts,
 * album grids, user cards, and other app UI belong in the consuming app
 * (docs: `demo.tsx`) — not in this module.
 */

import * as React from 'react';
import * as RamkaLightbox from '@ramka/react/lightbox';

import './lightbox.css';

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

/* ── Icons (inline — no lucide dependency for copy-paste) ───────────────── */

function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconZoomIn() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3M11 8v6M8 11h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconZoomOut() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3M8 11h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Miniature of the snug layout — a centered card with the neighbouring
 * slides peeking in from the edges. */
function IconLayoutSnug() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden>
      <rect x="8.5" y="7" width="7" height="10" rx="1.5" />
      <path d="M4 9v6M20 9v6" strokeLinecap="round" />
    </svg>
  );
}

/** Miniature of the bleed layout — one slide, edge to edge. */
function IconLayoutBleed() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden>
      <rect x="4" y="7" width="16" height="10" rx="1.5" />
    </svg>
  );
}

/** Item shape for `Lightbox.Gallery` — pass real intrinsic pixel size. */
export type LightboxItem = {
  id?: string | number;
  src: string;
  thumb: string;
  alt: string;
  caption?: string;
  width: number;
  height: number;
};

export type SlidesLayout = 'bleed' | 'snug';

/**
 * The snug/bleed choice is a user preference, so it survives across galleries
 * and visits. Guarded reads/writes: localStorage throws in some private modes,
 * and `window` doesn't exist during SSR (the portal renders nothing while
 * closed, so the pre-hydration value is never visible anyway).
 */
const SLIDES_LAYOUT_STORAGE_KEY = 'ramka-lightbox-slides-layout';

function readStoredSlidesLayout(): SlidesLayout | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(SLIDES_LAYOUT_STORAGE_KEY);
    return value === 'snug' || value === 'bleed' ? value : null;
  } catch {
    return null;
  }
}

function storeSlidesLayout(layout: SlidesLayout) {
  try {
    window.localStorage.setItem(SLIDES_LAYOUT_STORAGE_KEY, layout);
  } catch {
    // Storage unavailable — the toggle still works for this session.
  }
}

function itemAspectRatio(item: LightboxItem): number {
  return item.width / item.height;
}

/* ── Styled primitives (design-system re-exports) ───────────────────────── */

function Root(props: React.ComponentProps<typeof RamkaLightbox.Root>) {
  return <RamkaLightbox.Root {...props} />;
}

function Trigger({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Trigger>) {
  return <RamkaLightbox.Trigger className={cx('lb-trigger', className)} {...props} />;
}

function Portal({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Portal>) {
  return <RamkaLightbox.Portal className={cx('lb-portal', className)} {...props} />;
}

function Backdrop({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Backdrop>) {
  return <RamkaLightbox.Backdrop className={cx('lb-backdrop', className)} {...props} />;
}

function Content({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Content>) {
  return <RamkaLightbox.Content className={cx('lb-content', className)} {...props} />;
}

function Close({ className, children, ...props }: React.ComponentProps<typeof RamkaLightbox.Close>) {
  return (
    <RamkaLightbox.Close className={cx('lb-control', className)} aria-label="Close" {...props}>
      {children ?? <IconX />}
    </RamkaLightbox.Close>
  );
}

function Slides({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Slides>) {
  return <RamkaLightbox.Slides className={cx('lb-slides', className)} {...props} />;
}

function Slide({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Slide>) {
  return <RamkaLightbox.Slide className={cx('lb-slide', className)} {...props} />;
}

function Item(props: React.ComponentProps<typeof RamkaLightbox.Item>) {
  return <RamkaLightbox.Item {...props} />;
}

function Media({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Media>) {
  return <RamkaLightbox.Media className={cx('lb-media', className)} {...props} />;
}

function Zoom(props: React.ComponentProps<typeof RamkaLightbox.Zoom>) {
  return <RamkaLightbox.Zoom {...props} />;
}

function ZoomIn({ className, children, ...props }: React.ComponentProps<typeof RamkaLightbox.ZoomIn>) {
  return (
    <RamkaLightbox.ZoomIn className={cx('lb-control', 'lb-control-md', className)} aria-label="Zoom in" {...props}>
      {children ?? <IconZoomIn />}
    </RamkaLightbox.ZoomIn>
  );
}

function ZoomOut({ className, children, ...props }: React.ComponentProps<typeof RamkaLightbox.ZoomOut>) {
  return (
    <RamkaLightbox.ZoomOut className={cx('lb-control', 'lb-control-md', className)} aria-label="Zoom out" {...props}>
      {children ?? <IconZoomOut />}
    </RamkaLightbox.ZoomOut>
  );
}

function Counter({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Counter>) {
  return <RamkaLightbox.Counter className={cx('lb-counter', className)} {...props} />;
}

function Caption({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.Caption>) {
  return <RamkaLightbox.Caption className={cx('lb-caption', className)} {...props} />;
}

function ThumbnailStrip({ className, ...props }: React.ComponentProps<typeof RamkaLightbox.ThumbnailStrip>) {
  return <RamkaLightbox.ThumbnailStrip className={cx('lb-thumbnail-strip', className)} {...props} />;
}

function ThumbnailStripTrack(props: React.ComponentProps<typeof RamkaLightbox.ThumbnailStripTrack>) {
  return <RamkaLightbox.ThumbnailStripTrack {...props} />;
}

function Thumbnail(props: React.ComponentProps<typeof RamkaLightbox.Thumbnail>) {
  return <RamkaLightbox.Thumbnail {...props} />;
}

function Previous(props: React.ComponentProps<typeof RamkaLightbox.Previous>) {
  return <RamkaLightbox.Previous {...props} />;
}

function Next(props: React.ComponentProps<typeof RamkaLightbox.Next>) {
  return <RamkaLightbox.Next {...props} />;
}

function ThumbnailGroup(props: React.ComponentProps<typeof RamkaLightbox.ThumbnailGroup>) {
  return <RamkaLightbox.ThumbnailGroup {...props} />;
}

/* ── Composed Gallery (product chrome) ──────────────────────────────────── */

function GalleryThumbnailStrip({ items }: { items: LightboxItem[] }) {
  if (items.length <= 1) return null;

  return (
    <ThumbnailStrip className="lb-thumbnail-strip-desktop">
      <ThumbnailStripTrack aria-label="Photo thumbnails">
        {items.map((item, i) => (
          <Thumbnail key={item.id ?? i} index={i}>
            <img src={item.thumb} alt={item.alt} draggable={false} />
          </Thumbnail>
        ))}
      </ThumbnailStripTrack>
      <span className="lb-thumbnail-strip-indicator" aria-hidden />
    </ThumbnailStrip>
  );
}

/**
 * Default product chrome — Portal → Backdrop + Content → Slides/Zoom + glass
 * controls / caption + counter placard / desktop ThumbnailStrip. Supports bleed (full-width)
 * and snug (aspect-sized cards) via the top-right layout toggle or `slidesLayout`.
 */
function Gallery({
  items,
  ariaLabel,
  slidesLayout: slidesLayoutProp,
  onSlidesLayoutChange,
}: {
  items: LightboxItem[];
  ariaLabel: string;
  slidesLayout?: SlidesLayout;
  onSlidesLayoutChange?: (layout: SlidesLayout) => void;
}) {
  const [slidesLayoutInternal, setSlidesLayoutInternal] = React.useState<SlidesLayout>(
    () => readStoredSlidesLayout() ?? 'bleed',
  );
  const slidesLayout = slidesLayoutProp ?? slidesLayoutInternal;
  const snug = slidesLayout === 'snug';
  // Single item → no thumbnail strip → solo layout (tighter, centered bottom band).
  const solo = items.length <= 1;

  const setSlidesLayout = React.useCallback(
    (next: SlidesLayout) => {
      storeSlidesLayout(next);
      onSlidesLayoutChange?.(next);
      if (slidesLayoutProp === undefined) {
        setSlidesLayoutInternal(next);
      }
    },
    [onSlidesLayoutChange, slidesLayoutProp],
  );

  const toggleSlidesLayout = React.useCallback(() => {
    setSlidesLayout(slidesLayout === 'snug' ? 'bleed' : 'snug');
  }, [setSlidesLayout, slidesLayout]);

  const snugEdgeRatios =
    snug && items.length > 0
      ? {
          start: itemAspectRatio(items[0]!),
          end: itemAspectRatio(items[items.length - 1]!),
        }
      : null;

  return (
    <Portal>
      <Backdrop />
      <Content aria-label={ariaLabel} className={cx(snug && 'lb-content-snug', solo && 'lb-content-solo') || undefined}>
        <Slides
          key={slidesLayout}
          aria-label="Full-size images"
          preload={2}
          className={snug ? 'lb-slides-snug' : undefined}
          style={
            snugEdgeRatios
              ? ({
                  '--lb-snug-ratio-start': snugEdgeRatios.start,
                  '--lb-snug-ratio-end': snugEdgeRatios.end,
                } as React.CSSProperties)
              : undefined
          }
        >
          {items.map((item, i) => {
            const ratio = itemAspectRatio(item);
            return (
              <Slide
                key={item.id ?? i}
                className={snug ? 'lb-slide-snug' : undefined}
                style={snug ? ({ '--lb-snug-ratio': ratio } as React.CSSProperties) : undefined}
              >
                <Item index={i} caption={item.caption ?? item.alt}>
                  <Zoom maxZoom={6}>
                    <Media width={item.width} height={item.height}>
                      <img
                        width={item.width}
                        height={item.height}
                        src={item.src}
                        alt={item.alt}
                        loading="eager"
                        draggable={false}
                      />
                    </Media>
                  </Zoom>
                </Item>
              </Slide>
            );
          })}
        </Slides>

        <div className={cx('lb-top-right', 'lb-chrome-gesture-hide')}>
          {/* Layout toggle: the icon is a miniature of the CURRENT layout —
              snug shows a card with neighbours, bleed one wide slide. */}
          <button
            type="button"
            className={cx('lb-control', 'lb-control-md', 'lb-control-layout')}
            aria-pressed={snug}
            aria-label={snug ? 'Switch to full-bleed slides' : 'Switch to snug slides'}
            onClick={toggleSlidesLayout}
          >
            {snug ? <IconLayoutSnug /> : <IconLayoutBleed />}
          </button>
          {/* Zoom −/+ share one capsule with a hairline divider. */}
          <div className={cx('lb-control-group', 'lb-control-md')}>
            <ZoomOut />
            <ZoomIn />
          </div>
          <Close />
        </div>

        <div className={cx('lb-bottom', 'lb-chrome-gesture-hide', solo && 'lb-bottom-solo')}>
          {/*
            Caption under the media, placard-style. The counter is visible on
            mobile where there's no strip to show position; on md+ the strip
            covers that, so the counter collapses to sr-only and keeps only
            its aria-live announcement role.
          */}
          <div className="lb-caption-group">
            <Caption />
            {/* "1 of 1" is noise — skip the counter for single-item galleries. */}
            {solo ? null : <Counter>{({ current, total }) => `${current} of ${total}`}</Counter>}
          </div>
          <GalleryThumbnailStrip items={items} />
        </div>
      </Content>
    </Portal>
  );
}

/**
 * Styled Lightbox namespace — drop-in replacement for `import * as Lightbox from '@ramka/react/lightbox'`
 * with this preset’s styles and composed Gallery.
 */
export const Lightbox = {
  Root,
  Trigger,
  Portal,
  Backdrop,
  Content,
  Close,
  Slides,
  Slide,
  Item,
  Media,
  Zoom,
  ZoomIn,
  ZoomOut,
  Counter,
  Caption,
  ThumbnailStrip,
  ThumbnailStripTrack,
  Thumbnail,
  ThumbnailGroup,
  Previous,
  Next,
  Gallery,
};
```

```css presets/default/css/lightbox.css
/**
 * Default lightbox skin — pairs with lightbox.tsx (copy both files).
 *
 * Scope: styles for the styled Lightbox primitives + the composed Gallery
 * only. App layout (trigger grids, cards, page chrome) belongs in your app.
 *
 * Class prefix: `lb-`. Dark mode: `.dark` or `[data-theme='dark']` on an
 * ancestor (e.g. <html>).
 *
 * Variables named `--lightbox-*` are written by the library at runtime
 * (gesture progress, motion timing) — this file only reads them. Variables
 * named `--lb-*` are this skin's own tokens. All view-transition CSS
 * (morph group, snapshots, crossfade) is injected by the library; skins
 * ship none of it.
 */

/* ── Tokens (scoped to the Portal host — not :root) ─────────────────────── */

.lb-portal {
  --lb-ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
}

/* ── Trigger ────────────────────────────────────────────────────────────── */

.lb-trigger {
  font: inherit;
  color: inherit;
  appearance: none;
  cursor: pointer;
}

.lb-trigger:focus {
  outline: none;
}

.lb-trigger:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* Hiding the trigger while it morphs (`data-morph-target`) is injected by
   the library — no rule needed here. */

/* ── Backdrop / Content open-close + pull ───────────────────────────────── */

.lb-backdrop {
  position: fixed;
  inset: 0;
  opacity: 0;
  /* Solid — the page underneath is fully covered while open. */
  background-color: #fff;
  /* Duration cascade: `--lightbox-pull-snap-*` exist only while a cancelled
     pull-to-dismiss springs back (so the refade matches the item's spring);
     otherwise `--lightbox-vt-duration` — the Root's `viewTransition` preset
     timing, which the library always sets on the Portal host. The 360ms
     literal is just a safety net (the default preset's duration). */
  transition: opacity var(--lightbox-pull-snap-duration, var(--lightbox-vt-duration, 360ms))
    var(--lightbox-pull-snap-easing, var(--lb-ease-out-expo));
}

:is(.dark, [data-theme='dark']) .lb-backdrop {
  background-color: #000;
}

/* Start the fade from 0 on the first frame after [data-open] appears. */
@starting-style {
  .lb-backdrop[data-open] {
    opacity: 0;
  }
}

/* `--lightbox-pull-progress` is 0 → 1 while pull-to-dismiss drags. */
.lb-backdrop[data-open] {
  opacity: calc(1 - var(--lightbox-pull-progress, 0) * 0.6);
}

.lb-backdrop[data-pulling] {
  transition: none; /* follow the finger */
}

.lb-content {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  overscroll-behavior: contain;
  outline: none;
  opacity: 0;
  /* Same preset clock as the backdrop and the morph. */
  transition: opacity var(--lightbox-vt-duration, 360ms) var(--lb-ease-out-expo);

  /*
   * Letterbox insets around the media (read by Slide padding and the snug
   * width formula). Mobile: equal top/bottom so the media is vertically
   * centered — 4rem clears the close-button row above and the caption +
   * counter below (no thumbnail strip on mobile).
   */
  --lb-inset-top: calc(4rem + env(safe-area-inset-top, 0px));
  --lb-inset-bottom: calc(4rem + env(safe-area-inset-bottom, 0px));
  --lb-inset-inline: 0px;
}

@media (min-width: 768px) {
  .lb-content {
    /*
     * Roomier desktop letterbox. Bottom = thumbnail-strip row (4rem) +
     * one-line caption bar (~1.75rem incl. gap) + the same optical gap the
     * media keeps to the corner controls above, so the letterbox reads
     * symmetric.
     */
    --lb-inset-top: calc(4.5rem + env(safe-area-inset-top, 0px));
    --lb-inset-bottom: calc(7.5rem + env(safe-area-inset-bottom, 0px));
    --lb-inset-inline: 3rem;
  }

  /* Solo (single item — no thumbnail strip): only the caption placard sits
     below, so match the top inset and keep the letterbox symmetric. */
  .lb-content-solo {
    --lb-inset-bottom: calc(4.5rem + env(safe-area-inset-bottom, 0px));
  }

  /* Snug: the horizontal inset is a scrollport gutter consumed by the card
     width formula below — not per-slide padding. */
  .lb-content-snug {
    --lb-inset-inline: 2rem;
  }
}

.lb-content[data-open] {
  opacity: 1;
}

@starting-style {
  .lb-content[data-open] {
    opacity: 0;
  }
}

/* ── Slides / Slide / Media ─────────────────────────────────────────────── */

.lb-slides {
  flex: 1;
  gap: 1.25rem;
  scrollbar-width: none;
}

.lb-slides::-webkit-scrollbar {
  display: none;
}

@media (min-width: 768px) {
  .lb-slides {
    gap: 0;
  }
}

.lb-slide {
  flex: 0 0 100%;
  min-width: 100%;
  height: 100%;
  padding-top: var(--lb-inset-top);
  padding-bottom: var(--lb-inset-bottom);
  padding-inline: var(--lb-inset-inline);
}

/* Snug: no horizontal padding on the card itself — the gutter lives in the
   width formula only, so neighbors can peek right up to the card edge. */
.lb-content-snug .lb-slide {
  padding-inline: 0;
}

.lb-media {
  overflow: hidden;
}

@media (min-width: 768px) {
  .lb-media {
    border-radius: 0.5rem;
  }
}

.lb-media img {
  user-select: none;
  -webkit-user-select: none;
}

/* ── Snug slides (aspect-sized cards + peeking neighbors) ───────────────── */

/*
 * Card width = the largest size that fits the letterbox at the item's aspect
 * ratio: min(scrollport width minus gutters, letterbox height × ratio).
 * The `--lb-snug-ratio*` values are per-item aspect ratios set inline
 * by lightbox.tsx; cqw/cqh resolve against the Slides scrollport (the
 * library makes it a size container). -start/-end are the first/last item's
 * ratios, needed below to center them in the scrollport.
 */
.lb-slides-snug {
  --lb-snug-gap: 1.25rem;
  --lb-snug-width-start: min(
    calc(100cqw - 2 * var(--lb-inset-inline)),
    calc((100cqh - var(--lb-inset-top) - var(--lb-inset-bottom)) * var(--lb-snug-ratio-start, 1))
  );
  --lb-snug-width-end: min(
    calc(100cqw - 2 * var(--lb-inset-inline)),
    calc((100cqh - var(--lb-inset-top) - var(--lb-inset-bottom)) * var(--lb-snug-ratio-end, 1))
  );
  gap: var(--lb-snug-gap);
}

.lb-content-snug .lb-slide-snug {
  --lb-snug-width: min(
    calc(100cqw - 2 * var(--lb-inset-inline)),
    calc((100cqh - var(--lb-inset-top) - var(--lb-inset-bottom)) * var(--lb-snug-ratio))
  );
  /* Stacking baseline for the zoomed-card promotion below. */
  z-index: 0;
}

@media (min-width: 768px) {
  .lb-content-snug .lb-slide-snug {
    flex: 0 0 auto;
    min-width: 0;
    width: var(--lb-snug-width);
  }

  /* Leading/trailing spacers sized so the first/last card can center in the
     scrollport under scroll-snap. */
  .lb-slides-snug::before,
  .lb-slides-snug::after {
    content: '';
    pointer-events: none;
  }

  .lb-slides-snug::before {
    flex: 0 0 calc((100cqw - var(--lb-snug-width-start)) / 2 - var(--lb-snug-gap));
  }

  .lb-slides-snug::after {
    flex: 0 0 calc((100cqw - var(--lb-snug-width-end)) / 2 - var(--lb-snug-gap));
  }
}

/*
 * Neighbor cards dim as the active item is pulled to dismiss
 * (`--lightbox-pull-progress`) or zoomed (`--lightbox-zoom-progress`) — both
 * library-written, 0 → 1. `filter` tracks the gesture 1:1 (transitioning it
 * would lag the finger); `opacity` transitions so the pull snap-back
 * resolves on the same spring as the item.
 */
.lb-slide-snug [data-ramka-item] {
  transition: opacity var(--lightbox-pull-snap-duration, 500ms)
    var(--lightbox-pull-snap-easing, var(--lb-ease-out-expo));
}

.lb-slide-snug [data-ramka-item]:not([data-active]) {
  --lb-neighbor-dim: max(var(--lightbox-pull-progress, 0), var(--lightbox-zoom-progress, 0));
  opacity: calc(1 - var(--lightbox-pull-progress, 0) * 0.85);
  filter: opacity(calc(1 - var(--lb-neighbor-dim))) blur(calc(var(--lb-neighbor-dim) * 6px));
}

.lb-content[data-pulling] .lb-slide-snug [data-ramka-item] {
  transition: none; /* follow the finger */
}

/* The zoomed active card paints above the peeking neighbors. */
.lb-content[data-zoomed] .lb-slide-snug:has([data-ramka-item][data-active]) {
  z-index: 1;
}

/* ── Chrome (controls, caption, counter, strip) ─────────────────────────── */

/* Chrome that gets out of the way during gestures. `visibility` (not just
   opacity/pointer-events) keeps hidden controls out of the tab order; its
   0s flip is delayed to the end of the fade-out, instant on fade-in. */
.lb-chrome-gesture-hide {
  opacity: 1;
  visibility: visible;
  transition:
    opacity 200ms,
    visibility 0s linear 0s;
}

/* Fade the chrome in on open. */
@starting-style {
  .lb-chrome-gesture-hide {
    opacity: 0;
  }
}

/* Pull-to-dismiss hides all gesture chrome; zoom hides the bottom placard
   (the zoomed media pans under it). */
.lb-content:is([data-pulling], [data-pull-dismissing]) .lb-chrome-gesture-hide,
.lb-content[data-zoomed] .lb-bottom {
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 200ms,
    visibility 0s linear 200ms;
}

/* On mobile, zoom also hides the top controls — the media fills the screen. */
@media (max-width: 767px) {
  .lb-content[data-zoomed] .lb-top-right {
    opacity: 0;
    visibility: hidden;
    transition:
      opacity 200ms,
      visibility 0s linear 200ms;
  }
}

.lb-top-right {
  position: absolute;
  right: 0.75rem;
  top: calc(0.75rem + env(safe-area-inset-top, 0px));
  z-index: 1;
  display: flex;
  gap: 0.5rem;
}

.lb-bottom {
  /* Click-through the inset band; caption opts back in for text selection. */
  pointer-events: none;
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding-inline: 0.75rem;
  padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
}

/* Solo (no strip): center the placard in the bottom inset band instead of
   pinning it to the viewport edge. */
.lb-bottom-solo {
  justify-content: center;
  min-height: var(--lb-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

/* Placard under the media: caption line with the counter beneath it. */
.lb-caption-group {
  display: flex;
  max-width: 100%;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.lb-caption {
  pointer-events: auto;
  -webkit-user-select: text;
  user-select: text;
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.25;
  color: #171717;
}

:is(.dark, [data-theme='dark']) .lb-caption {
  color: #fafafa;
}

.lb-counter {
  font-size: 0.6875rem;
  line-height: 1.25;
  font-variant-numeric: tabular-nums;
  color: #737373;
}

:is(.dark, [data-theme='dark']) .lb-counter {
  color: #a3a3a3;
}

/* md+: the thumbnail strip shows position, so the counter collapses to
   sr-only and keeps only its aria-live announcement role. */
@media (min-width: 768px) {
  .lb-counter {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
}

/* ── Controls (iOS-style liquid glass) ──────────────────────────────────── */

.lb-control {
  display: inline-flex;
  height: 2.25rem;
  width: 2.25rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 1px solid rgb(0 0 0 / 0.2);
  background: rgb(255 255 255 / 0.55);
  color: #171717;
  box-shadow:
    0 0.5px 1px rgb(0 0 0 / 0.12),
    0 1px 2px rgb(0 0 0 / 0.08),
    inset 0 0.5px 0 rgb(255 255 255 / 0.65);
  -webkit-backdrop-filter: blur(40px) saturate(1.5);
  backdrop-filter: blur(40px) saturate(1.5);
  transition:
    background-color 150ms ease-out,
    box-shadow 150ms ease-out,
    transform 150ms ease-out,
    opacity 150ms ease-out,
    color 150ms ease-out;
  cursor: pointer;
}

/* Hover/press tint as a background-image overlay so one rule serves both the
   glass pills (which have a background-color) and the transparent segments
   inside .lb-control-group. */
.lb-control:hover {
  background-image: linear-gradient(rgb(0 0 0 / 0.05), rgb(0 0 0 / 0.05));
}

.lb-control:active {
  transform: scale(0.96);
  background-image: linear-gradient(rgb(0 0 0 / 0.09), rgb(0 0 0 / 0.09));
}

.lb-control:focus {
  outline: none;
}

/* Focus ring rides on box-shadow (the pill clips outlines poorly), so it
   restates the resting shadows plus the ring. */
.lb-control:focus-visible {
  box-shadow:
    0 0 0 2px rgb(0 0 0 / 0.25),
    0 0.5px 1px rgb(0 0 0 / 0.12),
    0 1px 2px rgb(0 0 0 / 0.08),
    inset 0 0.5px 0 rgb(255 255 255 / 0.65);
}

.lb-control:disabled {
  cursor: not-allowed;
  opacity: 0.3;
}

.lb-control:disabled:active {
  transform: none;
}

:is(.dark, [data-theme='dark']) .lb-control {
  border-color: rgb(255 255 255 / 0.25);
  background: rgb(23 23 23 / 0.45);
  color: #fff;
  box-shadow:
    0 0 0 0.5px #000,
    0 0.5px 1px rgb(0 0 0 / 0.45),
    0 1px 2px rgb(0 0 0 / 0.35),
    inset 0 0.5px 0 rgb(255 255 255 / 0.14);
}

:is(.dark, [data-theme='dark']) .lb-control:hover {
  background-image: linear-gradient(rgb(255 255 255 / 0.08), rgb(255 255 255 / 0.08));
}

:is(.dark, [data-theme='dark']) .lb-control:active {
  background-image: linear-gradient(rgb(255 255 255 / 0.12), rgb(255 255 255 / 0.12));
}

:is(.dark, [data-theme='dark']) .lb-control:focus-visible {
  box-shadow:
    0 0 0 2px rgb(255 255 255 / 0.4),
    0 0 0 0.5px #000,
    0 0.5px 1px rgb(0 0 0 / 0.45),
    0 1px 2px rgb(0 0 0 / 0.35),
    inset 0 0.5px 0 rgb(255 255 255 / 0.14);
}

/* Joined capsule — one glass pill holding several segments (zoom −/+) with a
   hairline divider, like iOS grouped controls. The pill owns the glass
   chrome; segments become flat, full-height hit areas. */
.lb-control-group {
  display: inline-flex;
  align-items: stretch;
  border-radius: 9999px;
  border: 1px solid rgb(0 0 0 / 0.2);
  background: rgb(255 255 255 / 0.55);
  box-shadow:
    0 0.5px 1px rgb(0 0 0 / 0.12),
    0 1px 2px rgb(0 0 0 / 0.08),
    inset 0 0.5px 0 rgb(255 255 255 / 0.65);
  -webkit-backdrop-filter: blur(40px) saturate(1.5);
  backdrop-filter: blur(40px) saturate(1.5);
  overflow: hidden;
}

/* Each segment is as wide as the pill is tall → the capsule is exactly 2:1.
   `background-color` (not the `background` shorthand) so the shared hover/
   press background-image overlay above still applies. */
.lb-control-group .lb-control {
  position: relative;
  width: 2.25rem;
  height: auto;
  border: 0;
  border-radius: 0;
  background-color: transparent;
  box-shadow: none;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

/* Segments don't shrink on press — the pill is one rigid control. */
.lb-control-group .lb-control:active {
  transform: none;
}

/* The pill clips outset rings, so segments use an inset focus ring. */
.lb-control-group .lb-control:focus-visible {
  box-shadow: inset 0 0 0 2px rgb(0 0 0 / 0.25);
}

/* Hairline divider between segments. */
.lb-control-group .lb-control + .lb-control::before {
  content: '';
  position: absolute;
  left: 0;
  top: 22%;
  bottom: 22%;
  width: 1px;
  background: rgb(0 0 0 / 0.15);
}

:is(.dark, [data-theme='dark']) .lb-control-group {
  border-color: rgb(255 255 255 / 0.25);
  background: rgb(23 23 23 / 0.45);
  box-shadow:
    0 0 0 0.5px #000,
    0 0.5px 1px rgb(0 0 0 / 0.45),
    0 1px 2px rgb(0 0 0 / 0.35),
    inset 0 0.5px 0 rgb(255 255 255 / 0.14);
}

:is(.dark, [data-theme='dark']) .lb-control-group .lb-control {
  border: 0;
  background-color: transparent;
  box-shadow: none;
}

:is(.dark, [data-theme='dark']) .lb-control-group .lb-control:focus-visible {
  box-shadow: inset 0 0 0 2px rgb(255 255 255 / 0.4);
}

:is(.dark, [data-theme='dark']) .lb-control-group .lb-control + .lb-control::before {
  background: rgb(255 255 255 / 0.2);
}

/* `lb-control-md` controls (layout toggle, zoom) are desktop-only. */
@media (max-width: 767px) {
  .lb-control-md {
    display: none;
  }
}

.lb-control svg {
  display: block;
  width: 1rem;
  height: 1rem;
}

/* The close ✕ and the layout glyphs are optically lighter — render larger. */
.lb-control[aria-label='Close'] svg,
.lb-control-layout svg {
  width: 1.125rem;
  height: 1.125rem;
}

/* ── Thumbnail strip ────────────────────────────────────────────────────── */

.lb-thumbnail-strip {
  --lb-thumb-size: 3.5rem;
  --lb-strip-fade: 32px;
  /* Soft edge fade over the scrolling thumbs (eased ramp, not linear). */
  --lb-strip-mask: linear-gradient(
    to right,
    rgb(0 0 0 / 0) 0,
    rgb(0 0 0 / 0.156) calc(var(--lb-strip-fade) * 0.25),
    rgb(0 0 0 / 0.5) calc(var(--lb-strip-fade) * 0.5),
    rgb(0 0 0 / 0.844) calc(var(--lb-strip-fade) * 0.75),
    #000 var(--lb-strip-fade),
    #000 calc(100% - var(--lb-strip-fade)),
    rgb(0 0 0 / 0.844) calc(100% - var(--lb-strip-fade) * 0.75),
    rgb(0 0 0 / 0.5) calc(100% - var(--lb-strip-fade) * 0.5),
    rgb(0 0 0 / 0.156) calc(100% - var(--lb-strip-fade) * 0.25),
    rgb(0 0 0 / 0) 100%
  );
  pointer-events: auto; /* counteract .lb-bottom click-through */
  align-self: stretch;
  width: 100%;
  min-width: 0;
  padding-block: 0.25rem;
  -webkit-mask-image: var(--lb-strip-mask);
  mask-image: var(--lb-strip-mask);
}

/* The strip is desktop-only; mobile shows the counter instead. */
@media (max-width: 767px) {
  .lb-thumbnail-strip-desktop {
    display: none;
  }
}

.lb-thumbnail-strip [data-ramka-thumbnail-strip-track] {
  display: flex;
  width: max-content;
  gap: 0.5rem;
  align-items: center;
}

.lb-thumbnail-strip [role='tab'] {
  box-sizing: border-box;
  position: relative;
  display: block;
  width: var(--lb-thumb-size);
  height: var(--lb-thumb-size);
  flex-shrink: 0;
  overflow: hidden;
  margin: 0;
  border: 0;
  border-radius: 0.375rem;
  padding: 0;
  appearance: none;
  background: transparent;
  cursor: pointer;
}

.lb-thumbnail-strip [role='tab'] img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Decorative ring the library positions over the active tab. */
.lb-thumbnail-strip-indicator {
  position: absolute;
  left: 50%;
  top: 50%;
  box-sizing: border-box;
  width: calc(var(--lb-thumb-size) + 8px);
  height: calc(var(--lb-thumb-size) + 8px);
  border-radius: calc(0.375rem + 2px);
  border: 2px solid #000;
  pointer-events: none;
  transform: translate(-50%, -50%);
}

:is(.dark, [data-theme='dark']) .lb-thumbnail-strip-indicator {
  border-color: #fff;
}
```
