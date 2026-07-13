'use client';

import { mergeProps, useRender } from '@base-ui/react';
import * as React from 'react';

import {
  clamp,
  clampOffset,
  computeMaxZoom,
  elasticClamp,
  elasticClampSymmetric,
  focalOffset,
  maxPanOffset,
  round,
} from './gesture-math';
import { triggerHaptic } from './haptics';
import { useLightboxContext } from './lightbox-context';
import { useOptionalLightboxItemContext } from './lightbox-item';
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
 * by default, override via `render`) that clips its content and captures
 * pointer/wheel/gesture input. State is exposed as attributes on that element —
 * `data-zoom` while scaled past 1x and `data-dragging` while panning — so
 * consumers can style purely through CSS.
 *
 * The zoom transform is applied to an internal wrapper element that is not
 * consumer-configurable; pass your (typically `<img>`) content as `children`.
 * `children` may also be a render function receiving the current zoom state.
 */
interface LightboxZoomProps
  extends Omit<useRender.ComponentProps<'div', LightboxZoomState>, 'children' | 'ref'> {
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
  /** Max delay between clicks for double-click detection (ms). @default 400 */
  doubleClickDelay?: number;
  /** Smooth zoom animation duration (ms). @default 300 */
  animationDuration?: number;
  /** Callback when zoom level changes. */
  onZoomChange?: (zoom: number) => void;
}

const stateAttributesMapping = {
  zoom: (value: unknown) => (typeof value === 'number' && value > 1 ? { 'data-zoom': '' } : null),
  dragging: (value: unknown) => (value ? { 'data-dragging': '' } : null),
};

