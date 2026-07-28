'use client';

import * as React from 'react';
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
   * Optional intrinsic pixel size. Used for snug slide sizing + thumbnail-strip
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

/** Match `Lightbox.ThumbnailStrip` scrub defaults (track + indicator width scrub). */
const THUMBNAIL_STRIP_SCRUB_MS = 450;
const THUMBNAIL_STRIP_SCRUB_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

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

/**
 * Nine-slice selection frame (transform-only morph).
 *
 * Fixed outer host (max thumb aspect + outset). Left/right caps keep
 * `border-radius`; top/bottom edges `scaleX`; shell + right cap `translateX`.
 * Outset = offset + stroke so a 2px gap sits between thumb and the 2px border
 * (same look as former `outline` + `outline-offset: 2px`).
 */
/** Gap between thumb edge and inner edge of the stroke. */
const FRAME_OFFSET_PX = 2;
/** Border thickness on caps / edges. */
const FRAME_STROKE_PX = 2;
/** Per-side growth beyond the thumb (offset + stroke), with border-box. */
const FRAME_OUTSET_PX = FRAME_OFFSET_PX + FRAME_STROKE_PX;
/** Cap width — ≥ thumb radius + offset so concentric corners stay round. */
const FRAME_CAP_PX = 8;

type FrameGeom = {
  /** Thumb height in px (shell is thumb + 2×outset). */
  thumbHeightPx: number;
  /** Max frame outer width (widest thumb + 2×outset). */
  maxWidthPx: number;
  outset: number;
  cap: number;
};

type FramePose = {
  /** Thumb width this pose corresponds to (not the expanded frame width). */
  thumbWidthPx: number;
  shell: string;
  right: string;
  bar: string;
};

type FramePieces = {
  host: HTMLElement;
  shell: HTMLElement;
  right: HTMLElement;
  top: HTMLElement;
  bottom: HTMLElement;
};

function frameMaxAspect(aspects: number[]): number {
  let max = 16 / 9;
  for (const a of aspects) {
    if (a > max) max = a;
  }
  return max;
}

/** Expand thumb size by outset on each side, then build transform pose. */
function framePose(thumbWidthPx: number, geom: FrameGeom): FramePose {
  const w = Math.max(geom.cap * 2, thumbWidthPx + geom.outset * 2);
  const mid = Math.max(0, w - geom.cap * 2);
  const x = (geom.maxWidthPx - w) / 2;
  return {
    thumbWidthPx,
    shell: `translate3d(${x}px, 0px, 0)`,
    right: `translate3d(${w - geom.cap}px, 0, 0)`,
    bar: `scaleX(${mid})`,
  };
}

function writeFramePose(pieces: FramePieces, pose: FramePose) {
  pieces.shell.style.transform = pose.shell;
  pieces.right.style.transform = pose.right;
  pieces.top.style.transform = pose.bar;
  pieces.bottom.style.transform = pose.bar;
}

function clearFrameInlineTransforms(pieces: FramePieces) {
  pieces.shell.style.removeProperty('transform');
  pieces.right.style.removeProperty('transform');
  pieces.top.style.removeProperty('transform');
  pieces.bottom.style.removeProperty('transform');
}

function cancelAnimations(anims: Animation[] | null | undefined) {
  if (!anims) return;
  for (const anim of anims) anim.cancel();
}

/** Equal-offset transform keyframes for one piece (ScrollTimeline 0→1). */
function poseTransformKeyframes(poses: FramePose[], pick: (p: FramePose) => string): Keyframe[] {
  const max = Math.max(0, poses.length - 1);
  return poses.map((pose, i) => ({
    offset: max === 0 ? 0 : i / max,
    transform: pick(pose),
  }));
}

/**
 * Docs thumbnail-strip: per-photo-aspect thumbs + nine-slice selection frame.
 * Outer host is fixed (max aspect); ScrollTimeline / WAAPI morph transforms only.
 */
