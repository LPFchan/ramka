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
import { PoseController, type ZoomPose } from './pose-controller';
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

    // ----- Pose engine (single owner of style.transform) -----
    const reducedMotionPan =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const controllerRef = React.useRef<PoseController | null>(null);
    if (controllerRef.current == null) {
      controllerRef.current = new PoseController(
        { zoom: minZoom, offsetX: 0, offsetY: 0 },
        { reducedMotion: reducedMotionPan, defaultDiscreteDuration: DEFAULT_ANIMATION_DURATION },
      );
    }
    const controller = controllerRef.current;

    // Commit-store snapshot for React UI (phase boundaries / animation ends).
    // Hot pan/pinch does NOT notify this — no re-render per pointermove.
    const poseSnap = React.useSyncExternalStore(
      controller.subscribeCommit,
      controller.getSnapshot,
      controller.getSnapshot,
    );
    const zoom = poseSnap.zoom;
    const offsetX = poseSnap.offsetX;
    const offsetY = poseSnap.offsetY;

    // Eager pose mirrors for same-turn gesture math (pinch arming, release bake).
    const zoomRef = React.useRef(minZoom);
    const offsetXRef = React.useRef(0);
    const offsetYRef = React.useRef(0);
    const syncPoseRefs = React.useCallback((p: ZoomPose) => {
      zoomRef.current = p.zoom;
      offsetXRef.current = p.offsetX;
      offsetYRef.current = p.offsetY;
    }, []);
    React.useEffect(() => {
      syncPoseRefs(controller.getPose());
    });

    const [dragging, setDragging] = React.useState(false);
    // Frame-scoped layout cache storage — declared early so gesture-boundary
    // actions can invalidate it; populated by `measureStageLayout` below.
    const layoutCacheRef = React.useRef<{
      stage: DOMRect;
      viewport: DOMRect;
      contentW: number;
      contentH: number;
    } | null>(null);
    const layoutCacheRafRef = React.useRef<number | null>(null);
    // Sync mirror for rAF ticks (zoom snap-back) that must know, mid-frame,
    // whether a finger currently owns the offsets.
    const draggingRef = React.useRef(false);
    const setDraggingAction = React.useCallback(
      (value: boolean) => {
        draggingRef.current = value;
        if (value) {
          const live = controller.beginTracking();
          syncPoseRefs(live);
          setDragging(true);
          // Fresh geometry for the new gesture. Do NOT clear on release — the
          // settle bake needs the same-frame cache from the last pointermove.
          layoutCacheRef.current = null;
          return;
        }
        // UI-only on release: data-dragging / cursor. Pose phase is owned by
        // settle/discrete/finish — never notifyCommit here (that dumped the
        // full pan delta into React before WAAPI and caused the flick jump).
        setDragging(false);
        if (controller.isSettling() || controller.isDiscreteAnimating()) return;
        if (controller.getPhase() === 'tracking') {
          controller.endTracking({ commit: false });
        }
      },
      [controller, syncPoseRefs],
    );
    const [imageDimensions, setImageDimensions] = React.useState<{ w: number; h: number } | null>(null);
    const [containerSize, setContainerSize] = React.useState<{ w: number; h: number } | null>(null);

    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const wrapperRef = React.useRef<HTMLDivElement | null>(null);
    const setWrapperRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        wrapperRef.current = node;
        controller.attach(node);
      },
      [controller],
    );

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
      controller.replacePose({ zoom: minZoom, offsetX: 0, offsetY: 0 });
      setImageDimensions(null);
    }, [activeIndex, minZoom, stopZoomSnap, controller]);

    // ----- Fire callback on zoom change (commit epochs only) -----
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

    // Frame-scoped layout measurement. Pan geometry needs 2× getBoundingClientRect
    // plus a querySelector + offsetWidth/Height read, and it used to run on
    // EVERY pointermove — a forced style/layout flush right after the previous
    // move's commit dirtied style. None of these rects depend on the zoom
    // transform (the wrapper is transformed, its ancestors are not), so within
    // a rendered frame they cannot meaningfully change: measure once per frame
    // and share across moves, clamps, and the release-settle bake.
    const measureStageLayout = React.useCallback(() => {
      const cached = layoutCacheRef.current;
      if (cached) return cached;
      const stage = containerRef.current?.getBoundingClientRect() ?? null;
      if (!stage) return null;
      const panViewportEl = stageElementRef.current ?? dialogElementRef.current;
      const viewport = panViewportEl?.getBoundingClientRect() ?? stage;
      const { w: contentW, h: contentH } = resolveContentSize(stage);
      const measured = { stage, viewport, contentW, contentH };
      layoutCacheRef.current = measured;
      if (typeof requestAnimationFrame === 'function' && layoutCacheRafRef.current == null) {
        layoutCacheRafRef.current = requestAnimationFrame(() => {
          layoutCacheRafRef.current = null;
          layoutCacheRef.current = null;
        });
      }
      return measured;
    }, [resolveContentSize, dialogElementRef, stageElementRef]);
    // Defensive invalidation for environments where rAF doesn't tick between
    // synchronous gesture bursts (tests) and for viewport changes.
    const invalidateStageLayout = React.useCallback(() => {
      layoutCacheRef.current = null;
    }, []);
    React.useEffect(() => {
      if (typeof window === 'undefined') return;
      window.addEventListener('resize', invalidateStageLayout);
      return () => window.removeEventListener('resize', invalidateStageLayout);
    }, [invalidateStageLayout]);

    /**
     * Pan viewport = `Lightbox.Stage` when mounted, else Content (dialog).
     * Transform stage = Zoom (origin). Uneven Slide padding makes those
     * centers differ — true cover against the pan viewport is required so
     * every edge is reachable. `panOffsetRange` keeps the fit→overflow
     * crossing continuous via a home offset lerp toward δ.
     */
    const measurePanGeometry = React.useCallback(
      (z: number) => {
        const layout = measureStageLayout();
        if (!layout) return null;
        const { stage, viewport, contentW, contentH } = layout;
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
      [measureStageLayout, minZoom],
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

    // Raw (unclamped) offsets during elastic drag. The elastic formula
    // is applied to these to compute the displayed value, so resistance
    // is based on total overshoot rather than compounding.
    const rawOffsetX = React.useRef(0);
    const rawOffsetY = React.useRef(0);
    const isElasticDrag = React.useRef(false);

    const writeHotPose = React.useCallback(
      (p: ZoomPose) => {
        syncPoseRefs(p);
        controller.setPose(p);
      },
      [controller, syncPoseRefs],
    );

    // ----- Core actions -----
    // Queue follow-up double-taps until the current discrete WAAPI settles.
    const zoomAnimSettleWaitersRef = React.useRef<Array<() => void>>([]);
    const flushZoomAnimSettleWaiters = React.useCallback(() => {
      const waiters = zoomAnimSettleWaitersRef.current;
      zoomAnimSettleWaitersRef.current = [];
      for (const waiter of waiters) waiter();
    }, []);

    const getIsDiscreteAnimating = React.useCallback(() => controller.isDiscreteAnimating(), [controller]);

    const cancelZoomAnimation = React.useCallback(() => {
      // Drop queued double-taps — a live pinch/pan took over; don't fire them
      // after cancel (that would start a new discrete zoom mid-gesture).
      zoomAnimSettleWaitersRef.current = [];
      if (controller.getPhase() === 'idle' || controller.getPhase() === 'tracking') return;
      const live = controller.cancel();
      if (live) {
        syncPoseRefs(live);
        isElasticDrag.current = false;
      }
    }, [controller, syncPoseRefs]);

    const whenZoomAnimationSettled = React.useCallback(
      (cb: () => void) => {
        // Only *discrete* zooms defer follow-ups. A baked settle is interruptible.
        if (!controller.isDiscreteAnimating()) {
          cb();
          return;
        }
        zoomAnimSettleWaitersRef.current = [cb];
      },
      [controller],
    );

    /**
     * Catch a baked settle at its live pose — like putting a finger on a
     * coasting scroll view. Discrete transitions are NOT caught here.
     */
    const catchSettle = React.useCallback(() => {
      if (!controller.isDiscreteAnimating()) {
        if (controller.isSettling()) {
          const live = controller.catch();
          if (live) syncPoseRefs(live);
        }
      }
    }, [controller, syncPoseRefs]);

    React.useEffect(() => () => stopZoomSnap(), [stopZoomSnap]);

    // ----- Sync data-zoomed + --lightbox-zoom-progress on Content -----
    // Visual subscription: updates on every pose write (pinch) without React
    // re-renders. Zoom-static settles skip the sampling loop — scale is fixed.
    const holdZoomedChromeRef = React.useRef(false);
    React.useEffect(() => {
      if (!isActive) {
        holdZoomedChromeRef.current = false;
        return;
      }
      const el = dialogElementRef.current;
      if (!el) return;
      const progressVar = LightboxContentCssVars.zoomProgress;

      let writtenZoomed: boolean | null = null;
      let writtenProgress: string | null | undefined;

      const publish = (scale: number, phaseAnimatingZoom: boolean) => {
        // Visual scale drives progress. Committed snapshot covers discrete
        // zoom-in (target committed early while WAAPI still starts at 1×).
        // Hold keeps data-zoomed through discrete zoom-out until finish.
        const progress = zoomProgressFromScale(scale, minZoom, maxZoom);
        const committedProgress = zoomProgressFromScale(
          controller.getSnapshot().zoom,
          minZoom,
          maxZoom,
        );
        let zoomed: boolean;
        let progressValue: string | null;
        if (progress > 0 || committedProgress > 0) {
          holdZoomedChromeRef.current = true;
          zoomed = true;
          progressValue = String(Math.max(progress, committedProgress));
        } else if (phaseAnimatingZoom && holdZoomedChromeRef.current) {
          zoomed = true;
          progressValue = '0';
        } else {
          holdZoomedChromeRef.current = false;
          zoomed = false;
          progressValue = null;
        }
        if (zoomed !== writtenZoomed) {
          writtenZoomed = zoomed;
          if (zoomed) el.setAttribute('data-zoomed', '');
          else el.removeAttribute('data-zoomed');
        }
        if (progressValue !== writtenProgress) {
          writtenProgress = progressValue;
          if (progressValue == null) el.style.removeProperty(progressVar);
          else el.style.setProperty(progressVar, progressValue);
        }
      };

      let raf = 0;
      const zoomAnimates = () => {
        const phase = controller.getPhase();
        return (
          (phase === 'settling' || phase === 'discrete') && controller.getAnimatesZoom()
        );
      };
      const tick = () => {
        if (!zoomAnimates()) {
          publish(controller.getPose().zoom, false);
          return;
        }
        let live = controller.getLiveAnimatedZoom();
        if (live == null) {
          const wrapper = wrapperRef.current;
          live = wrapper
            ? uniformScaleFromTransform(getComputedStyle(wrapper).transform)
            : null;
        }
        publish(live ?? controller.getPose().zoom, true);
        raf = requestAnimationFrame(tick);
      };

      const onVisual = () => {
        cancelAnimationFrame(raf);
        if (zoomAnimates()) {
          tick();
          return;
        }
        publish(controller.getPose().zoom, false);
      };

      onVisual();
      const unsub = controller.subscribeVisual(onVisual);
      return () => {
        unsub();
        cancelAnimationFrame(raf);
      };
    }, [isActive, minZoom, maxZoom, dialogElementRef, controller]);

    const changeOffsetsAction = React.useCallback(
      (dx: number, dy: number, overscroll?: boolean, overflowAxesOnly?: boolean) => {
        // Live pan takes over any in-flight settle at the live pose.
        if (controller.isSettling()) {
          const caught = controller.catch();
          if (caught) syncPoseRefs(caught);
        } else if (controller.isDiscreteAnimating()) return;

        const live = controller.getPose();
        syncPoseRefs(live);
        const z = live.zoom;
        const geo = measurePanGeometry(z);
        if (!geo) return;
        const { x, y } = geo;

        if (overscroll) {
          // Touch (`overflowAxesOnly`): only pan axes that overflow — letterbox
          // stays put. Mouse: both axes rubber-band even when the item fits
          // (min===max rest → pure overshoot that snaps back).
          const allowX = !overflowAxesOnly || x.overflows;
          const allowY = !overflowAxesOnly || y.overflows;
          if (!allowX && !allowY) return;

          if (!isElasticDrag.current) {
            isElasticDrag.current = true;
            rawOffsetX.current = live.offsetX;
            rawOffsetY.current = live.offsetY;
          }
          if (allowX) rawOffsetX.current -= dx;
          if (allowY) rawOffsetY.current -= dy;
          const dimFactor = overflowAxesOnly
            ? RUBBER_BAND_DIMENSION_FACTOR
            : RUBBER_BAND_DIMENSION_FACTOR_MOUSE;
          const dimX = rubberBandPanDimension(geo.viewport.width, z, dimFactor);
          const dimY = rubberBandPanDimension(geo.viewport.height, z, dimFactor);
          const nextX = allowX
            ? rubberBandClamp(rawOffsetX.current, x.min, x.max, dimX)
            : live.offsetX;
          const nextY = allowY
            ? rubberBandClamp(rawOffsetY.current, y.min, y.max, dimY)
            : live.offsetY;
          writeHotPose({ zoom: z, offsetX: nextX, offsetY: nextY });
        } else {
          isElasticDrag.current = false;
          if (!x.overflows && !y.overflows) return;
          const nextX = x.overflows ? live.offsetX - dx : live.offsetX;
          const nextY = y.overflows ? live.offsetY - dy : live.offsetY;
          const clamped = clampOffsets(nextX, nextY, z);
          writeHotPose({
            zoom: z,
            offsetX: x.overflows ? clamped.x : live.offsetX,
            offsetY: y.overflows ? clamped.y : live.offsetY,
          });
        }
      },
      [clampOffsets, measurePanGeometry, controller, syncPoseRefs, writeHotPose],
    );

    const changeZoomAction = React.useCallback(
      (target: number, rapid: boolean, dx?: number, dy?: number, overscroll?: boolean) => {
        stopZoomSnap();
        isElasticDrag.current = false;
        const nextZoom = round(
          overscroll ? elasticClamp(target, minZoom, maxZoom) : clamp(target, minZoom, maxZoom),
          5,
        );

        const current = controller.getPose();
        let to: ZoomPose;
        if (dx !== undefined && dy !== undefined) {
          const geo = measurePanGeometry(nextZoom);
          if (geo) {
            const projected = projectFocalZoom(
              current.zoom,
              current.offsetX,
              current.offsetY,
              nextZoom,
              dx,
              dy,
              geo.x,
              geo.y,
            );
            to = {
              zoom: projected.zoom,
              offsetX: projected.offsetX,
              offsetY: projected.offsetY,
            };
          } else {
            const offsets = clampOffsets(current.offsetX, current.offsetY, nextZoom);
            to = { zoom: nextZoom, offsetX: offsets.x, offsetY: offsets.y };
          }
        } else {
          const offsets = clampOffsets(current.offsetX, current.offsetY, nextZoom);
          to = { zoom: nextZoom, offsetX: offsets.x, offsetY: offsets.y };
        }

        if (rapid) {
          // Pinch/wheel: direct writes, no WAAPI.
          if (controller.isSettling() || controller.isDiscreteAnimating()) controller.cancel();
          writeHotPose(to);
          return;
        }

        // Discrete: WAAPI from current pose → target. Commit notify on arm.
        controller.discrete({
          to,
          onFinish: () => {
            syncPoseRefs(to);
            flushZoomAnimSettleWaiters();
          },
        });
        syncPoseRefs(to);
      },
      [
        minZoom,
        maxZoom,
        clampOffsets,
        measurePanGeometry,
        stopZoomSnap,
        controller,
        writeHotPose,
        syncPoseRefs,
        flushZoomAnimSettleWaiters,
      ],
    );

    const zoomInAction = React.useCallback(() => {
      const z = controller.getPose().zoom;
      const target = z * zoomStep;
      changeZoomAction(z < 1 && target > 1 ? 1 : target, false);
    }, [zoomStep, changeZoomAction, controller]);

    const zoomOutAction = React.useCallback(() => {
      const z = controller.getPose().zoom;
      const target = z / zoomStep;
      changeZoomAction(z > 1 && target < 1 ? 1 : target, false);
    }, [zoomStep, changeZoomAction, controller]);

    const resetAction = React.useCallback(
      (rapid = false) => {
        stopZoomSnap();
        isElasticDrag.current = false;
        const to = { zoom: minZoom, offsetX: 0, offsetY: 0 };
        if (rapid) {
          controller.replacePose(to);
          syncPoseRefs(to);
          return;
        }
        controller.discrete({
          to,
          onFinish: () => {
            syncPoseRefs(to);
            flushZoomAnimSettleWaiters();
          },
        });
        syncPoseRefs(to);
      },
      [minZoom, stopZoomSnap, controller, syncPoseRefs, flushZoomAnimSettleWaiters],
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
        // pure math over cached rects for the whole bake. The frame-scoped
        // cache usually makes this free: a flick release follows a pointermove
        // in the same frame, which already measured.
        const layout = measureStageLayout();
        if (!layout) return false;
        const { stage, viewport, contentW, contentH } = layout;
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

        // Absorb a live rAF zoom snap — carry its spring velocity into the bake.
        let vz: number | undefined;
        if (snappingLive) {
          vz = zoomSnapVelRef.current;
          stopZoomSnap();
        }
        // Catch any in-flight WAAPI so the bake starts from what's on screen.
        if (controller.isSettling() || controller.isDiscreteAnimating()) {
          controller.cancel();
        }
        isElasticDrag.current = false;

        const fromPose = controller.getPose();
        syncPoseRefs(fromPose);
        const z = fromPose.zoom;
        const bound = clamp(z, minZoom, maxZoom);
        const freshZoomReturn = vz === undefined && Math.abs(z - bound) > 1e-6;

        if (reducedMotionPan) {
          const rest = restOffsetsAt(bound, fromPose.offsetX, fromPose.offsetY);
          const to = { zoom: bound, offsetX: rest.x, offsetY: rest.y };
          controller.replacePose(to);
          syncPoseRefs(to);
          return true;
        }

        const baked = bakeSettlePath({
          zoom: z,
          minZoom,
          maxZoom,
          vz,
          offsetX: fromPose.offsetX,
          offsetY: fromPose.offsetY,
          vx,
          vy,
          panSpring: spring,
          geometryAt,
          restOffsetsAt,
        });
        if (!baked) return false;

        if (freshZoomReturn) triggerHaptic('snap');

        // WAAPI in this turn from the pose already on the element — zero React
        // commit until finish (the release-frame discontinuity root fix).
        const to = { zoom: baked.zoom, offsetX: baked.offsetX, offsetY: baked.offsetY };
        const started = controller.settle({
          path: baked.path,
          pathOffsets: baked.offsets,
          to,
          durationMs: baked.durationMs,
          zoomChanges: vz !== undefined || Math.abs(z - bound) > 1e-6,
          onFinish: () => syncPoseRefs(to),
        });
        return started;
      },
      [
        minZoom,
        maxZoom,
        measureStageLayout,
        stopZoomSnap,
        controller,
        syncPoseRefs,
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

    // Stable, always-fresh zoom reader for the active-zoom bridge (consumed by
    // Content's pull-to-dismiss and keyboard handlers).
    const getLiveZoom = React.useCallback(() => controller.getPose().zoom, [controller]);

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
      const from = controller.getPose().zoom;
      const target = clamp(from, minZoom, maxZoom);
      if (Math.abs(target - from) < 1e-6) return false;
      stopZoomSnap();
      // Take over any discrete WAAPI continuously (commits its live pose).
      cancelZoomAnimation();
      // Mirror iOS's light rubber-band tick as the scale starts returning.
      triggerHaptic('snap');

      if (reducedMotionPan) {
        const live = controller.getPose();
        const offsets = clampOffsets(live.offsetX, live.offsetY, target);
        isElasticDrag.current = false;
        writeHotPose({ zoom: target, offsetX: offsets.x, offsetY: offsets.y });
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

        const live = controller.getPose();
        const z = live.zoom;
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
        let nextX = live.offsetX;
        let nextY = live.offsetY;
        const offsetsOwned = draggingRef.current;
        if (!offsetsOwned) {
          const rest = clampOffsets(live.offsetX, live.offsetY, bound);
          if (rest.x !== live.offsetX || rest.y !== live.offsetY) {
            const denom = z - bound;
            const f = denom !== 0 ? Math.min(1, Math.max(0, (z - nextZ) / denom)) : 1;
            nextX = live.offsetX + (rest.x - live.offsetX) * f;
            nextY = live.offsetY + (rest.y - live.offsetY) * f;
          }
        }

        writeHotPose({ zoom: nextZ, offsetX: nextX, offsetY: nextY });

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
      controller,
      writeHotPose,
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
        getZoom: () => controller.getPose().zoom,
        getOffsets: () => {
          const p = controller.getPose();
          return { x: p.offsetX, y: p.offsetY };
        },
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
        isSettling: () => controller.isSettling(),
        commitPose: () => {
          syncPoseRefs(controller.getPose());
          controller.commitSnapshot();
        },
      }),
      [
        controller,
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
        syncPoseRefs,
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
    // Live getters — pan/pinch never commit to React, so closed-over snapshot
    // values would lag the visual pose.
    React.useImperativeHandle(
      forwardedRef,
      () => ({
        get zoom() {
          return controller.getPose().zoom;
        },
        maxZoom,
        get offsetX() {
          return controller.getPose().offsetX;
        },
        get offsetY() {
          return controller.getPose().offsetY;
        },
        zoomIn: zoomInAction,
        zoomOut: zoomOutAction,
        zoomTo: (target, opts) => changeZoomAction(target, opts?.rapid ?? false, opts?.dx, opts?.dy),
        reset: resetAction,
      }),
      [maxZoom, zoomInAction, zoomOutAction, changeZoomAction, resetAction, controller],
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
    // Transform is owned by PoseController (direct style / WAAPI) — never React.
    const wrapper = (
      <div
        ref={setWrapperRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transformOrigin: 'center center',
          willChange: zoom > 1 || poseSnap.phase !== 'idle' ? 'transform' : undefined,
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

