'use client';

import { Lightbox, useLightboxItemContext, useLightboxTriggerContext } from 'ramka';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

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
 *   - backdrop opacity        340ms ease-out-expo
 *   - content opacity         280ms ease-out-expo
 *   - morph-target hide       200ms ease-out-expo (see triggerMorphHideClass)
 *   - active item fade-in     250ms ease-out (keyframe in globals.css)
 *
 * The `ease-out-expo` token and `animate-lightbox-item-fade-in` utility
 * are defined in `globals.css` via Tailwind v4's `@theme`. The View
 * Transition pseudo-elements (morph group, root cross-fade) are also
 * styled in globals.css since UA pseudo-elements aren't reachable from
 * className-based Tailwind utilities.
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
  'hover:bg-white/65 active:scale-[0.96] active:bg-white/75 ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-black/25 ' +
  'disabled:cursor-not-allowed disabled:opacity-30 disabled:active:scale-100 ' +
  'dark:border-white/25 dark:bg-neutral-900/45 dark:text-white ' +
  // 0.5px black outline (via shadow so it follows the circle) + crisp drop shadow.
  'dark:shadow-[0_0_0_0.5px_#000,0_0.5px_1px_rgba(0,0,0,0.45),0_1px_2px_rgba(0,0,0,0.35),inset_0_0.5px_0_rgba(255,255,255,0.14)] ' +
  'dark:hover:bg-neutral-900/55 dark:active:bg-neutral-900/65 dark:focus-visible:ring-white/40';

/** Glass control hidden below `md` (zoom in/out — pinch covers mobile). */
export const lightboxChromeButtonMd = `hidden md:inline-flex ${lightboxChromeButton.replace('inline-flex ', '')}`;

/**
 * Intrinsic pixel dimensions encoded in a picsum URL (`…/{width}/{height}`).
 * Spread onto `<img>` as `width`/`height` so the box (and aspect ratio) is
 * reserved before the pixels load — which keeps the morph target sized on slow
 * connections and prevents layout shift.
 */
function imgDims(url: string) {
  const m = url.match(/\/(\d+)\/(\d+)$/);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : undefined;
}

/** Intrinsic aspect ratio (w/h) from the URL, falling back to 16/9. */
function imgAspect(url: string): number {
  const d = imgDims(url);
  return d ? d.width / d.height : 16 / 9;
}

/**
 * Wrapper style for the "largest rectangle of the given aspect ratio that fits
 * inside the container" trick. The parent must set `container-type: size` so
 * `cqw`/`cqh` resolve to its box. The wrapper's width is the smaller of the
 * full container width and the width that would make its height equal the
 * container height; `aspect-ratio` then derives a height that never exceeds it.
 * `--lb-inset-w`/`--lb-inset-h` (default 0) leave room for overlapping chrome.
 *
 * This keeps the box correctly sized *before the image loads* — unlike
 * `size: auto`, which collapses an unloaded `<img>` to 0×0 and would skip the
 * open morph on a slow connection. Sizing lives here, in consumer code — the
 * lightbox primitives stay headless and never impose layout.
 */
function fitBoxStyle(ratio: number): React.CSSProperties {
  return {
    width: `min(calc(100cqw - var(--lb-inset-w, 0px)), calc((100cqh - var(--lb-inset-h, 0px)) * ${ratio}))`,
    aspectRatio: `${ratio}`,
  };
}

const fadeBase = 'opacity-0 ease-out-expo data-[open]:opacity-100 starting:opacity-0';

// The backdrop derives its open opacity from the `--lightbox-pull-progress`
// variable the pull-to-dismiss gesture publishes (0 at rest → 1 at the
// dismiss threshold), and suppresses the transition while `data-pulling` so
// the scrim tracks the finger 1:1. On release the variable resets to 0 and
// `data-pulling` is dropped, so this transition eases the scrim back.
const backdropFade =
  'opacity-0 ease-out-expo duration-[340ms] transition-opacity data-[open]:[opacity:calc(1_-_var(--lightbox-pull-progress,0)_*_0.6)] data-pulling:transition-none starting:opacity-0';
const contentFade = `${fadeBase} duration-[280ms] transition-opacity`;

export function LightboxOverlay({ className }: { className?: string } = {}) {
  return <Lightbox.Backdrop className={`fixed inset-0 z-40 bg-black/85 ${backdropFade} ${className ?? ''}`} />;
}

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
          ? `fixed inset-0 z-50 overscroll-contain outline-none ${contentFade} ${className}`
          : `fixed inset-0 z-50 flex flex-col items-center justify-between overscroll-contain outline-none ${contentFade}`
      }
    >
      {children}
    </Lightbox.Content>
  );
}

