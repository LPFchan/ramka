'use client';

import * as React from 'react';
import { useDialKitController } from 'dialkit';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Lightbox, useLightboxContext } from 'ramka';

import { imgDims, triggerFocusClass } from '../../../_components/lightbox-chrome';

import './pill-3d-strip.css';

export type Pill3DPhoto = {
  id: string;
  src: string;
  thumb: string;
  alt: string;
  caption: string;
};

/** Thumb card *visual* size (px) — the CSS box is 2x and scaled down 0.5. */
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
/** Camera/geometry tween (preset switches, dial drags) — one shared clock. */
const TAU_CAMERA_MS = 140;

/**
 * Camera presets — game-y "view modes", Apple-clean values. Applied through
 * the DialKit controller so the panel and the chips stay in sync; every
 * parameter tweens through the same rAF camera clock, so switching modes
 * morphs the pill instead of snapping.
 */
type PillCameraValues = {
  perspective: number;
  distance: number;
  capRadius: number;
  tilt: number;
};

export const PILL_PRESETS: ReadonlyArray<{ name: string; values: PillCameraValues }> = [
  /** The tuned default — shallow showcase shelf. */
  { name: 'Stage', values: { perspective: 900, distance: 0, capRadius: 0, tilt: 12 } },
  /** Deep drum — thumbs wrap hard around the sides. */
  { name: 'Drum', values: { perspective: 750, distance: 160, capRadius: 340, tilt: 9 } },
  /** Top-down racetrack — the whole stadium reads like a mini-map. */
  { name: 'Orbit', values: { perspective: 1300, distance: 220, capRadius: 0, tilt: 44 } },
  /** Near-flat shelf — barely-3D, long lens. */
  { name: 'Shelf', values: { perspective: 2600, distance: 240, capRadius: 90, tilt: 4 } },
  /** Straights collapse — an almost-circular wheel, pushed back. */
  { name: 'Coin', values: { perspective: 650, distance: 320, capRadius: 400, tilt: 16 } },
];

function presetIsActive(values: PillCameraValues, preset: PillCameraValues): boolean {
  return (
    Math.abs(values.perspective - preset.perspective) < 0.5 &&
    Math.abs(values.distance - preset.distance) < 0.5 &&
    Math.abs(values.capRadius - preset.capRadius) < 0.5 &&
    Math.abs(values.tilt - preset.tilt) < 0.5
  );
}

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
 *
 * `capRadius > 0` (DialKit control / presets) short-circuits the fit and
 * forces the cap radius directly — spacing stays perimeter/count, so small
 * radii make thumbs overlap. `0` means auto-fit.
 */
