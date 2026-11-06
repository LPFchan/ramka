import { afterEach, describe, expect, it } from 'vitest';

import {
  pageNeedsNameIsolation,
  resetNameIsolationCache,
  sheetsDeclareViewTransitionName,
} from './vt-name-isolation';

/**
 * Fake CSSOM fixtures: jsdom's CSS parser drops properties it does not know,
 * so stylesheet-shaped scans are pinned against hand-built rule objects (the
 * scanner is duck-typed on `style` / `cssRules` / `styleSheet` exactly so the
 * real objects and these fakes walk the same path).
 */
function styleRule(name: string | null) {
  return {
    style: {
      getPropertyValue: (prop: string) =>
        prop === 'view-transition-name' && name != null ? name : '',
    },
  };
}

function sheet(...rules: unknown[]): CSSStyleSheet {
  return { cssRules: rules } as unknown as CSSStyleSheet;
}

afterEach(() => {
  resetNameIsolationCache();
  document
    .querySelectorAll('[data-test-foreign]')
    .forEach((el) => el.remove());
});

describe('sheetsDeclareViewTransitionName', () => {
  it('finds a name declared in a plain style rule', () => {
    expect(sheetsDeclareViewTransitionName([sheet(styleRule('hero'))])).toBe(true);
  });

  it('ignores rules without the property and `none` declarations (our own isolation rule)', () => {
    expect(sheetsDeclareViewTransitionName([sheet(styleRule(null))])).toBe(false);
    expect(sheetsDeclareViewTransitionName([sheet(styleRule('none'))])).toBe(false);
  });

  it('recurses into grouping rules (@media / @supports / @layer)', () => {
    const grouping = { cssRules: [styleRule('card')] };
    expect(sheetsDeclareViewTransitionName([sheet(grouping)])).toBe(true);
  });

  it('recurses into @import child sheets', () => {
    const importRule = { styleSheet: sheet(styleRule('hero')) };
    expect(sheetsDeclareViewTransitionName([sheet(importRule)])).toBe(true);
  });

  it('treats unreadable (cross-origin) sheets as name-free instead of arming isolation', () => {
    const crossOrigin = {
      get cssRules(): CSSRuleList {
        throw new DOMException('SecurityError');
      },
    } as unknown as CSSStyleSheet;
    expect(sheetsDeclareViewTransitionName([crossOrigin])).toBe(false);
    // …and an unreadable sheet must not mask a readable one carrying a name.
    expect(sheetsDeclareViewTransitionName([crossOrigin, sheet(styleRule('hero'))])).toBe(true);
  });
});

describe('pageNeedsNameIsolation', () => {
  it('is false on a page with no view-transition-names', () => {
    expect(pageNeedsNameIsolation()).toBe(false);
  });

  it('detects inline style names on every call (no caching)', () => {
    expect(pageNeedsNameIsolation()).toBe(false);

    const el = document.createElement('div');
    el.setAttribute('data-test-foreign', '');
    // Raw attribute write, as consumers' HTML would deliver it.
    el.setAttribute('style', 'view-transition-name: hero');
    document.body.appendChild(el);
    expect(pageNeedsNameIsolation()).toBe(true);

    el.remove();
    expect(pageNeedsNameIsolation()).toBe(false);
  });
});
