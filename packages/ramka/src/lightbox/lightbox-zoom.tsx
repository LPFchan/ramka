'use client';

import { mergeProps, useRender } from '@base-ui/react';
import * as React from 'react';

import {
  clamp,
  clampOffsetToViewport,
  computeMaxZoom,
  elasticClamp,
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
  stepPanPhysics2D,
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
// Releasing a pinch past a zoom bound rubber-bands the scale back into range.
// A firm, no-overshoot decelerate — matching the pull-to-dismiss snap-back's
// serious, no-overflow feel. There is no release velocity to carry on a pinch,
// so a strong ease-out is equivalent to a critically-damped spring here. An
// overshoot would spring the scale *past* the min/max bound (a zoom overflow),
// which is exactly what we avoid.
const ZOOM_SNAP_OPTS = { duration: 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' } as const;

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
    const [imageDimensions, setImageDimensions] = React.useState<{ w: number; h: number } | null>(null);
    const [containerSize, setContainerSize] = React.useState<{ w: number; h: number } | null>(null);

    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const wrapperRef = React.useRef<HTMLDivElement | null>(null);

    const onZoomChangeRef = React.useRef(onZoomChange);
    onZoomChangeRef.current = onZoomChange;

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
      setZoom(minZoom);
      setOffsetX(0);
      setOffsetY(0);
      setImageDimensions(null);
    }, [activeIndex, minZoom]);

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
      captureStart,
      cancel: cancelZoomAnimation,
      isAnimating,
      getIsAnimating,
    } = useZoomAnimation(zoom, offsetX, offsetY, wrapperRef, DEFAULT_ANIMATION_DURATION);

    // rAF 2D scroll physics (friction coast + spring bounce). Not WAAPI.
    const panPhysicsRafRef = React.useRef<number | null>(null);
    const panPhysicsLastTsRef = React.useRef(0);
    const panVelRef = React.useRef({ vx: 0, vy: 0 });
    const reducedMotionPan =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const stopPanPhysics = React.useCallback(() => {
      if (panPhysicsRafRef.current != null) {
        cancelAnimationFrame(panPhysicsRafRef.current);
        panPhysicsRafRef.current = null;
      }
      panPhysicsLastTsRef.current = 0;
      panVelRef.current = { vx: 0, vy: 0 };
    }, []);

    React.useEffect(() => () => stopPanPhysics(), [stopPanPhysics]);

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
        stopPanPhysics();
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
          setOffsetX(allowX ? rubberBandClamp(rawOffsetX.current, x.min, x.max, dimX) : offsetXRef.current);
          setOffsetY(allowY ? rubberBandClamp(rawOffsetY.current, y.min, y.max, dimY) : offsetYRef.current);
        } else {
          // Hard-clamp path (keyboard / wheel): keep letterbox stable — no
          // pan on an axis that doesn't overflow.
          if (!x.overflows && !y.overflows) return;
          const nextX = x.overflows ? offsetXRef.current - dx : offsetXRef.current;
          const nextY = y.overflows ? offsetYRef.current - dy : offsetYRef.current;
          const clamped = clampOffsets(nextX, nextY, z);
          setOffsetX(x.overflows ? clamped.x : offsetXRef.current);
          setOffsetY(y.overflows ? clamped.y : offsetYRef.current);
        }
      },
      [clampOffsets, measurePanGeometry, stopPanPhysics],
    );

    const changeZoomAction = React.useCallback(
      (target: number, rapid: boolean, dx?: number, dy?: number, overscroll?: boolean) => {
        stopPanPhysics();
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
            setOffsetX(projected.offsetX);
            setOffsetY(projected.offsetY);
            setZoom(projected.zoom);
            return;
          }
        }

        const offsets = clampOffsets(offsetXRef.current, offsetYRef.current, nextZoom);
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
        stopPanPhysics,
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
        if (!rapid) captureStart();
        setZoom(minZoom);
        setOffsetX(0);
        setOffsetY(0);
      },
      [minZoom, captureStart],
    );

    const snapToBoundsAction = React.useCallback(() => {
      const currentZoom = zoomRef.current;
      if (currentZoom >= minZoom && currentZoom <= maxZoom) return;
      // The gesture was released past a zoom bound — mirror iOS's light
      // rubber-band tick as the scale snaps back into range.
      triggerHaptic('snap');
      captureStart(ZOOM_SNAP_OPTS);
      const snapped = clamp(currentZoom, minZoom, maxZoom);
      const offsets = clampOffsets(offsetXRef.current, offsetYRef.current, snapped);
      setZoom(snapped);
      setOffsetX(offsets.x);
      setOffsetY(offsets.y);
    }, [minZoom, maxZoom, clampOffsets, captureStart]);

    /**
     * Native-like 2D scroll physics: friction coast inside bounds, spring bounce
     * past edges. Driven by rAF — not WAAPI keyframes.
     *
     * @param vx Offset-space px/s
     * @param vy Offset-space px/s
     * @param spring Mouse vs touch return feel (touch is softer).
     * @returns `true` when a simulation was started (or instantly settled).
     */
    const startPanPhysicsAction = React.useCallback(
      (vx: number, vy: number, spring: PanPhysicsSpring = PAN_PHYSICS_SPRING_MOUSE): boolean => {
        stopPanPhysics();
        cancelZoomAnimation();
        isElasticDrag.current = false;

        const z = zoomRef.current;
        const geo = measurePanGeometry(z);
        if (!geo) return false;

        let x = offsetXRef.current;
        let y = offsetYRef.current;
        let velX = vx;
        let velY = vy;
        const outX = x < geo.x.min || x > geo.x.max;
        const outY = y < geo.y.min || y > geo.y.max;
        // Letterboxed axes don't coast — only spring home if already past rest.
        if (!geo.x.overflows && !outX) velX = 0;
        if (!geo.y.overflows && !outY) velY = 0;

        const speed = Math.hypot(velX, velY);
        if (!outX && !outY && speed < PAN_PHYSICS_STOP_SPEED) return false;

        if (reducedMotionPan) {
          const clamped = clampOffsets(x, y, z);
          setOffsetX(clamped.x);
          setOffsetY(clamped.y);
          return true;
        }

        panVelRef.current = { vx: velX, vy: velY };

        const tick = (ts: number) => {
          const prev = panPhysicsLastTsRef.current;
          panPhysicsLastTsRef.current = ts;
          let dt = prev > 0 ? (ts - prev) / 1000 : 1 / 60;
          if (dt > 0.048) dt = 1 / 60;

          const g = measurePanGeometry(zoomRef.current);
          if (!g) {
            panPhysicsRafRef.current = null;
            return;
          }

          const next = stepPanPhysics2D(
            {
              x: offsetXRef.current,
              y: offsetYRef.current,
              vx: panVelRef.current.vx,
              vy: panVelRef.current.vy,
            },
            g.x,
            g.y,
            g.x.overflows,
            g.y.overflows,
            dt,
            spring,
          );
          panVelRef.current = { vx: next.vx, vy: next.vy };
          offsetXRef.current = next.x;
          offsetYRef.current = next.y;
          setOffsetX(next.x);
          setOffsetY(next.y);

          if (next.settled) {
            const clamped = clampOffsets(next.x, next.y, zoomRef.current);
            offsetXRef.current = clamped.x;
            offsetYRef.current = clamped.y;
            setOffsetX(clamped.x);
            setOffsetY(clamped.y);
            panPhysicsRafRef.current = null;
            panPhysicsLastTsRef.current = 0;
            panVelRef.current = { vx: 0, vy: 0 };
            return;
          }

          panPhysicsRafRef.current = requestAnimationFrame(tick);
        };

        panPhysicsLastTsRef.current = 0;
        panPhysicsRafRef.current = requestAnimationFrame(tick);
        return true;
      },
      [stopPanPhysics, cancelZoomAnimation, measurePanGeometry, clampOffsets, reducedMotionPan],
    );

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
        setDragging,
        snapToBounds: snapToBoundsAction,
        snapOffsetsToBounds: snapOffsetsToBoundsAction,
        momentumPan: momentumPanAction,
        stopPanPhysics,
        isZoomAnimating: getIsAnimating,
      }),
      [
        zoomInAction,
        zoomOutAction,
        changeZoomAction,
        changeOffsetsAction,
        snapToBoundsAction,
        snapOffsetsToBoundsAction,
        momentumPanAction,
        stopPanPhysics,
        getIsAnimating,
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

