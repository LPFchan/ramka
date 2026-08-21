'use client';

import * as React from 'react';
import Image, { type StaticImageData } from 'next/image';
import * as Lightbox from 'ramka/lightbox';
import { useLightboxContext } from 'ramka';

import './aspect-frame-strip.css';

export type AspectFramePhoto = {
  id: string;
  image: StaticImageData;
  alt: string;
  /** Hardcoded w/h from recipe data — drives frame morph (not measured live). */
  aspect: number;
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
 * Debug recipe: hardcoded per-thumb aspects + nine-slice midline frame that
 * morphs width on swipe / select (ScrollTimeline + WAAPI). Aspects come from
 * recipe data — nothing is measured from the image or viewport.
 */
export function AspectFrameStrip({
  photos,
  className = 'ts-debug-strip ts-debug-aspect-frame',
}: {
  photos: AspectFramePhoto[];
  className?: string;
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

  const itemAspects = React.useMemo(() => photos.map((p) => p.aspect), [photos]);
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
          ['--ts-frame-max-aspect' as string]: String(maxAspect),
          ['--ts-frame-cap' as string]: `${FRAME_CAP_PX}px`,
        } as React.CSSProperties
      }
    >
      <div className="ts-debug-aspect-host">
        <Lightbox.ThumbnailStripTrack aria-label="Photo thumbnails">
          {photos.map((item, i) => (
            <Lightbox.Thumbnail
              key={item.id}
              index={i}
              style={
                {
                  ['--ts-aspect' as string]: String(itemAspects[i] ?? 16 / 9),
                } as React.CSSProperties
              }
            >
              <Image src={item.image} alt={item.alt} sizes="120px" draggable={false} />
            </Lightbox.Thumbnail>
          ))}
        </Lightbox.ThumbnailStripTrack>
        <span
          ref={hostRef}
          className="ts-debug-aspect-frame-indicator"
          aria-hidden
        >
          <span ref={shellRef} className="ts-debug-aspect-frame-shell">
            <span className="ts-debug-aspect-frame-cap ts-debug-aspect-frame-cap-left" />
            <span
              ref={rightRef}
              className="ts-debug-aspect-frame-cap ts-debug-aspect-frame-cap-right"
            />
            <span
              ref={topRef}
              className="ts-debug-aspect-frame-edge ts-debug-aspect-frame-edge-top"
            />
            <span
              ref={bottomRef}
              className="ts-debug-aspect-frame-edge ts-debug-aspect-frame-edge-bottom"
            />
          </span>
        </span>
      </div>
    </Lightbox.ThumbnailStrip>
  );
}
