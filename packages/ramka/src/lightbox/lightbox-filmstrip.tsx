'use client';

import { mergeProps, useRender } from '@base-ui/react';
import * as React from 'react';

import { useLightboxContext } from './lightbox-context';
import { LightboxFilmstripCssVars } from './lightbox-css-vars';
import { LightboxFilmstripDataAttributes } from './lightbox-data-attributes';
import { LightboxFilmstripContext } from './lightbox-filmstrip-context';
import { slidesGeometryIsUniform, slidesScrollProgress } from './lightbox-slides-geometry';

interface LightboxFilmstripState extends Record<string, unknown> {
  /** True while a pointer thumb-select WAAPI scrub is in flight. */
  scrubbing: boolean;
}

interface LightboxFilmstripProps extends useRender.ComponentProps<'div', LightboxFilmstripState> {
  /**
   * When true (default), pointer selection on a thumbnail WAAPI-scrubs the
   * track to the target index. Keyboard / button navigation stays instant
   * (follows the Slides jump via the scroll link).
   */
  scrubOnSelect?: boolean;
  /** WAAPI scrub duration in ms. @default 450 */
  scrubDuration?: number;
  /** WAAPI scrub easing. @default 'cubic-bezier(0.22, 1, 0.36, 1)' */
  scrubEasing?: string;
  /**
   * Optional wrapper around the active-index commit (e.g. docs chrome can run
   * an element-scoped `slides.startViewTransition`). Receives the target
   * `index` so consumers can arm WAAPI (same as the track scrub) *before*
   * `commit` jumps Slides scroll. Track scrub still runs outside this
   * callback. Defaults to invoking `commit` immediately.
   */
  wrapSelectCommit?: (commit: () => void, slides: HTMLElement | null, index: number) => void;
}

const filmstripStateAttributesMapping = {
  scrubbing: (value: unknown) => (value ? { 'data-scrubbing': '' } : null),
};

/** Flex column-gap on the track (px). `offsetLeft` deltas omit this in some engines. */
function measureTrackGapPx(track: HTMLElement): number {
  const raw = getComputedStyle(track).columnGap || getComputedStyle(track).gap;
  if (!raw || raw === 'normal') return 0;
  const gap = Number.parseFloat(raw);
  return Number.isFinite(gap) ? gap : 0;
}

/**
 * Stride between consecutive thumbs (width + gap).
 * Prefer getBoundingClientRect — `offsetLeft` can ignore flex `gap`, which
 * shifts the midline by one gap per index (indicator no longer sits on the thumb).
 *
 * `thumbs` come from the React registry (Thumbnail callback refs), ordered by index.
 */
