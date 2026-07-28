'use client';

import { mergeProps, useRender } from '@base-ui/react';
import * as React from 'react';
import { flushSync } from 'react-dom';

import { useLightboxContext } from './lightbox-context';
import { LightboxThumbnailStripCssVars } from './lightbox-css-vars';
import { LightboxThumbnailStripDataAttributes } from './lightbox-data-attributes';
import { LightboxThumbnailStripContext } from './lightbox-thumbnail-strip-context';
import { slidesGeometryIsUniform, slidesScrollProgress } from './lightbox-slides-geometry';

interface LightboxThumbnailStripState extends Record<string, unknown> {
  /** True while a pointer thumb-select WAAPI scrub is in flight. */
  scrubbing: boolean;
}

interface LightboxThumbnailStripProps extends useRender.ComponentProps<'div', LightboxThumbnailStripState> {
  /**
   * When true (default), pointer selection on a thumbnail WAAPI-scrubs the
   * track to the target index. Keyboard / button navigation stays instant
   * (follows the Slides jump via the scroll link).
   */
  scrubOnSelect?: boolean;
  /**
   * When true (default), pointer selection runs an element-scoped View
   * Transition on Slides around the active-index commit (stage crossfade).
   * Falls back to a plain commit when unsupported or
   * `prefers-reduced-motion`. Tune with `--lightbox-select-vt-duration` /
   * `--lightbox-select-vt-easing` on Slides. Keyboard stays instant.
   */
  selectViewTransition?: boolean;
  /**
   * Optional wrapper around the active-index commit so consumers can arm
   * custom WAAPI (e.g. an indicator scrub) *before* `commit` jumps Slides.
   * `commit` already includes the baked Slides view transition when
   * `selectViewTransition` is on. Track scrub still runs outside this
   * callback. Defaults to invoking `commit` immediately.
   */
  wrapSelectCommit?: (commit: () => void, slides: HTMLElement | null, index: number) => void;
}

/** Baked pointer-select scrub timing (not a public prop — keep the API lean). */
const SCRUB_DURATION_MS = 450;
const SCRUB_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

type SlidesVtHost = HTMLElement & {
  startViewTransition?: (cb: () => void) => unknown;
};

const thumbnailStripStateAttributesMapping = {
  scrubbing: (value: unknown) => (value ? { 'data-scrubbing': '' } : null),
};

/**
 * Per-thumb `translateX` distances so thumb `i`'s layout center sits on the
 * thumbnail-strip midline when `translateX = -travels[i]`.
 *
 * Uses `offsetLeft` / `offsetWidth` (layout box), not `getBoundingClientRect`.
 * Rect centers follow the axis-aligned bounding box of CSS transforms — so a
 * consumer `rotate()` on inactive thumbs would shift travel stops and leave the
 * upright active thumb off the indicator. Layout offsets ignore those transforms
 * and still include flex gap. Falls back to rects when offsets collapse (jsdom).
 */
function measureThumbTravels(thumbs: HTMLElement[]): {
  travels: number[];
  widths: number[];
} {
  if (thumbs.length === 0) return { travels: [], widths: [] };

  const layoutWidths = thumbs.map((thumb) => thumb.offsetWidth || 0);
  const layoutCenters = thumbs.map(
    (thumb, i) => thumb.offsetLeft + layoutWidths[i]! / 2,
  );
  const layoutOk =
    layoutWidths.some((w) => w > 0) &&
    (thumbs.length < 2 || layoutCenters.some((c, i) => i > 0 && c !== layoutCenters[0]));

  if (layoutOk) {
    const origin = layoutCenters[0]!;
    return {
      travels: layoutCenters.map((c) => c - origin),
      widths: layoutWidths,
    };
  }

  const widths = thumbs.map((thumb, i) => {
    return thumb.getBoundingClientRect().width || layoutWidths[i] || 0;
  });
  const centers = thumbs.map((thumb, i) => {
    const rect = thumb.getBoundingClientRect();
    if (rect.width > 0) return rect.left + rect.width / 2;
    return thumb.offsetLeft + widths[i]! / 2;
  });
  const origin = centers[0]!;
  return {
    travels: centers.map((c) => c - origin),
    widths,
  };
}

