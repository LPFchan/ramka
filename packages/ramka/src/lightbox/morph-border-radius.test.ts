import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveMorphBorderRadius } from './use-view-transition-morph';

describe('resolveMorphBorderRadius', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  function box(opts: {
    borderRadius: string;
    width?: number;
    height?: number;
    fontSize?: string;
    rootFontSize?: string;
  }) {
    const width = opts.width ?? 64;
    const height = opts.height ?? 64;
    const el = document.createElement('div');
    document.body.appendChild(el);
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      width,
      height,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON() {},
    } as DOMRect);

    // Drive computed style directly — jsdom doesn't reliably preserve
    // `calc(infinity * 1px)` or mixed-unit shorthands through style=.
    const realGcs = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((target, pseudo) => {
      if (target === el) {
        return {
          borderRadius: opts.borderRadius,
          fontSize: opts.fontSize ?? '16px',
        } as CSSStyleDeclaration;
      }
      if (target === document.documentElement) {
        return {
          borderRadius: '0px',
          fontSize: opts.rootFontSize ?? '16px',
        } as CSSStyleDeclaration;
      }
      return realGcs(target, pseudo);
    });

    return el;
  }

  it('keeps ordinary px radii', () => {
    const el = box({ borderRadius: '8px', width: 800, height: 600 });
    expect(resolveMorphBorderRadius(el)).toBe('8px');
  });

  it('rewrites Tailwind v4 rounded-full (calc infinity) to half the short side', () => {
    const el = box({ borderRadius: 'calc(infinity * 1px)', width: 64, height: 64 });
    expect(resolveMorphBorderRadius(el)).toBe('32px');
  });

  it('rewrites 50% / 9999px full-pill values to the used pixel radius', () => {
    expect(resolveMorphBorderRadius(box({ borderRadius: '50%', width: 64, height: 64 }))).toBe(
      '32px',
    );
    expect(resolveMorphBorderRadius(box({ borderRadius: '9999px', width: 64, height: 64 }))).toBe(
      '32px',
    );
  });

  it('uses the shorter side when the box is not square', () => {
    const el = box({ borderRadius: 'calc(infinity * 1px)', width: 40, height: 80 });
    expect(resolveMorphBorderRadius(el)).toBe('20px');
  });

  it('resolves % / rem / em corner tokens to px', () => {
    expect(
      resolveMorphBorderRadius(
        box({ borderRadius: '50% 0.5rem 2em 4px', width: 64, height: 64, fontSize: '10px' }),
      ),
    ).toBe('32px 8px 20px 4px');
  });

  it('returns 0px for a collapsed (0×0) box', () => {
    expect(
      resolveMorphBorderRadius(box({ borderRadius: '16px', width: 0, height: 0 })),
    ).toBe('0px');
  });

  // -------------------------------------------------------------------------
  // CSS corner-overlap rule (css-backgrounds-3 §5.5).
  //
  // The used radii must match what the browser renders: when the sum of
  // adjacent radii overflows an edge, ALL corners are multiplied by ONE
  // factor `f = min(1, edge / sum-of-adjacent-radii)` over all four edges —
  // corners are never clamped independently.
  //
  // Regression context: a landing-page tile with `border-radius: 16px 16px
  // 160px 160px` on a ~314×196 box renders bottom corners at ~157px
  // (f = 314/320), but the morph used to cap them at 98px (half the short
  // side). The close morph animated toward the flatter shape and visibly
  // snapped to the real trigger shape on the last frame.
  // -------------------------------------------------------------------------
  describe('corner-overlap scaling', () => {
    it('scales bottom-heavy radii by the shared overflow factor (reported bug)', () => {
      // 16+16 top, 160+160 bottom on 314×196: only the bottom edge overflows
      // (320 > 314), so f = 314/320 = 0.98125 applies to ALL corners.
      const el = box({ borderRadius: '16px 16px 160px 160px', width: 314, height: 196 });
      expect(resolveMorphBorderRadius(el)).toBe('15.7px 15.7px 157px 157px');
    });

    it('does not cap large corners at half the short side when no edge overflows', () => {
      // Old behavior would clamp 120px to min(314,196)/2 = 98px. The browser
      // renders the full 120px: bottom edge 16+120=136 <= 314, right edge
      // 16+120=136 <= 196 — no overflow anywhere, f = 1. (Serialized as the
      // equivalent minimal 3-token shorthand: bl == tr is dropped.)
      const el = box({ borderRadius: '16px 16px 120px 16px', width: 314, height: 196 });
      expect(resolveMorphBorderRadius(el)).toBe('16px 16px 120px');
    });

    it('leaves asymmetric radii untouched when every edge fits', () => {
      const el = box({ borderRadius: '16px 16px 80px 80px', width: 314, height: 196 });
      expect(resolveMorphBorderRadius(el)).toBe('16px 16px 80px 80px');
    });

    it('scales by the vertical edge when height is the constraint', () => {
      // Right edge: tr+br = 200 > height 120 → f = 120/200 = 0.6.
      const el = box({ borderRadius: '0px 100px 100px 0px', width: 300, height: 120 });
      expect(resolveMorphBorderRadius(el)).toBe('0px 60px 60px 0px');
    });

    it('takes the most constraining edge across the whole box', () => {
      // Bottom edge sum 320 (f=314/320≈0.98) vs left edge sum 260 on height
      // 196 (f=196/260≈0.754) — the smaller factor wins for every corner.
      const el = box({ borderRadius: '100px 16px 160px 160px', width: 314, height: 196 });
      // f = 196 / 260
      expect(resolveMorphBorderRadius(el)).toBe('75.38px 12.06px 120.62px 120.62px');
    });

    it('resolves rounded-b-full style (infinity bottom corners) to a semicircular arch', () => {
      // Bottom corners non-finite: the overlap factor drives them to half the
      // width and crushes the finite top corners toward zero — matching how
      // browsers render clamped calc(infinity * 1px) alongside finite radii.
      const el = box({
        borderRadius: '16px 16px calc(infinity * 1px) calc(infinity * 1px)',
        width: 314,
        height: 196,
      });
      expect(resolveMorphBorderRadius(el)).toBe('0px 0px 157px 157px');
    });

    it('gives one non-finite corner the full box and crushes its finite neighbors', () => {
      // Spec math with a huge tl: f ≈ 64/tl, so tl → 64 and the 4px corners
      // → ~0. (Browsers clamp calc infinity to a huge finite value and render
      // the same way.)
      const el = box({
        borderRadius: 'calc(infinity * 1px) 4px 4px 4px',
        width: 64,
        height: 64,
      });
      expect(resolveMorphBorderRadius(el)).toBe('64px 0px 0px');
    });

    it('resolves all-corner 50% on a non-square box to the used pill radius', () => {
      // Horizontal basis is the width (150px per corner), but the vertical
      // edges overflow (300 > 100) → f = 1/3 → 50px = min(w,h)/2.
      const el = box({ borderRadius: '50%', width: 300, height: 100 });
      expect(resolveMorphBorderRadius(el)).toBe('50px');
    });
  });

  // -------------------------------------------------------------------------
  // Shorthand expansion + serialization. Computed styles may serialize the
  // shorthand with 1–4 tokens; corners must expand per the CSS rules
  // (2 tokens: tl/br + tr/bl, 3 tokens: tl + tr/bl + br) before overlap math,
  // and the output must keep the same corner mapping.
  // -------------------------------------------------------------------------
  describe('shorthand expansion', () => {
    it('expands 2-token shorthand before scaling and re-serializes minimally', () => {
      // [tl, tr, br, bl] = [10, 200, 10, 200]: every edge sums to 210 > 100
      // → f = 100/210.
      const el = box({ borderRadius: '10px 200px', width: 100, height: 100 });
      expect(resolveMorphBorderRadius(el)).toBe('4.76px 95.24px');
    });

    it('expands 3-token shorthand (tr also applies to bl)', () => {
      const el = box({ borderRadius: '8px 16px 24px', width: 64, height: 64 });
      expect(resolveMorphBorderRadius(el)).toBe('8px 16px 24px');
    });

    it('collapses a uniform result to a single token', () => {
      const el = box({ borderRadius: '12px 12px 12px 12px', width: 64, height: 64 });
      expect(resolveMorphBorderRadius(el)).toBe('12px');
    });
  });

  it('drops the elliptical second list and resolves the horizontal component', () => {
    const el = box({
      borderRadius: '16px 16px 160px 160px / 8px 8px 80px 80px',
      width: 314,
      height: 196,
    });
    expect(resolveMorphBorderRadius(el)).toBe('15.7px 15.7px 157px 157px');
  });
});