function measureThumbStepPx(track: HTMLElement, thumbs: HTMLElement[]): number {
  if (thumbs.length === 0) return 0;
  const first = thumbs[0]!;
  const width = first.getBoundingClientRect().width || first.offsetWidth || 0;
  if (thumbs.length < 2) return width;

  const second = thumbs[1]!;
  const rectStep = second.getBoundingClientRect().left - first.getBoundingClientRect().left;
  if (rectStep > 0) return rectStep;

  const offsetStep = second.offsetLeft - first.offsetLeft;
  // Some engines report offsetLeft deltas as width only (gap omitted).
  if (offsetStep > width + 0.5) return offsetStep;
  return width + measureTrackGapPx(track);
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
 * Headless scroll-linked filmstrip.
 *
 * Always centers the active thumbnail under the filmstrip midline (Photos-style).
 * Owns midline padding, overflow clip, and Slides→track sync via native
 * `ScrollTimeline` + WAAPI (JS scroll→transform fallback when unavailable).
 * Consumers style flex/gap, thumb size, and optional Indicator paint.
 */
const LightboxFilmstrip = React.forwardRef<HTMLDivElement, LightboxFilmstripProps>(
  function LightboxFilmstrip(props, forwardedRef) {
    const {
      render,
      children,
      scrubOnSelect = true,
      scrubDuration = 450,
      scrubEasing = 'cubic-bezier(0.22, 1, 0.36, 1)',
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
    const thumbStepRef = React.useRef(0);
    const linkAnimRef = React.useRef<Animation | null>(null);
    const scrubAnimRef = React.useRef<Animation | null>(null);
    /** True from scrub arm through scroll-link handoff (blocks attach / RO rebuild). */
    const scrubHoldRef = React.useRef(false);
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

    const measureThumbs = React.useCallback(() => {
      const track = trackRef.current;
      const root = rootRef.current;
      if (!track) return;

      const thumbs = orderedThumbs(thumbsRef.current);
      thumbStepRef.current = measureThumbStepPx(track, thumbs);

      const firstThumb = thumbs[0];
      const thumbWidth =
        firstThumb != null
          ? firstThumb.getBoundingClientRect().width || firstThumb.offsetWidth || 0
          : 0;
      if (root && thumbWidth > 0) {
        const pad = Math.max(0, (root.clientWidth - thumbWidth) / 2);
        track.style.paddingInline = `${pad}px`;
      }

      const geometry = slidesGeometryRef.current;
      const travel = Math.max(0, geometry.count - 1) * thumbStepRef.current;
      track.style.setProperty(LightboxFilmstripCssVars.travel, `${-travel}px`);
    }, [slidesGeometryRef]);

    const syncNow = React.useCallback(() => {
      if (scrubAnimRef.current) return;
      const track = trackRef.current;
      const slides = slidesViewportRef.current;
      if (!track || !slides) return;

      const geometry = slidesGeometryRef.current;
      const t = slidesScrollProgress(slides, geometry);
      const travel = Math.max(0, geometry.count - 1) * thumbStepRef.current;
      track.style.transform = `translate3d(${-t * travel}px, 0, 0)`;
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
    const startLinkAnimation = React.useCallback(() => {
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

      const keepPaused =
        scrubAnimRef.current != null || linkAnimRef.current?.playState === 'paused';

      // Pin the live translate before cancel — covers the gap until the new
      // effect is on the stack (scrub fill:forwards may already own transform).
      const pinnedX = readComputedTranslateX(track);
      track.style.transform = `translate3d(${pinnedX}px, 0, 0)`;

      linkAnimRef.current?.cancel();
      linkAnimRef.current = null;
      track.style.removeProperty('animation');

      const travel = Math.max(0, geometry.count - 1) * thumbStepRef.current;
      const timeline = new ScrollTimeline({ source: slides, axis: 'x' });
      const effect = new KeyframeEffect(
        track,
        [
          { transform: 'translate3d(0px, 0, 0)' },
          { transform: `translate3d(${-travel}px, 0, 0)` },
        ],
        { fill: 'both', easing: 'linear' },
      );
      const link = new Animation(effect, timeline);
      link.play();
      if (keepPaused) link.pause();
      linkAnimRef.current = link;
      usesScrollTimelineRef.current = true;
      return true;
    }, [slidesViewportRef, slidesGeometryRef]);

    React.useLayoutEffect(() => {
      let detach: (() => void) | undefined;
      syncFromScrollRef.current = syncNow;

      const attach = () => {
        // Never tear down / rebuild the scroll link while a thumb scrub owns
        // transform — attach runs from slides viewport notify and would cancel
        // the DocumentTimeline scrub mid-flight.
        if (scrubHoldRef.current || scrubAnimRef.current) return;

        detach?.();
        detach = undefined;

        const track = trackRef.current;
        const slides = slidesViewportRef.current;
        const root = rootRef.current;
        if (!track || !slides || !root) return;

        measureThumbs();

        if (startLinkAnimation()) {
          const ro = new ResizeObserver(() => {
            if (scrubHoldRef.current || scrubAnimRef.current) return;
            measureThumbs();
            startLinkAnimation();
          });
          ro.observe(track);
          ro.observe(root);
          detach = () => {
            ro.disconnect();
            linkAnimRef.current?.cancel();
            linkAnimRef.current = null;
            usesScrollTimelineRef.current = false;
          };
          return;
        }

        // Fallback: continuous JS mirror of Slides scroll.
        syncNow();
        const onScroll = () => {
          if (scrubHoldRef.current || scrubAnimRef.current) return;
          scheduleSync();
        };
        slides.addEventListener('scroll', onScroll, { passive: true });
        const ro = new ResizeObserver(() => {
          if (scrubHoldRef.current || scrubAnimRef.current) return;
          measureThumbs();
          syncNow();
        });
        ro.observe(track);
        ro.observe(root);
        detach = () => {
          slides.removeEventListener('scroll', onScroll);
          ro.disconnect();
        };
      };

      attach();
      const unsubscribe = subscribeSlidesViewport(attach);

      return () => {
        unsubscribe();
        detach?.();
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
          track.style.removeProperty(LightboxFilmstripCssVars.travel);
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
        const toX = -index * thumbStepRef.current;
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
              duration: scrubDuration,
              easing: scrubEasing,
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
            track.style.transform = `translate3d(${toX}px, 0, 0)`;
            try {
              scrubAnim.commitStyles();
            } catch {
              /* commitStyles can throw if the effect was already cleared */
            }

            // Keep the DocumentTimeline scrub on the stack (fill:forwards) while
            // arming a new ScrollTimeline underneath. Safari often paints
            // keyframe 0 on a fresh scroll link — the scrub hides that frame.
            scrubAnimRef.current = null;
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

            syncFromScrollRef.current?.();
            dropScrub();
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
              if (!startLinkAnimation()) syncFromScrollRef.current?.();
              scrubHoldRef.current = false;
              setScrubbing(false);
            },
          );
        }

        const commit = () => {
          activeIndexRef.current = index;
          setActiveIndex(index, 'thumbnail');
        };

        if (wrapSelectCommit) {
          wrapSelectCommit(commit, slides, index);
        } else {
          commit();
        }

        // Play after commit so wrapSelectCommit's flushSync cannot flush a
        // setScrubbing render between pause(0) and play.
        scrub?.play();
        if (scrub) setScrubbing(true);
      },
      [
        scrubOnSelect,
        scrubDuration,
        scrubEasing,
        wrapSelectCommit,
        setActiveIndex,
        navigationLockedRef,
        slidesViewportRef,
        startLinkAnimation,
      ],
    );

    const filmstripContext = React.useMemo(
      () => ({ registerTrack, registerThumb, selectIndex }),
      [registerTrack, registerThumb, selectIndex],
    );

    const state = React.useMemo<LightboxFilmstripState>(() => ({ scrubbing }), [scrubbing]);

    return (
      <LightboxFilmstripContext.Provider value={filmstripContext}>
        {useRender({
          render,
          ref: assignRootRef,
          state,
          stateAttributesMapping: filmstripStateAttributesMapping,
          props: mergeProps<'div'>(
            {
              [LightboxFilmstripDataAttributes.root]: '',
              // Structural: clip padded track; relative for FilmstripIndicator.
              // Width gives a viewport for midline padding measurement.
              style: {
                position: 'relative',
                overflow: 'clip',
                width: '100%',
                ...style,
              },
              children,
            } as React.ComponentPropsWithRef<'div'>,
            elementProps as React.ComponentPropsWithRef<'div'>,
          ),
          defaultTagName: 'div',
        })}
      </LightboxFilmstripContext.Provider>
    );
  },
);

LightboxFilmstrip.displayName = 'LightboxFilmstrip';

export { LightboxFilmstrip };
export type { LightboxFilmstripProps, LightboxFilmstripState };
