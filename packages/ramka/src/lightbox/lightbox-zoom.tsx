'use client';

import { mergeProps, useRender } from '@base-ui/react';
import * as React from 'react';

import {
  bakeSettlePath,
  clamp,
  clampOffsetToViewport,
  computeMaxZoom,
  elasticClamp,
  PAN_PHYSICS_FRICTION,
  PAN_PHYSICS_SPRING_MOUSE,
  PAN_PHYSICS_SPRING_TOUCH,
  PAN_PHYSICS_STOP_SPEED,
  panOffsetRange,
  projectFocalZoom,
  round,
  RUBBER_BAND_DIMENSION_FACTOR,
  RUBBER_BAND_DIMENSION_FACTOR_MOUSE,
  rubberBandClamp,
  rubberBandPanDimension,
  SETTLE_BAKE_DT,
  stepPanPhysicsAxis,
  ZOOM_SNAP_SPRING,
  ZOOM_SNAP_STOP_DISTANCE,
  ZOOM_SNAP_STOP_SPEED,
  zoomSnapSeedVelocity,
  type PanPhysicsSpring,
} from './gesture-math';
import { triggerHaptic } from './haptics';
import { LightboxContentCssVars } from './lightbox-css-vars';
import { LightboxZoomDataAttributes } from './lightbox-data-attributes';
import { useLightboxContext } from './lightbox-context';
import { useOptionalLightboxItemContext } from './lightbox-item';
import { ignoreStateAttribute } from './lightbox-state-attributes';
import {
  ZoomContext,
  useLightboxZoomPublish,
  type ActiveZoomControls,
  type ZoomContextValue,
} from './lightbox-zoom-context';
import { useZoomAnimation } from './use-zoom-animation';
import { useZoomGestures, type ZoomGestureActions, type ZoomGestureConfig } from './use-zoom-gestures';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LightboxZoomState extends Record<string, unknown> {
  zoom: number;
  maxZoom: number;
  offsetX: number;
  offsetY: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  /** Whether the content is currently being dragged (panned). */
  dragging: boolean;
}

/**
 * `Lightbox.Zoom` is a headless zoom/pan surface. Like the other primitives it
 * follows the `render` + `data-*` model: it renders a single element (a `div`
 * by default, override via `render`) that captures pointer/wheel/gesture input.
 * State is exposed as attributes on that element — `data-zoom` while scaled
 * past 1x and `data-dragging` while panning — so consumers can style purely
 * through CSS.
 *
 * Structurally, Zoom fills its host (`width`/`height: 100%`, `position: relative`)
 * and is a CSS size container so nested `Lightbox.Media` fit-box units
 * (`cqw` / `cqh`) resolve against Zoom’s padding box. It does **not** set
 * `overflow` — clipping belongs on Content / consumer chrome so zoomed media
 * can paint outside the resting box. Prefer chrome / safe-area insets as
 * padding on `Lightbox.Slide` (not Zoom) so this surface fills the content box.
 * Other cosmetics (colors) stay consumer-owned.
 *
 * The zoom transform is applied to an internal wrapper element that is not
 * consumer-configurable; pass your (typically `<img>`) content as `children`.
 * `children` may also be a render function receiving the current zoom state.
 */
interface LightboxZoomProps
  extends Omit<useRender.ComponentProps<'div', LightboxZoomState>, 'children' | 'ref'> {
  /** Zoomable content, or a render function exposing zoom state. */
  children: React.ReactNode | ((state: LightboxZoomState) => React.ReactNode);
  /** Minimum zoom level. @default 1 */
  minZoom?: number;
  /**
   * Maximum zoom level. When not specified, auto-calculated from the
   * first `<img>` child's natural dimensions vs container size.
   * Falls back to 4 if no image dimensions are available.
   * @default undefined (auto)
   */
  maxZoom?: number;
  /** Multiplier for button/keyboard zoom steps. @default 2 */
  zoomStep?: number;
  /** Enable zoom via bare scroll/trackpad without Ctrl. @default false */
  scrollToZoom?: boolean;
  /** Wheel/trackpad zoom sensitivity factor. @default 100 */
  wheelSensitivity?: number;
  /** Keyboard pan distance in px per keypress. @default 50 */
  keyboardPanDistance?: number;
  /** Max delay between clicks for double-click detection (ms). @default 300 */
  doubleClickDelay?: number;
  /** Callback when zoom level changes. */
  onZoomChange?: (zoom: number) => void;
}

const stateAttributesMapping = {
  zoom: (value: unknown) => (typeof value === 'number' && value > 1 ? { 'data-zoom': '' } : null),
  dragging: (value: unknown) => (value ? { 'data-dragging': '' } : null),
  // Render-prop / imperative state — must not leak as data-maxzoom, etc.
  maxZoom: ignoreStateAttribute,
  offsetX: ignoreStateAttribute,
  offsetY: ignoreStateAttribute,
  canZoomIn: ignoreStateAttribute,
  canZoomOut: ignoreStateAttribute,
};

