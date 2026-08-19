/**
 * Shared offset-geometry for `Lightbox.Slides` and scroll-linked chrome
 * (`Lightbox.ThumbnailStrip`). Uses layout properties (`offsetLeft` / `offsetWidth`)
 * so measurements stay reliable inside portals / dialogs on mobile Safari.
 *
 * Slides may be full-viewport or content-sized (snug around media). Snap
 * positions are stored per slide so variable widths stay correct.
 *
 * `offsetLeft` is relative to `offsetParent`, not the scroll container. A
 * static-positioned scroller inside a positioned dialog (centered stage) makes
 * every slide's offset include the stage inset — using that as `scrollLeft`
 * leaves index 0 occupying the first ~half-viewport of scroll.
 */

/**
 * Slide left edge in the scroller's content coordinates.
 */
function slideOffsetLeftInViewport(slide: HTMLElement, viewport: HTMLElement): number {
  if (slide.offsetParent === viewport) {
    return slide.offsetLeft;
  }
  // Shared containing block (typical: both sit in a `position: fixed` dialog).
  // `offsetLeft` is scroll-invariant, so do not add `scrollLeft`.
  if (slide.offsetParent === viewport.offsetParent) {
    return slide.offsetLeft - viewport.offsetLeft;
  }
  return (
    slide.getBoundingClientRect().left - viewport.getBoundingClientRect().left + viewport.scrollLeft
  );
}

export const SLIDE_SELECTOR = '[data-ramka-slide]';

export interface SlidesGeometry {
  /**
   * `scrollLeft` that centers each slide (length = `count`). Prefer this over
   * `base + index * step` when slide widths can differ.
   */
  offsets: number[];
  /** `scrollLeft` that centers slide 0 (`offsets[0]`). */
  base: number;
  /**
   * Stride between slide 0 and 1 when the track is uniform. Kept for callers
   * that only need a representative step; navigation should use `offsets`.
   */
  step: number;
  /** Number of slide boxes measured. */
  count: number;
}

/**
 * Measure per-slide snap offsets from layout values.
 */
export function measureSlidesGeometry(viewport: HTMLElement): SlidesGeometry {
  const slides = viewport.querySelectorAll<HTMLElement>(SLIDE_SELECTOR);
  const count = slides.length;
  const clientWidth = viewport.clientWidth || 1;
  if (count === 0) return { offsets: [], base: 0, step: clientWidth, count: 0 };

  const offsets = Array.from(slides, (slide) => {
    const width = slide.offsetWidth || clientWidth;
    const left = slideOffsetLeftInViewport(slide, viewport);
    // scrollLeft that centers this slide (0 for a full-width slide at offset 0).
    return left + width / 2 - clientWidth / 2;
  });
  const base = offsets[0] ?? 0;
  const rawStep = count > 1 ? offsets[1]! - offsets[0]! : clientWidth;
  const step = rawStep > 0 ? rawStep : clientWidth;
  return { offsets, base, step, count };
}

/** True when snap offsets match a uniform `base + i * step` track. */
export function slidesGeometryIsUniform(geometry: SlidesGeometry): boolean {
  const { offsets, count, base, step } = geometry;
  if (count < 2 || offsets.length !== count) return true;
  return offsets.every((offset, i) => Math.abs(offset - (base + i * step)) < 1);
}

/** `scrollLeft` that centers `index`, clamped to the measured range. */
export function slideScrollLeftForIndex(index: number, geometry: SlidesGeometry): number {
  const { offsets, count, base, step } = geometry;
  if (count <= 0) return 0;
  const i = Math.min(Math.max(0, index), count - 1);
  return offsets[i] ?? base + i * step;
}

/** Nearest slide index for a `scrollLeft` (or live viewport position). */
export function slideIndexFromScrollLeft(scrollLeft: number, geometry: SlidesGeometry): number {
  const { offsets, count, base, step } = geometry;
  if (count <= 0) return 0;
  if (count === 1 || offsets.length === 0) return 0;

  // Fast path: uniform stride (full-bleed slides).
  if (slidesGeometryIsUniform(geometry) && step > 0) {
    return Math.min(count - 1, Math.max(0, Math.round((scrollLeft - base) / step)));
  }

  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < offsets.length; i++) {
    const dist = Math.abs(scrollLeft - offsets[i]!);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

/**
 * Logical scroll progress 0→1 over the index range.
 * Piecewise-linear across per-slide snap offsets so variable-width tracks stay
 * aligned with equal-offset thumbnail-strip keyframes (one stop per index).
 */
export function slidesScrollProgress(viewport: HTMLElement, geometry: SlidesGeometry): number {
  const { offsets, count, base, step } = geometry;
  if (count <= 1) return 0;

  if (offsets.length === count) {
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

  // Legacy geometry without offsets.
  const logicalMax = Math.max(0, count - 1) * step;
  if (logicalMax <= 0) return 0;
  return Math.min(1, Math.max(0, (viewport.scrollLeft - base) / logicalMax));
}
