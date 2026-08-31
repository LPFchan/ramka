/**
 * Async chunk for the zoom engine — behaviour only, renders `null`.
 *
 * `Lightbox.Zoom` owns the host element, the transform wrapper and the children
 * permanently and hands them here by ref; this module attaches gestures to those
 * nodes and publishes pose back through the store it is given. That split is
 * deliberate and load-bearing: a component that renders no DOM can arrive at any
 * point in the lightbox's life without React remounting anything, so a chunk
 * that lands mid-open cannot take the consumer's `<img>` or the canvas underlay
 * `Lightbox.Item` inserted with it. See the note in lightbox-zoom.tsx and
 * zoom-engine-swap.test.tsx.
 *
 * Loaded when `Lightbox.Zoom` first mounts, or earlier on hover / focus /
 * trigger press / `handle.open()`.
 */

import * as React from 'react';

import { clampOffsetToViewport, computeMaxZoom, panOffsetRange } from './gesture-math';
import { useLightboxContext } from './lightbox-context';
import { useOptionalLightboxItemContext } from './lightbox-item';
import {
  useLightboxZoomPublish,
  type ActiveZoomControls,
} from './lightbox-zoom-context';
import type {
  ZoomEngineControls,
  ZoomEnginePose,
  ZoomEngineProps,
} from './lightbox-zoom';
import { PoseController } from './pose-controller';
import { useZoomGestures, type ZoomGestureConfig } from './use-zoom-gestures';
import { bindZoomChrome } from './zoom-chrome';
import { createZoomSession, type ZoomSessionDeps } from './zoom-session';

const DEFAULT_MAX_ZOOM_FALLBACK = 4;
const DEFAULT_ANIMATION_DURATION = 300;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ZoomEngine({ options, containerRef, wrapperRef, store }: ZoomEngineProps) {
  const {
    minZoom,
    maxZoom: maxZoomProp,
    zoomStep,
    scrollToZoom,
    wheelSensitivity,
    keyboardPanDistance,
    doubleClickDelay,
    onZoomChange,
  } = options;

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

  // The wrapper node outlives this component, so attaching here rather than from
  // a callback ref is safe — and it is the only way round, since the shell owns
  // the element and cannot reach the controller.
  React.useEffect(() => {
    controller.attach(wrapperRef.current);
    return () => controller.attach(null);
  }, [controller, wrapperRef]);

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
  }, [maxZoomProp, containerRef]);

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
  }, [maxZoomProp, activeIndex, wrapperRef]);

  // ----- Layout measure (frame-scoped cache) -----
  const resolveContentSize = React.useCallback(
    (fallbackRect: DOMRect) => {
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
    },
    [wrapperRef],
  );

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
  }, [resolveContentSize, dialogElementRef, stageElementRef, containerRef]);

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
  }, [isActive, minZoom, maxZoom, dialogElementRef, controller, zoom, wrapperRef]);

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
    [
      minZoom,
      maxZoom,
      zoomStep,
      scrollToZoom,
      wheelSensitivity,
      keyboardPanDistance,
      doubleClickDelay,
    ],
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

  // ----- Publish to the shell -----
  const controls = React.useMemo<ZoomEngineControls>(
    () => ({
      zoomIn: session.zoomIn,
      zoomOut: session.zoomOut,
      zoomTo: (target, opts) => session.changeZoom(target, opts?.rapid ?? false, opts?.dx, opts?.dy),
      reset: session.reset,
      changeOffsets: session.changeOffsets,
      getPose: () => controller.getPose(),
    }),
    [session, controller],
  );

  // Read through refs so the publish callback stays stable across commits.
  const controlsRef = React.useRef(controls);
  controlsRef.current = controls;
  const maxZoomRef = React.useRef(maxZoom);
  maxZoomRef.current = maxZoom;
  const publishedRef = React.useRef<ZoomEnginePose | null>(null);

  const publish = React.useCallback(() => {
    const snap = controller.getSnapshot();
    const next: ZoomEnginePose = {
      zoom: snap.zoom,
      offsetX: snap.offsetX,
      offsetY: snap.offsetY,
      maxZoom: maxZoomRef.current,
      dragging: draggingRef.current,
      animating: snap.phase !== 'idle',
    };
    const prev = publishedRef.current;
    if (
      prev &&
      prev.zoom === next.zoom &&
      prev.offsetX === next.offsetX &&
      prev.offsetY === next.offsetY &&
      prev.maxZoom === next.maxZoom &&
      prev.dragging === next.dragging &&
      prev.animating === next.animating
    ) {
      return;
    }
    publishedRef.current = next;
    store.publish({ pose: next, controls: controlsRef.current });
  }, [controller, store]);

  // Straight off the controller rather than off this component's render, so the
  // shell's re-render batches with this one instead of trailing a frame behind.
  React.useEffect(() => controller.subscribeCommit(publish), [controller, publish]);

  // Covers what the controller doesn't drive: the handover of `controls` on
  // mount, and maxZoom / dragging, which are React state here.
  React.useEffect(() => {
    publish();
  }, [publish, maxZoom, dragging, controls]);

  // ----- Chrome outside the Zoom subtree (Lightbox.ZoomIn / ZoomOut) -----
  const canZoomIn = zoom < maxZoom;
  const canZoomOut = zoom > minZoom;

  const activeControls = React.useMemo<ActiveZoomControls>(
    () => ({
      canZoomIn,
      canZoomOut,
      zoomIn: session.zoomIn,
      zoomOut: session.zoomOut,
      reset: (rapid?: boolean) => session.reset(rapid),
      panBy: (dx: number, dy: number) => session.panStep(dx, dy),
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

  return null;
}

ZoomEngine.displayName = 'LightboxZoomEngine';

export { ZoomEngine };
