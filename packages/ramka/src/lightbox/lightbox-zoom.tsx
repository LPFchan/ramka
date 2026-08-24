'use client';

import * as React from 'react';

import { LightboxZoomDataAttributes } from './lightbox-data-attributes';
import { ignoreStateAttribute } from './lightbox-state-attributes';
import { ZoomContext, type ZoomContextValue } from './lightbox-zoom-context';
import {
  getZoomRuntimeSync,
  loadZoomRuntime,
  type ZoomRuntime,
} from './lightbox-zoom-loader';
import { mergeProps } from '../render/merge-props';
import { useRender } from '../render/use-render';

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
 * The zoom engine loads when Zoom first mounts (usually the first open), or
 * earlier on trigger press / `handle.open()`. It is not downloaded with the
 * initial lightbox bundle.
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
const DEFAULT_ZOOM_STEP = 2;
const DEFAULT_WHEEL_SENSITIVITY = 100;
const DEFAULT_KEYBOARD_PAN = 50;
const DEFAULT_DOUBLE_CLICK_DELAY = 300;

const noop = () => {};
const noopZoomTo = (_target: number, _options?: { rapid?: boolean; dx?: number; dy?: number }) => {};
const noopReset = (_rapid?: boolean) => {};
const noopOffsets = (_dx: number, _dy: number) => {};

// ---------------------------------------------------------------------------
// Engine channel
//
// The engine is a separate chunk, so this component has to render correctly
// both before and after it arrives — and it must render the *same DOM* either
// way. An earlier design swapped a placeholder component for an engine
// component once the chunk resolved; both rendered an identical tree, but they
// were different component types, so React unmounted the subtree and rebuilt
// it. That took the consumer's `<img>` with it, along with the `<canvas>`
// underlay `Lightbox.Item` inserts imperatively during the open — mid-morph,
// on the most visible frame of the interaction.
//
// So the split is by responsibility, not by phase: this module owns the host
// element, the transform wrapper and the children for the whole lifetime of
// the component, and the chunk owns behaviour and renders nothing. Handing
// over is then a matter of a store publishing new values, and a chunk that
// arrives late (or never) costs nothing but a few hundred milliseconds of
// unresponsive gestures. `zoom-engine-swap.test.tsx` pins that.
// ---------------------------------------------------------------------------

/** Live pose, published by the engine on every commit. */
interface ZoomEnginePose {
  zoom: number;
  offsetX: number;
  offsetY: number;
  maxZoom: number;
  dragging: boolean;
  /** Mid-animation — drives `will-change` on the transform wrapper. */
  animating: boolean;
}

/** Imperative surface the engine hands up once it is live. */
interface ZoomEngineControls {
  zoomIn: () => void;
  zoomOut: () => void;
  zoomTo: (target: number, options?: { rapid?: boolean; dx?: number; dy?: number }) => void;
  reset: (rapid?: boolean) => void;
  changeOffsets: (dx: number, dy: number) => void;
  /** Live pose read that bypasses React state, for the imperative handle. */
  getPose: () => { zoom: number; offsetX: number; offsetY: number };
}

interface ZoomEngineSnapshot {
  pose: ZoomEnginePose;
  controls: ZoomEngineControls;
}

interface ZoomEngineStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ZoomEngineSnapshot | null;
  publish: (snapshot: ZoomEngineSnapshot) => void;
}

/** Behavioural props, resolved here so the defaults stay out of the chunk. */
interface ZoomEngineOptions {
  minZoom: number;
  maxZoom: number | undefined;
  zoomStep: number;
  scrollToZoom: boolean;
  wheelSensitivity: number;
  keyboardPanDistance: number;
  doubleClickDelay: number;
  onZoomChange: ((zoom: number) => void) | undefined;
}

/** What the lazy chunk receives. It renders `null`. */
interface ZoomEngineProps {
  options: ZoomEngineOptions;
  containerRef: React.RefObject<HTMLDivElement | null>;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  store: ZoomEngineStore;
}

