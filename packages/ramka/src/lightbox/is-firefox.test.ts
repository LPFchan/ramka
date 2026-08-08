import { afterEach, describe, expect, it } from 'vitest';

import { isFirefox } from './is-firefox';

describe('isFirefox', () => {
  const originalUa = navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: originalUa,
    });
    delete (document.documentElement.style as unknown as Record<string, unknown>).MozAppearance;
    delete (window as unknown as Record<string, unknown>).mozInnerScreenX;
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

  it('is true via MozAppearance when the UA is spoofed (RDM device preview)', () => {
    // Firefox Responsive Design Mode device presets report the device
    // browser's UA (e.g. Chrome on Android) while the engine stays Gecko.
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (Linux; Android 14; SM-S931B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36',
    });
    (document.documentElement.style as unknown as Record<string, unknown>).MozAppearance = '';
    expect(isFirefox()).toBe(true);
  });

  it('is true via mozInnerScreenX when the UA is spoofed and MozAppearance is absent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (Linux; Android 14; SM-S931B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36',
    });
    (window as unknown as Record<string, unknown>).mozInnerScreenX = 0;
    expect(isFirefox()).toBe(true);
  });
});
