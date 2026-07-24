/**
 * Shared offset-geometry for `Lightbox.Slides` and scroll-linked chrome
 * (`Lightbox.Filmstrip`). Uses layout properties (`offsetLeft` / `offsetWidth`)
 * so measurements stay reliable inside portals / dialogs on mobile Safari.
 */

export const SLIDE_SELECTOR = '[data-ramka-slide]';

export interface SlidesGeometry {
  /** `scrollLeft` that centers slide 0. */
  base: number;
  /** Uniform stride between consecutive slides' snap positions. */
  step: number;
  /** Number of slide boxes measured. */
  count: number;
}

/**
 * Measure the (uniform) slide geometry from offset values.
 */
export function measureSlidesGeometry(viewport: HTMLElement): SlidesGeometry {
  const slides = viewport.querySelectorAll<HTMLElement>(SLIDE_SELECTOR);
  const count = slides.length;
  const clientWidth = viewport.clientWidth || 1;
  if (count === 0) return { base: 0, step: clientWidth, count: 0 };

  const first = slides[0]!;
  const width = first.offsetWidth || clientWidth;
  // scrollLeft that centers slide 0 (0 for full-width slides).
  const base = first.offsetLeft + width / 2 - clientWidth / 2;
  const step = count > 1 ? slides[1]!.offsetLeft - first.offsetLeft : clientWidth;
  return { base, step: step > 0 ? step : clientWidth, count };
}

/** Logical scroll progress 0→1 over the index range (not scrollWidth). */
export function slidesScrollProgress(viewport: HTMLElement, geometry: SlidesGeometry): number {
  const { base, step, count } = geometry;
  const logicalMax = Math.max(0, count - 1) * step;
  if (logicalMax <= 0) return 0;
  return Math.min(1, Math.max(0, (viewport.scrollLeft - base) / logicalMax));
}
