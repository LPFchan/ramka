import { describe, expect, it } from 'vitest';

import {
  measureSlidesGeometry,
  slideIndexFromScrollLeft,
  slideScrollLeftForIndex,
  slidesGeometryIsUniform,
  slidesScrollProgress,
} from './lightbox-slides-geometry';

function mockViewport(
  clientWidth: number,
  slides: { offsetLeft: number; offsetWidth: number }[],
  scrollLeft = 0,
): HTMLElement {
  const viewport = document.createElement('div');
  Object.defineProperty(viewport, 'clientWidth', { value: clientWidth });
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

describe('measureSlidesGeometry', () => {
  it('measures uniform full-width slides', () => {
    const viewport = mockViewport(1000, [
      { offsetLeft: 0, offsetWidth: 1000 },
      { offsetLeft: 1000, offsetWidth: 1000 },
      { offsetLeft: 2000, offsetWidth: 1000 },
    ]);
    const g = measureSlidesGeometry(viewport);
    expect(g.count).toBe(3);
    expect(g.offsets).toEqual([0, 1000, 2000]);
    expect(g.base).toBe(0);
    expect(g.step).toBe(1000);
    expect(slidesGeometryIsUniform(g)).toBe(true);
  });

  it('measures variable-width (snug) slides with gap', () => {
    // viewport 1000; slides 400, 600, 300 centered via their own widths + gap 20
    const viewport = mockViewport(1000, [
      { offsetLeft: 0, offsetWidth: 400 },
      { offsetLeft: 420, offsetWidth: 600 },
      { offsetLeft: 1040, offsetWidth: 300 },
    ]);
    const g = measureSlidesGeometry(viewport);
    expect(g.offsets).toEqual([
      0 + 200 - 500, // -300
      420 + 300 - 500, // 220
      1040 + 150 - 500, // 690
    ]);
    expect(slidesGeometryIsUniform(g)).toBe(false);
    expect(slideScrollLeftForIndex(1, g)).toBe(220);
    expect(slideIndexFromScrollLeft(220, g)).toBe(1);
    expect(slideIndexFromScrollLeft(300, g)).toBe(1);
    expect(slideIndexFromScrollLeft(700, g)).toBe(2);
  });

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
    expect(slideIndexFromScrollLeft(0, g)).toBe(0);
    expect(slideIndexFromScrollLeft(200, g)).toBe(0);
    expect(slideIndexFromScrollLeft(468, g)).toBe(1);
    expect(slideIndexFromScrollLeft(936, g)).toBe(2);
  });
});

describe('slidesScrollProgress', () => {
  it('is index-linear across variable-width snap offsets', () => {
    const offsets = [0, 100, 400];
    const geometry = { offsets, base: 0, step: 100, count: 3 };
    const viewport = mockViewport(1000, [], 0);
    Object.defineProperty(viewport, 'scrollLeft', { get: () => 0 });
    expect(slidesScrollProgress(viewport, geometry)).toBe(0);

    Object.defineProperty(viewport, 'scrollLeft', { get: () => 50 });
    expect(slidesScrollProgress(viewport, geometry)).toBeCloseTo(0.25);

    Object.defineProperty(viewport, 'scrollLeft', { get: () => 100 });
    expect(slidesScrollProgress(viewport, geometry)).toBeCloseTo(0.5);

    Object.defineProperty(viewport, 'scrollLeft', { get: () => 400 });
    expect(slidesScrollProgress(viewport, geometry)).toBe(1);
  });
});
