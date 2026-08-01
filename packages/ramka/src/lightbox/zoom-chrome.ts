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
    // Progress follows the *visual* scale so snug dim/blur fades with the
    // discrete WAAPI (rAF-sampled). Committed snapshot only arms data-zoomed:
    // discrete zoom-in commits the target before paint while the transform is
    // still at 1× — using that for progress snapped the fade to fully-on.
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
      progressValue = String(progress);
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
    // Always sync the CSS var to the live DOM value — not just our last write.
    // Content's React `style={{...}}` re-render wipes unknown inline props;
    // discrete zoom-in keeps progress at `"1"` for the whole WAAPI, so a
    // writtenProgress short-circuit would never restore the wiped var
    // (zoom-out still "worked" because live progress changes every frame).
    const applied = el.style.getPropertyValue(progressVar);
    const desired = progressValue ?? '';
    if (desired !== applied) {
      writtenProgress = progressValue;
      if (progressValue == null) el.style.removeProperty(progressVar);
      else el.style.setProperty(progressVar, progressValue);
    } else {
      writtenProgress = progressValue;
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
    // Discrete commits the target pose early — never use getPose() as the
    // visual fallback mid-flight or zoom-in progress snaps to fully-on.
    publish(live ?? minZoom, true);
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