/** Piecewise-linear travel for index-linear scroll progress `0→1`. */
function thumbTravelAtProgress(travels: number[], progress: number): number {
  const max = Math.max(0, travels.length - 1);
  if (max <= 0) return travels[0] ?? 0;
  const f = Math.min(1, Math.max(0, progress)) * max;
  const i0 = Math.min(max, Math.floor(f));
  const i1 = Math.min(max, i0 + 1);
  const a = travels[i0] ?? 0;
  const b = travels[i1] ?? a;
  return a + (b - a) * (f - i0);
}

function thumbTravelsAreUniform(travels: number[]): boolean {
  if (travels.length < 2) return true;
  const step = travels[1]!;
  if (step <= 0) return true;
  return travels.every((travel, i) => Math.abs(travel - i * step) < 1);
}

function thumbTravelsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i]! - b[i]!) > 0.5) return false;
  }
  return true;
}

/**
 * ScrollTimeline / WAAPI keyframes for the track. Uniform thumbs keep the
 * historical two-stop link; variable-width thumbs get one stop per index
 * (equal offsets ↔ index-linear `slidesScrollProgress`).
 */
function trackTransformKeyframes(travels: number[]): Keyframe[] {
  const max = Math.max(0, travels.length - 1);
  if (max === 0) {
    return [{ transform: 'translate3d(0px, 0, 0)' }];
  }
  if (thumbTravelsAreUniform(travels)) {
    return [
      { transform: 'translate3d(0px, 0, 0)' },
      { transform: `translate3d(${-(travels[max] ?? 0)}px, 0, 0)` },
    ];
  }
  return travels.map((travel, i) => ({
    offset: i / max,
    transform: `translate3d(${-travel}px, 0, 0)`,
  }));
}

/** Registered thumbs sorted by index (stable midline / travel measurement). */
function orderedThumbs(map: Map<number, HTMLElement>): HTMLElement[] {
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, node]) => node);
}

interface ScrollTimelineOptions {
  source?: Element | Document | null;
  axis?: 'block' | 'inline' | 'x' | 'y';
}

type ScrollTimelineConstructor = new (options?: ScrollTimelineOptions) => AnimationTimeline;

function getScrollTimelineConstructor(): ScrollTimelineConstructor | null {
  if (typeof window === 'undefined') return null;
  const ctor = (window as Window & { ScrollTimeline?: ScrollTimelineConstructor }).ScrollTimeline;
  return typeof ctor === 'function' ? ctor : null;
}

/** Current computed translateX (ScrollTimeline / WAAPI / inline sync). */
function readComputedTranslateX(el: HTMLElement): number {
  const raw = getComputedStyle(el).transform;
  if (!raw || raw === 'none') return 0;
  try {
    return new DOMMatrixReadOnly(raw).m41;
  } catch {
    const m = /matrix(?:3d)?\(([^)]+)\)/.exec(raw);
    if (!m) return 0;
    const parts = m[1]!.split(',').map((v) => Number(v.trim()));
    return parts.length === 6 ? parts[4]! : parts.length === 16 ? parts[12]! : 0;
  }
}

/**
 * Headless scroll-linked thumbnail-strip.
 *
 * Always centers the active thumbnail under the thumbnail-strip midline (Photos-style).
 * Owns midline padding, overflow clip, Slides→track sync via native
 * `ScrollTimeline` + WAAPI (JS scroll→transform fallback when unavailable),
 * and (by default) an element-scoped Slides view transition on pointer select.
 * Consumers style flex/gap, thumb size, optional Indicator paint, and VT look
 * via `--lightbox-select-vt-*` on Slides.
 */
