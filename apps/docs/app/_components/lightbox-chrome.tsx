'use client';

import * as React from 'react';
import { flushSync } from 'react-dom';
import Image, { type StaticImageData } from 'next/image';
import * as Lightbox from '@ramka/react/lightbox';
import { useLightboxTriggerContext } from '@ramka/react';
import {
  ChevronLeft,
  ChevronRight,
  GalleryHorizontal,
  RectangleHorizontal,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Shared Tailwind chrome for Lightbox examples. These are *consumer-side*
 * styled wrappers around the unstyled `Lightbox.*` primitives. The library
 * ships zero CSS — every visual property below (positioning, colors,
 * transitions, focus rings, open/close fades) is defined here, in user
 * code.
 *
 * Motion timings mirror frosted-ui's lightbox so this docs site looks
 * like the same component the library is modeled after:
 *
 *   - backdrop opacity        --lightbox-vt-duration ease-out-expo
 *   - content opacity         --lightbox-vt-duration ease-out-expo
 *   - VT root + morph group   library-injected (viewTransition preset timing)
 *   - morph-target hide       library-injected (200ms ease-out-expo)
 *
 * The open/close choreography (backdrop, content, VT root cross-fade, morph)
 * all read `--lightbox-vt-duration` — the Root's `viewTransition` preset
 * timing, which the library publishes on the Portal host (always) and on
 * documentElement (during a morph) — so they resolve as one cohesive motion.
 * Pick a different preset and everything stays in lockstep.
 *
 * The `ease-out-expo` token is defined in `globals.css` via Tailwind v4's
 * `@theme`. The View Transition pseudo-elements (morph group, root
 * cross-fade) and the morph-target hide are styled by the library's
 * injected stylesheet.
 *
 * The backdrop and chrome fade via their own live opacity transitions —
 * never via the VT root-crossfade snapshot. Crossfading two full-viewport
 * bitmaps every frame is measurably jankier on mobile Safari than animating
 * a single layer's opacity, so we let each element run its own transition
 * even while a view transition is in flight.
 */

/**
 * iOS-style liquid-glass control — frosted fill, specular rim, soft depth.
 * Desktop-only zoom uses {@link lightboxChromeButtonMd} (`hidden` below `md`).
 */
export const lightboxChromeButton =
  'pointer-events-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ' +
  'border border-black/20 bg-white/55 text-neutral-900 ' +
  // iOS: tight, low-opacity drop + hairline specular — not a soft ambient blob.
  'shadow-[0_0.5px_1px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.08),inset_0_0.5px_0_rgba(255,255,255,0.65)] ' +
  'backdrop-blur-2xl backdrop-saturate-150 ' +
  'transition-[background-color,box-shadow,transform,opacity,color] duration-150 ease-out ' +
  // Hover/press tint is a background-image overlay (same recipe as the
  // capsule segments) so standalone pills and grouped segments read alike.
  'hover:[background-image:linear-gradient(rgba(0,0,0,0.05),rgba(0,0,0,0.05))] ' +
  'active:scale-[0.96] active:[background-image:linear-gradient(rgba(0,0,0,0.09),rgba(0,0,0,0.09))] ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-black/25 ' +
  // pointer-events-none (not cursor-not-allowed): disabled buttons still
  // match :hover and still emit pointer events in Chrome, which would show
  // the hover tint and open tooltips. Same recipe as the default preset.
  'disabled:pointer-events-none disabled:opacity-30 ' +
  'dark:border-white/25 dark:bg-neutral-900/45 dark:text-white ' +
  // 0.5px black outline (via shadow so it follows the circle) + crisp drop shadow.
  'dark:shadow-[0_0_0_0.5px_#000,0_0.5px_1px_rgba(0,0,0,0.45),0_1px_2px_rgba(0,0,0,0.35),inset_0_0.5px_0_rgba(255,255,255,0.14)] ' +
  'dark:hover:[background-image:linear-gradient(rgba(255,255,255,0.08),rgba(255,255,255,0.08))] ' +
  'dark:active:[background-image:linear-gradient(rgba(255,255,255,0.12),rgba(255,255,255,0.12))] ' +
  'dark:focus-visible:ring-white/40';

/** Glass control hidden below `md` (zoom in/out — pinch covers mobile). */
export const lightboxChromeButtonMd = `hidden md:inline-flex ${lightboxChromeButton.replace('inline-flex ', '')}`;

/**
 * Joined capsule — one glass pill holding several segments (zoom −/+) with a
 * hairline divider, like iOS grouped controls (mirrors the default preset).
 * The pill owns the glass chrome; segments are flat, full-height hit areas.
 * Desktop-only, same as the standalone zoom buttons (pinch covers mobile).
 */
export const lightboxChromeButtonGroup =
  'pointer-events-auto hidden h-9 items-stretch overflow-hidden rounded-full md:inline-flex ' +
  'border border-black/20 bg-white/55 ' +
  'shadow-[0_0.5px_1px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.08),inset_0_0.5px_0_rgba(255,255,255,0.65)] ' +
  'backdrop-blur-2xl backdrop-saturate-150 ' +
  'dark:border-white/25 dark:bg-neutral-900/45 ' +
  'dark:shadow-[0_0_0_0.5px_#000,0_0.5px_1px_rgba(0,0,0,0.45),0_1px_2px_rgba(0,0,0,0.35),inset_0_0.5px_0_rgba(255,255,255,0.14)]';

/**
 * Segment inside {@link lightboxChromeButtonGroup}: no glass of its own (the
 * pill owns it), hover/press tint via background-image so it reads on the
 * transparent fill, inset focus ring (the pill clips outset rings). Each
 * segment is as wide as the pill is tall → a two-segment capsule is 2:1.
 */
export const lightboxChromeButtonSegment =
  'relative inline-flex w-9 shrink-0 items-center justify-center text-neutral-900 ' +
  'transition-[background-color,box-shadow,opacity,color] duration-150 ease-out ' +
  'hover:[background-image:linear-gradient(rgba(0,0,0,0.05),rgba(0,0,0,0.05))] ' +
  'active:[background-image:linear-gradient(rgba(0,0,0,0.09),rgba(0,0,0,0.09))] ' +
  'focus:outline-none focus-visible:shadow-[inset_0_0_0_2px_rgba(0,0,0,0.25)] ' +
  // See lightboxChromeButton: blocks hover tint + tooltips while disabled.
  'disabled:pointer-events-none disabled:opacity-30 ' +
  'dark:text-white ' +
  'dark:hover:[background-image:linear-gradient(rgba(255,255,255,0.08),rgba(255,255,255,0.08))] ' +
  'dark:active:[background-image:linear-gradient(rgba(255,255,255,0.12),rgba(255,255,255,0.12))] ' +
  'dark:focus-visible:shadow-[inset_0_0_0_2px_rgba(255,255,255,0.4)]';

/** Hairline divider on the leading edge of a follow-up capsule segment. */
export const lightboxChromeSegmentDivider =
  "before:absolute before:inset-y-[22%] before:start-0 before:w-px before:bg-black/15 before:content-[''] dark:before:bg-white/20";

/**
 * Intrinsic pixel dimensions encoded in a picsum URL (`…/{width}/{height}`).
 * Spread onto `<img>` as `width`/`height` so the box (and aspect ratio) is
 * reserved before the pixels load — which keeps the morph target sized on slow
 * connections and prevents layout shift.
 */
export function imgDims(url: string) {
  const m = url.match(/\/(\d+)\/(\d+)$/);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : undefined;
}

/**
 * Local statically-imported assets (preferred — Next.js provides intrinsic
 * dimensions + `blurDataURL` at build time) or a remote/plain URL string.
 */
export type LightboxImageSource = string | StaticImageData;

export type LightboxGalleryItem = {
  id?: string | number;
  src: LightboxImageSource;
  thumb: LightboxImageSource;
  alt: string;
  caption?: string;
  /**
   * Optional intrinsic pixel size override. Used for snug slide sizing when
   * `src` carries no dimensions (video posters sized to the video frame, 3D
   * screenshots sized to the canvas fit-box).
   */
  width?: number;
  height?: number;
  /**
   * Blur-up LQIP on the destination `next/image`. Per the Next.js Image guide,
   * only set this for items whose index has NO trigger image (+N overflow,
   * non-image triggers) — when a trigger `imageRef` exists, Ramka's thumb
   * bridge owns the open placeholder and a destination blur would cover it.
   */
  destinationBlur?: boolean;
};

/** Resolved pixel dims for Media / snug geometry. */
export function galleryItemDims(item: LightboxGalleryItem): { width: number; height: number } | undefined {
  if (item.width && item.height && item.width > 0 && item.height > 0) {
    return { width: item.width, height: item.height };
  }
  if (typeof item.src === 'object') {
    return { width: item.src.width, height: item.src.height };
  }
  return imgDims(item.src);
}

/** Width/height ratio for snug slide width + end-spacer geometry. */
export function galleryItemAspectRatio(item: LightboxGalleryItem): number {
  const dims = galleryItemDims(item);
  return dims ? dims.width / dims.height : 16 / 9;
}

type GalleryItemRenderCtx = {
  imageRef: (node: HTMLImageElement | null) => void;
  morphRef: (node: HTMLElement | null) => void;
};

/**
 * The snug/bleed choice is a user preference, so it survives across galleries
 * and visits (same recipe as the default preset, separate key — docs demos
 * shouldn't fight the preset pages over one setting). Guarded reads/writes:
 * localStorage throws in some private modes, and `window` doesn't exist
 * during SSR (the portal renders nothing while closed, so the pre-hydration
 * value is never visible anyway).
 */
const SLIDES_LAYOUT_STORAGE_KEY = 'ramka-docs-slides-layout';

function readStoredSlidesLayout(): 'bleed' | 'snug' | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(SLIDES_LAYOUT_STORAGE_KEY);
    return value === 'snug' || value === 'bleed' ? value : null;
  } catch {
    return null;
  }
}

