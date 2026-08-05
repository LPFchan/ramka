import { afterEach, describe, expect, it } from 'vitest';

import { isFirefox } from './is-firefox';

describe('isFirefox', () => {
  const originalUa = navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: originalUa,
    });
  });

  it('is true for Firefox UA', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Macintosh; rv:153.0) Gecko/20100101 Firefox/153.0',
    });
    expect(isFirefox()).toBe(true);
  });

  it('is false for Chrome UA', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Macintosh; Chrome/120.0.0.0)',
    });
    expect(isFirefox()).toBe(false);
  });
});
