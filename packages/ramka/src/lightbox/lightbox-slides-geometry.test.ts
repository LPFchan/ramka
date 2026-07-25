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
  for (const slide of slides) {
    const el = document.createElement('div');
    el.setAttribute('data-ramka-slide', '');
    Object.defineProperty(el, 'offsetLeft', { value: slide.offsetLeft });
    Object.defineProperty(el, 'offsetWidth', { value: slide.offsetWidth });
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