export function LightboxCloseButton() {
  return (
    <div className="absolute right-4 top-4 z-10">
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
  return (
    <Lightbox.Counter className="min-w-[3.5rem] text-center font-mono text-sm tabular-nums text-white/70" />
  );
}

export function LightboxCaptionLine() {
  return (
    <Lightbox.Caption className="block min-h-[1.5rem] max-w-full truncate px-6 pb-4 text-center text-sm text-white/80" />
  );
}

export function LightboxNavBar() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <LightboxPrevButton />
      <LightboxCounterPill />
      <LightboxNextButton />
    </div>
  );
}

/**
 * Wrapper around `Lightbox.ItemGroup` that stacks items absolutely and
 * uses `aria-hidden` / `data-active` to swap the visible item. The
 * fade-in keyframe is loaded from globals.css and is suppressed while
 * a view transition is in flight.
 */
export function StackedItemGroup({
  children,
  className,
  ...rest
}: React.ComponentProps<typeof Lightbox.ItemGroup>) {
  return (
    <Lightbox.ItemGroup
      {...rest}
      className={`relative flex w-full flex-1 items-center justify-center overflow-hidden ${className ?? ''}`}
    >
      {children}
    </Lightbox.ItemGroup>
  );
}

/**
 * Per-item class for stacked layouts. The active-item fade-in is
 * applied via globals.css using `[data-lightbox-item][data-active]:not([data-skip-fade])`
 * rather than a Tailwind `data-[active]:` utility, so that the library's
 * `data-skip-fade` flag (set on the View Transition destination item
 * during open) suppresses the entrance fade — otherwise the fade would
 * re-play once the VT layer is torn down and produce a visible flash.
 */
export const stackedItemClass =
  'absolute inset-0 flex items-center justify-center aria-hidden:invisible data-[active]:visible';

/**
 * Consumer-side hide for a trigger that *is* the morph element (image-only
 * tiles). Fades the whole trigger while it's `data-morph-target`, and kills
 * the transition during a View Transition so the fade isn't captured mid-flight
 * in the root snapshot. Prefer {@link morphElementHideClass} when only a child
 * designated via `morphElementRef` should disappear (e.g. a swatch + label card).
 */
export const triggerMorphHideClass =
  'transition-opacity duration-[200ms] ease-out-expo data-[morph-target]:opacity-0 [:root[data-lightbox-view-transition]_&]:transition-none';

/**
 * Consumer-side hide for the morph *child* only. Apply to the element that
 * carries `morphElementRef` (or its media wrapper) so chrome around it — titles,
 * labels, captions — stays visible while the lightbox is open.
 */
export const morphElementHideClass =
  'transition-opacity duration-[200ms] ease-out-expo in-data-morph-target:opacity-0 [:root[data-lightbox-view-transition]_&]:transition-none';

/**
 * Keyboard focus ring for a `Lightbox.Trigger`. Purely a demo affordance — the
 * headless library ships no trigger styling — so it lives here rather than in
 * lightbox-demo.css (which is reserved for styles the lightbox needs to work).
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
  src: string;
  alt: string;
  className?: string;
}) {
  // Grab `triggerImageRef` from the enclosing Lightbox.Trigger so this thumbnail
  // becomes the flash-free placeholder source for the item it opens — no render
  // prop threading required.
  const trigger = useLightboxTriggerContext();
  return (
    <img
      ref={trigger?.triggerImageRef}
      {...imgDims(src)}
      src={src}
      alt={alt}
      className={
        className ?? 'block h-28 w-full rounded-2xl object-cover'
      }
    />
  );
}

export function LightboxFullImage({ src, alt }: { src: string; alt: string }) {
  // Consumer owns layout: the container establishes the query context and the
  // fit-box reserves the aspect-ratio box before load. `imageRef` (from the
  // enclosing Lightbox.Item) marks this as the morph destination and lets the
  // open transition bridge the blank frame with the trigger's thumbnail until
  // the pixels arrive.
  const item = useLightboxItemContext();
  return (
    <div className="flex h-full w-full items-center justify-center [container-type:size] [--lb-inset-h:2rem] [--lb-inset-w:2rem]">
      <div className="relative shrink-0" style={fitBoxStyle(imgAspect(src))}>
        <img
          ref={item?.imageRef}
          {...imgDims(src)}
          src={src}
          alt={alt}
          loading="eager"
          className="h-full w-full rounded-lg object-contain"
        />
      </div>
    </div>
  );
}