function storeSlidesLayout(layout: 'bleed' | 'snug') {
  try {
    window.localStorage.setItem(SLIDES_LAYOUT_STORAGE_KEY, layout);
  } catch {
    // Storage unavailable — the toggle still works for this session.
  }
}

/** Default docs strip: square thumbs + stationary floating square indicator. */
function GalleryThumbnailStrip({
  items,
  className,
}: {
  items: LightboxGalleryItem[];
  className: string;
}) {
  return (
    <Lightbox.ThumbnailStrip className={className}>
      <Lightbox.ThumbnailStripTrack aria-label="Photo thumbnails">
        {items.map((item, i) => (
          <Lightbox.Thumbnail key={item.id ?? i} index={i}>
            {typeof item.thumb === 'object' ? (
              // Strip thumbs are regular images (Ramka bridges only the
              // destination media) — blur OK, same as triggers.
              <Image src={item.thumb} alt={item.alt} sizes="144px" placeholder="blur" draggable={false} />
            ) : (
              <img src={item.thumb} alt={item.alt} draggable={false} />
            )}
          </Lightbox.Thumbnail>
        ))}
      </Lightbox.ThumbnailStripTrack>
      <span className="lightbox-demo-thumbnail-strip-indicator" aria-hidden />
    </Lightbox.ThumbnailStrip>
  );
}