function measurePillGeom(stageWidth: number, count: number, capRadius = 0): PillGeom {
  const maxSpan = Math.max(220, stageWidth - STAGE_MARGIN_PX);

  if (capRadius > 0) {
    const R = Math.max(24, capRadius);
    const L = Math.max(48, maxSpan - 2 * R - THUMB_PX);
    const P = 2 * L + 2 * Math.PI * R;
    return { L, R, P, spacing: P / Math.max(1, count) };
  }

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
 * through the caps instead of unwinding the whole pill.
 *
 * The same loop runs a "camera" tween: perspective / distance / tilt / cap
 * radius (DialKit dials + preset chips) all ease toward their targets with
 * one shared time-constant, so preset switches morph the whole rig smoothly.
 * Front thumbs face the viewer; back thumbs show a dimmed card back.
 * ThumbnailGroup keeps tablist semantics / arrow keys; Thumbnail keeps
 * click-to-select and `data-active`.
 */
export function Pill3DStrip({ photos }: { photos: Pill3DPhoto[] }) {
  const { activeIndex, slidesViewportRef, slidesGeometryRef, subscribeSlidesViewport } =
    useLightboxContext();

  // Live tweak panel (debug page only; DialRoot is mounted by the page).
  const dial = useDialKitController('3D pill strip', {
    perspective: [900, 200, 3000, 10],
    /** Extra push-back of the whole pill from the viewer (px). */
    distance: [0, -150, 800, 5],
    /** Cap (corner) radius of the pill in px — 0 = auto-fit to width. */
    capRadius: [0, 0, 400, 1],
    /** Scene rotateX in degrees — how far the camera looks down at the pill. */
    tilt: [12, 0, 60, 1],
  });
  const dialValues = dial.values;

  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const thumbsRef = React.useRef(new Map<number, HTMLElement>());
  const geomRef = React.useRef<PillGeom>(measurePillGeom(640, photos.length));
  const targetGeomRef = React.useRef<PillGeom>({ ...geomRef.current });
  const countRef = React.useRef(photos.length);
  countRef.current = photos.length;
  const activeIndexRef = React.useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  /** Eased camera params (written to stage CSS vars from the rAF loop). */
  const cameraRef = React.useRef({
    perspective: dialValues.perspective,
    distance: dialValues.distance,
    tilt: dialValues.tilt,
  });
  const cameraTargetRef = React.useRef({ ...cameraRef.current });
  cameraTargetRef.current = {
    perspective: dialValues.perspective,
    distance: dialValues.distance,
    tilt: dialValues.tilt,
  };

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
      // Trailing scale(0.5): the card is laid out at 2x and shrunk here, so
      // its composited layer rasterizes at double resolution — otherwise the
      // tilted/rotated 3D planes sample a 56px texture and look soft.
      el.style.transform = `translate(-50%, -50%) translate3d(${pt.x.toFixed(2)}px, 0px, ${pt.z.toFixed(2)}px) rotateY(${pt.ry.toFixed(4)}rad) scale(0.5)`;
      el.style.setProperty('--p3d-shade', shade.toFixed(3));
    });
    lastWrittenRef.current = p;
  }, []);

  /** Push the eased camera + geometry out to the stage CSS vars. */
  const writeCamera = React.useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const cam = cameraRef.current;
    const geom = geomRef.current;
    stage.style.perspective = `${cam.perspective.toFixed(1)}px`;
    stage.style.setProperty('--ts-p3d-dist', cam.distance.toFixed(2));
    stage.style.setProperty('--ts-p3d-tilt', cam.tilt.toFixed(2));
    stage.style.setProperty('--ts-p3d-r', geom.R.toFixed(2));
    stage.style.setProperty('--ts-p3d-l', geom.L.toFixed(2));
  }, []);

  // Geometry: refit the stadium to the stage width (and the capRadius dial —
  // it feeds the fit). Sets the *target*; the rAF camera tween eases into it.
  const { capRadius } = dialValues;
  React.useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let first = true;
    const measure = () => {
      const geom = measurePillGeom(stage.clientWidth || 640, countRef.current, capRadius);
      targetGeomRef.current = geom;
      if (first) {
        // Mount: snap into place before paint (no morph on open).
        first = false;
        geomRef.current = { ...geom };
        writeCamera();
        writePose(renderPRef.current);
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [writePose, writeCamera, capRadius]);

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

  // The one loop: eases the carousel position (shortest path around the
  // loop — the pill is periodic in N) and the camera/geometry tween.
  React.useLayoutEffect(() => {
    const reduceMotion =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let last = performance.now();

    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      const dt = Math.min(64, now - last);
      last = now;

      // — camera + geometry tween —
      let camMoving = false;
      const kCam = reduceMotion ? 1 : 1 - Math.exp(-dt / TAU_CAMERA_MS);
      const tick = (cur: number, tgt: number, eps: number): number => {
        if (cur === tgt) return tgt;
        camMoving = true;
        return Math.abs(tgt - cur) < eps ? tgt : cur + (tgt - cur) * kCam;
      };

      const geom = geomRef.current;
      const targetGeom = targetGeomRef.current;
      const cam = cameraRef.current;
      const camTarget = cameraTargetRef.current;
      geom.R = tick(geom.R, targetGeom.R, 0.05);
      geom.L = tick(geom.L, targetGeom.L, 0.05);
      geom.P = 2 * geom.L + 2 * Math.PI * geom.R;
      geom.spacing = geom.P / Math.max(1, countRef.current);
      cam.perspective = tick(cam.perspective, camTarget.perspective, 0.5);
      cam.distance = tick(cam.distance, camTarget.distance, 0.05);
      cam.tilt = tick(cam.tilt, camTarget.tilt, 0.02);
      if (camMoving) writeCamera();

      // — carousel position —
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

      if (camMoving || Math.abs(render - lastWrittenRef.current) > 0.0002) {
        writePose(render);
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [writePose, writeCamera]);

  return (
    <div className="ts-p3d">
      <div className="ts-p3d-presets" role="group" aria-label="Carousel view presets">
        {PILL_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            className="ts-p3d-chip"
            data-active={presetIsActive(dialValues, preset.values) || undefined}
            onClick={() => dial.setValues({ ...preset.values })}
          >
            {preset.name}
          </button>
        ))}
      </div>
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
        {/* Stationary selection ring at the pill's front-center (rest position
            of the active thumb) — a twin preserve-3d plane so it projects with
            the exact same perspective as the scene. */}
        <span className="ts-p3d-indicator-plane" aria-hidden>
          <span className="ts-p3d-indicator" />
        </span>
      </div>
    </div>
  );
}

