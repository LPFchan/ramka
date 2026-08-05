import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LightboxSlideDataAttributes } from './lightbox-data-attributes';
import {
  applyFirefoxFullBleedCaptureInset,
  getFullBleedAxes,
} from './use-view-transition-morph';

/** Layout-box fixture — mirrors pre-transform size (pull scale must not matter). */
function layoutBox(width: number, height: number): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'offsetWidth', { configurable: true, value: width });
  Object.defineProperty(el, 'offsetHeight', { configurable: true, value: height });
  // Transformed visual rect is inset (pull-to-dismiss) — detection must ignore this.
  el.getBoundingClientRect = () =>
    ({
      x: 40,
      y: 80,
      top: 80,
      left: 40,
      right: 40 + width * 0.7,
      bottom: 80 + height * 0.7,
      width: width * 0.7,
      height: height * 0.7,
      toJSON: () => ({}),
    }) as DOMRect;
  return el;
}

describe('getFullBleedAxes', () => {
  beforeEach(() => {
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      value: 529,
    });
    Object.defineProperty(document.documentElement, 'clientHeight', {
      configurable: true,
      value: 910,
    });
  });

  it('uses layout size, not the transformed visual rect', () => {
    // Visual rect is inset (see layoutBox mock); layout still fills the viewport.
    expect(getFullBleedAxes(layoutBox(529, 400))).toEqual({
      horizontal: true,
      vertical: false,
    });
  });

  it('detects vertical full-bleed from layout height', () => {
    expect(getFullBleedAxes(layoutBox(400, 910))).toEqual({
      horizontal: false,
      vertical: true,
    });
  });

  it('detects both axes', () => {
    expect(getFullBleedAxes(layoutBox(529, 910))).toEqual({
      horizontal: true,
      vertical: true,
    });
  });

  it('is false when layout is letterboxed on both axes', () => {
    expect(getFullBleedAxes(layoutBox(400, 700))).toEqual({
      horizontal: false,
      vertical: false,
    });
  });
});

describe('applyFirefoxFullBleedCaptureInset', () => {
  const originalUa = navigator.userAgent;

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: originalUa,
    });
  });

  function firefoxUa() {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Macintosh; rv:153.0) Gecko/20100101 Firefox/153.0',
    });
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      value: 529,
    });
    Object.defineProperty(document.documentElement, 'clientHeight', {
      configurable: true,
      value: 910,
    });
  }

  function mountSlide(
    media: HTMLElement,
    padding?: Partial<Record<'left' | 'right' | 'top' | 'bottom', string>>,
  ) {
    const slide = document.createElement('div');
    slide.setAttribute(LightboxSlideDataAttributes.slide, '');
    if (padding?.left) slide.style.paddingLeft = padding.left;
    if (padding?.right) slide.style.paddingRight = padding.right;
    if (padding?.top) slide.style.paddingTop = padding.top;
    if (padding?.bottom) slide.style.paddingBottom = padding.bottom;
    document.body.append(slide);
    slide.append(media);
    return slide;
  }

  it('no-ops outside Firefox', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Macintosh; Chrome/120.0.0.0)',
    });
    expect(applyFirefoxFullBleedCaptureInset(layoutBox(529, 910))).toBe(null);
  });

  it('pads inline when layout is horizontally full-bleed (even if scaled visually)', () => {
    firefoxUa();
    const media = layoutBox(529, 400);
    const slide = mountSlide(media, { left: '8px', right: '8px' });

    const restore = applyFirefoxFullBleedCaptureInset(media);
    expect(restore).not.toBe(null);
    expect(slide.style.paddingLeft).toBe('9px');
    expect(slide.style.paddingRight).toBe('9px');
    expect(slide.style.paddingTop).toBe('');
    expect(slide.style.paddingBottom).toBe('');

    restore!();
    expect(slide.style.paddingLeft).toBe('8px');
    expect(slide.style.paddingRight).toBe('8px');
    slide.remove();
  });

  it('pads block when layout is vertically full-bleed', () => {
    firefoxUa();
    const media = layoutBox(400, 910);
    const slide = mountSlide(media, { top: '12px', bottom: '12px' });

    const restore = applyFirefoxFullBleedCaptureInset(media);
    expect(restore).not.toBe(null);
    expect(slide.style.paddingTop).toBe('13px');
    expect(slide.style.paddingBottom).toBe('13px');
    expect(slide.style.paddingLeft).toBe('');
    expect(slide.style.paddingRight).toBe('');

    restore!();
    expect(slide.style.paddingTop).toBe('12px');
    expect(slide.style.paddingBottom).toBe('12px');
    slide.remove();
  });

  it('pads all sides when layout is full-bleed on both axes', () => {
    firefoxUa();
    const media = layoutBox(529, 910);
    const slide = mountSlide(media);

    const restore = applyFirefoxFullBleedCaptureInset(media);
    expect(restore).not.toBe(null);
    expect(slide.style.paddingLeft).toBe('1px');
    expect(slide.style.paddingRight).toBe('1px');
    expect(slide.style.paddingTop).toBe('1px');
    expect(slide.style.paddingBottom).toBe('1px');

    restore!();
    expect(slide.style.paddingLeft).toBe('');
    expect(slide.style.paddingTop).toBe('');
    slide.remove();
  });

  it('no-ops when layout is not full-bleed on either axis', () => {
    firefoxUa();
    expect(applyFirefoxFullBleedCaptureInset(layoutBox(400, 700))).toBe(null);
  });
});