interface LightboxZoomRef {
  /** Current zoom level. */
  zoom: number;
  /** Resolved maximum zoom. */
  maxZoom: number;
  /** Current pan X. */
  offsetX: number;
  /** Current pan Y. */
  offsetY: number;
  /** Step zoom in by zoomStep. */
  zoomIn: () => void;
  /** Step zoom out by zoomStep. */
  zoomOut: () => void;
  /** Zoom to an absolute level, optionally recentering. */
  zoomTo: (target: number, options?: { rapid?: boolean; dx?: number; dy?: number }) => void;
  /** Reset zoom and pan to the resting state. */
  reset: (rapid?: boolean) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MIN_ZOOM = 1;
const DEFAULT_MAX_ZOOM_FALLBACK = 4;
const DEFAULT_ZOOM_STEP = 2;
const DEFAULT_WHEEL_SENSITIVITY = 100;
const DEFAULT_KEYBOARD_PAN = 50;
const DEFAULT_DOUBLE_CLICK_DELAY = 300;
const DEFAULT_ANIMATION_DURATION = 300;
/** Uniform scale from a computed `transform` (WAAPI mid-flight or resting). */
function uniformScaleFromTransform(transform: string): number | null {
  if (!transform || transform === 'none') return null;
  try {
    const m = new DOMMatrixReadOnly(transform);
    return Math.hypot(m.a, m.b);
  } catch {
    return null;
  }
}

/**
 * Map a live zoom scale to 0→1 progress for `--lightbox-zoom-progress`.
 * Hits 1 after +1× above `minZoom` (e.g. at 2× when min is 1).
 */
function zoomProgressFromScale(scale: number, minZoom: number, maxZoom: number): number {
  const range = Math.max(0.01, Math.min(maxZoom, minZoom + 1) - minZoom);
  return Math.min(1, Math.max(0, (scale - minZoom) / range));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const LightboxZoom = React.forwardRef<LightboxZoomRef, LightboxZoomProps>(
  function LightboxZoom(props, forwardedRef) {
    const {
      children,
      render,
      minZoom = DEFAULT_MIN_ZOOM,
      maxZoom: maxZoomProp,
      zoomStep = DEFAULT_ZOOM_STEP,
      scrollToZoom = false,
      wheelSensitivity = DEFAULT_WHEEL_SENSITIVITY,
      keyboardPanDistance = DEFAULT_KEYBOARD_PAN,
      doubleClickDelay = DEFAULT_DOUBLE_CLICK_DELAY,
      onZoomChange,
      ...elementProps
    } = props;

    const { activeIndex, dialogElementRef, stageElementRef, navigationLockedRef } =
      useLightboxContext();
    const itemContext = useOptionalLightboxItemContext();
    const { publish: publishActiveZoom } = useLightboxZoomPublish();
    // A Zoom used inside a Lightbox.Item only publishes when its slide is
    // active; a standalone Zoom (no item context) is always the active one.
    const isActive = itemContext ? itemContext.active : true;

    // ----- State -----
    const [zoom, setZoom] = React.useState(minZoom);
    const [offsetX, setOffsetX] = React.useState(0);
    const [offsetY, setOffsetY] = React.useState(0);
    const [dragging, setDragging] = React.useState(false);
    // Sync mirror for rAF ticks (zoom snap-back) that must know, mid-frame,
    // whether a finger currently owns the offsets.
    const draggingRef = React.useRef(false);
    const setDraggingAction = React.useCallback((value: boolean) => {
      draggingRef.current = value;
      setDragging(value);
    }, []);
    const [imageDimensions, setImageDimensions] = React.useState<{ w: number; h: number } | null>(null);
    const [containerSize, setContainerSize] = React.useState<{ w: number; h: number } | null>(null);

    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const wrapperRef = React.useRef<HTMLDivElement | null>(null);

    const onZoomChangeRef = React.useRef(onZoomChange);
    onZoomChangeRef.current = onZoomChange;

    // rAF zoom bound snap-back (spring on the zoom *value*), started when a
    // pinch breaks 2→1 out of bounds. Like iOS, it runs CONCURRENTLY with
    // the surviving finger's pan: the finger owns the offsets, this owns
    // zoom, and the scale returns uniformly about the stage center under the
    // live pan. Only a gesture that takes zoom ownership (new pinch, wheel,
    // discrete zoom) stops it; `changeOffsets` deliberately does not.
    const zoomSnapRafRef = React.useRef<number | null>(null);
    const zoomSnapLastTsRef = React.useRef(0);
    const zoomSnapVelRef = React.useRef(0);

    const stopZoomSnap = React.useCallback(() => {
      if (zoomSnapRafRef.current != null) {
        cancelAnimationFrame(zoomSnapRafRef.current);
        zoomSnapRafRef.current = null;
      }
      zoomSnapLastTsRef.current = 0;
      zoomSnapVelRef.current = 0;
    }, []);

    const isZoomSnapActive = React.useCallback(() => zoomSnapRafRef.current != null, []);

    // ----- Measure the container out of render -----
    // Layout reads belong in an effect, not render (render must stay pure and
    // concurrent-safe). A ResizeObserver also keeps maxZoom correct when the
    // container resizes (window/orientation change), which a render-time read
    // would miss. Skipped entirely when maxZoom is provided explicitly.
    React.useEffect(() => {
      if (maxZoomProp !== undefined) return;
      const el = containerRef.current;
      if (!el) return;

      const measure = () => {
        const rect = el.getBoundingClientRect();
        setContainerSize((prev) =>
          prev && prev.w === rect.width && prev.h === rect.height
            ? prev
            : { w: rect.width, h: rect.height },
        );
      };

      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(el);
      return () => observer.disconnect();
    }, [maxZoomProp]);

    // ----- Max zoom computation (pure — no layout reads) -----
    const maxZoom = React.useMemo(() => {
      if (maxZoomProp !== undefined) return maxZoomProp;
      if (!imageDimensions || !containerSize) return DEFAULT_MAX_ZOOM_FALLBACK;
      return computeMaxZoom(
        imageDimensions.w,
        imageDimensions.h,
        containerSize.w,
        containerSize.h,
        minZoom,
        DEFAULT_MAX_ZOOM_FALLBACK,
      );
    }, [maxZoomProp, imageDimensions, containerSize, minZoom]);

    // ----- Observe images inside wrapper to get natural dimensions -----
    // Prefer Media's laid-out box for pan; natural dims still come from <img>.
    React.useEffect(() => {
      const wrapper = wrapperRef.current;
      if (!wrapper || maxZoomProp !== undefined) return;

      const detect = () => {
        const img = wrapper.querySelector('img');
        if (img && img.naturalWidth > 0) {
          setImageDimensions({ w: img.naturalWidth, h: img.naturalHeight });
        }
      };

      detect();

      const observer = new MutationObserver(detect);
      observer.observe(wrapper, { childList: true, subtree: true });

      const imgs = wrapper.querySelectorAll('img');
      const handlers: Array<() => void> = [];
      imgs.forEach((img) => {
        const handler = () => detect();
        img.addEventListener('load', handler);
        handlers.push(() => img.removeEventListener('load', handler));
      });

      return () => {
        observer.disconnect();
        handlers.forEach((h) => h());
      };
    }, [maxZoomProp, activeIndex]);

    // ----- Reset on slide change -----
    React.useEffect(() => {
      stopZoomSnap();
      setZoom(minZoom);
      setOffsetX(0);
      setOffsetY(0);
      setImageDimensions(null);
    }, [activeIndex, minZoom, stopZoomSnap]);

    // ----- Fire callback on zoom change -----
    React.useEffect(() => {
      onZoomChangeRef.current?.(zoom);
    }, [zoom]);

    // ----- Offset clamping -----
    const resolveContentSize = React.useCallback((fallbackRect: DOMRect) => {
      const wrapper = wrapperRef.current;
      if (wrapper) {
        // Prefer Lightbox.Media (sized morph / content host) over a raw <img>.
        // Documented shape: Zoom > Media > img|video (bare children still work).
        const media = wrapper.querySelector('[data-ramka-media]');
        if (media instanceof HTMLElement && media.offsetWidth > 0) {
          return { w: media.offsetWidth, h: media.offsetHeight };
        }
        const img = wrapper.querySelector('img');
        if (img && img.offsetWidth > 0) {
          return { w: img.offsetWidth, h: img.offsetHeight };
        }
      }
      return { w: fallbackRect.width, h: fallbackRect.height };
    }, []);

    /**
     * Pan viewport = `Lightbox.Stage` when mounted, else Content (dialog).
     * Transform stage = Zoom (origin). Uneven Slide padding makes those
     * centers differ — true cover against the pan viewport is required so
     * every edge is reachable. `panOffsetRange` keeps the fit→overflow
     * crossing continuous via a home offset lerp toward δ.
     */
    const measurePanGeometry = React.useCallback(
      (z: number) => {
        const stage = containerRef.current?.getBoundingClientRect() ?? null;
        if (!stage) return null;
        const panViewportEl = stageElementRef.current ?? dialogElementRef.current;
        const viewport = panViewportEl?.getBoundingClientRect() ?? stage;
        const { w: contentW, h: contentH } = resolveContentSize(stage);
        const cx = stage.left + stage.width / 2;
        const cy = stage.top + stage.height / 2;
        return {
          viewport,
          stage,
          contentW,
          contentH,
          x: panOffsetRange(contentW, z, viewport.left, viewport.right, cx, minZoom),
          y: panOffsetRange(contentH, z, viewport.top, viewport.bottom, cy, minZoom),
        };
      },
      [resolveContentSize, dialogElementRef, stageElementRef, minZoom],
    );

    const clampOffsets = React.useCallback(
      (newOffsetX: number, newOffsetY: number, newZoom: number) => {
        const geo = measurePanGeometry(newZoom);
        if (!geo) return { x: 0, y: 0 };
        return clampOffsetToViewport(
          newOffsetX,
          newOffsetY,
          geo.contentW,
          geo.contentH,
          newZoom,
          geo.viewport,
          geo.stage,
          minZoom,
        );
      },
      [measurePanGeometry, minZoom],
    );

    // ----- Core actions -----
    const {
      captureStart: captureStartRaw,
      cancel: cancelZoomAnimationRaw,
      isAnimating,
      getIsDiscreteAnimating,
    } = useZoomAnimation(zoom, offsetX, offsetY, wrapperRef, DEFAULT_ANIMATION_DURATION);

    // Queue follow-up double-taps until the current discrete WAAPI settles.
    const zoomAnimSettleWaitersRef = React.useRef<Array<() => void>>([]);
    const flushZoomAnimSettleWaiters = React.useCallback(() => {
      const waiters = zoomAnimSettleWaitersRef.current;
      zoomAnimSettleWaitersRef.current = [];
      for (const waiter of waiters) waiter();
    }, []);

    const captureStart = React.useCallback(
      (opts?: Parameters<typeof captureStartRaw>[0]) => {
        const userOnFinish = opts?.onFinish;
        captureStartRaw({
          ...opts,
          onFinish: () => {
            userOnFinish?.();
            flushZoomAnimSettleWaiters();
          },
        });
      },
      [captureStartRaw, flushZoomAnimSettleWaiters],
    );

    const cancelZoomAnimation = React.useCallback(() => {
      // Drop queued double-taps — a live pinch/pan took over; don't fire them
      // after cancel (that would start a new discrete zoom mid-gesture).
      zoomAnimSettleWaitersRef.current = [];
      const live = cancelZoomAnimationRaw();
      if (live) {
        // A gesture interrupted a mid-flight WAAPI — commit the frozen visual
        // pose so the takeover continues from what's on screen instead of
        // teleporting to the animation's target. Refs sync eagerly so
        // same-turn readers (pan geometry, pinch arming) see the live pose.
        const liveZoom = round(live.zoom, 5);
        zoomRef.current = liveZoom;
        offsetXRef.current = live.offsetX;
        offsetYRef.current = live.offsetY;
        isElasticDrag.current = false;
        setZoom(liveZoom);
        setOffsetX(live.offsetX);
        setOffsetY(live.offsetY);
      }
    }, [cancelZoomAnimationRaw]);

    const whenZoomAnimationSettled = React.useCallback(
      (cb: () => void) => {
        // Only *discrete* zooms defer follow-ups. A baked settle (coast /
        // snap-back) is interruptible: run now — the callback's captureStart
        // samples the live mid-settle pose and takes over continuously.
        if (!getIsDiscreteAnimating()) {
          cb();
          return;
        }
        // Latest follow-up wins — don't stack toggles behind one anim.
        zoomAnimSettleWaitersRef.current = [cb];
      },
      [getIsDiscreteAnimating],
    );

    const reducedMotionPan =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /**
     * Catch a baked settle animation (coast / bounce / bound snap-back) at its
     * live pose — like putting a finger on a coasting scroll view. Discrete
     * zoom transitions are NOT caught here; gesture gates defer input while
     * those play.
     */
    const catchSettle = React.useCallback(() => {
      if (!getIsDiscreteAnimating()) cancelZoomAnimation();
    }, [getIsDiscreteAnimating, cancelZoomAnimation]);

    React.useEffect(() => () => stopZoomSnap(), [stopZoomSnap]);

    // ----- Sync data-zoomed + --lightbox-zoom-progress on Content -----
    // Only the active slide writes these, so they have a single writer and
    // never fight with preloaded (inactive) siblings.
    //
    // Continuous gestures (pinch/scroll) update React `zoom` every frame — publish
    // from that. Discrete zooms (double-tap) commit `zoom` immediately while WAAPI
    // animates the transform, so while `isAnimating` we sample the live scale from
    // the wrapper each frame and publish that — sibling filter/blur stays locked
    // to what the user sees. Progress hits 1 after +1× above minZoom.
    //
    // `holdZoomedChromeRef`: once progress has been > 0, keep `data-zoomed` through
    // the rest of a zoom-out WAAPI so chrome doesn’t flash early. Do *not* set it
    // for every animation — under-min / pan snap-back also animate and must leave
    // chrome visible.
    const holdZoomedChromeRef = React.useRef(false);
    React.useEffect(() => {
      if (!isActive) {
        holdZoomedChromeRef.current = false;
        return;
      }
      const el = dialogElementRef.current;
      if (!el) return;
      const progressVar = LightboxContentCssVars.zoomProgress;

      const publish = (scale: number) => {
        const progress = zoomProgressFromScale(scale, minZoom, maxZoom);
        // Discrete zoomTo commits React `zoom` before WAAPI moves the wrapper.
        // Treat committed zoom as zoomed too so `data-zoomed` doesn’t clear on
        // the first animated frames of a zoom-in (live scale still ≈ minZoom).
        const committedProgress = zoomProgressFromScale(zoom, minZoom, maxZoom);
        if (progress > 0 || committedProgress > 0) {
          holdZoomedChromeRef.current = true;
          el.setAttribute('data-zoomed', '');
          el.style.setProperty(progressVar, String(progress));
        } else if (isAnimating && holdZoomedChromeRef.current) {
          // Finishing a real zoom-out — keep chrome hidden until settle.
          el.setAttribute('data-zoomed', '');
          el.style.setProperty(progressVar, '0');
        } else {
          holdZoomedChromeRef.current = false;
          el.removeAttribute('data-zoomed');
          el.style.removeProperty(progressVar);
        }
      };

      if (!isAnimating) {
        publish(zoom);
        return;
      }

      // Publish committed zoom immediately — RAF sampling of the live WAAPI
      // transform starts on the next frame, which is too late for sync callers
      // (and would leave `data-zoomed` unset for a frame on zoom-in).
      publish(zoom);

      let raf = 0;
      const tick = () => {
        const wrapper = wrapperRef.current;
        const live = wrapper
          ? uniformScaleFromTransform(getComputedStyle(wrapper).transform)
          : null;
        publish(live ?? zoom);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, [isActive, zoom, minZoom, maxZoom, isAnimating, dialogElementRef]);

    const offsetXRef = React.useRef(offsetX);
    offsetXRef.current = offsetX;
    const offsetYRef = React.useRef(offsetY);
    offsetYRef.current = offsetY;

    // Raw (unclamped) offsets during elastic drag. The elastic formula
    // is applied to these to compute the displayed value, so resistance
    // is based on total overshoot rather than compounding.
    const rawOffsetX = React.useRef(0);
    const rawOffsetY = React.useRef(0);
    const isElasticDrag = React.useRef(false);

    const changeOffsetsAction = React.useCallback(
      (dx: number, dy: number, overscroll?: boolean, overflowAxesOnly?: boolean) => {
        // Live pan takes over any in-flight WAAPI (settle or discrete) at the
        // live pose.
        cancelZoomAnimation();
        const z = zoomRef.current;
        const geo = measurePanGeometry(z);
        if (!geo) return;
        const { x, y } = geo;

        if (overscroll) {
          // Touch (`overflowAxesOnly`): only pan axes that overflow — letterbox
          // stays put. Mouse: both axes rubber-band even when the item fits
          // (min===max rest → pure overshoot that snaps back).
          //
          // UIScrollView formula in offset space. Dimension is a fraction of
          // viewport/zoom — same screen-space feel at every zoom, but a shorter
          // leash than Apple's full-viewport scroll-view asymptote.
          const allowX = !overflowAxesOnly || x.overflows;
          const allowY = !overflowAxesOnly || y.overflows;
          if (!allowX && !allowY) return;

          if (!isElasticDrag.current) {
            isElasticDrag.current = true;
            rawOffsetX.current = offsetXRef.current;
            rawOffsetY.current = offsetYRef.current;
          }
          if (allowX) rawOffsetX.current -= dx;
          if (allowY) rawOffsetY.current -= dy;
          // Touch keeps the longer leash; mouse uses a shorter asymptote so
          // precise dragging can't yank the image as far past the edge.
          const dimFactor = overflowAxesOnly
            ? RUBBER_BAND_DIMENSION_FACTOR
            : RUBBER_BAND_DIMENSION_FACTOR_MOUSE;
          const dimX = rubberBandPanDimension(geo.viewport.width, z, dimFactor);
          const dimY = rubberBandPanDimension(geo.viewport.height, z, dimFactor);
          const nextX = allowX
            ? rubberBandClamp(rawOffsetX.current, x.min, x.max, dimX)
            : offsetXRef.current;
          const nextY = allowY
            ? rubberBandClamp(rawOffsetY.current, y.min, y.max, dimY)
            : offsetYRef.current;
          // Eager ref sync: same-task readers (release snap, pinch arming)
          // must see this move even before React commits the state.
          offsetXRef.current = nextX;
          offsetYRef.current = nextY;
          setOffsetX(nextX);
          setOffsetY(nextY);
        } else {
          // Hard-clamp path (keyboard / wheel): keep letterbox stable — no
          // pan on an axis that doesn't overflow. Offsets change outside the
          // elastic accumulator, so drop the latch — a later elastic drag must
          // re-anchor to the offsets it actually starts from.
          isElasticDrag.current = false;
          if (!x.overflows && !y.overflows) return;
          const nextX = x.overflows ? offsetXRef.current - dx : offsetXRef.current;
          const nextY = y.overflows ? offsetYRef.current - dy : offsetYRef.current;
          const clamped = clampOffsets(nextX, nextY, z);
          const finalX = x.overflows ? clamped.x : offsetXRef.current;
          const finalY = y.overflows ? clamped.y : offsetYRef.current;
          offsetXRef.current = finalX;
          offsetYRef.current = finalY;
          setOffsetX(finalX);
          setOffsetY(finalY);
        }
      },
      [clampOffsets, measurePanGeometry, cancelZoomAnimation],
    );

    const changeZoomAction = React.useCallback(
      (target: number, rapid: boolean, dx?: number, dy?: number, overscroll?: boolean) => {
        // A live pinch / wheel / discrete zoom takes zoom ownership from any
        // in-flight bound snap-back.
        stopZoomSnap();
        // Zoom rewrites offsets (focal projection / clamp) outside the elastic
        // pan accumulator. Drop the latch so a pan resuming after this zoom
        // (e.g. pinch 2→1 handoff) re-anchors to the current offsets instead
        // of teleporting back to stale pre-zoom raw values.
        isElasticDrag.current = false;
        const nextZoom = round(
          overscroll ? elasticClamp(target, minZoom, maxZoom) : clamp(target, minZoom, maxZoom),
          5,
        );

        // Discrete zooms arm WAAPI; rapid pinch/wheel must cancel any in-flight
        // discrete animation so the live transform isn't composited on top.
        if (rapid) cancelZoomAnimation();
        else captureStart();

        const currentZoom = zoomRef.current;
        if (dx !== undefined && dy !== undefined) {
          // Project onto the feasible pan set at nextZoom so scale always
          // advances even when the cursor sits past a cover edge.
          const geo = measurePanGeometry(nextZoom);
          if (geo) {
            const projected = projectFocalZoom(
              currentZoom,
              offsetXRef.current,
              offsetYRef.current,
              nextZoom,
              dx,
              dy,
              geo.x,
              geo.y,
            );
            // Eager ref sync — a same-task release (coalesced pinch move + up)
            // must see the elastic zoom, or its out-of-bounds snap won't fire.
            zoomRef.current = projected.zoom;
            offsetXRef.current = projected.offsetX;
            offsetYRef.current = projected.offsetY;
            setOffsetX(projected.offsetX);
            setOffsetY(projected.offsetY);
            setZoom(projected.zoom);
            return;
          }
        }

        const offsets = clampOffsets(offsetXRef.current, offsetYRef.current, nextZoom);
        zoomRef.current = nextZoom;
        offsetXRef.current = offsets.x;
        offsetYRef.current = offsets.y;
        setOffsetX(offsets.x);
        setOffsetY(offsets.y);
        setZoom(nextZoom);
      },
      [
        minZoom,
        maxZoom,
        clampOffsets,
        captureStart,
        cancelZoomAnimation,
        measurePanGeometry,
        stopZoomSnap,
      ],
    );

    const zoomInAction = React.useCallback(() => {
      const target = zoom * zoomStep;
      changeZoomAction(zoom < 1 && target > 1 ? 1 : target, false);
    }, [zoom, zoomStep, changeZoomAction]);

    const zoomOutAction = React.useCallback(() => {
      const target = zoom / zoomStep;
      changeZoomAction(zoom > 1 && target < 1 ? 1 : target, false);
    }, [zoom, zoomStep, changeZoomAction]);

    const resetAction = React.useCallback(
      (rapid = false) => {
        stopZoomSnap();
        if (!rapid) captureStart();
        isElasticDrag.current = false;
        zoomRef.current = minZoom;
        offsetXRef.current = 0;
        offsetYRef.current = 0;
        setZoom(minZoom);
        setOffsetX(0);
        setOffsetY(0);
      },
      [minZoom, captureStart, stopZoomSnap],
    );

    /**
     * Release-settle: bake the entire remaining trajectory — flick coast, edge
     * bounce, zoom bound snap-back and offset glide, jointly — and play it as
     * linear WAAPI keyframes on the compositor. This is what keeps post-release
     * motion smooth under a busy main thread and in iOS Low Power Mode, which
     * throttles rAF to ~30fps while compositor animations keep native refresh.
     *
     * An in-flight rAF zoom snap (started at a 2→1 pinch breakup, composing
     * with the live finger) is absorbed: its current spring velocity carries
     * into the bake, so the handoff at final release is seamless. The result
     * is fully interruptible — a new gesture cancels the WAAPI and takes over
     * at the exact live pose recovered from the baked trajectory.
     *
     * @param vx Offset-space px/s
     * @param vy Offset-space px/s
     * @param spring Mouse vs touch return feel (touch is softer).
     * @returns `true` when a settle started (or instantly committed).
     */
    const startPanPhysicsAction = React.useCallback(
      (vx: number, vy: number, spring: PanPhysicsSpring = PAN_PHYSICS_SPRING_MOUSE): boolean => {
        // Measure once — the settle plays on a static layout, so geometry is
        // pure math over cached rects for the whole bake.
        const stage = containerRef.current?.getBoundingClientRect() ?? null;
        if (!stage) return false;
        const panViewportEl = stageElementRef.current ?? dialogElementRef.current;
        const viewport = panViewportEl?.getBoundingClientRect() ?? stage;
        const { w: contentW, h: contentH } = resolveContentSize(stage);
        const cx = stage.left + stage.width / 2;
        const cy = stage.top + stage.height / 2;
        const geometryAt = (z: number) => ({
          x: panOffsetRange(contentW, z, viewport.left, viewport.right, cx, minZoom),
          y: panOffsetRange(contentH, z, viewport.top, viewport.bottom, cy, minZoom),
        });
        const restOffsetsAt = (z: number, ox: number, oy: number) =>
          clampOffsetToViewport(ox, oy, contentW, contentH, z, viewport, stage, minZoom);

        // Quick reject on the committed pose. Important: a release with
        // nothing to simulate (pinch release with v≈0, everything in range)
        // must NOT cancel a settle WAAPI that may still be flying.
        const snappingLive = zoomSnapRafRef.current != null;
        {
          const z0 = zoomRef.current;
          const g0 = geometryAt(z0);
          const zoomAtRest = z0 >= minZoom && z0 <= maxZoom;
          const outX = offsetXRef.current < g0.x.min || offsetXRef.current > g0.x.max;
          const outY = offsetYRef.current < g0.y.min || offsetYRef.current > g0.y.max;
          // Letterboxed axes don't coast — only spring home if already out.
          const speed = Math.hypot(
            g0.x.overflows || outX ? vx : 0,
            g0.y.overflows || outY ? vy : 0,
          );
          if (!snappingLive && zoomAtRest && !outX && !outY && speed < PAN_PHYSICS_STOP_SPEED) {
            return false;
          }
        }

        // Absorb a live rAF zoom snap — carry its spring velocity into the
        // bake so the value animation continues without a kink.
        let vz: number | undefined;
        if (snappingLive) {
          vz = zoomSnapVelRef.current;
          stopZoomSnap();
        }
        // Commit the live pose of any in-flight WAAPI so the bake starts from
        // exactly what's on screen.
        cancelZoomAnimation();
        isElasticDrag.current = false;

        const z = zoomRef.current;
        const bound = clamp(z, minZoom, maxZoom);
        const freshZoomReturn = vz === undefined && Math.abs(z - bound) > 1e-6;

        if (reducedMotionPan) {
          const rest = restOffsetsAt(bound, offsetXRef.current, offsetYRef.current);
          zoomRef.current = bound;
          offsetXRef.current = rest.x;
          offsetYRef.current = rest.y;
          setZoom(bound);
          setOffsetX(rest.x);
          setOffsetY(rest.y);
          return true;
        }

        const baked = bakeSettlePath({
          zoom: z,
          minZoom,
          maxZoom,
          vz,
          offsetX: offsetXRef.current,
          offsetY: offsetYRef.current,
          vx,
          vy,
          panSpring: spring,
          geometryAt,
          restOffsetsAt,
        });
        // Nothing left to animate — the live pose (already committed) is rest.
        if (!baked) return false;

        // Mirror iOS's light rubber-band tick as the scale starts returning —
        // unless carried from the live rAF snap, which ticked at the breakup.
        if (freshZoomReturn) triggerHaptic('snap');

        captureStart({
          kind: 'settle',
          path: baked.path,
          // Keyframes: captured live pose + path + committed rest pose, one
          // fixed bake step per interval.
          duration: (baked.path.length + 1) * SETTLE_BAKE_DT * 1000,
        });
        // Commit the rest pose; WAAPI plays the trajectory over it. Eager ref
        // sync keeps same-turn readers (pinch arming, wheel) on the rest pose.
        zoomRef.current = baked.zoom;
        offsetXRef.current = baked.offsetX;
        offsetYRef.current = baked.offsetY;
        setZoom(baked.zoom);
        setOffsetX(baked.offsetX);
        setOffsetY(baked.offsetY);
        return true;
      },
      [
        minZoom,
        maxZoom,
        resolveContentSize,
        dialogElementRef,
        stageElementRef,
        stopZoomSnap,
        cancelZoomAnimation,
        captureStart,
        reducedMotionPan,
      ],
    );

    /**
     * Return an out-of-bounds zoom to range. While a finger still composes the
     * live rAF snap (2→1 pan), let it run — the final release upgrades it to a
     * baked settle. Otherwise route through the settle baker so zoom and
     * offsets land together on the compositor.
     */
    const snapToBoundsAction = React.useCallback(() => {
      if (zoomSnapRafRef.current != null && draggingRef.current) return;
      const currentZoom = zoomRef.current;
      if (zoomSnapRafRef.current == null && currentZoom >= minZoom && currentZoom <= maxZoom) {
        return;
      }
      startPanPhysicsAction(0, 0);
    }, [minZoom, maxZoom, startPanPhysicsAction]);

    /** @returns `true` when offsets were past bounds and a spring-back started. */
    const snapOffsetsToBoundsAction = React.useCallback((): boolean => {
      return startPanPhysicsAction(0, 0);
    }, [startPanPhysicsAction]);

    /** @returns `true` when coast / bounce physics was started. */
    const momentumPanAction = React.useCallback(
      (vx: number, vy: number, touch = false): boolean =>
        startPanPhysicsAction(vx, vy, touch ? PAN_PHYSICS_SPRING_TOUCH : PAN_PHYSICS_SPRING_MOUSE),
      [startPanPhysicsAction],
    );

    // ----- Gesture hook -----
    const zoomRef = React.useRef(zoom);
    zoomRef.current = zoom;

    // Stable, always-fresh zoom reader for the active-zoom bridge (consumed by
    // Content's pull-to-dismiss and keyboard handlers).
    const getLiveZoom = React.useCallback(() => zoomRef.current, []);

    /**
     * iOS-style zoom rubber-band return: a rAF spring on the zoom *value*
     * that starts the moment a pinch breaks (2→1). The return is a UNIFORM
     * zoom-out about the stage center — no focal anchoring to the finger —
     * and it runs concurrently with the surviving finger's pan, which owns
     * the offsets the whole time. Offsets are only nudged toward their
     * clamped rest pose (along the same spring progress) when nothing else
     * is authoring them — no live drag, no pan physics — so a stationary
     * release still lands as one unified motion.
     *
     * @returns `true` when zoom was out of bounds and a snap-back started.
     */
    const startZoomSnapAction = React.useCallback((): boolean => {
      const from = zoomRef.current;
      const target = clamp(from, minZoom, maxZoom);
      if (Math.abs(target - from) < 1e-6) return false;
      stopZoomSnap();
      // Take over any discrete WAAPI continuously (commits its live pose).
      cancelZoomAnimation();
      // Mirror iOS's light rubber-band tick as the scale starts returning.
      triggerHaptic('snap');

      if (reducedMotionPan) {
        const offsets = clampOffsets(offsetXRef.current, offsetYRef.current, target);
        isElasticDrag.current = false;
        zoomRef.current = target;
        offsetXRef.current = offsets.x;
        offsetYRef.current = offsets.y;
        setZoom(target);
        setOffsetX(offsets.x);
        setOffsetY(offsets.y);
        return true;
      }

      // Seed at -ω·x₀ so the critically damped spring becomes pure exponential
      // decay — max velocity at release (crisp, iOS ease-out), no overshoot.
      // From rest the same spring eases in for ~40ms, which reads as lazy.
      zoomSnapVelRef.current = zoomSnapSeedVelocity(from, target);

      const tick = (ts: number) => {
        const prev = zoomSnapLastTsRef.current;
        zoomSnapLastTsRef.current = ts;
        let dt = prev > 0 ? (ts - prev) / 1000 : 1 / 60;
        if (dt > 0.048) dt = 1 / 60;

        const z = zoomRef.current;
        const bound = clamp(z, minZoom, maxZoom);
        const step = stepPanPhysicsAxis(
          { position: z, velocity: zoomSnapVelRef.current, min: bound, max: bound, canCoast: false },
          dt,
          PAN_PHYSICS_FRICTION,
          ZOOM_SNAP_SPRING.stiffness,
          ZOOM_SNAP_SPRING.damping,
          ZOOM_SNAP_STOP_SPEED,
          ZOOM_SNAP_STOP_DISTANCE,
        );
        zoomSnapVelRef.current = step.velocity;
        const nextZ = step.settled ? bound : step.position;

        // Offsets: hands off while a finger drags — the finger owns them
        // (rubber-band handles ranges at the animating zoom), and a held
        // overscroll is legit gesture state. Otherwise glide offsets toward
        // their clamped rest pose at the bound by the fraction of remaining
        // zoom distance this frame covered — both settle together, as one
        // motion. The rest pose is re-derived per frame so it can't go stale.
        const offsetsOwned = draggingRef.current;
        if (!offsetsOwned) {
          const rest = clampOffsets(offsetXRef.current, offsetYRef.current, bound);
          if (rest.x !== offsetXRef.current || rest.y !== offsetYRef.current) {
            const denom = z - bound;
            const f = denom !== 0 ? Math.min(1, Math.max(0, (z - nextZ) / denom)) : 1;
            const nextX = offsetXRef.current + (rest.x - offsetXRef.current) * f;
            const nextY = offsetYRef.current + (rest.y - offsetYRef.current) * f;
            offsetXRef.current = nextX;
            offsetYRef.current = nextY;
            setOffsetX(nextX);
            setOffsetY(nextY);
          }
        }

        zoomRef.current = nextZ;
        setZoom(nextZ);

        if (step.settled) {
          zoomSnapRafRef.current = null;
          zoomSnapLastTsRef.current = 0;
          zoomSnapVelRef.current = 0;
          // Safety: land offsets in range at the final zoom, unless a live
          // finger owns them (its own release re-clamps).
          if (!draggingRef.current) {
            snapOffsetsToBoundsAction();
          }
          return;
        }
        zoomSnapRafRef.current = requestAnimationFrame(tick);
      };

      zoomSnapLastTsRef.current = 0;
      zoomSnapRafRef.current = requestAnimationFrame(tick);
      return true;
    }, [
      minZoom,
      maxZoom,
      stopZoomSnap,
      cancelZoomAnimation,
      clampOffsets,
      reducedMotionPan,
      snapOffsetsToBoundsAction,
    ]);

    const gestureConfig = React.useMemo<ZoomGestureConfig>(
      () => ({
        minZoom,
        maxZoom,
        zoomStep,
        scrollToZoom,
        wheelSensitivity,
        keyboardPanDistance,
        doubleClickDelay,
      }),
      [minZoom, maxZoom, zoomStep, scrollToZoom, wheelSensitivity, keyboardPanDistance, doubleClickDelay],
    );

    const gestureActions = React.useMemo<ZoomGestureActions>(
      () => ({
        getZoom: () => zoomRef.current,
        getOffsets: () => ({ x: offsetXRef.current, y: offsetYRef.current }),
        zoomIn: zoomInAction,
        zoomOut: zoomOutAction,
        changeZoom: changeZoomAction,
        changeOffsets: changeOffsetsAction,
        setDragging: setDraggingAction,
        snapToBounds: snapToBoundsAction,
        snapOffsetsToBounds: snapOffsetsToBoundsAction,
        momentumPan: momentumPanAction,
        startZoomSnap: startZoomSnapAction,
        stopZoomSnap,
        isZoomSnapActive,
        catchSettle,
        cancelZoomAnimation,
        isZoomAnimating: getIsDiscreteAnimating,
        whenZoomAnimationSettled,
      }),
      [
        zoomInAction,
        zoomOutAction,
        changeZoomAction,
        changeOffsetsAction,
        setDraggingAction,
        snapToBoundsAction,
        snapOffsetsToBoundsAction,
        momentumPanAction,
        startZoomSnapAction,
        stopZoomSnap,
        isZoomSnapActive,
        catchSettle,
        cancelZoomAnimation,
        getIsDiscreteAnimating,
        whenZoomAnimationSettled,
      ],
    );

    // Only the active slide owns Stage/Content-level wheel/gesture listeners so
    // preloaded siblings don’t all fight over the same host.
    useZoomGestures(
      containerRef,
      wrapperRef,
      gestureConfig,
      gestureActions,
      !isActive,
      dialogElementRef,
      zoom,
      navigationLockedRef,
      stageElementRef,
    );

    // ----- Imperative ref -----
    React.useImperativeHandle(
      forwardedRef,
      () => ({
        zoom,
        maxZoom,
        offsetX,
        offsetY,
        zoomIn: zoomInAction,
        zoomOut: zoomOutAction,
        zoomTo: (target, opts) => changeZoomAction(target, opts?.rapid ?? false, opts?.dx, opts?.dy),
        reset: resetAction,
      }),
      [zoom, maxZoom, offsetX, offsetY, zoomInAction, zoomOutAction, changeZoomAction, resetAction],
    );

    // ----- Context value -----
    const canZoomIn = zoom < maxZoom;
    const canZoomOut = zoom > minZoom;

    const contextValue = React.useMemo<ZoomContextValue>(
      () => ({
        zoom,
        maxZoom,
        offsetX,
        offsetY,
        canZoomIn,
        canZoomOut,
        zoomIn: zoomInAction,
        zoomOut: zoomOutAction,
        zoomTo: (target, opts) => changeZoomAction(target, opts?.rapid ?? false, opts?.dx, opts?.dy),
        reset: resetAction,
        changeOffsets: changeOffsetsAction,
      }),
      [zoom, maxZoom, offsetX, offsetY, canZoomIn, canZoomOut, zoomInAction, zoomOutAction, changeZoomAction, resetAction, changeOffsetsAction],
    );

    // ----- Active-zoom bridge -----
    // Publish this slide's controls to Root while it is the active slide, so a
    // single global set of ZoomIn/ZoomOut controls can drive it. Cleanup guards
    // by identity so a slide swap never nulls out the incoming controls.
    const activeControls = React.useMemo<ActiveZoomControls>(
      () => ({
        canZoomIn,
        canZoomOut,
        zoomIn: zoomInAction,
        zoomOut: zoomOutAction,
        reset: () => resetAction(),
        panBy: (dx: number, dy: number) => changeOffsetsAction(dx, dy),
        keyboardPanDistance,
        getZoom: getLiveZoom,
      }),
      [canZoomIn, canZoomOut, zoomInAction, zoomOutAction, resetAction, changeOffsetsAction, keyboardPanDistance, getLiveZoom],
    );

    React.useEffect(() => {
      if (!isActive) return;
      publishActiveZoom(activeControls);
      return () => {
        publishActiveZoom((prev) => (prev === activeControls ? null : prev));
      };
    }, [isActive, activeControls, publishActiveZoom]);

    // ----- Render -----
    const state = React.useMemo<LightboxZoomState>(
      () => ({ zoom, maxZoom, offsetX, offsetY, canZoomIn, canZoomOut, dragging }),
      [zoom, maxZoom, offsetX, offsetY, canZoomIn, canZoomOut, dragging],
    );

    const resolvedChildren = typeof children === 'function' ? children(state) : children;

    // The transform wrapper is an internal implementation detail: it centers
    // and scales the content. Consumers style the outer element (via `render`/
    // `className`) and pass their content as `children`.
    const wrapper = (
      <div
        ref={wrapperRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transformOrigin: 'center center',
          transform: `scale(${zoom}) translate(${offsetX}px, ${offsetY}px)`,
          willChange: zoom > 1 ? 'transform' : undefined,
        }}
      >
        {resolvedChildren}
      </div>
    );

    const element = useRender({
      render,
      ref: containerRef,
      state,
      stateAttributesMapping,
      props: mergeProps<'div'>(
        {
          [LightboxZoomDataAttributes.host]: '',
          style: {
            position: 'relative',
            width: '100%',
            height: '100%',
            // Size container for Media’s cqw/cqh fit-box (structural, not cosmetic).
            containerType: 'size',
            touchAction: zoom > minZoom ? 'none' : 'pan-x pan-y',
            cursor: dragging ? 'grabbing' : zoom > 1 ? 'grab' : undefined,
            userSelect: 'none',
          },
        } as React.ComponentPropsWithRef<'div'>,
        elementProps as React.ComponentPropsWithRef<'div'>,
        { children: wrapper } as React.ComponentPropsWithRef<'div'>,
      ),
      defaultTagName: 'div',
    });

    return <ZoomContext.Provider value={contextValue}>{element}</ZoomContext.Provider>;
  },
);

LightboxZoom.displayName = 'LightboxZoom';

export { LightboxZoom };
export type { LightboxZoomProps, LightboxZoomRef, LightboxZoomState };

