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
  /**
   * Optional intrinsic pixel size. Used for snug slide sizing + filmstrip
   * aspect when `src` is not a `…/{w}/{h}` URL (video posters, 3D screenshots).
   */
  width?: number;
  height?: number;
};

/** Aspect from explicit dims, else picsum-style URL dims, else 16/9. */
export function galleryItemAspect(item: LightboxGalleryItem): number {
  if (item.width && item.height && item.width > 0 && item.height > 0) {
    return item.width / item.height;
  }
  return imgAspect(item.src);
}

/** Resolved pixel dims for Media / snug geometry. */
export function galleryItemDims(item: LightboxGalleryItem): { width: number; height: number } | undefined {
  if (item.width && item.height && item.width > 0 && item.height > 0) {
    return { width: item.width, height: item.height };
  }
  return imgDims(item.src);
}

type GalleryItemRenderCtx = {
  imageRef: (node: HTMLImageElement | null) => void;
  morphRef: (node: HTMLElement | null) => void;
};

/** Match `Lightbox.Filmstrip` scrub defaults (track + indicator width scrub). */
const FILMSTRIP_SCRUB_MS = 450;
const FILMSTRIP_SCRUB_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

type ScrollTimelineConstructor = new (options?: {
  source?: Element | Document | null;
  axis?: 'block' | 'inline' | 'x' | 'y';
}) => AnimationTimeline;

function getScrollTimelineConstructor(): ScrollTimelineConstructor | null {
  if (typeof window === 'undefined') return null;
  const ctor = (window as Window & { ScrollTimeline?: ScrollTimelineConstructor }).ScrollTimeline;
  return typeof ctor === 'function' ? ctor : null;
}