/**
 * The full lightbox experience for the 3D pill — a dark, console-style shell
 * (deep gradient, glass HUD, mono counter) kept Apple-clean: hairline glass,
 * restrained type, one accent. Reuses the docs' functional demo classes
 * (`lightbox-demo-*`) for open/close fades and inset tokens; all visuals come
 * from the `ts-p3dx-*` skin in `pill-3d-strip.css`.
 */
export function Pill3DDemo({
  photos,
  triggerCount = 6,
}: {
  photos: Pill3DPhoto[];
  triggerCount?: number;
}) {
  return (
    <Lightbox.Root loop morphTo="closest">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {photos.slice(0, triggerCount).map((photo, i) => (
          <Lightbox.Trigger
            key={photo.id}
            index={i}
            crossfade={i === triggerCount - 1 ? 'both' : undefined}
            className={`relative aspect-square overflow-hidden rounded-lg bg-neutral-100 ${triggerFocusClass} dark:bg-neutral-900`}
          >
            <img
              {...(imgDims(photo.thumb) ?? {})}
              src={photo.thumb}
              alt={photo.alt}
              className="h-full w-full object-cover"
              draggable={false}
            />
          </Lightbox.Trigger>
        ))}
      </div>

      <Lightbox.Portal>
        <Lightbox.Backdrop className="lightbox-demo-backdrop ts-p3dx-backdrop fixed inset-0" />
        <Lightbox.Content
          aria-label="3D pill gallery"
          pullToClose
          className="lightbox-demo-content ts-debug-content-pill3d ts-p3dx-content fixed inset-0 flex flex-col overscroll-contain outline-none"
        >
          <Lightbox.Slides
            aria-label="Full-size images"
            preload={1}
            className="lightbox-demo-slides flex-1 gap-5 [&::-webkit-scrollbar]:hidden md:gap-0"
          >
            {photos.map((photo, i) => {
              const dims = imgDims(photo.src);
              return (
                <Lightbox.Slide key={photo.id} className="lightbox-demo-slide-pad h-full">
                  <Lightbox.Item index={i} caption={photo.caption}>
                    <Lightbox.Zoom maxZoom={4}>
                      <Lightbox.Media
                        {...(dims ?? {})}
                        className="ts-p3dx-media overflow-hidden rounded-none md:rounded-xl"
                      >
                        <img
                          {...(dims ?? {})}
                          src={photo.src}
                          alt={photo.alt}
                          loading="eager"
                          draggable={false}
                          className="select-none"
                        />
                      </Lightbox.Media>
                    </Lightbox.Zoom>
                  </Lightbox.Item>
                </Lightbox.Slide>
              );
            })}
          </Lightbox.Slides>

          {/* HUD — top rail: mono counter left, close right. */}
          <div className="ts-p3dx-hud ts-p3dx-hud-top">
            <Lightbox.Counter className="ts-p3dx-counter">
              {({ current, total }) =>
                `${String(current).padStart(2, '0')} / ${String(total).padStart(2, '0')}`
              }
            </Lightbox.Counter>
            <Lightbox.Close className="ts-p3dx-btn" aria-label="Close">
              <X aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
            </Lightbox.Close>
          </div>

          {/* HUD — side nav (desktop). */}
          <Lightbox.Previous
            className="ts-p3dx-btn ts-p3dx-nav ts-p3dx-nav-prev"
            aria-label="Previous"
          >
            <ChevronLeft aria-hidden className="h-5 w-5" strokeWidth={2} />
          </Lightbox.Previous>
          <Lightbox.Next className="ts-p3dx-btn ts-p3dx-nav ts-p3dx-nav-next" aria-label="Next">
            <ChevronRight aria-hidden className="h-5 w-5" strokeWidth={2} />
          </Lightbox.Next>

          {/* HUD — bottom cluster: caption, then presets + pill. */}
          <div className="ts-p3dx-hud ts-p3dx-hud-bottom">
            <Lightbox.Caption className="ts-p3dx-caption" />
            <div className="pointer-events-auto w-full min-w-0">
              <Pill3DStrip photos={photos} />
            </div>
          </div>
        </Lightbox.Content>
      </Lightbox.Portal>
    </Lightbox.Root>
  );
}
