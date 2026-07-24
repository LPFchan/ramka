'use client';

import * as React from 'react';
import { flushSync } from 'react-dom';
import { Lightbox, useLightboxContext, useLightboxTriggerContext } from 'ramka';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';

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
 *   - backdrop opacity        --duration-open ease-out-expo
 *   - content opacity         --duration-open ease-out-expo
 *   - VT root + morph group   --duration-open (see view-transitions.css)
 *   - morph-target hide       200ms ease-out-expo (see triggerMorphHideClass)
 *   - active item fade-in     250ms ease-out (keyframe in globals.css)
 *
 * The open/close choreography (backdrop, content, VT root cross-fade, morph)
 * all share the single `--duration-open` token (motion.css) so they resolve as
 * one cohesive motion — tweak it once and everything stays in lockstep.
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
export function imgDims(url: string) {
  const m = url.match(/\/(\d+)\/(\d+)$/);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : undefined;
}

/** Intrinsic aspect ratio (w/h) from the URL, falling back to 16/9. */
export function imgAspect(url: string): number {
  const d = imgDims(url);
  return d ? d.width / d.height : 16 / 9;
}

export type LightboxGalleryItem = {
  id?: string | number;
  src: string;
  thumb: string;
  alt: string;
  caption?: string;
};

type GalleryItemRenderCtx = {
  imageRef: (node: HTMLImageElement | null) => void;
  morphRef: (node: HTMLElement | null) => void;
};

/**
 * Default product chrome for docs/examples — responsive-gallery viewer:
 * light pull-fade Backdrop, Slides + Zoom, Counter (top-left), Close/ZoomIn/
 * ZoomOut, Caption + desktop thumbnails. Place beside Triggers under
 * `Lightbox.Root` (does not render Root or Triggers).
 */
