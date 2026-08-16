/**
 * Thumbnail-strip travel geometry and ScrollTimeline keyframes.
 * `Lightbox.ThumbnailStrip` owns *when* to measure / scrub; this module only
 * computes travels, interpolates progress, and reads the live translate.
 */

/**
 * Per-thumb `translateX` distances so thumb `i`'s layout center sits on the
 * thumbnail-strip midline when `translateX = -travels[i]`.
 *
 * Uses `offsetLeft` / `offsetWidth` (layout box), not `getBoundingClientRect`.
 * Rect centers follow the axis-aligned bounding box of CSS transforms — so a
 * consumer `rotate()` on inactive thumbs would shift travel stops and leave the
 * upright active thumb off the indicator. Layout offsets ignore those transforms
 * and still include flex gap. Falls back to rects when offsets collapse (jsdom).
 */
export function measureThumbTravels(thumbs: HTMLElement[]): {
  travels: number[];
  widths: number[];
} {
  if (thumbs.length === 0) return { travels: [], widths: [] };

  const layoutWidths = thumbs.map((thumb) => thumb.offsetWidth || 0);
  const layoutCenters = thumbs.map(
    (thumb, i) => thumb.offsetLeft + layoutWidths[i]! / 2,
  );
  const layoutOk =
    layoutWidths.some((w) => w > 0) &&
    (thumbs.length < 2 || layoutCenters.some((c, i) => i > 0 && c !== layoutCenters[0]));

  if (layoutOk) {
    const origin = layoutCenters[0]!;
    return {
      travels: layoutCenters.map((c) => c - origin),
      widths: layoutWidths,
    };
  }

  const widths = thumbs.map((thumb, i) => {
    return thumb.getBoundingClientRect().width || layoutWidths[i] || 0;
  });
  const centers = thumbs.map((thumb, i) => {
    const rect = thumb.getBoundingClientRect();
    if (rect.width > 0) return rect.left + rect.width / 2;
    return thumb.offsetLeft + widths[i]! / 2;
  });
  const origin = centers[0]!;
  return {
    travels: centers.map((c) => c - origin),
    widths,
  };
}

/** Piecewise-linear travel for index-linear scroll progress `0→1`. */
export function thumbTravelAtProgress(travels: number[], progress: number): number {
  const max = Math.max(0, travels.length - 1);
  if (max <= 0) return travels[0] ?? 0;
  const f = Math.min(1, Math.max(0, progress)) * max;
  const i0 = Math.min(max, Math.floor(f));
  const i1 = Math.min(max, i0 + 1);
  const a = travels[i0] ?? 0;
  const b = travels[i1] ?? a;
  return a + (b - a) * (f - i0);
}

export function thumbTravelsAreUniform(travels: number[]): boolean {
  if (travels.length < 2) return true;
  const step = travels[1]!;
  if (step <= 0) return true;
  return travels.every((travel, i) => Math.abs(travel - i * step) < 1);
}

export function thumbTravelsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i]! - b[i]!) > 0.5) return false;
  }
  return true;
}

/**
 * ScrollTimeline / WAAPI keyframes for the track. Uniform thumbs keep the
 * historical two-stop link; variable-width thumbs get one stop per index
 * (equal offsets ↔ index-linear `slidesScrollProgress`).
 */
export function trackTransformKeyframes(travels: number[]): Keyframe[] {
  const max = Math.max(0, travels.length - 1);
  if (max === 0) {
    return [{ transform: 'translate3d(0px, 0, 0)' }];
  }
  if (thumbTravelsAreUniform(travels)) {
    return [
      { transform: 'translate3d(0px, 0, 0)' },
      { transform: `translate3d(${-(travels[max] ?? 0)}px, 0, 0)` },
    ];
  }
  return travels.map((travel, i) => ({
    offset: i / max,
    transform: `translate3d(${-travel}px, 0, 0)`,
  }));
}

/** Registered thumbs sorted by index (stable midline / travel measurement). */
export function orderedThumbs(map: Map<number, HTMLElement>): HTMLElement[] {
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, node]) => node);
}

interface ScrollTimelineOptions {
  source?: Element | Document | null;
  axis?: 'block' | 'inline' | 'x' | 'y';
}

type ScrollTimelineConstructor = new (options?: ScrollTimelineOptions) => AnimationTimeline;

export function getScrollTimelineConstructor(): ScrollTimelineConstructor | null {
  if (typeof window === 'undefined') return null;
  const ctor = (window as Window & { ScrollTimeline?: ScrollTimelineConstructor }).ScrollTimeline;
  return typeof ctor === 'function' ? ctor : null;
}

/** Current computed translateX (ScrollTimeline / WAAPI / inline sync). */
export function readComputedTranslateX(el: HTMLElement): number {
  const raw = getComputedStyle(el).transform;
  if (!raw || raw === 'none') return 0;
  try {
    return new DOMMatrixReadOnly(raw).m41;
  } catch {
    const m = /matrix(?:3d)?\(([^)]+)\)/.exec(raw);
    if (!m) return 0;
    const parts = m[1]!.split(',').map((v) => Number(v.trim()));
    return parts.length === 6 ? parts[4]! : parts.length === 16 ? parts[12]! : 0;
  }
}