function GalleryThumbnailStrip({
  items,
  className,
}: {
  items: LightboxGalleryItem[];
  className: string;
}) {
  const { activeIndex, slidesViewportRef, slidesGeometryRef, subscribeSlidesViewport } =
    useLightboxContext();
  const thumbnailStripRef = React.useRef<HTMLDivElement | null>(null);
  const hostRef = React.useRef<HTMLSpanElement | null>(null);
  const shellRef = React.useRef<HTMLSpanElement | null>(null);
  const rightRef = React.useRef<HTMLSpanElement | null>(null);
  const topRef = React.useRef<HTMLSpanElement | null>(null);
  const bottomRef = React.useRef<HTMLSpanElement | null>(null);
  const activeIndexRef = React.useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  const itemAspects = React.useMemo(() => items.map((item) => galleryItemAspect(item)), [items]);
  const itemAspectsRef = React.useRef(itemAspects);
  itemAspectsRef.current = itemAspects;
  const maxAspect = React.useMemo(() => frameMaxAspect(itemAspects), [itemAspects]);

  const aspectLinkAnimsRef = React.useRef<Animation[] | null>(null);
  const aspectScrubAnimsRef = React.useRef<Animation[] | null>(null);
  const usesScrollTimelineRef = React.useRef(false);
  const aspectHoldRef = React.useRef(false);
  const widthRef = React.useRef(56 * (itemAspects[0] ?? 16 / 9));
  const geomRef = React.useRef<FrameGeom>({
    thumbHeightPx: 56,
    maxWidthPx: 56 * maxAspect + FRAME_OUTSET_PX * 2,
    outset: FRAME_OUTSET_PX,
    cap: FRAME_CAP_PX,
  });
  const reattachAspectRef = React.useRef<(() => void) | null>(null);
  const startAspectLinkRef = React.useRef<(force?: boolean) => boolean>(() => false);
  const syncAspectFromScrollRef = React.useRef<(() => void) | null>(null);

  const getPieces = React.useCallback((): FramePieces | null => {
    const host = hostRef.current;
    const shell = shellRef.current;
    const right = rightRef.current;
    const top = topRef.current;
    const bottom = bottomRef.current;
    if (!host || !shell || !right || !top || !bottom) return null;
    return { host, shell, right, top, bottom };
  }, []);

  const measureGeom = React.useCallback((): FrameGeom => {
    const host = hostRef.current;
    const thumbHeightPx = Math.max(
      1,
      (host?.clientHeight ?? 56 + FRAME_OUTSET_PX * 2) - FRAME_OUTSET_PX * 2,
    );
    const maxWidthPx = thumbHeightPx * frameMaxAspect(itemAspectsRef.current) + FRAME_OUTSET_PX * 2;
    const geom = {
      thumbHeightPx,
      maxWidthPx,
      outset: FRAME_OUTSET_PX,
      cap: FRAME_CAP_PX,
    };
    geomRef.current = geom;
    return geom;
  }, []);

  React.useLayoutEffect(() => {
    let raf = 0;
    let ro: ResizeObserver | undefined;

    const syncFromScroll = () => {
      if (aspectHoldRef.current || aspectScrubAnimsRef.current) return;
      const pieces = getPieces();
      const slides = slidesViewportRef.current;
      const aspects = itemAspectsRef.current;
      if (!pieces || !slides || aspects.length === 0) return;
      const geom = measureGeom();
      const geometry = slidesGeometryRef.current;
      const progress = demoSlidesScrollProgress(slides, geometry);
      const max = Math.max(0, geometry.count - 1);
      let aspect = aspects[0] ?? 16 / 9;
      if (max > 0) {
        const f = progress * max;
        const i0 = Math.min(max, Math.floor(f));
        const i1 = Math.min(max, i0 + 1);
        aspect = lerp(aspects[i0] ?? 16 / 9, aspects[i1] ?? aspects[i0] ?? 16 / 9, f - i0);
      }
      const thumbW = geom.thumbHeightPx * aspect;
      const pose = framePose(thumbW, geom);
      widthRef.current = pose.thumbWidthPx;
      writeFramePose(pieces, pose);
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
      if (aspectHoldRef.current && !force) return usesScrollTimelineRef.current;

      const pieces = getPieces();
      const slides = slidesViewportRef.current;
      const ScrollTimeline = getScrollTimelineConstructor();
      const aspects = itemAspectsRef.current;
      const geometry = slidesGeometryRef.current;
      const uniform =
        !geometry.offsets ||
        geometry.offsets.length !== geometry.count ||
        geometry.count < 2 ||
        geometry.offsets.every(
          (offset, i) => Math.abs(offset - (geometry.base + i * geometry.step)) < 1,
        );
      if (
        !pieces ||
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

      // Thumb height / aspects unchanged — keep the live scroll link.
      if (
        !force &&
        usesScrollTimelineRef.current &&
        aspectLinkAnimsRef.current != null &&
        aspectLinkAnimsRef.current.length > 0
      ) {
        return true;
      }

      const keepPaused =
        aspectScrubAnimsRef.current != null ||
        aspectLinkAnimsRef.current?.some((a) => a.playState === 'paused');
      cancelAnimations(aspectLinkAnimsRef.current);
      aspectLinkAnimsRef.current = null;

      const geom = measureGeom();
      const poses = aspects.map((aspect) => framePose(geom.thumbHeightPx * aspect, geom));
      const timeline = new ScrollTimeline({ source: slides, axis: 'x' });
      const effectOpts: KeyframeEffectOptions = { duration: 1, fill: 'both', easing: 'linear' };

      const shellFx = new KeyframeEffect(
        pieces.shell,
        poseTransformKeyframes(poses, (p) => p.shell),
        effectOpts,
      );
      const rightFx = new KeyframeEffect(
        pieces.right,
        poseTransformKeyframes(poses, (p) => p.right),
        effectOpts,
      );
      const topFx = new KeyframeEffect(
        pieces.top,
        poseTransformKeyframes(poses, (p) => p.bar),
        effectOpts,
      );
      const bottomFx = new KeyframeEffect(
        pieces.bottom,
        poseTransformKeyframes(poses, (p) => p.bar),
        effectOpts,
      );

      const links = [
        new Animation(shellFx, timeline),
        new Animation(rightFx, timeline),
        new Animation(topFx, timeline),
        new Animation(bottomFx, timeline),
      ];
      for (const link of links) {
        link.play();
        if (keepPaused) link.pause();
      }
      aspectLinkAnimsRef.current = links;
      usesScrollTimelineRef.current = true;

      const primary = links[0]!;
      void primary.ready.then(() => {
        requestAnimationFrame(() => {
          if (
            aspectLinkAnimsRef.current !== links ||
            aspectScrubAnimsRef.current ||
            aspectHoldRef.current
          ) {
            return;
          }
          clearFrameInlineTransforms(pieces);
        });
      });
      return true;
    };
    startAspectLinkRef.current = startAspectLink;

    let scrollSlides: HTMLElement | null = null;
    let lastLinkHeight = 0;

    const unbindScroll = () => {
      if (scrollSlides) {
        scrollSlides.removeEventListener('scroll', scheduleSync);
      }
      scrollSlides = null;
    };

    /**
     * Wire observers once; rebuild ST only when thumb height (rem/zoom) changes.
     * Slides viewport resize must NOT cancel+rebuild — keyframes are aspect-based
     * and ScrollTimeline remaps progress automatically (same glitch as the track).
     */
    const refresh = (forceLink = false) => {
      if (aspectHoldRef.current || aspectScrubAnimsRef.current) return;

      const slides = slidesViewportRef.current;
      const pieces = getPieces();
      if (!slides || !pieces) return;

      const geom = measureGeom();
      const heightChanged = Math.round(geom.thumbHeightPx) !== lastLinkHeight;

      if (!ro) {
        let roRaf = 0;
        ro = new ResizeObserver(() => {
          if (aspectHoldRef.current || aspectScrubAnimsRef.current) return;
          if (roRaf !== 0) return;
          roRaf = requestAnimationFrame(() => {
            roRaf = 0;
            const nextH = Math.round(measureGeom().thumbHeightPx);
            if (nextH === lastLinkHeight) return;
            lastLinkHeight = nextH;
            startAspectLink(true);
          });
        });
        ro.observe(pieces.host);
      }

      if (usesScrollTimelineRef.current && !forceLink && !heightChanged) {
        // Live ST — slides/window resize must not cancel+rebuild (keyframes are
        // aspect-based; ScrollTimeline remaps progress on its own).
        return;
      }

      lastLinkHeight = Math.round(geom.thumbHeightPx);
      if (startAspectLink(forceLink || heightChanged)) {
        unbindScroll();
        return;
      }

      // JS fallback mirror.
      cancelAnimations(aspectLinkAnimsRef.current);
      aspectLinkAnimsRef.current = null;
      usesScrollTimelineRef.current = false;
      syncFromScroll();
      if (scrollSlides !== slides) {
        unbindScroll();
        slides.addEventListener('scroll', scheduleSync, { passive: true });
        scrollSlides = slides;
      }
    };

    reattachAspectRef.current = () => refresh(true);
    refresh(true);
    const unsubscribe = subscribeSlidesViewport(() => refresh(false));
    return () => {
      unsubscribe();
      unbindScroll();
      reattachAspectRef.current = null;
      syncAspectFromScrollRef.current = null;
      ro?.disconnect();
      cancelAnimations(aspectScrubAnimsRef.current);
      aspectScrubAnimsRef.current = null;
      cancelAnimations(aspectLinkAnimsRef.current);
      aspectLinkAnimsRef.current = null;
      usesScrollTimelineRef.current = false;
      aspectHoldRef.current = false;
      if (raf !== 0) cancelAnimationFrame(raf);
    };
  }, [slidesViewportRef, slidesGeometryRef, subscribeSlidesViewport, itemAspects, measureGeom, getPieces]);

  /**
   * WAAPI transform scrub on the nine-slice pieces around the index commit.
   * Slides view transition is baked into ThumbnailStrip (`selectViewTransition`).
   */
  const wrapThumbSelectCommit = React.useCallback(
    (commit: () => void, _slides: HTMLElement | null, index: number) => {
      const reduceMotion =
        typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      const pieces = getPieces();
      const aspects = itemAspectsRef.current;
      const links = aspectLinkAnimsRef.current;
      const geom = measureGeom();

      const fromWidth = widthRef.current;
      const fromPose = framePose(fromWidth, geom);
      const toWidth =
        geom.thumbHeightPx * (aspects[index] ?? aspects[activeIndexRef.current] ?? 16 / 9);
      const toPose = framePose(toWidth, geom);

      aspectHoldRef.current = true;

      const canScrub =
        !reduceMotion &&
        pieces != null &&
        typeof pieces.shell.animate === 'function' &&
        Number.isFinite(index) &&
        fromWidth > 0 &&
        Math.abs(fromWidth - toPose.thumbWidthPx) > 0.5;

      let scrubPrimary: Animation | undefined;

      if (canScrub && pieces) {
        writeFramePose(pieces, fromPose);
        void pieces.host.offsetWidth;
        cancelAnimations(links);
        aspectLinkAnimsRef.current = null;
        usesScrollTimelineRef.current = false;

        cancelAnimations(aspectScrubAnimsRef.current);
        const scrubOpts: KeyframeAnimationOptions = {
          duration: THUMBNAIL_STRIP_SCRUB_MS,
          easing: THUMBNAIL_STRIP_SCRUB_EASE,
          fill: 'forwards',
        };
        const scrubs = [
          pieces.shell.animate(
            [{ transform: fromPose.shell }, { transform: toPose.shell }],
            scrubOpts,
          ),
          pieces.right.animate(
            [{ transform: fromPose.right }, { transform: toPose.right }],
            scrubOpts,
          ),
          pieces.top.animate([{ transform: fromPose.bar }, { transform: toPose.bar }], scrubOpts),
          pieces.bottom.animate(
            [{ transform: fromPose.bar }, { transform: toPose.bar }],
            scrubOpts,
          ),
        ];
        for (const scrub of scrubs) {
          scrub.pause();
          scrub.currentTime = 0;
        }
        aspectScrubAnimsRef.current = scrubs;
        scrubPrimary = scrubs[0];
        widthRef.current = toPose.thumbWidthPx;

        const releaseToScrollLink = () => {
          if (aspectScrubAnimsRef.current !== scrubs) return;
          for (const scrub of scrubs) {
            try {
              scrub.commitStyles();
            } catch {
              /* commitStyles can throw if the effect was already cleared */
            }
          }

          aspectScrubAnimsRef.current = null;
          const armed = startAspectLinkRef.current(true);
          const liveLinks = aspectLinkAnimsRef.current;

          const dropScrub = () => {
            if (aspectScrubAnimsRef.current) return;
            cancelAnimations(scrubs);
            clearFrameInlineTransforms(pieces);
            aspectHoldRef.current = false;
          };

          if (armed && liveLinks?.[0]) {
            void liveLinks[0].ready.then(() => {
              requestAnimationFrame(() => {
                requestAnimationFrame(dropScrub);
              });
            });
            return;
          }

          cancelAnimations(scrubs);
          writeFramePose(pieces, framePose(toPose.thumbWidthPx, measureGeom()));
          aspectHoldRef.current = false;
          syncAspectFromScrollRef.current?.();
          reattachAspectRef.current?.();
        };

        void scrubs[0]!.finished.then(
          () => {
            if (aspectScrubAnimsRef.current !== scrubs) return;
            releaseToScrollLink();
          },
          () => {
            if (aspectScrubAnimsRef.current !== scrubs) return;
            cancelAnimations(scrubs);
            aspectScrubAnimsRef.current = null;
            writeFramePose(pieces, framePose(toPose.thumbWidthPx, measureGeom()));
            aspectHoldRef.current = false;
            if (!startAspectLinkRef.current(true)) {
              syncAspectFromScrollRef.current?.();
              reattachAspectRef.current?.();
            } else {
              clearFrameInlineTransforms(pieces);
            }
          },
        );
      }

      commit();

      if (scrubPrimary && aspectScrubAnimsRef.current) {
        for (const scrub of aspectScrubAnimsRef.current) scrub.play();
      } else {
        aspectHoldRef.current = false;
        const liveLinks = aspectLinkAnimsRef.current;
        if (liveLinks && usesScrollTimelineRef.current) {
          for (const link of liveLinks) link.play();
        } else if (!startAspectLinkRef.current() && pieces) {
          const pose = framePose(toPose.thumbWidthPx, measureGeom());
          widthRef.current = pose.thumbWidthPx;
          writeFramePose(pieces, pose);
        }
      }
    },
    [measureGeom, getPieces],
  );

  return (
    <Lightbox.ThumbnailStrip
      ref={thumbnailStripRef}
      className={className}
      wrapSelectCommit={wrapThumbSelectCommit}
      style={
        {
          ['--lightbox-demo-frame-max-aspect' as string]: String(maxAspect),
          ['--lightbox-demo-frame-cap' as string]: `${FRAME_CAP_PX}px`,
        } as React.CSSProperties
      }
    >
      <div className="lightbox-demo-thumbnail-strip-aspect-host">
        <Lightbox.ThumbnailStripTrack aria-label="Photo thumbnails">
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
        </Lightbox.ThumbnailStripTrack>
        <span
          ref={hostRef}
          className="lightbox-demo-thumbnail-strip-frame"
          aria-hidden
        >
          <span ref={shellRef} className="lightbox-demo-thumbnail-strip-frame-shell">
            <span className="lightbox-demo-thumbnail-strip-frame-cap lightbox-demo-thumbnail-strip-frame-cap-left" />
            <span
              ref={rightRef}
              className="lightbox-demo-thumbnail-strip-frame-cap lightbox-demo-thumbnail-strip-frame-cap-right"
            />
            <span
              ref={topRef}
              className="lightbox-demo-thumbnail-strip-frame-edge lightbox-demo-thumbnail-strip-frame-edge-top"
            />
            <span
              ref={bottomRef}
              className="lightbox-demo-thumbnail-strip-frame-edge lightbox-demo-thumbnail-strip-frame-edge-bottom"
            />
          </span>
        </span>
      </div>
    </Lightbox.ThumbnailStrip>
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
  // Viewport visibility only — linked layout/sync live in Lightbox.ThumbnailStrip.
  const thumbClass =
    thumbnails === 'never'
      ? 'hidden'
      : thumbnails === 'always'
        ? 'pointer-events-auto lightbox-demo-thumbnail-strip'
        : 'pointer-events-auto hidden md:block lightbox-demo-thumbnail-strip';

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
            <GalleryThumbnailStrip items={items} className={thumbClass} />
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
