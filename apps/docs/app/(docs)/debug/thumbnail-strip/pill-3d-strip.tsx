'use client';

import * as React from 'react';
import { Lightbox, useLightboxContext } from 'ramka';

import './pill-3d-strip.css';

export type Pill3DPhoto = {
  id: string;
  thumb: string;
  alt: string;
};

/** Thumb card size (px) — square; matches the CSS `.ts-p3d-thumb` box. */
const THUMB_PX = 56;
/** Minimum arc spacing between thumb centers before the pill deepens. */
const MIN_SPACING_PX = THUMB_PX + 8;
/** Minimum cap radius — the pill never gets shallower than this. */
const MIN_RADIUS_PX = 96;
/** Horizontal breathing room inside the stage. */
const STAGE_MARGIN_PX = 32;
/** Smoothing time-constants: tight tracking for swipes, glide for long jumps. */
const TAU_TRACK_MS = 50;
const TAU_GLIDE_MS = 130;

type PillGeom = {
  /** Length of each straight segment. */
  L: number;
  /** Cap (semicircle) radius — also the pill's half-depth in Z. */
  R: number;
  /** Perimeter (2L + 2πR). */
  P: number;
  /** Arc distance between adjacent thumb centers (P / count — equal spacing). */
  spacing: number;
};

/**
 * Fit the stadium to the stage width: straights soak up available width,
 * and the caps deepen (R grows) until the perimeter holds `count` thumbs at
 * `MIN_SPACING_PX`. The two constraints feed each other, so iterate to the
 * fixed point; a final cap keeps the pill inside the stage on narrow hosts
 * (spacing may compress below the minimum there — debug-page tradeoff).
 */
function measurePillGeom(stageWidth: number, count: number): PillGeom {
  const maxSpan = Math.max(220, stageWidth - STAGE_MARGIN_PX);
  const needP = Math.max(1, count) * MIN_SPACING_PX;

  let R = MIN_RADIUS_PX;
  let L = Math.max(48, maxSpan - 2 * R - THUMB_PX);
  for (let i = 0; i < 8; i++) {
    R = Math.max(MIN_RADIUS_PX, (needP - 2 * L) / (2 * Math.PI));
    const fitL = Math.max(48, maxSpan - 2 * R - THUMB_PX);
    if (Math.abs(fitL - L) < 0.5) {
      L = fitL;
      break;
    }
    L = fitL;
  }
  R = Math.min(R, Math.max(MIN_RADIUS_PX, (maxSpan - 48 - THUMB_PX) / 2));
  L = Math.max(48, maxSpan - 2 * R - THUMB_PX);

  const P = 2 * L + 2 * Math.PI * R;
  return { L, R, P, spacing: P / Math.max(1, count) };
}

/**
 * Point on the stadium path at arc length `s` (wrapped mod P), plus the
 * outward-facing yaw. The path lives in the XZ plane; `s = 0` is front-center
 * (facing the viewer), increasing `s` travels right along the front straight,
 * around the right cap to the back, and home via the left cap.
 */
function pillPoint(s: number, geom: PillGeom): { x: number; z: number; ry: number } {
  const { L, R, P } = geom;
  let t = s % P;
  if (t < 0) t += P;

  const half = L / 2;
  const cap = Math.PI * R;

  // Front straight, right half: x 0 → L/2, facing the viewer.
  if (t < half) return { x: t, z: R, ry: 0 };
  t -= half;
  // Right cap: yaw sweeps 0 → π as the thumb goes around to the back.
  if (t < cap) {
    const a = t / R;
    return { x: half + R * Math.sin(a), z: R * Math.cos(a), ry: a };
  }
  t -= cap;
  // Back straight: x L/2 → -L/2, facing away.
  if (t < L) return { x: half - t, z: -R, ry: Math.PI };
  t -= L;
  // Left cap: yaw sweeps π → 2π back to front-facing.
  if (t < cap) {
    const a = t / R;
    return { x: -half - R * Math.sin(a), z: -R * Math.cos(a), ry: Math.PI + a };
  }
  t -= cap;
  // Front straight, left half: x -L/2 → 0.
  return { x: -half + t, z: R, ry: 0 };
}