export function LightboxGallery({
  items,
  ariaLabel,
  preload = 2,
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
  renderItem,
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
  renderItem?: (item: LightboxGalleryItem, index: number, ctx: GalleryItemRenderCtx) => React.ReactNode;
}) {
  // Viewport visibility only — layout/scroll-link live in filmstrip-scroll-link.css.
  const thumbClass =
    thumbnails === 'never'
      ? 'hidden'
      : thumbnails === 'always'
        ? 'pointer-events-auto lightbox-demo-filmstrip'
        : 'pointer-events-auto hidden md:block lightbox-demo-filmstrip';

  const backdropTone = backdrop === 'solid' ? 'bg-white dark:bg-black' : 'lightbox-demo-backdrop-light';

  return (
    <Lightbox.Portal>
      <Lightbox.Backdrop className={`lightbox-demo-backdrop ${backdropTone} fixed inset-0`} />
      <Lightbox.Content
        aria-label={ariaLabel}
        pullToClose={pullToClose}
        className="lightbox-demo-content fixed inset-0 flex flex-col overscroll-contain outline-none"
      >
        <Lightbox.Slides
          aria-label="Full-size images"
          preload={preload}
          className="lightbox-demo-slides flex-1 gap-5 [&::-webkit-scrollbar]:hidden md:gap-0"
        >
          {items.map((item, i) => (
            <Lightbox.Slide key={item.id ?? i} className="relative h-full">
              <Lightbox.Item index={i} caption={item.caption ?? item.alt} className="relative size-full">
                {({ imageRef, morphRef }) =>
                  renderItem ? (
                    renderItem(item, i, { imageRef, morphRef })
                  ) : (
                    <Lightbox.Zoom
                      maxZoom={maxZoom}
                      className="px-0 pt-[calc(env(safe-area-inset-top,0px)+3.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+3.5rem)] md:px-8 md:pt-[calc(env(safe-area-inset-top,0px)+3.5rem)] md:pb-[calc(env(safe-area-inset-bottom,0px)+7.5rem)]"
                    >
                      {/* Radius/overflow are cosmetic on Media; width/height are structural. */}
                      <Lightbox.Media {...imgDims(item.src)} className="overflow-hidden rounded-none md:rounded-lg">
                        <img
                          {...imgDims(item.src)}
                          src={item.src}
                          alt={item.alt}
                          loading="eager"
                          draggable={false}
                          className="select-none"
                        />
                      </Lightbox.Media>
                    </Lightbox.Zoom>
                  )
                }
              </Lightbox.Item>
            </Lightbox.Slide>
          ))}
        </Lightbox.Slides>

        <div
          className={`absolute left-3 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-10 ${chromePullHide} max-md:[[data-zoomed]_&]:pointer-events-none max-md:[[data-zoomed]_&]:opacity-0 max-md:[[data-zoomed]_&]:blur-[6px]`}
        >
          <Lightbox.Counter className="min-w-[3.5rem] font-mono text-sm tabular-nums text-black/70 dark:text-white/70" />
        </div>

        <div
          className={`absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-10 flex gap-2 ${chromePullHide} max-md:[[data-zoomed]_&]:pointer-events-none max-md:[[data-zoomed]_&]:opacity-0 max-md:[[data-zoomed]_&]:blur-[6px]`}
        >
          {zoomControls ? (
            <>
              <Lightbox.ZoomOut className={lightboxChromeButtonMd} aria-label="Zoom out">
                <ZoomOut aria-hidden className="h-4 w-4" strokeWidth={2.25} />
              </Lightbox.ZoomOut>
              <Lightbox.ZoomIn className={lightboxChromeButtonMd} aria-label="Zoom in">
                <ZoomIn aria-hidden className="h-4 w-4" strokeWidth={2.25} />
              </Lightbox.ZoomIn>
            </>
          ) : null}
          <Lightbox.Close className={lightboxChromeButton} aria-label="Close">
            <X aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </Lightbox.Close>
        </div>

        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 px-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] transition-[opacity,filter] duration-200 [[data-zoomed]_&]:opacity-0 [[data-zoomed]_&]:blur-[6px] ${chromePullHide}`}
        >
          <Lightbox.Caption className="pointer-events-auto block min-h-[1.25rem] max-w-full truncate px-6 text-center text-sm text-black/70 dark:text-white/80" />

          {thumbnails !== 'never' ? (
            <GalleryThumbnailStrip items={items} className={thumbClass} />
          ) : null}
        </div>
      </Lightbox.Content>
    </Lightbox.Portal>
  );
}

/** True when slides can drive the filmstrip via a named scroll timeline. */
function supportsFilmstripScrollLink(): boolean {
  return typeof CSS !== 'undefined' && CSS.supports('animation-timeline', 'scroll()');
}

function filmstripThumbStepPx(strip: HTMLElement): number {
  const step = getComputedStyle(strip).getPropertyValue('--thumb-step').trim() || '4rem';
  if (step.endsWith('rem')) {
    const rem = Number.parseFloat(step);
    const rootPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    return rem * rootPx;
  }
  return Number.parseFloat(step) || 64;
}

function readTranslateX(el: HTMLElement): number {
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return 0;
  return new DOMMatrix(t).m41;
}

/**
 * Drop WAAPI + inline overrides so the CSS scroll-timeline owns `transform`
 * again. `fill: forwards` keeps applying until the Animation is cancelled.
 */
function releaseFilmstripTrack(track: HTMLElement, anim?: Animation | null) {
  anim?.cancel();
  track.style.removeProperty('animation');
  track.style.removeProperty('transform');
}

/**
 * Demo-only filmstrip (not part of ramka):
 * - Enhanced: track `translateX` is scroll-timeline-linked to Lightbox.Slides
 *   (Slides is the only scroller; strip is display-only + tap targets).
 * - Thumb click → `setActiveIndex('thumbnail')` + WAAPI scrub on the track
 *   (no document VT — strip stays clickable for rapid +1 taps).
 * - Fallback: overflow strip + scrollIntoView on `data-active`.
 */
function GalleryThumbnailStrip({
  items,
  className,
}: {
  items: LightboxGalleryItem[];
  className: string;
}) {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const groupRef = React.useRef<HTMLDivElement>(null);
  const scrubAnimRef = React.useRef<Animation | null>(null);
  const { activeIndex, setActiveIndex, navigationLockedRef } = useLightboxContext();
  const activeIndexRef = React.useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const linked = supportsFilmstripScrollLink();

  const endTrackScrub = React.useCallback(() => {
    const track = groupRef.current;
    const anim = scrubAnimRef.current;
    scrubAnimRef.current = null;
    if (track) releaseFilmstripTrack(track, anim);
  }, []);

  React.useEffect(() => {
    return () => endTrackScrub();
  }, [endTrackScrub]);

  /**
   * Same as `Lightbox.Thumbnail` → `setActiveIndex`. When scroll-linked, briefly
   * detaches the track from the timeline and WAAPI-scrubs `translateX` so rapid
   * taps stay interactive (document VT would cover the strip for the duration).
   */
  const goToIndex = React.useCallback(
    (index: number) => {
      if (index === activeIndexRef.current || navigationLockedRef.current) return;

      const commit = () => {
        flushSync(() => {
          setActiveIndex(index, 'thumbnail');
        });
        activeIndexRef.current = index;
      };

      const strip = viewportRef.current;
      const track = groupRef.current;
      const reduceMotion =
        typeof matchMedia === 'function' &&
        matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!linked || reduceMotion || !strip || !track || typeof track.animate !== 'function') {
        commit();
        return;
      }

      const prev = scrubAnimRef.current;
      if (prev) {
        try {
          prev.commitStyles();
        } catch {
          /* commitStyles unsupported / nothing to commit */
        }
        prev.cancel();
        scrubAnimRef.current = null;
      }

      const step = filmstripThumbStepPx(strip);
      const fromX = readTranslateX(track);
      const toX = -index * step;

      // Hold the visual position while Slides jumps underneath.
      track.style.setProperty('animation', 'none');
      track.style.transform = `translateX(${fromX}px)`;
      commit();

      if (Math.abs(fromX - toX) < 0.5) {
        endTrackScrub();
        return;
      }

      const anim = track.animate(
        [{ transform: `translateX(${fromX}px)` }, { transform: `translateX(${toX}px)` }],
        {
          duration: 450,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'forwards',
        },
      );
      scrubAnimRef.current = anim;
      void anim.finished.then(
        () => {
          if (scrubAnimRef.current !== anim) return;
          endTrackScrub();
        },
        () => {
          /* cancelled by a newer scrub — next goToIndex owns styles */
        },
      );
    },
    [linked, navigationLockedRef, setActiveIndex, endTrackScrub],
  );

  // Fallback only: center the active thumb when the stage index changes.
  React.useLayoutEffect(() => {
    if (linked) return;
    const root = groupRef.current;
    if (!root) return;
    root
      .querySelector<HTMLElement>('[role="tab"][data-active]')
      ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'auto' });
  }, [linked]);

  React.useEffect(() => {
    if (linked) return;
    const root = groupRef.current;
    if (!root) return;
    const scrollActiveIntoView = () => {
      root
        .querySelector<HTMLElement>('[role="tab"][data-active]')
        ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    };
    const mo = new MutationObserver(scrollActiveIntoView);
    mo.observe(root, { attributes: true, attributeFilter: ['data-active'], subtree: true });
    return () => mo.disconnect();
  }, [linked]);

  // Capture-phase: same navigation as Thumbnail, plus linked WAAPI scrub.
  React.useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const onClickCapture = (e: MouseEvent) => {
      const tab = (e.target as Element | null)?.closest?.('[role="tab"]');
      if (!tab || !group.contains(tab)) return;
      const index = Number(tab.getAttribute('data-index'));
      if (!Number.isFinite(index)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      goToIndex(index);
    };
    group.addEventListener('click', onClickCapture, true);
    return () => group.removeEventListener('click', onClickCapture, true);
  }, [goToIndex, items.length]);

  return (
    <div ref={viewportRef} className={className}>
      {/* Clip/scroll the track; frame stays a sibling so outline-offset isn't clipped. */}
      <div className="lightbox-demo-filmstrip-clip">
        <Lightbox.ThumbnailGroup
          ref={groupRef}
          aria-label="Photo thumbnails"
          className="lightbox-demo-filmstrip-track"
          style={
            {
              ['--thumb-count' as string]: String(Math.max(items.length, 1)),
            } as React.CSSProperties
          }
        >
          {items.map((item, i) => (
            <Lightbox.Thumbnail
              key={item.id ?? i}
              index={i}
              // Selection chrome is the stationary center frame only.
              className="size-14 shrink-0 rounded-md p-0"
            >
              <img
                {...imgDims(item.thumb)}
                src={item.thumb}
                alt={item.alt}
                className="pointer-events-none size-full rounded-[inherit] object-cover"
              />
            </Lightbox.Thumbnail>
          ))}
        </Lightbox.ThumbnailGroup>
      </div>
      <span aria-hidden className="lightbox-demo-filmstrip-frame" />
    </div>
  );
}

/** Hide chrome while pulling / committing pull-to-dismiss. */
const chromePullHide =
  'transition-[opacity,filter] duration-200 [[data-pulling]_&]:pointer-events-none [[data-pulling]_&]:opacity-0 [[data-pulling]_&]:blur-[6px] [[data-pull-dismissing]_&]:pointer-events-none [[data-pull-dismissing]_&]:opacity-0 [[data-pull-dismissing]_&]:blur-[6px]';

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
    <div className={`absolute right-4 top-4 z-10 ${chromePullHide}`}>
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
 * Wrapper around `Lightbox.ItemGroup` that stacks items absolutely and
 * uses `aria-hidden` / `data-active` to swap the visible item. The
 * fade-in keyframe is loaded from globals.css and is suppressed while
 * a view transition is in flight.
 */
export function StackedItemGroup({ children, className, ...rest }: React.ComponentProps<typeof Lightbox.ItemGroup>) {
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
 * applied via globals.css using `[data-ramka-item][data-active]:not([data-skip-fade])`
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
 * in the root snapshot. Prefer {@link morphHideClass} when only a child
 * designated via `morphRef` should disappear (e.g. a swatch + label card).
 */
export const triggerMorphHideClass =
  'transition-opacity duration-[200ms] ease-out-expo data-[morph-target]:opacity-0 [:root[data-ramka-view-transition]_&]:transition-none';

/**
 * Consumer-side hide for the morph *child* only. Apply to the element that
 * carries `morphRef` (or its media wrapper) so chrome around it — titles,
 * labels, captions — stays visible while the lightbox is open.
 */
export const morphHideClass =
  'transition-opacity duration-[200ms] ease-out-expo in-data-morph-target:opacity-0 [:root[data-ramka-view-transition]_&]:transition-none';

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

export function LightboxTriggerImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  // Grab `imageRef` from the enclosing Lightbox.Trigger so this thumbnail
  // becomes the flash-free placeholder source for the item it opens — no render
  // prop threading required.
  const trigger = useLightboxTriggerContext();
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