/**
 * Default product chrome for docs/examples — the shared fullscreen viewer:
 * light pull-fade Backdrop, Slides + Zoom, Counter (top-left), Close/ZoomIn/
 * ZoomOut, Caption + desktop thumbnails. Place beside Triggers under
 * `Lightbox.Root` (does not render Root or Triggers).
 */
export function LightboxGallery({
  items,
  ariaLabel,
  preload = 3,
  maxZoom = 6,
  thumbnails = 'desktop',
  zoomControls = true,
  pullToClose = true,
  /**
   * `scrim` — translucent white/black (default).
   * `solid` — opaque `bg-white dark:bg-black` (prefer with instant
   * `scrollTriggerIntoView` so page scroll under the viewer isn’t visible).
   */
  backdrop = 'scrim',
  /**
   * `bleed` — each slide spans the viewport (default Photos-style track).
   * `snug` — same full-height Slide → Item → Zoom stack as bleed. On `md+`,
   * Slide width shrinks to the media column (variable-width track + gap); on
   * mobile, slides are full scrollport width like bleed. Vertical chrome insets
   * are Slide padding; desktop horizontal inset is a width cap (not
   * padding-inline). See `lightbox-demo/chrome-insets.css` + `snug-slides.css`.
   */
  slidesLayout: slidesLayoutProp = 'bleed',
  /**
   * Desktop-only bleed/snug toggle in the top chrome (mirrors the default
   * preset). When on, `slidesLayout` is just the first-visit default — the
   * user's choice wins and persists in localStorage.
   */
  layoutToggle = false,
  renderItem,
  /** Portaled inside Content — e.g. debug tooling or in-viewer controls. */
  overlay,
  /**
   * Forwarded to `Lightbox.Portal`. Lets a page opt out of the body portal —
   * e.g. `{ container: null }` renders the viewer in place so a server-rendered
   * page can ship with the lightbox already open (portals cannot exist in
   * server HTML). When rendering in place, also pass a stacking class (e.g.
   * `relative z-50`) so the fixed viewer clears the page's sticky chrome.
   */
  portalProps,
  /**
   * Forwarded to `Lightbox.Slides` for pages that server-render the viewer
   * open (deep links): the library's transform stand-in paints the correct
   * slide before hydration. Only applied in the bleed layout — the shift
   * requires scrollport-wide slides, and snug cards are content-sized (they
   * fall back to the library's `scroll-initial-target` path instead).
   */
  ssrSlideShift = false,
  /**
   * Forwarded as `Lightbox.Caption`'s children — the pre-registration
   * fallback for pages that render the viewer already open (server paints
   * and the first client paint): items register captions in effects, so the
   * registry is empty until then. Pass the initially-active item's caption.
   */
  captionFallback,
}: {
  items: LightboxGalleryItem[];
  ariaLabel: string;
  preload?: number;
  maxZoom?: number;
  thumbnails?: 'desktop' | 'always' | 'never';
  /** Desktop ZoomIn/ZoomOut toolbar buttons (default true). Off for video etc. */
  zoomControls?: boolean;
  /** Pass `false` when content owns vertical drag (maps, orbit, …). @default true */
  pullToClose?: boolean;
  backdrop?: 'scrim' | 'solid';
  slidesLayout?: 'bleed' | 'snug';
  layoutToggle?: boolean;
  renderItem?: (item: LightboxGalleryItem, index: number, ctx: GalleryItemRenderCtx) => React.ReactNode;
  overlay?: React.ReactNode;
  portalProps?: React.ComponentProps<typeof Lightbox.Portal>;
  ssrSlideShift?: boolean;
  captionFallback?: React.ReactNode;
}) {
  const [slidesLayoutState, setSlidesLayoutState] = React.useState<'bleed' | 'snug'>(
    () => (layoutToggle ? readStoredSlidesLayout() : null) ?? slidesLayoutProp,
  );
  const slidesLayout = layoutToggle ? slidesLayoutState : slidesLayoutProp;

  const toggleSlidesLayout = React.useCallback(() => {
    const flip = () =>
      setSlidesLayoutState((prev) => {
        const next = prev === 'snug' ? 'bleed' : 'snug';
        storeSlidesLayout(next);
        return next;
      });
    // Default root crossfade between the two layouts (no move effects — the
    // keyed Slides remount swaps geometry, the VT dissolves old → new).
    // Skipped under prefers-reduced-motion and where the API is missing.
    // The library's VT CSS is gated on `data-ramka-view-transition` (open/
    // close morphs only), so this transition keeps the browser default look.
    const reduceMotion =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || typeof document.startViewTransition !== 'function') {
      flip();
      return;
    }
    document.startViewTransition(() => {
      flushSync(flip);
    });
  }, []);
  // Viewport visibility only — linked layout/sync live in Lightbox.ThumbnailStrip.
  const thumbClass =
    thumbnails === 'always'
      ? 'pointer-events-auto lightbox-demo-thumbnail-strip'
      : 'pointer-events-auto hidden md:block lightbox-demo-thumbnail-strip';

  // No strip → solo layout: tighter bottom band with the placard centered in it.
  const showStrip = thumbnails !== 'never' && items.length > 1;

  const backdropTone = backdrop === 'solid' ? 'bg-white dark:bg-black' : 'lightbox-demo-backdrop-light';
  const snug = slidesLayout === 'snug';
  const snugEdgeRatios =
    snug && items.length > 0
      ? {
          start: galleryItemAspectRatio(items[0]!),
          end: galleryItemAspectRatio(items[items.length - 1]!),
        }
      : null;

  return (
    <Lightbox.Portal {...portalProps}>
      <Lightbox.Backdrop className={`lightbox-demo-backdrop ${backdropTone} fixed inset-0`} />
      <Lightbox.Content
        aria-label={ariaLabel}
        pullToClose={pullToClose}
        className={`lightbox-demo-content fixed inset-0 flex flex-col overscroll-contain outline-none${snug ? ' lightbox-demo-content-snug' : ''}${showStrip ? '' : ' lightbox-demo-content-solo'}`}
      >
        <Lightbox.Slides
          // Remount the track when the toggle flips layouts mid-session — the
          // bleed/snug geometry (spacers, widths) shouldn't animate between.
          key={slidesLayout}
          aria-label="Full-size images"
          // The library ships no copy for these, so the words are ours to pass
          // (see the slide's `aria-roledescription` / `aria-label` below). In a
          // localized app they would come from your translation catalogue.
          aria-roledescription="carousel"
          preload={preload}
          ssrSlideShift={ssrSlideShift && !snug}
          className={
            snug
              ? // End spacers + card gap: `lightbox-demo/snug-slides.css`.
                'lightbox-demo-slides lightbox-demo-slides-snug flex-1 [&::-webkit-scrollbar]:hidden'
              : // `--lightbox-ssr-slide-gap` mirrors the gap utilities beside it —
                // the library's ssrSlideShift math cannot read a computed `gap`,
                // so the skin restates it as a var (keep the pairs in sync).
                'lightbox-demo-slides flex-1 gap-5 [--lightbox-ssr-slide-gap:1.25rem] [&::-webkit-scrollbar]:hidden md:gap-0 md:[--lightbox-ssr-slide-gap:0px]'
          }
          style={
            snugEdgeRatios
              ? ({
                  '--lightbox-snug-ratio-start': snugEdgeRatios.start,
                  '--lightbox-snug-ratio-end': snugEdgeRatios.end,
                } as React.CSSProperties)
              : undefined
          }
        >
          {items.map((item, i) => {
            const ratio = galleryItemAspectRatio(item);
            return (
              <Lightbox.Slide
                key={item.id ?? i}
                className={
                  snug
                    ? // Width + sibling dim: `snug-slides.css` / `pull-progress.css`.
                      'lightbox-demo-slide-snug lightbox-demo-slide-pad z-0 h-full'
                    : 'lightbox-demo-slide-pad h-full'
                }
                style={
                  snug
                    ? ({ '--lightbox-snug-ratio': ratio } as React.CSSProperties)
                    : undefined
                }
              >
                <Lightbox.Item
                  index={i}
                  caption={item.caption ?? item.alt}
                  aria-roledescription="slide"
                  // Only the strip-less shape needs naming here: with a strip
                  // the item is a `tabpanel` already named by its thumbnail
                  // tab, and `aria-labelledby` outranks `aria-label` anyway.
                  {...(showStrip ? {} : { 'aria-label': `${i + 1} of ${items.length}` })}
                >
                  {({ imageRef, morphRef }) =>
                    renderItem ? (
                      renderItem(item, i, { imageRef, morphRef })
                    ) : (
                      <Lightbox.Zoom maxZoom={maxZoom}>
                        {/* Radius/overflow are cosmetic on Media; width/height are structural. */}
                        {/* The ::after draws the same Apple-style 0.5px inset outline as the
                            landing triggers, so dark photos don't bleed into the dark-mode
                            backdrop (and bright ones into the light scrim). Media is already
                            position:relative (structural), so absolute insets just work.
                            md+ only — the mobile edge-to-edge layout stays outline-free. */}
                        <Lightbox.Media
                          {...(galleryItemDims(item) ?? {})}
                          className="overflow-hidden rounded-none after:pointer-events-none after:absolute after:inset-0 after:z-10 after:rounded-[inherit] md:rounded-lg md:after:shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.1)] md:dark:after:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.12)]"
                        >
                          {typeof item.src === 'object' ? (
                            // Destination Image: no placeholder unless the item
                            // has no trigger image (see `destinationBlur`).
                            <Image
                              src={item.src}
                              alt={item.alt}
                              sizes="100vw"
                              loading="eager"
                              draggable={false}
                              className="select-none"
                              {...(item.destinationBlur ? { placeholder: 'blur' as const } : null)}
                            />
                          ) : (
                            <img
                              {...(galleryItemDims(item) ?? {})}
                              src={item.src}
                              alt={item.alt}
                              loading="eager"
                              draggable={false}
                              className="select-none"
                            />
                          )}
                        </Lightbox.Media>
                      </Lightbox.Zoom>
                    )
                  }
                </Lightbox.Item>
              </Lightbox.Slide>
            );
          })}
        </Lightbox.Slides>

        {overlay}

        {/*
          Chrome after Slides, and above snug zoomed-slide `z-20` — DOM order alone
          can’t win when a sibling slide creates a higher stacking context.
        */}
        {/*
          The app-level tooltip wrapper zeroes Base UI's delay; toolbar icons
          want the platform feel instead — first tooltip after a beat, then
          instant while moving across the group (provider-shared warm-up).
        */}
        <TooltipProvider delay={600}>
          <div
            className={`lightbox-demo-chrome-top lightbox-demo-chrome-hide absolute end-3 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-30 flex gap-2`}
          >
            {layoutToggle ? (
              /* Layout toggle. User copy: "Theater" = bleed (one wide slide),
                 "Peek" = snug (card with neighbours peeking). The icon is a
                 miniature of the CURRENT layout; the label names the TARGET. */
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      // zoom-hide: fades out while zoomed (see pull-progress.css) —
                      // toggling layouts mid-zoom would remount the track and
                      // drop the zoom pose.
                      className={`${lightboxChromeButtonMd} lightbox-demo-chrome-hide lightbox-demo-zoom-hide`}
                      aria-pressed={snug}
                      aria-label={snug ? 'Switch to theater layout' : 'Switch to peek layout'}
                      onClick={toggleSlidesLayout}
                    />
                  }
                >
                  {/* 16px like the zoom glyphs — the boxy layout glyphs read
                      heavy at the close button's 18px (the ✕ is optically
                      lighter, which is why it gets the larger size). */}
                  {snug ? (
                    <GalleryHorizontal aria-hidden className="h-4 w-4" strokeWidth={2.25} />
                  ) : (
                    <RectangleHorizontal aria-hidden className="h-4 w-4" strokeWidth={2.25} />
                  )}
                </TooltipTrigger>
                <TooltipContent side="bottom">{snug ? 'Theater' : 'Peek'}</TooltipContent>
              </Tooltip>
            ) : null}
            {zoomControls ? (
              /* Zoom −/+ share one capsule with a hairline divider. */
              <div className={lightboxChromeButtonGroup}>
                <Tooltip>
                  <TooltipTrigger
                    render={<Lightbox.ZoomOut className={lightboxChromeButtonSegment} aria-label="Zoom out" />}
                  >
                    <ZoomOut aria-hidden className="h-4 w-4" strokeWidth={2.25} />
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Zoom out</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Lightbox.ZoomIn
                        className={`${lightboxChromeButtonSegment} ${lightboxChromeSegmentDivider}`}
                        aria-label="Zoom in"
                      />
                    }
                  >
                    <ZoomIn aria-hidden className="h-4 w-4" strokeWidth={2.25} />
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Zoom in</TooltipContent>
                </Tooltip>
              </div>
            ) : null}
            <Tooltip>
              <TooltipTrigger render={<Lightbox.Close className={lightboxChromeButton} aria-label="Close" />}>
                <X aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </TooltipTrigger>
              <TooltipContent side="bottom">Close</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        <div
          className={`lightbox-demo-chrome-bottom lightbox-demo-chrome-hide${showStrip ? '' : ' lightbox-demo-chrome-bottom-solo'} pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-3 px-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]`}
        >
          {/*
            Caption under the media, placard-style, on every breakpoint. The
            counter is visible on mobile where there's no strip to show
            position; on md+ the strip covers that, so the counter collapses
            to sr-only and keeps only its aria-live announcement role.
          */}
          <div className="flex max-w-full flex-col items-center text-center">
            <Lightbox.Caption className="block max-w-full truncate text-[13px] font-medium leading-tight text-neutral-900 dark:text-neutral-50">
              {captionFallback}
            </Lightbox.Caption>
            {/* "1 of 1" is noise — skip the counter for single-item galleries. */}
            {items.length > 1 ? (
              <Lightbox.Counter className="text-[11px] leading-tight tabular-nums text-neutral-500 dark:text-neutral-400 md:sr-only">
                {({ current, total }) => `${current} of ${total}`}
              </Lightbox.Counter>
            ) : null}
          </div>
          {showStrip ? <GalleryThumbnailStrip items={items} className={thumbClass} /> : null}
        </div>
      </Lightbox.Content>
    </Lightbox.Portal>
  );
}


