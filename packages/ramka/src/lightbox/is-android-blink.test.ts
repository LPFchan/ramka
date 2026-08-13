import { afterEach, describe, expect, it } from 'vitest';

import { isAndroidBlinkSnapshotRoot } from './is-android-blink';

describe('isAndroidBlinkSnapshotRoot', () => {
  const originalUa = navigator.userAgent;
  const originalChrome = (window as unknown as { chrome?: unknown }).chrome;
  const originalUaData = (navigator as Navigator & { userAgentData?: unknown }).userAgentData;

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: originalUa,
    });
    if (originalUaData === undefined) {
      delete (navigator as Navigator & { userAgentData?: unknown }).userAgentData;
    } else {
      Object.defineProperty(navigator, 'userAgentData', {
        configurable: true,
        value: originalUaData,
      });
    }
    if (originalChrome === undefined) {
      delete (window as unknown as { chrome?: unknown }).chrome;
    } else {
      (window as unknown as { chrome?: unknown }).chrome = originalChrome;
    }
    delete (window as unknown as Record<string, unknown>).GestureEvent;
    delete (document.documentElement.style as unknown as Record<string, unknown>).MozAppearance;
    delete (window as unknown as Record<string, unknown>).mozInnerScreenX;
  });

  it('is false in jsdom by default', () => {
    expect(isAndroidBlinkSnapshotRoot()).toBe(false);
  });

  it('is true for Android Chrome via chrome + userAgentData.mobile', () => {
    (window as unknown as { chrome: object }).chrome = {};
    Object.defineProperty(navigator, 'userAgentData', {
      configurable: true,
      value: { mobile: true },
    });
    expect(isAndroidBlinkSnapshotRoot()).toBe(true);
  });

  it('is true for an Android Chrome UA without window.chrome', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (Linux; Android 14; Pixel 6 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36',
    });
    expect(isAndroidBlinkSnapshotRoot()).toBe(true);
  });

  it('is false for desktop Chrome (mobile: false)', () => {
    (window as unknown as { chrome: object }).chrome = {};
    Object.defineProperty(navigator, 'userAgentData', {
      configurable: true,
      value: { mobile: false },
    });
    expect(isAndroidBlinkSnapshotRoot()).toBe(false);
  });

  it('is false on WebKit even when the UA looks like Android Chrome', () => {
    (window as unknown as Record<string, unknown>).GestureEvent = function GestureEvent() {};
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (Linux; Android 14; Pixel 6 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36',
    });
    expect(isAndroidBlinkSnapshotRoot()).toBe(false);
  });

  it('is false on Firefox even when the UA is spoofed as Android Chrome', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (Linux; Android 14; Pixel 6 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36',
    });
    (document.documentElement.style as unknown as Record<string, unknown>).MozAppearance = '';
    expect(isAndroidBlinkSnapshotRoot()).toBe(false);
  });
});
