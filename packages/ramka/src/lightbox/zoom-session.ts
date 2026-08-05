/**
 * Zoom policy layer: rubber-band pan, focal zoom, release bake/settle,
 * concurrent rAF 2→1 zoom snap. Owns no React — PoseController writes pixels.
 */

import {
  bakeDiscreteZoomPath,
  bakeSettlePath,
  clamp,
  clampOffsetToViewport,
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
import { PoseController, type ZoomPose } from './pose-controller';
import type { ZoomGestureActions } from './use-zoom-gestures';

export interface StageLayout {
  stage: DOMRect;
  viewport: DOMRect;
  contentW: number;
  contentH: number;
}

export interface PanGeometry extends StageLayout {
  x: { min: number; max: number; overflows: boolean };
  y: { min: number; max: number; overflows: boolean };
}

export interface ZoomSessionDeps {
  controller: PoseController;
  measureStageLayout: () => StageLayout | null;
  measurePanGeometry: (z: number) => PanGeometry | null;
  clampOffsets: (x: number, y: number, z: number) => { x: number; y: number };
  minZoom: number;
  maxZoom: number;
  zoomStep: number;
  reducedMotion: boolean;
  /** True while a finger owns pan offsets (rAF zoom-snap must not steal them). */
  isDragging: () => boolean;
  /** React UI flag for data-dragging / cursor — never commits pose on false. */
  setDraggingUi: (value: boolean) => void;
  /** Bust layout cache on gesture start only. */
  invalidateLayoutCache: () => void;
}

export interface ZoomSession {
  actions: ZoomGestureActions;
  /** Imperative helpers for ref / context (same implementations as actions). */
  zoomIn: () => void;
  zoomOut: () => void;
  changeZoom: ZoomGestureActions['changeZoom'];
  changeOffsets: ZoomGestureActions['changeOffsets'];
  reset: (rapid?: boolean) => void;
  getLiveZoom: () => number;
  dispose: () => void;
}

export function createZoomSession(getDeps: () => ZoomSessionDeps): ZoomSession {
  const rawOffsetX = { current: 0 };
  const rawOffsetY = { current: 0 };
  const isElasticDrag = { current: false };
  const zoomSnapRaf = { current: null as number | null };
  const zoomSnapLastTs = { current: 0 };
  const zoomSnapVel = { current: 0 };
  const discreteWaiters = { current: [] as Array<() => void> };

  const syncPoseRefs = (_p: ZoomPose) => {
    // Pose is authoritative on the controller; kept as a no-op hook if we
    // later need eager mirrors for same-turn readers.
  };

  const writeHotPose = (p: ZoomPose) => {
    syncPoseRefs(p);
    getDeps().controller.setPose(p);
  };

  const stopZoomSnap = () => {
    if (zoomSnapRaf.current != null) {
      cancelAnimationFrame(zoomSnapRaf.current);
      zoomSnapRaf.current = null;
    }
    zoomSnapLastTs.current = 0;
    zoomSnapVel.current = 0;
  };

  const isZoomSnapActive = () => zoomSnapRaf.current != null;

  const flushDiscreteWaiters = () => {
    const waiters = discreteWaiters.current;
    discreteWaiters.current = [];
    for (const w of waiters) w();
  };

  const cancelZoomAnimation = () => {
    discreteWaiters.current = [];
    const { controller } = getDeps();
    if (controller.getPhase() === 'idle' || controller.getPhase() === 'tracking') return;
    const live = controller.cancel();
    if (live) {
      syncPoseRefs(live);
      isElasticDrag.current = false;
    }
  };

  const whenZoomAnimationSettled = (cb: () => void) => {
    const { controller } = getDeps();
    if (!controller.isDiscreteAnimating()) {
      cb();
      return;
    }
    discreteWaiters.current = [cb];
  };

  const catchSettle = () => {
    const { controller } = getDeps();
    if (!controller.isDiscreteAnimating() && controller.isSettling()) {
      const live = controller.catch();
      if (live) syncPoseRefs(live);
    }
  };

  const setDragging = (value: boolean) => {
    const deps = getDeps();
    const { controller } = deps;
    if (value) {
      const live = controller.beginTracking();
      syncPoseRefs(live);
      deps.setDraggingUi(true);
      deps.invalidateLayoutCache();
      return;
    }
    deps.setDraggingUi(false);
    if (controller.isSettling() || controller.isDiscreteAnimating()) return;
    if (controller.getPhase() === 'tracking') {
      controller.endTracking({ commit: false });
    }
  };

  const changeOffsets = (
    dx: number,
    dy: number,
    overscroll?: boolean,
    overflowAxesOnly?: boolean,
  ) => {
    const { controller, measurePanGeometry, clampOffsets } = getDeps();
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
  };

  /**
   * Start (or retarget) an animated discrete zoom toward `to` as a baked
   * keyframe curve played by the controller. An uninterrupted step plays the
   * same 300ms ease-in-out it always did; when an animation is already in
   * flight the live zoom velocity is carried into the new bake, so rapid
   * successive steps merge into one continuous motion instead of restarting
   * the easing curve from zero on every press.
   */
  const startDiscreteZoom = (to: ZoomPose) => {
    const { controller, reducedMotion } = getDeps();

    // Carry momentum out of any in-flight animation, landing at the live pose.
    let vZoom = 0;
    if (controller.isDiscreteAnimating() || controller.isSettling()) {
      const vz = controller.getLiveZoomVelocity();
      const live = controller.cancel();
      if (live) {
        syncPoseRefs(live);
        if (vz != null) vZoom = vz;
      }
    }

    const from = controller.getPose();
    const baked = reducedMotion
      ? null
      : bakeDiscreteZoomPath({
          from,
          to,
          vZoom,
          durationMs: controller.getDefaultDiscreteDuration(),
        });
    controller.discrete({
      to,
      // Null bake (pure-offset move / degenerate delta) falls back to the
      // controller's 2-keyframe eased tween.
      path: baked?.path,
      pathOffsets: baked?.offsets,
      duration: baked?.durationMs,
      onFinish: () => {
        syncPoseRefs(to);
        flushDiscreteWaiters();
      },
    });
    syncPoseRefs(to);
  };

  const changeZoom = (
    target: number,
    rapid: boolean,
    dx?: number,
    dy?: number,
    overscroll?: boolean,
  ) => {
    const { controller, minZoom, maxZoom, measurePanGeometry, clampOffsets } = getDeps();
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
      if (controller.isSettling() || controller.isDiscreteAnimating()) controller.cancel();
      writeHotPose(to);
      return;
    }

    startDiscreteZoom(to);
  };

  const zoomIn = () => {
    const { controller, zoomStep } = getDeps();
    const z = controller.getPose().zoom;
    const target = z * zoomStep;
    changeZoom(z < 1 && target > 1 ? 1 : target, false);
  };

  const zoomOut = () => {
    const { controller, zoomStep } = getDeps();
    const z = controller.getPose().zoom;
    const target = z / zoomStep;
    changeZoom(z > 1 && target < 1 ? 1 : target, false);
  };

  const reset = (rapid = false) => {
    const { controller, minZoom } = getDeps();
    stopZoomSnap();
    isElasticDrag.current = false;
    const to = { zoom: minZoom, offsetX: 0, offsetY: 0 };
    if (rapid) {
      controller.replacePose(to);
      syncPoseRefs(to);
      return;
    }
    startDiscreteZoom(to);
  };

  const startPanPhysics = (
    vx: number,
    vy: number,
    spring: PanPhysicsSpring = PAN_PHYSICS_SPRING_MOUSE,
  ): boolean => {
    const {
      controller,
      measureStageLayout,
      minZoom,
      maxZoom,
      reducedMotion,
    } = getDeps();

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

    const snappingLive = zoomSnapRaf.current != null;
    {
      const from0 = controller.getPose();
      const g0 = geometryAt(from0.zoom);
      const zoomAtRest = from0.zoom >= minZoom && from0.zoom <= maxZoom;
      const outX = from0.offsetX < g0.x.min || from0.offsetX > g0.x.max;
      const outY = from0.offsetY < g0.y.min || from0.offsetY > g0.y.max;
      const speed = Math.hypot(
        g0.x.overflows || outX ? vx : 0,
        g0.y.overflows || outY ? vy : 0,
      );
      if (!snappingLive && zoomAtRest && !outX && !outY && speed < PAN_PHYSICS_STOP_SPEED) {
        return false;
      }
    }

    let vz: number | undefined;
    if (snappingLive) {
      vz = zoomSnapVel.current;
      stopZoomSnap();
    }
    if (controller.isSettling() || controller.isDiscreteAnimating()) {
      controller.cancel();
    }
    isElasticDrag.current = false;

    const fromPose = controller.getPose();
    syncPoseRefs(fromPose);
    const z = fromPose.zoom;
    const bound = clamp(z, minZoom, maxZoom);
    const freshZoomReturn = vz === undefined && Math.abs(z - bound) > 1e-6;

    if (reducedMotion) {
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

    const to = { zoom: baked.zoom, offsetX: baked.offsetX, offsetY: baked.offsetY };
    return controller.settle({
      path: baked.path,
      pathOffsets: baked.offsets,
      to,
      durationMs: baked.durationMs,
      zoomChanges: vz !== undefined || Math.abs(z - bound) > 1e-6,
      onFinish: () => syncPoseRefs(to),
    });
  };

  const snapOffsetsToBounds = (): boolean => startPanPhysics(0, 0);

  const snapToBounds = () => {
    const { controller, minZoom, maxZoom, isDragging } = getDeps();
    if (zoomSnapRaf.current != null && isDragging()) return;
    const currentZoom = controller.getPose().zoom;
    if (zoomSnapRaf.current == null && currentZoom >= minZoom && currentZoom <= maxZoom) {
      return;
    }
    startPanPhysics(0, 0);
  };

  const momentumPan = (vx: number, vy: number, touch = false): boolean =>
    startPanPhysics(vx, vy, touch ? PAN_PHYSICS_SPRING_TOUCH : PAN_PHYSICS_SPRING_MOUSE);

  /**
   * Concurrent zoom rubber-band (2→1 only): rAF spring on the zoom *value*
   * while a surviving finger still owns offsets. WAAPI cannot share
   * `transform` with a live pan, so this path exists solely for that overlap.
   * Full release / trackpad end must use {@link startPanPhysics} (baked WAAPI)
   * instead — call sites skip this when no finger remains.
   */
  const startZoomSnap = (): boolean => {
    const { controller, minZoom, maxZoom, clampOffsets, reducedMotion, isDragging } = getDeps();
    const from = controller.getPose().zoom;
    const target = clamp(from, minZoom, maxZoom);
    if (Math.abs(target - from) < 1e-6) return false;

    // No concurrent pan author — prefer compositor WAAPI (same bake as release).
    if (!isDragging()) {
      return startPanPhysics(0, 0);
    }

    stopZoomSnap();
    cancelZoomAnimation();
    triggerHaptic('snap');

    if (reducedMotion) {
      const live = controller.getPose();
      const offsets = clampOffsets(live.offsetX, live.offsetY, target);
      isElasticDrag.current = false;
      writeHotPose({ zoom: target, offsetX: offsets.x, offsetY: offsets.y });
      return true;
    }

    zoomSnapVel.current = zoomSnapSeedVelocity(from, target);

    const tick = (ts: number) => {
      const prev = zoomSnapLastTs.current;
      zoomSnapLastTs.current = ts;
      let dt = prev > 0 ? (ts - prev) / 1000 : 1 / 60;
      if (dt > 0.048) dt = 1 / 60;

      const live = controller.getPose();
      const z = live.zoom;
      const bound = clamp(z, minZoom, maxZoom);
      const step = stepPanPhysicsAxis(
        {
          position: z,
          velocity: zoomSnapVel.current,
          min: bound,
          max: bound,
          canCoast: false,
        },
        dt,
        PAN_PHYSICS_FRICTION,
        ZOOM_SNAP_SPRING.stiffness,
        ZOOM_SNAP_SPRING.damping,
        ZOOM_SNAP_STOP_SPEED,
        ZOOM_SNAP_STOP_DISTANCE,
      );
      zoomSnapVel.current = step.velocity;
      // Never teleport onto `bound` — exact rest is the release bake / land.
      const nextZ = step.position;

      let nextX = live.offsetX;
      let nextY = live.offsetY;
      if (!isDragging()) {
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
        zoomSnapRaf.current = null;
        zoomSnapLastTs.current = 0;
        zoomSnapVel.current = 0;
        // Finger may have lifted mid-snap — finish via WAAPI (absorbs micro-gap).
        if (!isDragging()) snapOffsetsToBounds();
        else if (Math.abs(nextZ - bound) > 1e-6) {
          // Still dragging: micro-land zoom only (gap is ≤ stop distance).
          writeHotPose({ zoom: bound, offsetX: nextX, offsetY: nextY });
        }
        return;
      }
      zoomSnapRaf.current = requestAnimationFrame(tick);
    };

    zoomSnapLastTs.current = 0;
    zoomSnapRaf.current = requestAnimationFrame(tick);
    return true;
  };

  const getLiveZoom = () => getDeps().controller.getPose().zoom;

  const actions: ZoomGestureActions = {
    getZoom: () => getDeps().controller.getPose().zoom,
    getOffsets: () => {
      const p = getDeps().controller.getPose();
      return { x: p.offsetX, y: p.offsetY };
    },
    zoomIn,
    zoomOut,
    changeZoom,
    changeOffsets,
    setDragging,
    snapToBounds,
    snapOffsetsToBounds,
    momentumPan,
    startZoomSnap,
    stopZoomSnap,
    isZoomSnapActive,
    catchSettle,
    cancelZoomAnimation,
    isZoomAnimating: () => getDeps().controller.isDiscreteAnimating(),
    whenZoomAnimationSettled,
    isSettling: () => getDeps().controller.isSettling(),
    commitPose: () => {
      const { controller } = getDeps();
      syncPoseRefs(controller.getPose());
      controller.commitSnapshot();
    },
  };

  return {
    actions,
    zoomIn,
    zoomOut,
    changeZoom,
    changeOffsets,
    reset,
    getLiveZoom,
    dispose: stopZoomSnap,
  };
}