/** Hide chrome while pulling / committing pull-to-dismiss. See pull-progress.css. */
const chromePullHide = 'lightbox-demo-chrome-hide';

/**
 * Styled Backdrop — place inside the same `Lightbox.Portal` as Content/Frame.
 * Open/close + pull opacity: `.lightbox-demo-backdrop` in `app/lightbox-demo/`.
 */
export function LightboxOverlay({ className }: { className?: string } = {}) {
  return <Lightbox.Backdrop className={`lightbox-demo-backdrop fixed inset-0 bg-black/85 ${className ?? ''}`} />;
}

/**
 * Styled Content shell. Place inside `Lightbox.Portal` (with Overlay/Backdrop as a
 * sibling when you want a scrim). Open/close fade: `.lightbox-demo-content`.
 */
export function LightboxFrame({
  children,
  ariaLabel,
  className,
}: {
  children: React.ReactNode;
  ariaLabel: string;
  /**
   * Overrides the default `flex flex-col items-center justify-between`
   * layout. Useful when the content is e.g. a `Lightbox.Slides` scroller
   * that should stretch to fill the frame.
   */
  className?: string;
}) {
  return (
    <Lightbox.Content
      aria-label={ariaLabel}
      className={
        className
          ? `lightbox-demo-content fixed inset-0 overscroll-contain outline-none ${className}`
          : 'lightbox-demo-content fixed inset-0 flex flex-col items-center justify-between overscroll-contain outline-none'
      }
    >
      {children}
    </Lightbox.Content>
  );
}