/** Docs-local copy of ramka `slidesScrollProgress` (JS fallback). */
function demoSlidesScrollProgress(
  viewport: HTMLElement,
  geometry: { offsets?: number[]; base: number; step: number; count: number },
): number {
  const { offsets, base, step, count } = geometry;
  if (count <= 1) return 0;
  if (offsets && offsets.length === count) {
    const scroll = viewport.scrollLeft;
    const first = offsets[0]!;
    const last = offsets[count - 1]!;
    if (scroll <= first) return 0;
    if (scroll >= last) return 1;
    for (let i = 0; i < count - 1; i++) {
      const a = offsets[i]!;
      const b = offsets[i + 1]!;
      if (scroll <= b) {
        const t = (scroll - a) / (b - a || 1);
        return (i + t) / (count - 1);
      }
    }
    return 1;
  }
  const logicalMax = Math.max(0, count - 1) * step;
  if (logicalMax <= 0) return 0;
  return Math.min(1, Math.max(0, (viewport.scrollLeft - base) / logicalMax));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Equal-offset width keyframes for ScrollTimeline 0→1 (height × photo aspect). */
function morphWidthKeyframes(aspects: number[], heightPx: number): Keyframe[] {
  const max = Math.max(0, aspects.length - 1);
  const h = Math.max(1, heightPx);
  return aspects.map((aspect, i) => ({
    offset: max === 0 ? 0 : i / max,
    width: `${h * aspect}px`,
  }));
}

/**
 * Docs filmstrip: per-photo-aspect thumbs + selection frame.
 * Morph `width` is the single size owner — ScrollTimeline on swipe, pause +
 * DocumentTimeline scrub on thumb click (same handoff as the track).
 */
function GalleryFilmstrip({
  items,
  className,
}: {
  items: LightboxGalleryItem[];
  className: string;
}) {
  const { activeIndex, slidesViewportRef, slidesGeometryRef, subscribeSlidesViewport } =
    useLightboxContext();
  const filmstripRef = React.useRef<HTMLDivElement | null>(null);
  const morphRef = React.useRef<HTMLSpanElement | null>(null);
  const activeIndexRef = React.useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  const itemAspects = React.useMemo(() => items.map((item) => galleryItemAspect(item)), [items]);
  const itemAspectsRef = React.useRef(itemAspects);
  itemAspectsRef.current = itemAspects;

  const aspectLinkRef = React.useRef<Animation | null>(null);
  const aspectScrubRef = React.useRef<Animation | null>(null);
  const usesScrollTimelineRef = React.useRef(false);
  const aspectHoldRef = React.useRef(false);
  /** After thumb scrub, stay on JS width sync (Firefox ST post-jump sits at 0). */
  const aspectJsSyncOnlyRef = React.useRef(false);
  const reattachAspectRef = React.useRef<(() => void) | null>(null);
  const startAspectLinkRef = React.useRef<(force?: boolean) => boolean>(() => false);
  const syncAspectFromScrollRef = React.useRef<(() => void) | null>(null);

  React.useLayoutEffect(() => {
    let detach: (() => void) | undefined;
    let raf = 0;
    let ro: ResizeObserver | undefined;

    const writeMorphWidth = (widthPx: number) => {
      morphRef.current?.style.setProperty('width', `${widthPx}px`);
    };

    const syncFromScroll = () => {
      if (aspectHoldRef.current || aspectScrubRef.current) return;
      const morph = morphRef.current;
      const slides = slidesViewportRef.current;
      const aspects = itemAspectsRef.current;
      if (!morph || !slides || aspects.length === 0) return;
      const heightPx = morph.getBoundingClientRect().height || 56;
      const geometry = slidesGeometryRef.current;
      const progress = demoSlidesScrollProgress(slides, geometry);
      const max = Math.max(0, geometry.count - 1);
      if (max <= 0) {
        writeMorphWidth(heightPx * (aspects[0] ?? 16 / 9));
        return;
      }
      const f = progress * max;
      const i0 = Math.min(max, Math.floor(f));
      const i1 = Math.min(max, i0 + 1);
      const aspect = lerp(aspects[i0] ?? 16 / 9, aspects[i1] ?? aspects[i0] ?? 16 / 9, f - i0);
      writeMorphWidth(heightPx * aspect);
    };

    const scheduleSync = () => {
      if (raf !== 0) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        syncFromScroll();
      });
    };

    syncAspectFromScrollRef.current = syncFromScroll;

    const startAspectLink = (force = false) => {
      // Hold blocks opportunistic rebuild during thumb scrub.
      if (aspectHoldRef.current && !force) return usesScrollTimelineRef.current;

      const morph = morphRef.current;
      const slides = slidesViewportRef.current;
      const ScrollTimeline = getScrollTimelineConstructor();
      const aspects = itemAspectsRef.current;
      const geometry = slidesGeometryRef.current;
      // Equal-offset aspect keyframes assume index-linear progress; skip
      // ScrollTimeline on variable-width (snug) tracks and use JS sync.
      const uniform =
        !geometry.offsets ||
        geometry.offsets.length !== geometry.count ||
        geometry.count < 2 ||
        geometry.offsets.every(
          (offset, i) => Math.abs(offset - (geometry.base + i * geometry.step)) < 1,
        );
      if (
        aspectJsSyncOnlyRef.current ||
        !morph ||
        !slides ||
        aspects.length === 0 ||
        !ScrollTimeline ||
        !uniform ||
        typeof KeyframeEffect === 'undefined' ||
        typeof Animation === 'undefined'
      ) {
        usesScrollTimelineRef.current = false;
        return false;
      }

      const keepPaused =
        aspectScrubRef.current != null || aspectLinkRef.current?.playState === 'paused';
      aspectLinkRef.current?.cancel();
      aspectLinkRef.current = null;
      // Do not clear inline width here — scrub fill / pin covers the gap.

      const heightPx = morph.getBoundingClientRect().height || 56;
      const timeline = new ScrollTimeline({ source: slides, axis: 'x' });
      // `duration` is ignored for scroll progress; Firefox still requires a
      // non-zero value or the ScrollTimeline effect never applies after scrub.
      const effect = new KeyframeEffect(morph, morphWidthKeyframes(aspects, heightPx), {
        duration: 1,
        fill: 'both',
        easing: 'linear',
      });
      const link = new Animation(effect, timeline);
      link.play();
      if (keepPaused) link.pause();
      aspectLinkRef.current = link;
      usesScrollTimelineRef.current = true;
      // Opportunistic pin clear only when not in a scrub handoff (hold).
      void link.ready.then(() => {
        requestAnimationFrame(() => {
          if (
            aspectLinkRef.current !== link ||
            aspectScrubRef.current ||
            aspectHoldRef.current
          ) {
            return;
          }
          morph.style.removeProperty('width');
        });
      });
      return true;
    };
    startAspectLinkRef.current = startAspectLink;

    const attach = () => {
      if (aspectHoldRef.current || aspectScrubRef.current) return;

      detach?.();
      detach = undefined;
      ro?.disconnect();
      ro = undefined;

      const slides = slidesViewportRef.current;
      const morph = morphRef.current;
      if (!slides || !morph) return;

      if (startAspectLink()) {
        // Keyframes bake height×aspect → width. Only rebuild when *height*
        // changes. Observing width (or rebuilding on every RO fire) cancels the
        // ScrollTimeline mid-swipe — Safari reports RO loop errors and the
        // morph jumps instead of interpolating (Chrome often coalesces this).
        let lastLinkHeight = Math.round(morph.getBoundingClientRect().height || 56);
        let roRaf = 0;
        ro = new ResizeObserver(() => {
          if (aspectHoldRef.current || aspectScrubRef.current) return;
          if (roRaf !== 0) return;
          roRaf = requestAnimationFrame(() => {
            roRaf = 0;
            const nextH = Math.round(morph.getBoundingClientRect().height || 56);
            if (nextH === lastLinkHeight) return;
            lastLinkHeight = nextH;
            if (aspectJsSyncOnlyRef.current) {
              syncFromScroll();
              return;
            }
            startAspectLink();
          });
        });
        ro.observe(morph);
        detach = () => {
          if (roRaf !== 0) cancelAnimationFrame(roRaf);
          ro?.disconnect();
          ro = undefined;
          aspectLinkRef.current?.cancel();
          aspectLinkRef.current = null;
          usesScrollTimelineRef.current = false;
          morph.style.removeProperty('width');
        };
        return;
      }

      syncFromScroll();
      slides.addEventListener('scroll', scheduleSync, { passive: true });
      detach = () => slides.removeEventListener('scroll', scheduleSync);
    };

    reattachAspectRef.current = attach;
    aspectJsSyncOnlyRef.current = false;
    attach();
    const unsubscribe = subscribeSlidesViewport(attach);
    return () => {
      unsubscribe();
      detach?.();
      reattachAspectRef.current = null;
      syncAspectFromScrollRef.current = null;
      ro?.disconnect();
      aspectScrubRef.current?.cancel();
      aspectScrubRef.current = null;
      aspectLinkRef.current?.cancel();
      aspectLinkRef.current = null;
      usesScrollTimelineRef.current = false;
      aspectHoldRef.current = false;
      aspectJsSyncOnlyRef.current = false;
      morphRef.current?.style.removeProperty('width');
      if (raf !== 0) cancelAnimationFrame(raf);
    };
  }, [slidesViewportRef, slidesGeometryRef, subscribeSlidesViewport, itemAspects]);

  /**
   * VT on Slides + WAAPI width scrub on the morph node.
   *
   * Same handoff as the filmstrip track: cancel ScrollTimeline for the scrub,
   * then finish on the JS scroll mirror (re-arming ST after a programmatic jump
   * leaves Firefox at progress 0 / wrong width).
   */
  const wrapThumbSelectCommit = React.useCallback(
    (commit: () => void, slides: HTMLElement | null, index: number) => {
      const reduceMotion =
        typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      const morph = morphRef.current;
      const aspects = itemAspectsRef.current;
      const link = aspectLinkRef.current;

      const heightPx = morph?.getBoundingClientRect().height || 56;
      const fromWidth = morph
        ? Number.parseFloat(getComputedStyle(morph).width) || morph.getBoundingClientRect().width
        : 0;
      const toWidth = heightPx * (aspects[index] ?? aspects[activeIndexRef.current] ?? 16 / 9);

      aspectHoldRef.current = true;

      const canScrub =
        !reduceMotion &&
        morph != null &&
        typeof morph.animate === 'function' &&
        Number.isFinite(index) &&
        fromWidth > 0 &&
        Math.abs(fromWidth - toWidth) > 0.5;

      let scrub: Animation | undefined;

      if (canScrub && morph) {
        morph.style.width = `${fromWidth}px`;
        void morph.offsetWidth;
        link?.cancel();
        aspectLinkRef.current = null;
        usesScrollTimelineRef.current = false;

        aspectScrubRef.current?.cancel();
        const scrubAnim = morph.animate(
          [{ width: `${fromWidth}px` }, { width: `${toWidth}px` }],
          {
            duration: FILMSTRIP_SCRUB_MS,
            easing: FILMSTRIP_SCRUB_EASE,
            fill: 'forwards',
          },
        );
        scrubAnim.pause();
        scrubAnim.currentTime = 0;
        aspectScrubRef.current = scrubAnim;
        scrub = scrubAnim;

        const releaseToScrollLink = () => {
          if (aspectScrubRef.current !== scrubAnim) return;
          try {
            scrubAnim.commitStyles();
          } catch {
            /* commitStyles can throw if the effect was already cleared */
          }
          scrubAnim.cancel();
          aspectScrubRef.current = null;

          aspectLinkRef.current?.cancel();
          aspectLinkRef.current = null;
          usesScrollTimelineRef.current = false;
          aspectJsSyncOnlyRef.current = true;

          aspectHoldRef.current = false;
          morph.style.width = `${toWidth}px`;
          syncAspectFromScrollRef.current?.();
          reattachAspectRef.current?.();
        };

        void scrubAnim.finished.then(
          () => {
            if (aspectScrubRef.current !== scrubAnim) return;
            releaseToScrollLink();
          },
          () => {
            if (aspectScrubRef.current !== scrubAnim) return;
            scrubAnim.cancel();
            aspectScrubRef.current = null;
            aspectLinkRef.current?.cancel();
            aspectLinkRef.current = null;
            usesScrollTimelineRef.current = false;
            aspectJsSyncOnlyRef.current = true;
            aspectHoldRef.current = false;
            morph.style.width = `${toWidth}px`;
            syncAspectFromScrollRef.current?.();
            reattachAspectRef.current?.();
          },
        );
      }

      type VTHost = { startViewTransition: (cb: () => void) => unknown };
      if (
        !reduceMotion &&
        slides &&
        typeof (slides as HTMLElement & VTHost).startViewTransition === 'function'
      ) {
        (slides as HTMLElement & VTHost).startViewTransition(() => {
          flushSync(commit);
        });
      } else {
        flushSync(commit);
      }

      if (scrub) {
        scrub.play();
      } else {
        // No width delta (or reduced motion): follow the jumped scroll link.
        aspectHoldRef.current = false;
        const liveLink = aspectLinkRef.current;
        if (liveLink && usesScrollTimelineRef.current) {
          liveLink.play();
        } else if (!startAspectLinkRef.current() && morph) {
          morph.style.width = `${toWidth}px`;
        }
      }
    },
    [],
  );

  return (
    <Lightbox.Filmstrip
      ref={filmstripRef}
      className={className}
      scrubDuration={FILMSTRIP_SCRUB_MS}
      scrubEasing={FILMSTRIP_SCRUB_EASE}
      wrapSelectCommit={wrapThumbSelectCommit}
    >
      <div className="lightbox-demo-filmstrip-aspect-host">
        <Lightbox.FilmstripTrack aria-label="Photo thumbnails">
          {items.map((item, i) => (
            <Lightbox.Thumbnail
              key={item.id ?? i}
              index={i}
              style={
                {
                  ['--lightbox-demo-thumb-aspect' as string]: String(itemAspects[i] ?? 16 / 9),
                } as React.CSSProperties
              }
            >
              <img src={item.thumb} alt={item.alt} draggable={false} />
            </Lightbox.Thumbnail>
          ))}
        </Lightbox.FilmstripTrack>
        <Lightbox.FilmstripIndicator className="lightbox-demo-filmstrip-frame">
          <span ref={morphRef} className="lightbox-demo-filmstrip-frame-morph" aria-hidden />
        </Lightbox.FilmstripIndicator>
      </div>
    </Lightbox.Filmstrip>
  );
}

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
  /**
   * `bleed` — each slide spans the viewport (default Photos-style track).
   * `snug` — same full-height Slide → Item → Zoom stack as bleed. On `md+`,
   * Slide width shrinks to the media column (variable-width track + gap); on
   * mobile, slides are full scrollport width like bleed. Vertical chrome insets
   * are Slide padding; desktop horizontal inset is a width cap (not
   * padding-inline). See `lightbox-demo/chrome-insets.css` + `snug-slides.css`.
   */
  slidesLayout = 'bleed',
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
  slidesLayout?: 'bleed' | 'snug';
  renderItem?: (item: LightboxGalleryItem, index: number, ctx: GalleryItemRenderCtx) => React.ReactNode;
}) {
  // Viewport visibility only — linked layout/sync live in Lightbox.Filmstrip.
  const thumbClass =
    thumbnails === 'never'
      ? 'hidden'
      : thumbnails === 'always'
        ? 'pointer-events-auto lightbox-demo-filmstrip'
        : 'pointer-events-auto hidden md:block lightbox-demo-filmstrip';

  const backdropTone = backdrop === 'solid' ? 'bg-white dark:bg-black' : 'lightbox-demo-backdrop-light';
  const snug = slidesLayout === 'snug';

  return (
    <Lightbox.Portal>
      <Lightbox.Backdrop className={`lightbox-demo-backdrop ${backdropTone} fixed inset-0`} />
      <Lightbox.Content
        aria-label={ariaLabel}
        pullToClose={pullToClose}
        className={`lightbox-demo-content fixed inset-0 flex flex-col overscroll-contain outline-none${snug ? ' lightbox-demo-content-snug' : ''}`}
      >
        <Lightbox.Slides
          aria-label="Full-size images"
          preload={preload}
          className={
            snug
              ? // End spacers + card gap: `lightbox-demo/snug-slides.css`.
                'lightbox-demo-slides lightbox-demo-slides-snug flex-1 [&::-webkit-scrollbar]:hidden'
              : 'lightbox-demo-slides flex-1 gap-5 [&::-webkit-scrollbar]:hidden md:gap-0'
          }
        >
          {items.map((item, i) => {
            const dims = galleryItemDims(item);
            const ratio = dims ? dims.width / dims.height : 16 / 9;
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
                    ? {
                        // Override Slide’s baked `flex: 0 0 100%` for md+ card width.
                        // Mobile forces full width in `snug-slides.css`.
                        flex: '0 0 auto',
                        minWidth: 0,
                        width: `min(calc(100cqw - 2 * var(--lightbox-inset-inline)), calc((100cqh - var(--lightbox-inset-top) - var(--lightbox-inset-bottom)) * ${ratio}))`,
                      }
                    : undefined
                }
              >
                <Lightbox.Item index={i} caption={item.caption ?? item.alt}>
                  {({ imageRef, morphRef }) =>
                    renderItem ? (
                      renderItem(item, i, { imageRef, morphRef })
                    ) : (
                      <Lightbox.Zoom maxZoom={maxZoom}>
                        {/* Radius/overflow are cosmetic on Media; width/height are structural. */}
                        <Lightbox.Media
                          {...(galleryItemDims(item) ?? {})}
                          className="overflow-hidden rounded-none md:rounded-lg"
                        >
                          <img
                            {...(galleryItemDims(item) ?? {})}
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
            );
          })}
        </Lightbox.Slides>

        {/*
          Chrome after Slides, and above snug zoomed-slide `z-20` — DOM order alone
          can’t win when a sibling slide creates a higher stacking context.
        */}
        <div
          className={`absolute left-3 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-30 ${chromePullHide} max-md:[[data-zoomed]_&]:pointer-events-none max-md:[[data-zoomed]_&]:opacity-0`}
        >
          <Lightbox.Counter className="min-w-[3.5rem] font-mono text-sm tabular-nums text-black/70 dark:text-white/70" />
        </div>

        <div
          className={`absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-30 flex gap-2 ${chromePullHide} max-md:[[data-zoomed]_&]:pointer-events-none max-md:[[data-zoomed]_&]:opacity-0`}
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
          className={`pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-3 px-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] transition-opacity duration-200 [[data-zoomed]_&]:opacity-0 ${chromePullHide}`}
        >
          <Lightbox.Caption className="pointer-events-auto block min-h-[1.25rem] max-w-full truncate px-6 text-center text-sm text-black/70 dark:text-white/80" />

          {thumbnails !== 'never' ? (
            <GalleryFilmstrip items={items} className={thumbClass} />
          ) : null}
        </div>
      </Lightbox.Content>
    </Lightbox.Portal>
  );
}


/** Hide chrome while pulling / committing pull-to-dismiss (opacity only — no blur). */
const chromePullHide =
  'transition-opacity duration-200 [[data-pulling]_&]:pointer-events-none [[data-pulling]_&]:opacity-0 [[data-pull-dismissing]_&]:pointer-events-none [[data-pull-dismissing]_&]:opacity-0';

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
