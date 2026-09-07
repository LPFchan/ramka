'use client';

import * as React from 'react';

import { useLightboxContext } from './lightbox-context';
import { LightboxSlidesCssVars } from './lightbox-css-vars';
import type { TextDirection } from './lightbox-direction';
import {
  measureSlidesGeometry,
  slidesGeometryIsUniform,
  SLIDE_SELECTOR,
  type SlidesGeometry,
} from './lightbox-slides-geometry';
import { LightboxSlidesBase, type LightboxSlidesProps } from './lightbox-slides';

/**
 * `Lightbox.VirtualSlides` — the windowed (virtualized) variant of
 * `Lightbox.Slides`, for galleries so large that merely MOUNTING a slide box
 * per item is a visible cost (≳500 items: the open/close commit — which the
 * view-transition morph wraps in `flushSync` — scales with the number of
 * mounted boxes, stuttering right before the transition).
 *
 * Only a window of slides around the active index is mounted
 * (`preload + overscan` on each side). Two invisible spacer flex items stand
 * in for everything outside it, sized in CSS (`calc` of the scrollport width
 * plus the consumer-mirrored `--lightbox-slide-gap`) so scroll extent, snap
 * positions, and `scrollLeft` are IDENTICAL to the fully-mounted track at
 * every moment — including atomically across a window shift, because React
 * commits the spacer resize and the slide mount/unmount in one mutation.
 *
 * ## How it reuses the Slides engine
 *
 * This is a thin layer over the same scroll engine as `Lightbox.Slides`
 * (fling lock, snap suppression, settle detection, resize re-snap — see
 * lightbox-slides.tsx). It injects exactly two seams:
 *
 *  - geometry: measure the mounted window (real layout, spacer included) and
 *    extrapolate the uniform track over the full `count`, so every consumer
 *    of `slidesGeometryRef` (index↔position math, ThumbnailStrip) transparently
 *    works in full-collection indexes;
 *  - index→element: offset DOM lookups by the window start.
 *
 * Because the window is recentred by `activeIndex` — whose authority is the
 * scroll's *eventual* position (see the engine docs) — a native fling can
 * never outrun it: `scroll-snap-stop: always` stops each gesture at the next
 * slide, which is always mounted.
 *
 * ## Constraints (vs `Lightbox.Slides`)
 *
 *  - **Uniform, scrollport-wide slides only** (`flex: 0 0 100%` tracks): the
 *    spacers and off-window snap positions are extrapolated as
 *    `index × (100% + gap)`. Content-sized (snug) tracks need per-slide
 *    measurement — exactly the work windowing removes — so they stay on
 *    `Lightbox.Slides`. Dev builds warn when the measured track disagrees.
 *  - If the track has a `gap`, mirror it into `--lightbox-slide-gap`
 *    (see `LightboxSlidesCssVars.slideGap`). Without it the spacers are short
 *    by one gap per unmounted slide and snap positions drift.
 *  - `loop` is not supported (the window cannot wrap a linear scroll track).
 *  - `ssrSlideShift` is not supported; server paints of an open lightbox
 *    still mark the active item so Chromium's `scroll-initial-target`
 *    positions it (the window always contains it). Pass `count` on
 *    `Lightbox.Root` too if you server-render an open viewer, so Counter /
 *    Next / Previous paint the real total before hydration.
 *
 * While mounted, it publishes `count` to the Root so `itemCount` reflects the
 * full collection (the item registry only ever sees the mounted window).
 */

interface LightboxVirtualSlidesProps
  extends Omit<LightboxSlidesProps, 'children' | 'ssrSlideShift'> {
  /** Total number of items in the collection. Required. */
  count: number;
  /**
   * How many slide BOXES beyond the `preload` window stay mounted on each
   * side of the active slide (window radius = `preload + overscan`). More
   * overscan = fewer window shifts near the edges and more snap targets ahead
   * of a scrubbing scrollbar; less = fewer mounted nodes. @default 2
   */
  overscan?: number;
  /**
   * Render one slide by full-collection index. Must render a `Lightbox.Slide`
   * (with a `Lightbox.Item index={index}` inside). Called only for indexes in
   * the mounted window; keys are applied by VirtualSlides, per index.
   */
  children?: (index: number) => React.ReactNode;
}

/**
 * Full-track geometry from the mounted window: measure the real layout (the
 * spacer has already pushed the window to its true positions), then
 * extrapolate `base + i × step` over `count`. When the window covers the
 * whole collection the measurement IS the full track and passes through.
 */
function synthesizeVirtualSlidesGeometry(
  viewport: HTMLElement,
  dir: TextDirection,
  count: number,
  start: number,
  warnedRef: React.MutableRefObject<boolean>,
): SlidesGeometry {
  const measured = measureSlidesGeometry(viewport, dir);
  if (measured.count === 0) {
    return { offsets: [], base: 0, step: viewport.clientWidth || 1, count: 0 };
  }
  if (measured.count === count && start === 0) {
    return measured;
  }

  const step = measured.step;
  const base = measured.offsets[0]! - start * step;

  if (process.env.NODE_ENV !== 'production' && !warnedRef.current) {
    if (!slidesGeometryIsUniform(measured)) {
      warnedRef.current = true;
      // eslint-disable-next-line no-console
      console.warn(
        '[ramka] Lightbox.VirtualSlides requires uniform, scrollport-wide slides ' +
          '(`flex: 0 0 100%` boxes): the mounted window measured non-uniform snap ' +
          'offsets, so extrapolated positions will be wrong. Use Lightbox.Slides ' +
          'for content-sized (snug) tracks.',
      );
    } else if (start > 0 && Math.abs(measured.offsets[0]! - start * step) > 1) {
      warnedRef.current = true;
      // eslint-disable-next-line no-console
      console.warn(
        `[ramka] Lightbox.VirtualSlides: the first mounted slide (index ${start}) ` +
          `measured at inline position ${Math.round(measured.offsets[0]!)}, expected ` +
          `${Math.round(start * step)}. If the track has a gap, mirror it into ` +
          `--lightbox-slide-gap (see LightboxSlidesCssVars.slideGap); otherwise ` +
          `check that every slide is scrollport-wide.`,
      );
    }
  }

  const offsets = Array.from({ length: count }, (_, i) => base + i * step);
  return { offsets, base, step, count };
}