export function LightboxCloseButton() {
  return (
    <div className={`absolute end-4 top-4 z-10 ${chromePullHide}`}>
      <Lightbox.Close className={lightboxChromeButton} aria-label="Close">
        <X aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.25} />
      </Lightbox.Close>
    </div>
  );
}

export function LightboxPrevButton() {
  return (
    <Lightbox.Previous className={lightboxChromeButton} aria-label="Previous">
      <ChevronLeft aria-hidden className="h-5 w-5" strokeWidth={2.25} />
    </Lightbox.Previous>
  );
}

export function LightboxNextButton() {
  return (
    <Lightbox.Next className={lightboxChromeButton} aria-label="Next">
      <ChevronRight aria-hidden className="h-5 w-5" strokeWidth={2.25} />
    </Lightbox.Next>
  );
}

export function LightboxCounterPill() {
  return <Lightbox.Counter className="min-w-[3.5rem] text-center font-mono text-sm tabular-nums text-white/70" />;
}

export function LightboxCaptionLine() {
  return (
    <Lightbox.Caption className="block min-h-[1.5rem] max-w-full truncate px-6 pb-4 text-center text-sm text-white/80" />
  );
}

export function LightboxNavBar() {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${chromePullHide}`}>
      <LightboxPrevButton />
      <LightboxCounterPill />
      <LightboxNextButton />
    </div>
  );
}

/**
 * Keyboard focus ring for a `Lightbox.Trigger`. Purely a demo affordance — the
 * headless library ships no trigger styling — so it lives here rather than in
 * `app/lightbox-demo/` (which is reserved for styles the lightbox needs to work).
 * `outline` (not `ring`) so the radius follows each trigger's own
 * `border-radius`, matching the rounded image it wraps.
 */
export const triggerFocusClass =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500';

export function LightboxTriggerGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid max-w-md grid-cols-3 gap-3">{children}</div>;
}

export function LightboxTriggerImage({
  src,
  alt,
  className,
}: {
  src: LightboxImageSource;
  alt: string;
  className?: string;
}) {
  // Grab `imageRef` from the enclosing Lightbox.Trigger so this thumbnail
  // becomes the flash-free placeholder source for the item it opens — no render
  // prop threading required.
  const trigger = useLightboxTriggerContext();
  if (typeof src === 'object') {
    // Trigger thumb: blur-up LQIP is fine here (guide: blur on triggers only).
    return (
      <Image
        ref={trigger?.imageRef}
        src={src}
        alt={alt}
        placeholder="blur"
        sizes="140px"
        className={className ?? 'block h-28 w-full rounded-2xl object-cover'}
      />
    );
  }
  return (
    <img
      ref={trigger?.imageRef}
      {...imgDims(src)}
      src={src}
      alt={alt}
      className={className ?? 'block h-28 w-full rounded-2xl object-cover'}
    />
  );
}