const LightboxThumbnailStrip = React.forwardRef<HTMLDivElement, LightboxThumbnailStripProps>(
  function LightboxThumbnailStrip(props, forwardedRef) {
    const {
      render,
      children,
      scrubOnSelect = true,
      selectViewTransition = true,
      wrapSelectCommit,
      style,
      ...elementProps
    } = props;

    const {
      slidesViewportRef,
      slidesGeometryRef,
      subscribeSlidesViewport,
      setActiveIndex,
      navigationLockedRef,
      itemCount,
      activeIndex,
    } = useLightboxContext();

    const rootRef = React.useRef<HTMLElement | null>(null);
    const trackRef = React.useRef<HTMLElement | null>(null);
    const thumbsRef = React.useRef(new Map<number, HTMLElement>());
    /** translateX magnitude to center each thumb (`travels[i]` → `-travels[i]`). */
    const thumbTravelsRef = React.useRef<number[]>([]);
    const linkAnimRef = React.useRef<Animation | null>(null);
    const scrubAnimRef = React.useRef<Animation | null>(null);
    /** True from scrub arm through scroll-link handoff (blocks attach / RO rebuild). */
    const scrubHoldRef = React.useRef(false);
    /** Re-run attach (JS scroll mirror) when ScrollTimeline is unavailable. */
    const reattachRef = React.useRef<(() => void) | null>(null);
    const rafRef = React.useRef(0);
    const syncFromScrollRef = React.useRef<(() => void) | null>(null);
    const usesScrollTimelineRef = React.useRef(false);
    const activeIndexRef = React.useRef(activeIndex);
    activeIndexRef.current = activeIndex;

    const [trackVersion, setTrackVersion] = React.useState(0);
    const [thumbVersion, setThumbVersion] = React.useState(0);
    const [scrubbing, setScrubbing] = React.useState(false);

    const registerTrack = React.useCallback((node: HTMLElement | null) => {
      if (trackRef.current === node) return;
      trackRef.current = node;
      setTrackVersion((v) => v + 1);
    }, []);

    const thumbBumpRafRef = React.useRef(0);
    const registerThumb = React.useCallback((index: number, node: HTMLElement | null) => {
      const map = thumbsRef.current;
      const prev = map.get(index);
      if (node) {
        if (prev === node) return;
        map.set(index, node);
      } else if (prev) {
        map.delete(index);
      } else {
        return;
      }
      // Coalesce mount/unmount storms into one remeasure.
      if (thumbBumpRafRef.current !== 0) return;
      thumbBumpRafRef.current = requestAnimationFrame(() => {
        thumbBumpRafRef.current = 0;
        setThumbVersion((v) => v + 1);
      });
    }, []);

    const assignRootRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        rootRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef],
    );

    /**
     * Remeasure thumb centers + midline padding.
     * @returns whether travel keyframes changed (ST must rebuild). Padding-only
     * updates (window resize) return false so the live ScrollTimeline stays up.
     */
    const measureThumbs = React.useCallback((): boolean => {
      const track = trackRef.current;
      const root = rootRef.current;
      if (!track) return false;

      const thumbs = orderedThumbs(thumbsRef.current);
      const { travels, widths } = measureThumbTravels(thumbs);
      const travelsChanged = !thumbTravelsEqual(thumbTravelsRef.current, travels);
      thumbTravelsRef.current = travels;

      const firstWidth = widths[0] ?? 0;
      const lastWidth = widths[widths.length - 1] ?? firstWidth;
      if (root && firstWidth > 0) {
        // Asymmetric pad so the first *and* last thumb (possibly different
        // widths) can both sit on the midline. Safe to update without touching ST.
        const padStart = Math.max(0, (root.clientWidth - firstWidth) / 2);
        const padEnd = Math.max(0, (root.clientWidth - lastWidth) / 2);
        track.style.paddingLeft = `${padStart}px`;
        track.style.paddingRight = `${padEnd}px`;
        track.style.removeProperty('padding-inline');
      }

      const endTravel = travels[travels.length - 1] ?? 0;
      track.style.setProperty(LightboxThumbnailStripCssVars.travel, `${-endTravel}px`);
      return travelsChanged;
    }, []);

    const syncNow = React.useCallback(() => {
      if (scrubAnimRef.current) return;
      const track = trackRef.current;
      const slides = slidesViewportRef.current;
      if (!track || !slides) return;

      const geometry = slidesGeometryRef.current;
      const t = slidesScrollProgress(slides, geometry);
      const x = thumbTravelAtProgress(thumbTravelsRef.current, t);
      track.style.transform = `translate3d(${-x}px, 0, 0)`;
    }, [slidesViewportRef, slidesGeometryRef]);

    const scheduleSync = React.useCallback(() => {
      if (rafRef.current !== 0) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        syncNow();
      });
    }, [syncNow]);

    /**
     * Native Slides→track link via ScrollTimeline.
     *
     * Thumb scrubs *cancel* this link (not pause): a paused ScrollTimeline still
     * retargets on the Slides jump and can win a frame over the DocumentTimeline
     * scrub — the whole strip flashes to the destination, then the scrub restarts.
     * On scrub end we rebuild underneath the still-filling scrub, then drop it.
     */
    const startLinkAnimation = React.useCallback((force = false) => {
      const track = trackRef.current;
      const slides = slidesViewportRef.current;
      const ScrollTimeline = getScrollTimelineConstructor();
      const geometry = slidesGeometryRef.current;
      // ScrollTimeline progress is linear in scroll distance; variable-width
      // (snug) tracks need index-linear JS sync via slidesScrollProgress.
      if (!track || !slides || !ScrollTimeline || !slidesGeometryIsUniform(geometry)) {
        usesScrollTimelineRef.current = false;
        return false;
      }

      const travels = thumbTravelsRef.current;
      if (travels.length === 0) {
        usesScrollTimelineRef.current = false;
        return false;
      }

      // Resize often only changes midline padding — keep the live ST effect.
      if (
        !force &&
        usesScrollTimelineRef.current &&
        linkAnimRef.current != null &&
        linkAnimRef.current.playState !== 'idle'
      ) {
        return true;
      }

      const keepPaused =
        scrubAnimRef.current != null || linkAnimRef.current?.playState === 'paused';

      // Pin the live translate before cancel — covers the gap until the new
      // effect is on the stack (scrub fill:forwards may already own transform).
      const pinnedX = readComputedTranslateX(track);
      track.style.transform = `translate3d(${pinnedX}px, 0, 0)`;

      linkAnimRef.current?.cancel();
      linkAnimRef.current = null;
      track.style.removeProperty('animation');

      const timeline = new ScrollTimeline({ source: slides, axis: 'x' });
      const effect = new KeyframeEffect(
        track,
        trackTransformKeyframes(travels),
        // `duration` is ignored for scroll progress, but Firefox will not apply
        // a ScrollTimeline effect when duration is missing / 0 — after a thumb
        // scrub drops its fill:forwards, the track then sits at keyframe 0.
        { duration: 1, fill: 'both', easing: 'linear' },
      );
      const link = new Animation(effect, timeline);
      link.play();
      if (keepPaused) link.pause();
      linkAnimRef.current = link;
      usesScrollTimelineRef.current = true;
      return true;
    }, [slidesViewportRef, slidesGeometryRef]);

    React.useLayoutEffect(() => {
      let ro: ResizeObserver | undefined;
      let scrollSlides: HTMLElement | null = null;
      let onScroll: (() => void) | undefined;
      syncFromScrollRef.current = syncNow;

      const unbindScroll = () => {
        if (scrollSlides && onScroll) {
          scrollSlides.removeEventListener('scroll', onScroll);
        }
        scrollSlides = null;
        onScroll = undefined;
      };

      /**
       * Update padding / travels; rebuild ST only when keyframes must change.
       * Window resize used to cancel+rebuild ST every frame (visible glitch).
       */
      const refresh = (forceLink = false) => {
        if (scrubHoldRef.current || scrubAnimRef.current) return;

        const track = trackRef.current;
        const slides = slidesViewportRef.current;
        const root = rootRef.current;
        if (!track || !slides || !root) return;

        const travelsChanged = measureThumbs();

        if (startLinkAnimation(forceLink || travelsChanged)) {
          unbindScroll();
          return;
        }

        // Fallback: continuous JS mirror of Slides scroll (no ScrollTimeline).
        linkAnimRef.current?.cancel();
        linkAnimRef.current = null;
        usesScrollTimelineRef.current = false;
        syncNow();
        if (scrollSlides !== slides) {
          unbindScroll();
          onScroll = () => {
            if (scrubHoldRef.current || scrubAnimRef.current) return;
            scheduleSync();
          };
          slides.addEventListener('scroll', onScroll, { passive: true });
          scrollSlides = slides;
        }
      };

      const attach = () => {
        if (scrubHoldRef.current || scrubAnimRef.current) return;

        const track = trackRef.current;
        const root = rootRef.current;
        if (!track || !root) return;

        if (!ro) {
          ro = new ResizeObserver(() => {
            if (scrubHoldRef.current || scrubAnimRef.current) return;
            // Padding updates every time; ST rebuilds only if travels changed.
            refresh(false);
          });
          ro.observe(track);
          ro.observe(root);
        }

        refresh(true);
      };

      reattachRef.current = () => refresh(true);
      attach();
      const unsubscribe = subscribeSlidesViewport(() => refresh(false));

      return () => {
        unsubscribe();
        unbindScroll();
        ro?.disconnect();
        ro = undefined;
        reattachRef.current = null;
        syncFromScrollRef.current = null;
        scrubHoldRef.current = false;
        scrubAnimRef.current?.cancel();
        scrubAnimRef.current = null;
        linkAnimRef.current?.cancel();
        linkAnimRef.current = null;
        usesScrollTimelineRef.current = false;
        if (thumbBumpRafRef.current !== 0) {
          cancelAnimationFrame(thumbBumpRafRef.current);
          thumbBumpRafRef.current = 0;
        }
        if (rafRef.current !== 0) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = 0;
        }
        const track = trackRef.current;
        if (track) {
          track.style.removeProperty('transform');
          track.style.removeProperty('animation');
          track.style.removeProperty('padding-inline');
          track.style.removeProperty('padding-left');
          track.style.removeProperty('padding-right');
          track.style.removeProperty(LightboxThumbnailStripCssVars.travel);
        }
      };
    }, [
      subscribeSlidesViewport,
      slidesViewportRef,
      measureThumbs,
      startLinkAnimation,
      syncNow,
      scheduleSync,
      itemCount,
      trackVersion,
      thumbVersion,
    ]);

    const selectIndex = React.useCallback(
      (index: number) => {
        if (index === activeIndexRef.current || navigationLockedRef.current) return;

        const track = trackRef.current;
        const link = linkAnimRef.current;
        const slides = slidesViewportRef.current;
        const reduceMotion =
          typeof matchMedia === 'function' &&
          matchMedia('(prefers-reduced-motion: reduce)').matches;

        const fromX = track ? readComputedTranslateX(track) : 0;
        const toX = -(thumbTravelsRef.current[index] ?? 0);
        const canScrub =
          scrubOnSelect &&
          !reduceMotion &&
          track != null &&
          typeof track.animate === 'function' &&
          Math.abs(fromX - toX) >= 0.5;

        let scrub: Animation | undefined;

        if (canScrub && track) {
          scrubAnimRef.current?.cancel();
          scrubHoldRef.current = true;
          // Pin, then *cancel* the scroll link. Pause is not enough on Safari:
          // the paused ScrollTimeline still retargets when Slides jump and can
          // paint the destination translate for a frame above/beside the scrub.
          track.style.transform = `translate3d(${fromX}px, 0, 0)`;
          void track.offsetWidth;
          link?.cancel();
          linkAnimRef.current = null;
          usesScrollTimelineRef.current = false;

          const scrubAnim = track.animate(
            [
              { transform: `translate3d(${fromX}px, 0, 0)` },
              { transform: `translate3d(${toX}px, 0, 0)` },
            ],
            {
              duration: SCRUB_DURATION_MS,
              easing: SCRUB_EASING,
              fill: 'forwards',
            },
          );
          // Hold on the first frame until the index commit starts (so a
          // wrapSelectCommit view transition can capture a stable "old" slide).
          scrubAnim.pause();
          scrubAnim.currentTime = 0;
          scrubAnimRef.current = scrubAnim;
          scrub = scrubAnim;

          const releaseToScrollLink = () => {
            if (scrubAnimRef.current !== scrubAnim) return;
            try {
              scrubAnim.commitStyles();
            } catch {
              /* commitStyles can throw if the effect was already cleared */
            }

            // Keep the DocumentTimeline scrub on the stack (fill:forwards) while
            // arming a new ScrollTimeline underneath. Safari often paints
            // keyframe 0 on a fresh scroll link — the scrub hides that frame.
            // Firefox needs a non-zero effect `duration` (see startLinkAnimation)
            // or the ST effect never applies and dropping the scrub snaps to 0.
            scrubAnimRef.current = null;
            measureThumbs();
            const armed = startLinkAnimation();
            const liveLink = linkAnimRef.current;

            const dropScrub = () => {
              // A newer scrub took over — leave its hold/animation alone.
              if (scrubAnimRef.current) return;
              scrubAnim.cancel();
              track.style.removeProperty('transform');
              scrubHoldRef.current = false;
              setScrubbing(false);
            };

            if (armed && liveLink) {
              void liveLink.ready.then(() => {
                requestAnimationFrame(() => {
                  requestAnimationFrame(dropScrub);
                });
              });
              return;
            }

            // No ScrollTimeline — pin destination and use the JS scroll mirror.
            scrubAnim.cancel();
            track.style.transform = `translate3d(${toX}px, 0, 0)`;
            syncFromScrollRef.current?.();
            scrubHoldRef.current = false;
            setScrubbing(false);
            reattachRef.current?.();
          };

          void scrubAnim.finished.then(
            () => {
              if (scrubAnimRef.current !== scrubAnim) return;
              releaseToScrollLink();
            },
            () => {
              if (scrubAnimRef.current !== scrubAnim) return;
              track.style.transform = `translate3d(${toX}px, 0, 0)`;
              scrubAnim.cancel();
              scrubAnimRef.current = null;
              measureThumbs();
              if (!startLinkAnimation()) {
                syncFromScrollRef.current?.();
                reattachRef.current?.();
              } else {
                track.style.removeProperty('transform');
              }
              scrubHoldRef.current = false;
              setScrubbing(false);
            },
          );
        }

        const applyIndex = () => {
          activeIndexRef.current = index;
          setActiveIndex(index, 'thumbnail');
        };

        const commit = () => {
          const host = slides as SlidesVtHost | null;
          const startVt = host?.startViewTransition;
          if (selectViewTransition && !reduceMotion && typeof startVt === 'function') {
            startVt.call(host, () => {
              flushSync(applyIndex);
            });
          } else {
            flushSync(applyIndex);
          }
        };

        if (wrapSelectCommit) {
          wrapSelectCommit(commit, slides, index);
        } else {
          commit();
        }

        // Play after commit so wrapSelectCommit cannot flush a setScrubbing
        // render between pause(0) and play.
        scrub?.play();
        if (scrub) setScrubbing(true);
      },
      [
        scrubOnSelect,
        selectViewTransition,
        wrapSelectCommit,
        setActiveIndex,
        navigationLockedRef,
        slidesViewportRef,
        startLinkAnimation,
        measureThumbs,
      ],
    );

    const thumbnailStripContext = React.useMemo(
      () => ({ registerTrack, registerThumb, selectIndex }),
      [registerTrack, registerThumb, selectIndex],
    );

    const state = React.useMemo<LightboxThumbnailStripState>(() => ({ scrubbing }), [scrubbing]);

    return (
      <LightboxThumbnailStripContext.Provider value={thumbnailStripContext}>
        {useRender({
          render,
          ref: assignRootRef,
          state,
          stateAttributesMapping: thumbnailStripStateAttributesMapping,
          props: mergeProps<'div'>(
            {
              [LightboxThumbnailStripDataAttributes.root]: '',
              // Structural: clip padded track; relative for consumer midline chrome.
              // Consumers size the root (width / stretch) so midline padding can
              // measure against the intended viewport.
              style: {
                position: 'relative',
                overflow: 'clip',
                ...style,
              },
              children,
            } as React.ComponentPropsWithRef<'div'>,
            elementProps as React.ComponentPropsWithRef<'div'>,
          ),
          defaultTagName: 'div',
        })}
      </LightboxThumbnailStripContext.Provider>
    );
  },
);

LightboxThumbnailStrip.displayName = 'LightboxThumbnailStrip';

export { LightboxThumbnailStrip };
export type { LightboxThumbnailStripProps, LightboxThumbnailStripState };
