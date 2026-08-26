/**
 * Shared offset-geometry for `Lightbox.Slides` and scroll-linked chrome
 * (`Lightbox.ThumbnailStrip`). Uses layout properties (`offsetLeft` / `offsetWidth`)
 * so measurements stay reliable inside portals / dialogs on mobile Safari.
 *
 * Slides may be full-viewport or content-sized (snug around media). Snap
 * positions are stored per slide so variable widths stay correct.
 *
 * Everything here works in **inline positions** — distance from the scroller's
 * inline-start edge, so index order and position order agree in both reading
 * directions. `lightbox-direction.ts` converts to and from physical
 * `scrollLeft`; nothing in this module branches on direction beyond the one
 * measurement step that needs it.
 *
 * `offsetLeft` is relative to `offsetParent`, not the scroll container. A
 * static-positioned scroller inside a positioned dialog (centered stage) makes
 * every slide's offset include the stage inset — using that as a scroll
 * position leaves index 0 occupying the first ~half-viewport of scroll.
 */

import { toInlineOffset, type TextDirection } from './lightbox-direction';

/**
 * Slide left edge in the scroller's content coordinates (physical, not inline).
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
  // Rect fallback. Adding `scrollLeft` is right in both directions: it is the
  // scroll translation applied to the content, and it is 0 at the inline-start
  // edge either way (just negative-going under RTL).
  return (
    slide.getBoundingClientRect().left - viewport.getBoundingClientRect().left + viewport.scrollLeft
  );
}

export const SLIDE_SELECTOR = '[data-ramka-slide]';

export interface SlidesGeometry {
  /**
   * Inline scroll position that centers each slide (length = `count`). Prefer
   * this over `base + index * step` when slide widths can differ.
   */
  offsets: number[];
  /** Inline position that centers slide 0 (`offsets[0]`). */
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
 * Measure per-slide snap offsets from layout values, as inline positions.
 */
export function measureSlidesGeometry(
  viewport: HTMLElement,
  dir: TextDirection = 'ltr',
): SlidesGeometry {
  const slides = viewport.querySelectorAll<HTMLElement>(SLIDE_SELECTOR);
  const count = slides.length;
  const clientWidth = viewport.clientWidth || 1;
  if (count === 0) return { offsets: [], base: 0, step: clientWidth, count: 0 };

  // The RTL flip mirrors around the *client* box, not the scroll box.
  // `offsetLeft` is measured from the scroller's padding-box left edge, and an
  // RTL flex row packs slide 0 against the right edge and overflows leftward —
  // so slide 0 sits near `clientWidth` and later slides go *negative*.
  // Mirroring around `scrollWidth` would offset every slide by the overflow.
  const referenceWidth = dir === 'rtl' ? clientWidth : 0;

  const offsets = Array.from(slides, (slide) => {
    const width = slide.offsetWidth || clientWidth;
    const left = toInlineOffset(
      slideOffsetLeftInViewport(slide, viewport),
      width,
      referenceWidth,
      dir,
    );
    // Inline position that centers this slide (0 for a full-width slide at
    // the inline-start edge).
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

/** Inline position that centers `index`, clamped to the measured range. */
export function slideInlinePositionForIndex(index: number, geometry: SlidesGeometry): number {
  const { offsets, count, base, step } = geometry;
  if (count <= 0) return 0;
  const i = Math.min(Math.max(0, index), count - 1);
  return offsets[i] ?? base + i * step;
}

/** Nearest slide index for an inline scroll position. */
export function slideIndexFromInlinePosition(inline: number, geometry: SlidesGeometry): number {
  const { offsets, count, base, step } = geometry;
  if (count <= 0) return 0;
  if (count === 1 || offsets.length === 0) return 0;

  // Fast path: uniform stride (full-bleed slides).
  if (slidesGeometryIsUniform(geometry) && step > 0) {
    return Math.min(count - 1, Math.max(0, Math.round((inline - base) / step)));
  }

  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < offsets.length; i++) {
    const dist = Math.abs(inline - offsets[i]!);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

/**
 * Logical scroll progress 0→1 over the index range, from an inline position.
 * Piecewise-linear across per-slide snap offsets so variable-width tracks stay
 * aligned with equal-offset thumbnail-strip keyframes (one stop per index).
 */
export function slidesScrollProgressAt(inline: number, geometry: SlidesGeometry): number {
  const { offsets, count, base, step } = geometry;
  if (count <= 1) return 0;

  if (offsets.length === count) {
    const first = offsets[0]!;
    const last = offsets[count - 1]!;
    if (inline <= first) return 0;
    if (inline >= last) return 1;
    for (let i = 0; i < count - 1; i++) {
      const a = offsets[i]!;
      const b = offsets[i + 1]!;
      if (inline <= b) {
        const t = (inline - a) / (b - a || 1);
        return (i + t) / (count - 1);
      }
    }
    return 1;
  }

  // Legacy geometry without offsets.
  const logicalMax = Math.max(0, count - 1) * step;
  if (logicalMax <= 0) return 0;
  return Math.min(1, Math.max(0, (inline - base) / logicalMax));
}
