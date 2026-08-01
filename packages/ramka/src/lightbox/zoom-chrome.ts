/**
 * Content chrome for zoom: `data-zoomed` + `--lightbox-zoom-progress`.
 * Subscribes to PoseController visual updates (no React per frame).
 */

import { LightboxContentCssVars } from './lightbox-css-vars';
import type { PoseController } from './pose-controller';

/** Uniform scale from a computed `transform` (WAAPI mid-flight fallback). */
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
export function zoomProgressFromScale(scale: number, minZoom: number, maxZoom: number): number {
  const range = Math.max(0.01, Math.min(maxZoom, minZoom + 1) - minZoom);
  return Math.min(1, Math.max(0, (scale - minZoom) / range));
}

export interface BindZoomChromeOptions {
  controller: PoseController;
  dialogElement: HTMLElement | null;
  /** Transform host — used only if live WAAPI zoom cannot be recovered analytically. */
  wrapperElement?: HTMLElement | null;
  minZoom: number;
  maxZoom: number;
  isActive: boolean;
}

/**
 * Bind chrome attrs/vars to the pose engine. Returns an unsubscribe/cleanup.
 * No-op when inactive or dialog element is missing.
 */
export function bindZoomChrome(opts: BindZoomChromeOptions): () => void {
  const { controller, dialogElement: el, minZoom, maxZoom, isActive } = opts;
  if (!isActive || !el) return () => {};

  const progressVar = LightboxContentCssVars.zoomProgress;
  let holdZoomed = false;
  let writtenZoomed: boolean | null = null;
  let writtenProgress: string | null | undefined;
  let raf = 0;

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
      holdZoomed = true;
      zoomed = true;
      progressValue = String(Math.max(progress, committedProgress));
    } else if (phaseAnimatingZoom && holdZoomed) {
      zoomed = true;
      progressValue = '0';
    } else {
      holdZoomed = false;
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

  const zoomAnimates = () => {
    const phase = controller.getPhase();
    return (phase === 'settling' || phase === 'discrete') && controller.getAnimatesZoom();
  };

  const tick = () => {
    if (!zoomAnimates()) {
      publish(controller.getPose().zoom, false);
      return;
    }
    let live = controller.getLiveAnimatedZoom();
    if (live == null) {
      const wrapper = opts.wrapperElement ?? null;
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
}
