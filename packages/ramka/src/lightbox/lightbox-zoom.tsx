'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import * as React from 'react';

import { LightboxZoomDataAttributes } from './lightbox-data-attributes';
import { ignoreStateAttribute } from './lightbox-state-attributes';
import { ZoomContext, type ZoomContextValue } from './lightbox-zoom-context';
import {
  getZoomRuntimeSync,
  loadZoomRuntime,
  requestZoomRuntime,
  type ZoomRuntime,
} from './lightbox-zoom-loader';

// Tells Root/Trigger that this bundle can zoom, so their prefetch is worth the
// bytes. Runs on module evaluation — before any Root mounts — because the
// prefetch has to beat the first `Lightbox.Zoom` mount to be useful at all.
requestZoomRuntime();

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
 * The zoom engine is a separate chunk, not part of the initial lightbox bundle.
 * Using this part anywhere in your app is what tells Root to warm that chunk on
 * mount, well before the first open; a gallery built without `Lightbox.Zoom`
 * never downloads it at all. Failing that, it loads when Zoom first mounts.
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

const DEFAULT_MIN_ZOOM = 1;
const DEFAULT_MAX_ZOOM_FALLBACK = 4;

const noop = () => {};
const noopZoomTo = (_target: number, _options?: { rapid?: boolean; dx?: number; dy?: number }) => {};
const noopReset = (_rapid?: boolean) => {};
const noopOffsets = (_dx: number, _dy: number) => {};

function ZoomPlaceholder({
  props,
  forwardedRef,
}: {
  props: LightboxZoomProps;
  forwardedRef: React.ForwardedRef<LightboxZoomRef>;
}) {
  const { children, render, minZoom = DEFAULT_MIN_ZOOM, maxZoom: maxZoomProp, ...elementProps } =
    props;
  const maxZoom = maxZoomProp ?? DEFAULT_MAX_ZOOM_FALLBACK;

  const state = React.useMemo<LightboxZoomState>(
    () => ({
      zoom: minZoom,
      maxZoom,
      offsetX: 0,
      offsetY: 0,
      canZoomIn: true,
      canZoomOut: false,
      dragging: false,
    }),
    [minZoom, maxZoom],
  );

  React.useImperativeHandle(
    forwardedRef,
    () => ({
      zoom: minZoom,
      maxZoom,
      offsetX: 0,
      offsetY: 0,
      zoomIn: noop,
      zoomOut: noop,
      zoomTo: noopZoomTo,
      reset: noopReset,
    }),
    [minZoom, maxZoom],
  );

  const contextValue = React.useMemo<ZoomContextValue>(
    () => ({
      zoom: minZoom,
      maxZoom,
      offsetX: 0,
      offsetY: 0,
      canZoomIn: true,
      canZoomOut: false,
      zoomIn: noop,
      zoomOut: noop,
      zoomTo: noopZoomTo,
      reset: noopReset,
      changeOffsets: noopOffsets,
    }),
    [minZoom, maxZoom],
  );

  const resolvedChildren = typeof children === 'function' ? children(state) : children;

  const wrapper = (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transformOrigin: 'center center',
      }}
    >
      {resolvedChildren}
    </div>
  );

  const element = useRender({
    render,
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
          touchAction: 'pan-x pan-y',
          userSelect: 'none',
        },
      } as React.ComponentPropsWithRef<'div'>,
      elementProps as React.ComponentPropsWithRef<'div'>,
      { children: wrapper } as React.ComponentPropsWithRef<'div'>,
    ),
    defaultTagName: 'div',
  });

  return <ZoomContext.Provider value={contextValue}>{element}</ZoomContext.Provider>;
}

const LightboxZoom = React.forwardRef<LightboxZoomRef, LightboxZoomProps>(
  function LightboxZoom(props, forwardedRef) {
    const cached = getZoomRuntimeSync();
    const [Engine, setEngine] = React.useState<ZoomRuntime['LightboxZoomEngine'] | null>(
      () => cached?.LightboxZoomEngine ?? null,
    );

    React.useEffect(() => {
      if (Engine) return;
      let cancelled = false;
      void loadZoomRuntime().then((runtime) => {
        if (!cancelled) setEngine(() => runtime.LightboxZoomEngine);
      });
      return () => {
        cancelled = true;
      };
    }, [Engine]);

    if (!Engine) {
      return <ZoomPlaceholder props={props} forwardedRef={forwardedRef} />;
    }
    return <Engine {...props} ref={forwardedRef} />;
  },
);

LightboxZoom.displayName = 'LightboxZoom';

export { LightboxZoom };
export type { LightboxZoomProps, LightboxZoomRef, LightboxZoomState };