/** Docs-local copy of ramka `slidesScrollProgress` (same as aspect-frame-strip). */
function demoSlidesScrollProgress(
  viewport: HTMLElement,
  geometry: { offsets?: number[]; base: number; step: number; count: number },
): number {
  const { offsets, base, step, count } = geometry;
  if (count <= 1) return 0;
  if (offsets && offsets.length === count) {
    const scroll = viewport.scrollLeft;
    const first = offsets[0]!;
    const last = offsets[count - 1]!;
    if (scroll <= first) return 0;
    if (scroll >= last) return 1;
    for (let i = 0; i < count - 1; i++) {
      const a = offsets[i]!;
      const b = offsets[i + 1]!;
      if (scroll <= b) {
        const t = (scroll - a) / (b - a || 1);
        return (i + t) / (count - 1);
      }
    }
    return 1;
  }
  const logicalMax = Math.max(0, count - 1) * step;
  if (logicalMax <= 0) return 0;
  return Math.min(1, Math.max(0, (viewport.scrollLeft - base) / logicalMax));
}

/**
 * Debug recipe: thumbnails ride a pill-shaped (stadium) path in 3D —
 * perspective + preserve-3d, equal arc spacing, outward-facing yaw. A rAF
 * loop eases a continuous carousel position toward the Slides scroll progress
 * along the *shortest path around the loop*, so `loop` seam crossings rotate
 * through the caps instead of unwinding the whole pill. Front thumbs face the
 * viewer; back thumbs show a dimmed card back (`backface-visibility` on the
 * image). ThumbnailGroup keeps tablist semantics / arrow keys; Thumbnail
 * keeps click-to-select and `data-active`.
 */
