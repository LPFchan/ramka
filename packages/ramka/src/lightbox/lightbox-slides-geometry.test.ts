import { describe, expect, it } from 'vitest';

import {
  measureSlidesGeometry,
  slideIndexFromInlinePosition,
  slideInlinePositionForIndex,
  slidesGeometryIsUniform,
  slidesScrollProgressAt,
} from './lightbox-slides-geometry';
import type { TextDirection } from './lightbox-direction';

function mockViewport(
  clientWidth: number,
  slides: { offsetLeft: number; offsetWidth: number }[],
  scrollLeft = 0,
  scrollWidth?: number,
): HTMLElement {
  const viewport = document.createElement('div');
  Object.defineProperty(viewport, 'clientWidth', { value: clientWidth });
  Object.defineProperty(viewport, 'scrollWidth', {
    configurable: true,
    value: scrollWidth ?? Math.max(clientWidth, ...slides.map((s) => s.offsetLeft + s.offsetWidth)),
  });
  Object.defineProperty(viewport, 'scrollLeft', {
    configurable: true,
    get: () => scrollLeft,
    set: (v: number) => {
      scrollLeft = v;
    },
  });
  Object.defineProperty(viewport, 'offsetLeft', { configurable: true, value: 0 });
  for (const slide of slides) {
    const el = document.createElement('div');
    el.setAttribute('data-ramka-slide', '');
    Object.defineProperty(el, 'offsetLeft', { value: slide.offsetLeft });
    Object.defineProperty(el, 'offsetWidth', { value: slide.offsetWidth });
    Object.defineProperty(el, 'offsetParent', { configurable: true, value: viewport });
    viewport.appendChild(el);
  }
  return viewport;
}

/**
 * Lay slides out in DOM order for `dir`, the way a browser would.
 *
 * `offsetLeft` is measured from the scroller's padding-box left edge. An RTL
 * flex row packs slide 0 against the *right* edge of the client box and
 * overflows leftward, so slide 0 sits at `clientWidth − width` and later slides
 * run negative. Getting this wrong is what an e2e run caught: mocking RTL as
 * "laid out from `scrollWidth`" made the suite agree with a broken
 * implementation.
 */
function trackFor(
  dir: TextDirection,
  clientWidth: number,
  widths: number[],
  gap = 0,
): { slides: { offsetLeft: number; offsetWidth: number }[]; scrollWidth: number } {
  const scrollWidth =
    widths.reduce((total, w) => total + w, 0) + gap * Math.max(0, widths.length - 1);
  let cursor = dir === 'rtl' ? clientWidth : 0;
  const slides = widths.map((offsetWidth) => {
    if (dir === 'rtl') cursor -= offsetWidth;
    const offsetLeft = cursor;
    cursor += dir === 'rtl' ? -gap : offsetWidth + gap;
    return { offsetLeft, offsetWidth };
  });
  return { slides, scrollWidth };
}

