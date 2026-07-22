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

  it('keeps ordinary px radii (clamped to the used pill cap)', () => {
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

  it('resolves mixed corners independently (infinity + px)', () => {
    const el = box({
      borderRadius: 'calc(infinity * 1px) 4px 4px 4px',
      width: 64,
      height: 64,
    });
    expect(resolveMorphBorderRadius(el)).toBe('32px 4px 4px 4px');
  });

  it('resolves % / rem / em corner tokens to px', () => {
    expect(
      resolveMorphBorderRadius(
        box({ borderRadius: '50% 0.5rem 2em 4px', width: 64, height: 64, fontSize: '10px' }),
      ),
    ).toBe('32px 8px 20px 4px');
  });
});