export function Pill3DStrip({ photos }: { photos: Pill3DPhoto[] }) {
  const { activeIndex, slidesViewportRef, slidesGeometryRef, subscribeSlidesViewport } =
    useLightboxContext();

  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const thumbsRef = React.useRef(new Map<number, HTMLElement>());
  const geomRef = React.useRef<PillGeom>(measurePillGeom(640, photos.length));
  const countRef = React.useRef(photos.length);
  countRef.current = photos.length;
  const activeIndexRef = React.useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  /** Continuous carousel position (float index at front-center). */
  const renderPRef = React.useRef(activeIndex);
  const targetPRef = React.useRef(activeIndex);
  const lastWrittenRef = React.useRef(Number.NaN);

  const registerThumb = React.useCallback((index: number, node: HTMLElement | null) => {
    const map = thumbsRef.current;
    if (node) map.set(index, node);
    else map.delete(index);
  }, []);

  /** Place every thumb for carousel position `p` (imperative style writes). */
  const writePose = React.useCallback((p: number) => {
    const geom = geomRef.current;
    thumbsRef.current.forEach((el, i) => {
      const pt = pillPoint((i - p) * geom.spacing, geom);
      // 0 at the front of the pill, 1 at the back — drives the depth dim.
      const shade = (geom.R - pt.z) / (2 * geom.R);
      el.style.transform = `translate(-50%, -50%) translate3d(${pt.x.toFixed(2)}px, 0px, ${pt.z.toFixed(2)}px) rotateY(${pt.ry.toFixed(4)}rad)`;
      el.style.setProperty('--p3d-shade', shade.toFixed(3));
    });
    lastWrittenRef.current = p;
  }, []);

  // Geometry: refit the stadium to the stage width; publish R/L for the CSS
  // scene shift (front row at screen depth) and the ground-shadow ellipse.
  React.useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const measure = () => {
      const geom = measurePillGeom(stage.clientWidth || 640, countRef.current);
      geomRef.current = geom;
      stage.style.setProperty('--ts-p3d-r', geom.R.toFixed(1));
      stage.style.setProperty('--ts-p3d-l', geom.L.toFixed(1));
      writePose(renderPRef.current);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [writePose]);

  // Target: mirror the Slides scroll progress (continuous during swipes).
  React.useLayoutEffect(() => {
    let bound: HTMLElement | null = null;

    const syncTarget = () => {
      const slides = slidesViewportRef.current;
      const geometry = slidesGeometryRef.current;
      if (!slides || geometry.count <= 0) {
        targetPRef.current = activeIndexRef.current;
        return;
      }
      const progress = demoSlidesScrollProgress(slides, geometry);
      targetPRef.current = progress * Math.max(0, geometry.count - 1);
    };

    const attach = () => {
      const slides = slidesViewportRef.current;
      if (slides !== bound) {
        bound?.removeEventListener('scroll', syncTarget);
        bound = slides;
        slides?.addEventListener('scroll', syncTarget, { passive: true });
      }
      syncTarget();
    };

    attach();
    // First paint: open directly in pose (no glide from index 0).
    renderPRef.current = targetPRef.current;
    writePose(renderPRef.current);

    const unsubscribe = subscribeSlidesViewport(attach);
    return () => {
      unsubscribe();
      bound?.removeEventListener('scroll', syncTarget);
      bound = null;
    };
  }, [slidesViewportRef, slidesGeometryRef, subscribeSlidesViewport, writePose]);

  // Discrete nav (thumb click / arrows / buttons) jumps Slides' scrollLeft
  // synchronously but the scroll event lands later — resync immediately.
  React.useLayoutEffect(() => {
    const slides = slidesViewportRef.current;
    const geometry = slidesGeometryRef.current;
    if (slides && geometry.count > 0) {
      const progress = demoSlidesScrollProgress(slides, geometry);
      targetPRef.current = progress * Math.max(0, geometry.count - 1);
    } else {
      targetPRef.current = activeIndex;
    }
  }, [activeIndex, slidesViewportRef, slidesGeometryRef]);

  // Easing loop: shortest path around the loop (the pill is periodic in N).
  React.useLayoutEffect(() => {
    const reduceMotion =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let last = performance.now();

    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      const dt = Math.min(64, now - last);
      last = now;

      const n = Math.max(1, countRef.current);
      const target = targetPRef.current;
      let render = renderPRef.current;

      // Wrap the error into (-n/2, n/2] so the seam is crossed the short way.
      let delta = (((target - render) % n) + n) % n;
      if (delta > n / 2) delta -= n;

      if (reduceMotion || Math.abs(delta) < 0.0005) {
        render = target;
      } else {
        const tau = Math.abs(delta) > 1.25 ? TAU_GLIDE_MS : TAU_TRACK_MS;
        render += delta * (1 - Math.exp(-dt / tau));
      }
      // Keep the float bounded; shifting by n is pose-invariant (mod P).
      render = ((render % n) + n) % n;
      renderPRef.current = render;

      if (Math.abs(render - lastWrittenRef.current) > 0.0002) {
        writePose(render);
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [writePose]);

  return (
    <div className="ts-p3d">
      <div ref={stageRef} className="ts-p3d-stage">
        <Lightbox.ThumbnailGroup aria-label="Photo thumbnails" className="ts-p3d-scene">
          {photos.map((photo, i) => (
            <Lightbox.Thumbnail
              key={photo.id}
              index={i}
              ref={(node: HTMLButtonElement | null) => registerThumb(i, node)}
              className="ts-p3d-thumb"
            >
              <img src={photo.thumb} alt="" draggable={false} />
            </Lightbox.Thumbnail>
          ))}
        </Lightbox.ThumbnailGroup>
      </div>
    </div>
  );
}