describe.each<TextDirection>(['ltr', 'rtl'])('measureSlidesGeometry (%s)', (dir) => {
  it('measures uniform full-width slides', () => {
    const { slides, scrollWidth } = trackFor(dir, 1000, [1000, 1000, 1000]);
    const viewport = mockViewport(1000, slides, 0, scrollWidth);
    const g = measureSlidesGeometry(viewport, dir);
    expect(g.count).toBe(3);
    expect(g.offsets).toEqual([0, 1000, 2000]);
    expect(g.base).toBe(0);
    expect(g.step).toBe(1000);
    expect(slidesGeometryIsUniform(g)).toBe(true);
  });

  it('measures variable-width (snug) slides with gap', () => {
    // viewport 1000; slides 400, 600, 300 centered via their own widths + gap 20
    const { slides, scrollWidth } = trackFor(dir, 1000, [400, 600, 300], 20);
    const viewport = mockViewport(1000, slides, 0, scrollWidth);
    const g = measureSlidesGeometry(viewport, dir);
    expect(g.offsets).toEqual([
      0 + 200 - 500, // -300
      420 + 300 - 500, // 220
      1040 + 150 - 500, // 690
    ]);
    expect(slidesGeometryIsUniform(g)).toBe(false);
    expect(slideInlinePositionForIndex(1, g)).toBe(220);
    expect(slideIndexFromInlinePosition(220, g)).toBe(1);
    expect(slideIndexFromInlinePosition(300, g)).toBe(1);
    expect(slideIndexFromInlinePosition(700, g)).toBe(2);
  });

  it('maps inline positions to indices in index order', () => {
    const { slides, scrollWidth } = trackFor(dir, 1000, [1000, 1000, 1000]);
    const viewport = mockViewport(1000, slides, 0, scrollWidth);
    const g = measureSlidesGeometry(viewport, dir);
    expect(slideIndexFromInlinePosition(0, g)).toBe(0);
    expect(slideIndexFromInlinePosition(1000, g)).toBe(1);
    expect(slideIndexFromInlinePosition(2000, g)).toBe(2);
    expect(slideInlinePositionForIndex(0, g)).toBe(0);
    expect(slideInlinePositionForIndex(2, g)).toBe(2000);
  });
});

describe('measureSlidesGeometry (ltr)', () => {
  it('subtracts the scroller inset when offsetParent is outside the viewport', () => {
    // Centered 468px stage in a 1419px dialog: slides' offsetLeft includes the
    // (1419 − 468) / 2 ≈ 476 inset of the static scroller inside the dialog.
    const viewport = mockViewport(468, [
      { offsetLeft: 476, offsetWidth: 468 },
      { offsetLeft: 944, offsetWidth: 468 },
      { offsetLeft: 1412, offsetWidth: 468 },
    ]);
    const parent = document.createElement('div');
    Object.defineProperty(viewport, 'offsetLeft', { configurable: true, value: 476 });
    Object.defineProperty(viewport, 'offsetParent', { configurable: true, value: parent });
    for (const slide of viewport.querySelectorAll('[data-ramka-slide]')) {
      Object.defineProperty(slide, 'offsetParent', { configurable: true, value: parent });
    }

    const g = measureSlidesGeometry(viewport);
    expect(g.offsets).toEqual([0, 468, 936]);
    expect(g.base).toBe(0);
    expect(g.step).toBe(468);
    expect(slideIndexFromInlinePosition(0, g)).toBe(0);
    expect(slideIndexFromInlinePosition(200, g)).toBe(0);
    expect(slideIndexFromInlinePosition(468, g)).toBe(1);
    expect(slideIndexFromInlinePosition(936, g)).toBe(2);
  });

  it('defaults to ltr when no direction is passed', () => {
    const { slides, scrollWidth } = trackFor('ltr', 1000, [1000, 1000]);
    const viewport = mockViewport(1000, slides, 0, scrollWidth);
    expect(measureSlidesGeometry(viewport).offsets).toEqual(
      measureSlidesGeometry(viewport, 'ltr').offsets,
    );
  });
});

describe('slidesScrollProgressAt', () => {
  it('is index-linear across variable-width snap offsets', () => {
    const geometry = { offsets: [0, 100, 400], base: 0, step: 100, count: 3 };
    expect(slidesScrollProgressAt(0, geometry)).toBe(0);
    expect(slidesScrollProgressAt(50, geometry)).toBeCloseTo(0.25);
    expect(slidesScrollProgressAt(100, geometry)).toBeCloseTo(0.5);
    expect(slidesScrollProgressAt(400, geometry)).toBe(1);
  });

  it('clamps outside the measured range', () => {
    const geometry = { offsets: [0, 100, 400], base: 0, step: 100, count: 3 };
    expect(slidesScrollProgressAt(-50, geometry)).toBe(0);
    expect(slidesScrollProgressAt(500, geometry)).toBe(1);
  });
});
