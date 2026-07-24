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

/**
 * TEMP — force the non-CSS (JS scroll→transform sync) path on every browser.
 * Set false to restore CSS timeline when supported.
 */
const FORCE_FILMSTRIP_OVERFLOW_FALLBACK = false;

/** True when CSS scroll-driven animations can own the filmstrip link. */
function supportsCssFilmstripScrollLink(): boolean {
  return typeof CSS !== 'undefined' && CSS.supports('animation-timeline', 'scroll()');
}

/** One-shot diagnostics — remove once filmstrip paths are confirmed. */
function logFilmstripTimelineSupport(path: 'css-timeline' | 'js-sync') {
  if (typeof window === 'undefined') return;
  const w = window as Window & { __ramkaFilmstripTimelineLogged?: boolean };
  if (w.__ramkaFilmstripTimelineLogged) return;
  w.__ramkaFilmstripTimelineLogged = true;

  const css = typeof CSS !== 'undefined' ? CSS : null;
  console.log('[ramka filmstrip] animation-timeline support', {
    path,
    forceJsSync: FORCE_FILMSTRIP_OVERFLOW_FALLBACK,
    isFirefox: typeof navigator !== 'undefined' && /Firefox\//.test(navigator.userAgent),
    'CSS.supports(animation-timeline, scroll())': css?.supports('animation-timeline', 'scroll()') ?? null,
    'CSS.supports(animation-timeline: scroll())': css?.supports('animation-timeline: scroll()') ?? null,
    'CSS.supports(scroll-timeline-name: --x)': css?.supports('scroll-timeline-name', '--x') ?? null,
    'CSS.supports(timeline-scope: --x)': css?.supports('timeline-scope', '--x') ?? null,
    hasScrollTimeline: 'ScrollTimeline' in window,
    userAgent: navigator.userAgent,
  });
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

/** Same geometry as Lightbox.Slides — scrollLeft that centers slide 0 + stride. */
function measureSlidesGeometry(slides: HTMLElement): { base: number; step: number; count: number } {
  const slideEls = slides.querySelectorAll<HTMLElement>('[data-ramka-slide]');
  const count = slideEls.length;
  const clientWidth = slides.clientWidth || 1;
  if (count === 0) return { base: 0, step: clientWidth, count: 0 };
  const first = slideEls[0]!;
  const width = first.offsetWidth || clientWidth;
  const base = first.offsetLeft + width / 2 - clientWidth / 2;
  const step = count > 1 ? slideEls[1]!.offsetLeft - first.offsetLeft : clientWidth;
  return { base, step: step > 0 ? step : clientWidth, count };
}

/**
 * Demo-only filmstrip (not part of ramka):
 * - Chromium/WebKit: track `translateX` via CSS scroll-timeline on Slides.
 * - No CSS SDA (Firefox / forced): same non-scrolling midline layout, transform
 *   synced continuously from Slides scroll in JS (swipe-smooth; keyboard jumps
 *   with the stage).
 * - Thumb click → `setActiveIndex('thumbnail')` + WAAPI scrub + slides
 *   crossfade via element-scoped VT when available (Safari: hard-cut slides).
 *
 * `FORCE_FILMSTRIP_OVERFLOW_FALLBACK` currently forces the JS-sync path everywhere.
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
  const syncFromScrollRef = React.useRef<(() => void) | null>(null);
  /** Bumps when a scrub starts/ends so deferred bridge clears can't clobber a newer scrub. */
  const scrubEpochRef = React.useRef(0);
  const { activeIndex, setActiveIndex, navigationLockedRef } = useLightboxContext();
  const activeIndexRef = React.useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const cssTimeline =
    !FORCE_FILMSTRIP_OVERFLOW_FALLBACK && supportsCssFilmstripScrollLink();
  // Always a linked (non-scrolling) strip — CSS timeline or JS scroll sync.
  const linked = true;
  const jsLinked = !cssTimeline;
  logFilmstripTimelineSupport(jsLinked ? 'js-sync' : 'css-timeline');

  const getSlides = React.useCallback((): HTMLElement | null => {
    const viewport = viewportRef.current;
    if (!viewport) return null;
    return (
      viewport.closest('.lightbox-demo-content')?.querySelector<HTMLElement>('.lightbox-demo-slides') ??
      viewport.closest('[role="dialog"]')?.querySelector<HTMLElement>('[aria-roledescription="carousel"]') ??
      null
    );
  }, []);

  /**
   * JS sync path: drive track translate from Slides scroll using lightbox
   * base/step (progress 0→1 over the index range). Skipped while WAAPI scrub
   * owns the transform.
   */
  React.useLayoutEffect(() => {
    if (!jsLinked) return;
    const track = groupRef.current;
    const strip = viewportRef.current;
    const slides = getSlides();
    if (!track || !strip || !slides) return;

    let base = 0;
    let step = 1;
    let count = 1;

    const measure = () => {
      const g = measureSlidesGeometry(slides);
      base = g.base;
      step = g.step;
      count = g.count;
    };

    const sync = () => {
      if (scrubAnimRef.current) return;
      const travel = Math.max(0, count - 1) * filmstripThumbStepPx(strip);
      const logicalMax = Math.max(0, count - 1) * step;
      const t =
        logicalMax <= 0
          ? 0
          : Math.min(1, Math.max(0, (slides.scrollLeft - base) / logicalMax));
      track.style.transform = `translate3d(${-t * travel}px, 0, 0)`;
    };

    syncFromScrollRef.current = sync;
    measure();
    sync();

    const onScroll = () => sync();
    slides.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(() => {
      measure();
      sync();
    });
    ro.observe(slides);

    return () => {
      syncFromScrollRef.current = null;
      slides.removeEventListener('scroll', onScroll);
      ro.disconnect();
      track.style.removeProperty('transform');
    };
  }, [jsLinked, getSlides, items.length]);

  /**
   * Hand the track back after WAAPI scrub.
   * - CSS timeline path: bridge transform until the timeline reattaches (Safari).
   * - JS sync path: drop WAAPI and re-sync from scroll.
   */
  const endTrackScrub = React.useCallback(() => {
    const track = groupRef.current;
    const anim = scrubAnimRef.current;
    scrubAnimRef.current = null;
    if (!track) return;

    if (jsLinked) {
      anim?.cancel();
      syncFromScrollRef.current?.();
      return;
    }

    const bridgeX = readTranslateX(track);
    try {
      anim?.commitStyles();
    } catch {
      /* commitStyles unsupported */
    }
    anim?.cancel();

    const epoch = scrubEpochRef.current;
    track.style.transform = `translate3d(${bridgeX}px, 0, 0)`;
    track.style.removeProperty('animation');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (epoch !== scrubEpochRef.current) return;
        if (scrubAnimRef.current) return;
        track.style.removeProperty('transform');
      });
    });
  }, [jsLinked]);

  React.useEffect(() => {
    return () => {
      scrubEpochRef.current += 1;
      const track = groupRef.current;
      const anim = scrubAnimRef.current;
      scrubAnimRef.current = null;
      anim?.cancel();
      if (track) {
        track.style.removeProperty('animation');
        track.style.removeProperty('transform');
      }
    };
  }, []);

  /**
   * Same as `Lightbox.Thumbnail` → `setActiveIndex`, plus docs-only motion:
   * slides crossfade (VT) and filmstrip WAAPI scrub. Mid-fling taps respect
   * the library nav lock.
   *
   * Safari drops the first frames if `animation: none` runs before a hold
   * transform (timeline keyframe 0 flashes). Order: sample → pin transform →
   * kill CSS animation → paused WAAPI at fromX → commit slides → play.
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
      const slides = getSlides();
      const reduceMotion =
        typeof matchMedia === 'function' &&
        matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (reduceMotion) {
        commit();
        return;
      }

      let scrub: Animation | null = null;

      if (linked && strip && track && typeof track.animate === 'function') {
        scrubEpochRef.current += 1; // invalidate any pending release bridge clear
        const prev = scrubAnimRef.current;
        if (prev) {
          try {
            prev.commitStyles();
          } catch {
            /* */
          }
          prev.cancel();
          scrubAnimRef.current = null;
        }

        // Sample while CSS timeline / JS sync still owns the transform.
        const fromX = readTranslateX(track);
        const toX = -index * filmstripThumbStepPx(strip);

        // Pin hold. CSS timeline path: then `animation: none` (Safari flashes
        // keyframe 0 if those are reversed). JS path: no CSS animation.
        track.style.transform = `translate3d(${fromX}px, 0, 0)`;
        if (!jsLinked) track.style.setProperty('animation', 'none');

        if (Math.abs(fromX - toX) >= 0.5) {
          // WAAPI owns the hold before slides jump (paused on the first keyframe).
          scrub = track.animate(
            [
              { transform: `translate3d(${fromX}px, 0, 0)` },
              { transform: `translate3d(${toX}px, 0, 0)` },
            ],
            {
              duration: 450,
              easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
              fill: 'forwards',
            },
          );
          scrub.pause();
          scrub.currentTime = 0;
          scrubAnimRef.current = scrub;
          void scrub.finished.then(
            () => {
              if (scrubAnimRef.current !== scrub) return;
              endTrackScrub();
            },
            () => {
              /* cancelled by a newer scrub — next goToIndex owns styles */
            },
          );
        }
      }

      // Slides crossfade only via *element-scoped* VT. Document VT (Safari's
      // path today) snapshots the whole page — hiding root to keep the strip
      // live flashes the lightbox. No scoped API → hard-cut slides + WAAPI strip.
      type VTHost = { startViewTransition: (cb: () => void) => unknown };
      if (slides && typeof (slides as HTMLElement & VTHost).startViewTransition === 'function') {
        (slides as HTMLElement & VTHost).startViewTransition(commit);
      } else {
        commit();
      }

      if (scrub) scrub.play();
      else if (linked && track) endTrackScrub();
    },
    [linked, jsLinked, navigationLockedRef, setActiveIndex, endTrackScrub, getSlides],
  );

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

  // Linked strip is never a scrollport — kill wheel/trackpad just in case.
  React.useEffect(() => {
    const clip = viewportRef.current?.querySelector('.lightbox-demo-filmstrip-clip');
    if (!clip) return;
    const prevent = (e: Event) => e.preventDefault();
    clip.addEventListener('wheel', prevent, { passive: false });
    clip.addEventListener('touchmove', prevent, { passive: false });
    return () => {
      clip.removeEventListener('wheel', prevent);
      clip.removeEventListener('touchmove', prevent);
    };
  }, []);

  return (
    <div
      ref={viewportRef}
      className={[
        className,
        'lightbox-demo-filmstrip--linked',
        jsLinked ? 'lightbox-demo-filmstrip--js-link' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Clip the track; frame stays a sibling so outline-offset isn't clipped. */}
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
