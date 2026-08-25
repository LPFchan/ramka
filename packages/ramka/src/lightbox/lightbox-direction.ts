/**
 * Reading-direction primitives.
 *
 * Slide snap geometry (`lightbox-slides-geometry.ts`) and thumbnail-strip
 * travels (`lightbox-thumbnail-strip-geometry.ts`) both work in a *logical
 * inline* space: position 0 is the inline-start edge and grows toward
 * inline-end, so index order and position order always agree. This module is
 * the only place that maps that space onto the physical DOM — keep direction
 * checks here rather than in the measurement or navigation math.
 *
 * Per CSSOM an RTL scroller reports `scrollLeft` as `0` at the inline-start
 * (right) edge, running negative to `-(scrollWidth - clientWidth)`. Chrome 85+,
 * Firefox, and Safari all follow that; the old reversed positive-range model is
 * gone from every browser ramka supports.
 */

/** Reading direction of the text. Mirrors the HTML `dir` attribute. */
export type TextDirection = 'ltr' | 'rtl';

/**
 * Scroll position as a distance from the inline-start edge (never negative).
 *
 * The `|| 0` normalizes the `-0` that negating zero yields. A scroller treats
 * the two identically, but `-0` leaks into `Object.is` comparisons and
 * serialized state, so keep it out of the inline space entirely.
 */
export function readInlineScroll(viewport: HTMLElement, dir: TextDirection): number {
  return dir === 'rtl' ? -viewport.scrollLeft || 0 : viewport.scrollLeft;
}

/** Scroll to an inline-start distance. */
export function writeInlineScroll(
  viewport: HTMLElement,
  dir: TextDirection,
  inline: number,
): void {
  viewport.scrollLeft = dir === 'rtl' ? -inline || 0 : inline;
}

/**
 * Distance from a reference box's inline-start edge, given a physical `left`
 * offset measured from that box's *left* edge.
 *
 * RTL mirrors the axis around `referenceWidth`, so the caller has to pass the
 * box `left` is actually relative to. For `offsetLeft` inside a scroller that is
 * the client box, not the scroll box: RTL content packs against the right edge
 * of the client box and overflows leftward, giving later children negative
 * offsets. Mirroring around `scrollWidth` instead shifts every result by the
 * overflow — a bug that unit tests will happily agree with, since the fixture
 * and the implementation share the assumption.
 *
 * `referenceWidth` is ignored in LTR, where `left` is already the inline offset.
 */
export function toInlineOffset(
  left: number,
  width: number,
  referenceWidth: number,
  dir: TextDirection,
): number {
  return dir === 'rtl' ? referenceWidth - (left + width) : left;
}

/**
 * Index step for a navigation arrow key, or `0` for keys that don't navigate.
 * Vertical keys follow document order; horizontal keys mirror under RTL so
 * `ArrowLeft` advances an RTL carousel.
 */
export function arrowKeyIndexDelta(key: string, dir: TextDirection): number {
  switch (key) {
    case 'ArrowRight':
      return dir === 'rtl' ? -1 : 1;
    case 'ArrowLeft':
      return dir === 'rtl' ? 1 : -1;
    case 'ArrowDown':
      return 1;
    case 'ArrowUp':
      return -1;
    default:
      return 0;
  }
}

/**
 * Sign mapping a physical x delta onto the inline axis: `+1` in LTR, `-1` in
 * RTL. Lets a caller turn measured physical distances into inline ones without
 * knowing the width of the box they sit in — the box origin cancels out of any
 * delta between two positions inside it.
 */
export function inlineAxisSign(dir: TextDirection): 1 | -1 {
  return dir === 'rtl' ? -1 : 1;
}

/**
 * Physical `translateX` that brings an inline travel distance onto the midline.
 * A track slides opposite its travel, so the sign flips with direction.
 */
export function inlineTrackTranslateX(travel: number, dir: TextDirection): number {
  return -travel * inlineAxisSign(dir);
}