function createZoomEngineStore(): ZoomEngineStore {
  let snapshot: ZoomEngineSnapshot | null = null;
  const listeners = new Set<() => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    // Referentially stable between publishes, as useSyncExternalStore requires.
    getSnapshot: () => snapshot,
    publish(next) {
      snapshot = next;
      for (const listener of listeners) listener();
    },
  };
}

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

    // Owned here for the whole lifetime, and handed to the engine by reference.
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const wrapperRef = React.useRef<HTMLDivElement | null>(null);

    const storeRef = React.useRef<ZoomEngineStore | null>(null);
    storeRef.current ??= createZoomEngineStore();
    const store = storeRef.current;

    const engine = React.useSyncExternalStore(
      store.subscribe,
      store.getSnapshot,
      store.getSnapshot,
    );

    const cached = getZoomRuntimeSync();
    const [Engine, setEngine] = React.useState<ZoomRuntime['ZoomEngine'] | null>(
      () => cached?.ZoomEngine ?? null,
    );

    React.useEffect(() => {
      if (Engine) return;
      let cancelled = false;
      void loadZoomRuntime().then(
        (runtime) => {
          if (!cancelled) setEngine(() => runtime.ZoomEngine);
        },
        (error: unknown) => {
          // The image still renders and the lightbox still works, just without
          // gestures. Swallowed rather than rethrown so a missing chunk isn't an
          // unhandled rejection in the consumer's app.
          if (process.env.NODE_ENV !== 'production') {
            console.warn('Lightbox.Zoom: the zoom runtime failed to load.', error);
          }
        },
      );
      return () => {
        cancelled = true;
      };
    }, [Engine]);

    // Until the engine publishes, the resting pose — which is also what a
    // consumer who never zooms sees for the whole session.
    const pose = engine?.pose;
    const controls = engine?.controls;
    const zoom = pose?.zoom ?? minZoom;
    const offsetX = pose?.offsetX ?? 0;
    const offsetY = pose?.offsetY ?? 0;
    const dragging = pose?.dragging ?? false;
    const animating = pose?.animating ?? false;
    const maxZoom = pose?.maxZoom ?? maxZoomProp ?? DEFAULT_MAX_ZOOM_FALLBACK;
    const canZoomIn = zoom < maxZoom;
    const canZoomOut = zoom > minZoom;

    const state = React.useMemo<LightboxZoomState>(
      () => ({ zoom, maxZoom, offsetX, offsetY, canZoomIn, canZoomOut, dragging }),
      [zoom, maxZoom, offsetX, offsetY, canZoomIn, canZoomOut, dragging],
    );

    React.useImperativeHandle(
      forwardedRef,
      () => ({
        get zoom() {
          return controls?.getPose().zoom ?? minZoom;
        },
        maxZoom,
        get offsetX() {
          return controls?.getPose().offsetX ?? 0;
        },
        get offsetY() {
          return controls?.getPose().offsetY ?? 0;
        },
        zoomIn: controls?.zoomIn ?? noop,
        zoomOut: controls?.zoomOut ?? noop,
        zoomTo: controls?.zoomTo ?? noopZoomTo,
        reset: controls?.reset ?? noopReset,
      }),
      [controls, maxZoom, minZoom],
    );

    const contextValue = React.useMemo<ZoomContextValue>(
      () => ({
        zoom,
        maxZoom,
        offsetX,
        offsetY,
        canZoomIn,
        canZoomOut,
        zoomIn: controls?.zoomIn ?? noop,
        zoomOut: controls?.zoomOut ?? noop,
        zoomTo: controls?.zoomTo ?? noopZoomTo,
        reset: controls?.reset ?? noopReset,
        changeOffsets: controls?.changeOffsets ?? noopOffsets,
      }),
      [zoom, maxZoom, offsetX, offsetY, canZoomIn, canZoomOut, controls],
    );

    const engineOptions = React.useMemo<ZoomEngineOptions>(
      () => ({
        minZoom,
        maxZoom: maxZoomProp,
        zoomStep,
        scrollToZoom,
        wheelSensitivity,
        keyboardPanDistance,
        doubleClickDelay,
        onZoomChange,
      }),
      [
        minZoom,
        maxZoomProp,
        zoomStep,
        scrollToZoom,
        wheelSensitivity,
        keyboardPanDistance,
        doubleClickDelay,
        onZoomChange,
      ],
    );

    const resolvedChildren = typeof children === 'function' ? children(state) : children;

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
          willChange: zoom > 1 || animating ? 'transform' : undefined,
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

    return (
      <ZoomContext.Provider value={contextValue}>
        {element}
        {/* Renders null — mounting and unmounting it touches no DOM. */}
        {Engine ? (
          <Engine
            options={engineOptions}
            containerRef={containerRef}
            wrapperRef={wrapperRef}
            store={store}
          />
        ) : null}
      </ZoomContext.Provider>
    );
  },
);

LightboxZoom.displayName = 'LightboxZoom';

export { LightboxZoom };
export type { LightboxZoomProps, LightboxZoomRef, LightboxZoomState };
export type {
  ZoomEngineControls,
  ZoomEngineOptions,
  ZoomEnginePose,
  ZoomEngineProps,
  ZoomEngineStore,
};
