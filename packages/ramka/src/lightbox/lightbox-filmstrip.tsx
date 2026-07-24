'use client';

import { mergeProps, useRender } from '@base-ui/react';
import * as React from 'react';

import { useLightboxContext } from './lightbox-context';
import { LightboxFilmstripCssVars } from './lightbox-css-vars';
import { LightboxFilmstripDataAttributes } from './lightbox-data-attributes';
import { LightboxFilmstripContext } from './lightbox-filmstrip-context';
import { slidesScrollProgress } from './lightbox-slides-geometry';

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
}

const filmstripStateAttributesMapping = {
  scrubbing: (value: unknown) => (value ? { 'data-scrubbing': '' } : null),
};

/** Stride between consecutive thumbs (offsetLeft delta, or first thumb width). */
function measureThumbStepPx(track: HTMLElement): number {
  const tabs = track.querySelectorAll<HTMLElement>('[role="tab"]');
  if (tabs.length === 0) return 0;
  const first = tabs[0]!;
  const width = first.offsetWidth || 0;
  if (tabs.length < 2) return width;
  const step = tabs[1]!.offsetLeft - first.offsetLeft;
  return step > 0 ? step : width;
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
    const thumbStepRef = React.useRef(0);
    const linkAnimRef = React.useRef<Animation | null>(null);
    const scrubAnimRef = React.useRef<Animation | null>(null);
    const rafRef = React.useRef(0);
    const syncFromScrollRef = React.useRef<(() => void) | null>(null);
    const usesScrollTimelineRef = React.useRef(false);
    const activeIndexRef = React.useRef(activeIndex);
    activeIndexRef.current = activeIndex;

    const [trackVersion, setTrackVersion] = React.useState(0);
    const [scrubbing, setScrubbing] = React.useState(false);

    const registerTrack = React.useCallback((node: HTMLElement | null) => {
      if (trackRef.current === node) return;
      trackRef.current = node;
      setTrackVersion((v) => v + 1);
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

      thumbStepRef.current = measureThumbStepPx(track);

      const firstThumb = track.querySelector<HTMLElement>('[role="tab"]');
      const thumbWidth = firstThumb?.offsetWidth ?? 0;
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
     * Native Slides→track link via ScrollTimeline. Kept alive across thumb
     * scrubs — pause/play only — so Safari never flashes keyframe 0 from
     * cancel/recreate.
     */
    const startLinkAnimation = React.useCallback(() => {
      const track = trackRef.current;
      const slides = slidesViewportRef.current;
      const ScrollTimeline = getScrollTimelineConstructor();
      if (!track || !slides || !ScrollTimeline) {
        usesScrollTimelineRef.current = false;
        return false;
      }

      const keepPaused =
        scrubAnimRef.current != null || linkAnimRef.current?.playState === 'paused';

      linkAnimRef.current?.cancel();
      linkAnimRef.current = null;
      track.style.removeProperty('transform');
      track.style.removeProperty('animation');

      const geometry = slidesGeometryRef.current;
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
        detach?.();
        detach = undefined;

        const track = trackRef.current;
        const slides = slidesViewportRef.current;
        const root = rootRef.current;
        if (!track || !slides || !root) return;

        measureThumbs();

        if (startLinkAnimation()) {
          const ro = new ResizeObserver(() => {
            measureThumbs();
            if (!scrubAnimRef.current) startLinkAnimation();
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
        const onScroll = () => scheduleSync();
        slides.addEventListener('scroll', onScroll, { passive: true });
        const ro = new ResizeObserver(() => {
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
        scrubAnimRef.current?.cancel();
        scrubAnimRef.current = null;
        linkAnimRef.current?.cancel();
        linkAnimRef.current = null;
        usesScrollTimelineRef.current = false;
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
    ]);

    const selectIndex = React.useCallback(
      (index: number) => {
        if (index === activeIndexRef.current || navigationLockedRef.current) return;

        const track = trackRef.current;
        const link = linkAnimRef.current;
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

        if (canScrub && track) {
          scrubAnimRef.current?.cancel();
          // Freeze the scroll link in place; do not cancel it (Safari flash).
          link?.pause();
          setScrubbing(true);
          const scrub = track.animate(
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
          scrubAnimRef.current = scrub;
          void scrub.finished.then(
            () => {
              if (scrubAnimRef.current !== scrub) return;
              scrubAnimRef.current = null;
              try {
                scrub.commitStyles();
              } catch {
                /* commitStyles can throw if the effect was already cleared */
              }
              scrub.cancel();
              track.style.removeProperty('transform');
              if (usesScrollTimelineRef.current) {
                link?.play();
              } else {
                syncFromScrollRef.current?.();
              }
              setScrubbing(false);
            },
            () => {
              if (scrubAnimRef.current === scrub) {
                scrubAnimRef.current = null;
                track.style.removeProperty('transform');
                if (usesScrollTimelineRef.current) {
                  link?.play();
                } else {
                  syncFromScrollRef.current?.();
                }
                setScrubbing(false);
              }
            },
          );
        }

        activeIndexRef.current = index;
        setActiveIndex(index, 'thumbnail');
      },
      [
        scrubOnSelect,
        scrubDuration,
        scrubEasing,
        setActiveIndex,
        navigationLockedRef,
      ],
    );

    const filmstripContext = React.useMemo(
      () => ({ registerTrack, selectIndex }),
      [registerTrack, selectIndex],
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