interface LightboxZoomRef {
  zoom: number;
  maxZoom: number;
  offsetX: number;
  offsetY: number;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomTo: (target: number, options?: { rapid?: boolean; dx?: number; dy?: number }) => void;
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
const SNAP_OPTS = { duration: 180, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' } as const;
const MOMENTUM_OPTS = { duration: 600, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' } as const;

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
      animationDuration = DEFAULT_ANIMATION_DURATION,
      onZoomChange,
      ...elementProps
    } = props;

    const { activeIndex, dialogElementRef, navigationLockedRef } = useLightboxContext();
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

    // ----- Sync data-zoomed attribute on Content element -----
    // Only the active slide writes this attribute, so it has a single writer
    // and never fights with preloaded (inactive) siblings.
    React.useEffect(() => {
      if (!isActive) return;
      const el = dialogElementRef.current;
      if (!el) return;
      if (zoom > minZoom) {
        el.setAttribute('data-zoomed', '');
      } else {
        el.removeAttribute('data-zoomed');
      }
    }, [isActive, zoom, minZoom, dialogElementRef]);

    // ----- Offset clamping -----
    const clampOffsets = React.useCallback(
      (newOffsetX: number, newOffsetY: number, newZoom: number) => {
        const el = containerRef.current;
        if (!el) return { x: 0, y: 0 };

        const containerRect = el.getBoundingClientRect();
        const wrapper = wrapperRef.current;
        let contentW = containerRect.width;
        let contentH = containerRect.height;

        if (wrapper) {
          const img = wrapper.querySelector('img');
          if (img && img.offsetWidth > 0) {
            contentW = img.offsetWidth;
            contentH = img.offsetHeight;
          }
        }

        return clampOffset(
          newOffsetX,
          newOffsetY,
          contentW,
          contentH,
          containerRect.width,
          containerRect.height,
          newZoom,
        );
      },
      [],
    );

    // ----- Core actions -----
    const captureStart = useZoomAnimation(zoom, offsetX, offsetY, wrapperRef, animationDuration);

    const offsetXRef = React.useRef(offsetX);
    offsetXRef.current = offsetX;
    const offsetYRef = React.useRef(offsetY);
    offsetYRef.current = offsetY;

    // Raw (unclamped) offsets during elastic touch drag. The elastic
    // formula is applied to these to compute the displayed value, so
    // resistance is based on total overshoot rather than compounding.
    const rawOffsetX = React.useRef(0);
    const rawOffsetY = React.useRef(0);
    const isElasticDrag = React.useRef(false);

    const getMaxOffsets = React.useCallback(
      (z: number) => {
        const el = containerRef.current;
        if (!el) return { maxX: 0, maxY: 0 };
        const rect = el.getBoundingClientRect();
        const wrapper = wrapperRef.current;
        let cw = rect.width;
        let ch = rect.height;
        if (wrapper) {
          const img = wrapper.querySelector('img');
          if (img && img.offsetWidth > 0) { cw = img.offsetWidth; ch = img.offsetHeight; }
        }
        return {
          maxX: maxPanOffset(cw, rect.width, z),
          maxY: maxPanOffset(ch, rect.height, z),
        };
      },
      [],
    );

    const changeOffsetsAction = React.useCallback(
      (dx: number, dy: number, overscroll?: boolean) => {
        if (overscroll) {
          if (!isElasticDrag.current) {
            isElasticDrag.current = true;
            rawOffsetX.current = offsetXRef.current;
            rawOffsetY.current = offsetYRef.current;
          }
          rawOffsetX.current -= dx;
          rawOffsetY.current -= dy;
          const { maxX, maxY } = getMaxOffsets(zoomRef.current);
          setOffsetX(elasticClampSymmetric(rawOffsetX.current, maxX));
          setOffsetY(elasticClampSymmetric(rawOffsetY.current, maxY));
        } else {
          const clamped = clampOffsets(offsetXRef.current - dx, offsetYRef.current - dy, zoomRef.current);
          setOffsetX(clamped.x);
          setOffsetY(clamped.y);
        }
      },
      [clampOffsets, getMaxOffsets],
    );

    const changeZoomAction = React.useCallback(
      (target: number, rapid: boolean, dx?: number, dy?: number, overscroll?: boolean) => {
        const clamped = round(
          overscroll ? elasticClamp(target, minZoom, maxZoom) : clamp(target, minZoom, maxZoom),
          5,
        );

        if (!rapid) captureStart();

        const currentZoom = zoomRef.current;
        const currentOffX = offsetXRef.current;
        const currentOffY = offsetYRef.current;

        if (dx !== undefined && dy !== undefined) {
          const newOffX = focalOffset(currentOffX, dx, currentZoom, clamped);
          const newOffY = focalOffset(currentOffY, dy, currentZoom, clamped);
          const offsets = clampOffsets(newOffX, newOffY, clamped);
          setOffsetX(offsets.x);
          setOffsetY(offsets.y);
        } else {
          const offsets = clampOffsets(currentOffX, currentOffY, clamped);
          setOffsetX(offsets.x);
          setOffsetY(offsets.y);
        }

        setZoom(clamped);
      },
      [minZoom, maxZoom, clampOffsets, captureStart],
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
      captureStart(SNAP_OPTS);
      const snapped = clamp(currentZoom, minZoom, maxZoom);
      const offsets = clampOffsets(offsetXRef.current, offsetYRef.current, snapped);
      setZoom(snapped);
      setOffsetX(offsets.x);
      setOffsetY(offsets.y);
    }, [minZoom, maxZoom, clampOffsets, captureStart]);

    const snapOffsetsToBoundsAction = React.useCallback(() => {
      isElasticDrag.current = false;
      const clamped = clampOffsets(offsetXRef.current, offsetYRef.current, zoomRef.current);
      if (clamped.x === offsetXRef.current && clamped.y === offsetYRef.current) return;
      captureStart(SNAP_OPTS);
      setOffsetX(clamped.x);
      setOffsetY(clamped.y);
    }, [clampOffsets, captureStart]);

    const momentumPanAction = React.useCallback(
      (targetX: number, targetY: number) => {
        isElasticDrag.current = false;
        const clamped = clampOffsets(targetX, targetY, zoomRef.current);
        if (clamped.x === offsetXRef.current && clamped.y === offsetYRef.current) return;
        captureStart(MOMENTUM_OPTS);
        setOffsetX(clamped.x);
        setOffsetY(clamped.y);
      },
      [clampOffsets, captureStart],
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
      }),
      [zoomInAction, zoomOutAction, changeZoomAction, changeOffsetsAction, snapToBoundsAction, snapOffsetsToBoundsAction, momentumPanAction],
    );

    useZoomGestures(containerRef, wrapperRef, gestureConfig, gestureActions, false, dialogElementRef, zoom, navigationLockedRef);

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
          style: {
            overflow: 'hidden',
            position: 'relative',
            width: '100%',
            height: '100%',
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