const SPACER_ATTRIBUTE = 'data-ramka-virtual-spacer';

const LightboxVirtualSlides = React.forwardRef<HTMLDivElement, LightboxVirtualSlidesProps>(
  function LightboxVirtualSlides(props, forwardedRef) {
    const { count, overscan = 2, preload = 1, children, ...slidesProps } = props;
    const { activeIndex, loop, setVirtualItemCount } = useLightboxContext();

    const warnedLoopRef = React.useRef(false);
    if (process.env.NODE_ENV !== 'production' && loop && !warnedLoopRef.current) {
      warnedLoopRef.current = true;
      // eslint-disable-next-line no-console
      console.warn(
        '[ramka] Lightbox.VirtualSlides does not support `loop` on Lightbox.Root: ' +
          'the mounted window cannot wrap a linear scroll track. Navigation will ' +
          'behave as if loop were off.',
      );
    }

    // Window bounds. `radius` covers the preload window (items whose CONTENT
    // must mount) plus overscan slide boxes; recentred on every index commit.
    // `end` is exclusive.
    const radius = preload + overscan;
    const start = Math.max(0, activeIndex - radius);
    const end = Math.min(count, activeIndex + radius + 1);

    // Render-phase mirror (same pattern as the engine's activeIndexRef) so the
    // stable geometry/element callbacks below always see the window that the
    // CURRENT commit is laying out — a layout-effect assignment would lag the
    // measurement that runs in this very commit.
    const startRef = React.useRef(start);
    startRef.current = start;

    // Publish the full collection size — the item registry only sees the
    // window. Layout effect so the very first open commit (inside the view
    // transition's flushSync) corrects `itemCount` before paint.
    React.useLayoutEffect(() => {
      setVirtualItemCount(count);
      return () => setVirtualItemCount(null);
    }, [count, setVirtualItemCount]);

    const nonUniformWarnedRef = React.useRef(false);
    const measureGeometry = React.useCallback(
      (viewport: HTMLElement, dir: TextDirection) =>
        synthesizeVirtualSlidesGeometry(viewport, dir, count, startRef.current, nonUniformWarnedRef),
      [count],
    );

    const resolveSlideElement = React.useCallback((viewport: HTMLElement, index: number) => {
      const relative = index - startRef.current;
      if (relative < 0) return null;
      return viewport.querySelectorAll<HTMLElement>(SLIDE_SELECTOR)[relative] ?? null;
    }, []);

    // Spacers: pure CSS so they are correct on the first paint (before any
    // measurement), resize-proof, and valid in server HTML. A spacer is a flex
    // item, so the track `gap` inserts one gap next to it that an unmounted
    // slide would have owned — hence `n × (100% + gap) − gap`.
    const gap = `var(${LightboxSlidesCssVars.slideGap}, 0px)`;
    const spacerBaseStyle: React.CSSProperties = {
      flex: '0 0 auto',
      height: '100%',
      // Never a snap target, never visible, never in the a11y tree.
      scrollSnapAlign: 'none',
      pointerEvents: 'none',
    };
    const trailingCount = count - end;
    const leadingSpacer =
      start > 0 ? (
        <div
          aria-hidden
          {...{ [SPACER_ATTRIBUTE]: '' }}
          style={{ ...spacerBaseStyle, width: `calc(${start} * (100% + ${gap}) - ${gap})` }}
        />
      ) : null;
    const trailingSpacer =
      trailingCount > 0 ? (
        <div
          aria-hidden
          {...{ [SPACER_ATTRIBUTE]: '' }}
          style={{ ...spacerBaseStyle, width: `calc(${trailingCount} * (100% + ${gap}) - ${gap})` }}
        />
      ) : null;

    // Index-keyed so a window shift reconciles stationary slides in place and
    // only mounts/unmounts the edges.
    const windowedSlides: React.ReactNode[] = [];
    if (children) {
      for (let index = start; index < end; index += 1) {
        windowedSlides.push(<React.Fragment key={index}>{children(index)}</React.Fragment>);
      }
    }

    // Note: a window shift swaps slide DOM without changing layout — spacers
    // grow/shrink by exactly the mounted/unmounted widths in the same commit —
    // so geometry is invariant and the engine's measure effect deliberately
    // does NOT re-run on shifts (its `measureGeometry` identity only changes
    // with `count`). Resizes still re-measure through the engine's
    // ResizeObserver, which reads the CURRENT window via `startRef`.
    return (
      <LightboxSlidesBase
        {...slidesProps}
        ref={forwardedRef}
        preload={preload}
        measureGeometry={measureGeometry}
        resolveSlideElement={resolveSlideElement}
      >
        {leadingSpacer}
        {windowedSlides}
        {trailingSpacer}
      </LightboxSlidesBase>
    );
  },
);

LightboxVirtualSlides.displayName = 'LightboxVirtualSlides';

export { LightboxVirtualSlides };
export type { LightboxVirtualSlidesProps };
