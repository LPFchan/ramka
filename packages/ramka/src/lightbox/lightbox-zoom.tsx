'use client';

import { mergeProps, useRender } from '@base-ui/react';
import * as React from 'react';

import {
  clampOffsetToViewport,
  computeMaxZoom,
  panOffsetRange,
} from './gesture-math';
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
import { PoseController } from './pose-controller';
import { useZoomGestures, type ZoomGestureConfig } from './use-zoom-gestures';
import { bindZoomChrome } from './zoom-chrome';
import { createZoomSession, type ZoomSessionDeps } from './zoom-session';

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
 *
 * Architecture: PoseController (transform writer) + ZoomSession (policy) +
 * useZoomGestures (input) + bindZoomChrome (Content attrs). This file is the
 * thin React shell only.
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
    const isActive = itemContext ? itemContext.active : true;

    // ----- Pose engine (sole writer of style.transform) -----
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

    const poseSnap = React.useSyncExternalStore(
      controller.subscribeCommit,
      controller.getSnapshot,
      controller.getSnapshot,
    );
    const zoom = poseSnap.zoom;
    const offsetX = poseSnap.offsetX;
    const offsetY = poseSnap.offsetY;

    const [dragging, setDragging] = React.useState(false);
    const draggingRef = React.useRef(false);

    const layoutCacheRef = React.useRef<{
      stage: DOMRect;
      viewport: DOMRect;
      contentW: number;
      contentH: number;
    } | null>(null);
    const layoutCacheRafRef = React.useRef<number | null>(null);

    const [imageDimensions, setImageDimensions] = React.useState<{ w: number; h: number } | null>(
      null,
    );
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

    // ----- maxZoom -----
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

    // ----- Layout measure (frame-scoped cache) -----
    const resolveContentSize = React.useCallback((fallbackRect: DOMRect) => {
      const wrapper = wrapperRef.current;
      if (wrapper) {
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

    const invalidateStageLayout = React.useCallback(() => {
      layoutCacheRef.current = null;
    }, []);
    React.useEffect(() => {
      if (typeof window === 'undefined') return;
      window.addEventListener('resize', invalidateStageLayout);
      return () => window.removeEventListener('resize', invalidateStageLayout);
    }, [invalidateStageLayout]);

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

    // ----- Zoom session (policy) -----
    const sessionDepsRef = React.useRef<ZoomSessionDeps>(null!);
    sessionDepsRef.current = {
      controller,
      measureStageLayout,
      measurePanGeometry,
      clampOffsets,
      minZoom,
      maxZoom,
      zoomStep,
      reducedMotion: reducedMotionPan,
      isDragging: () => draggingRef.current,
      setDraggingUi: (value) => {
        draggingRef.current = value;
        setDragging(value);
      },
      invalidateLayoutCache: () => {
        layoutCacheRef.current = null;
      },
    };

    const sessionRef = React.useRef<ReturnType<typeof createZoomSession> | null>(null);
    if (sessionRef.current == null) {
      sessionRef.current = createZoomSession(() => sessionDepsRef.current);
    }
    const session = sessionRef.current;

    React.useEffect(() => () => session.dispose(), [session]);

    // ----- Slide reset -----
    React.useEffect(() => {
      session.dispose();
      controller.replacePose({ zoom: minZoom, offsetX: 0, offsetY: 0 });
      setImageDimensions(null);
    }, [activeIndex, minZoom, controller, session]);

    React.useEffect(() => {
      onZoomChangeRef.current?.(zoom);
    }, [zoom]);

    // ----- Chrome (Content data-zoomed / progress) -----
    // useEffect (not layout): Content assigns dialogElementRef in its own
    // layout pass — layout here would see null and never subscribe.
    React.useEffect(() => {
      return bindZoomChrome({
        controller,
        dialogElement: dialogElementRef.current,
        wrapperElement: wrapperRef.current,
        minZoom,
        maxZoom,
        isActive,
      });
      // Re-bind after commit epochs so a late-mounted dialog still attaches.
    }, [isActive, minZoom, maxZoom, dialogElementRef, controller, zoom]);

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

    useZoomGestures(
      containerRef,
      wrapperRef,
      gestureConfig,
      session.actions,
      !isActive,
      dialogElementRef,
      zoom,
      navigationLockedRef,
      stageElementRef,
    );

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
        zoomIn: session.zoomIn,
        zoomOut: session.zoomOut,
        zoomTo: (target, opts) =>
          session.changeZoom(target, opts?.rapid ?? false, opts?.dx, opts?.dy),
        reset: session.reset,
      }),
      [maxZoom, session, controller],
    );

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
        zoomIn: session.zoomIn,
        zoomOut: session.zoomOut,
        zoomTo: (target, opts) =>
          session.changeZoom(target, opts?.rapid ?? false, opts?.dx, opts?.dy),
        reset: session.reset,
        changeOffsets: session.changeOffsets,
      }),
      [zoom, maxZoom, offsetX, offsetY, canZoomIn, canZoomOut, session],
    );

    const activeControls = React.useMemo<ActiveZoomControls>(
      () => ({
        canZoomIn,
        canZoomOut,
        zoomIn: session.zoomIn,
        zoomOut: session.zoomOut,
        reset: (rapid?: boolean) => session.reset(rapid),
        panBy: (dx: number, dy: number) => session.changeOffsets(dx, dy),
        keyboardPanDistance,
        getZoom: session.getLiveZoom,
      }),
      [canZoomIn, canZoomOut, session, keyboardPanDistance],
    );

    React.useEffect(() => {
      if (!isActive) return;
      publishActiveZoom(activeControls);
      return () => {
        publishActiveZoom((prev) => (prev === activeControls ? null : prev));
      };
    }, [isActive, activeControls, publishActiveZoom]);

    const state = React.useMemo<LightboxZoomState>(
      () => ({ zoom, maxZoom, offsetX, offsetY, canZoomIn, canZoomOut, dragging }),
      [zoom, maxZoom, offsetX, offsetY, canZoomIn, canZoomOut, dragging],
    );

    const resolvedChildren = typeof children === 'function' ? children(state) : children;

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
