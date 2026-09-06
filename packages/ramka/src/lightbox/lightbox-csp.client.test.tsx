// Client-side (jsdom) CSP nonce delivery. Unlike the server path — which
// only emits the nonce when the render call is also configured with it
// (lightbox-csp.test.tsx) — client-inserted hoistables carry the nonce prop
// unconditionally. This is the path that matters on frameworks that cannot
// pass a style nonce to the server render yet (Next.js, vercel/next.js#76317):
// every client-side open still injects nonce'd tags that pass a strict CSP.
import { render } from '@testing-library/react';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LightboxCSPProvider } from './lightbox-csp';
import { LightboxContent } from './lightbox-content';
import { LightboxItem } from './lightbox-item';
import { LightboxMedia } from './lightbox-media';
import { LightboxPortal } from './lightbox-portal';
import { LightboxRoot } from './lightbox-root';
import { LightboxSlide } from './lightbox-slide';
import { LightboxSlides } from './lightbox-slides';
import { LightboxTrigger } from './lightbox-trigger';
import { REACT_SUPPORTS_STYLE_HOISTING } from './react-style-hoisting';

const NONCE = 'client-nonce-value';

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }
});

function hoistedStyles() {
  return Array.from(document.head.querySelectorAll('style[data-precedence]'));
}

// Skipped under React 18: the hoistable delivery is gated to React 19+
// (react-style-hoisting.ts) — under 18 these components render no tags and
// the CSSOM copies (which take no nonce) are the delivery instead.
describe.runIf(REACT_SUPPORTS_STYLE_HOISTING)('Lightbox.CSPProvider (client-inserted hoistables)', () => {
  it('stamps the nonce on the Media fill tag', () => {
    render(
      <LightboxCSPProvider nonce={NONCE}>
        <LightboxMedia width={800} height={533}>
          <img src="/photo.jpg" alt="" width={800} height={533} />
        </LightboxMedia>
      </LightboxCSPProvider>,
    );
    const hoisted = hoistedStyles();
    expect(hoisted.length).toBeGreaterThan(0);
    for (const tag of hoisted) {
      expect(tag.getAttribute('nonce')).toBe(NONCE);
    }
  });

  it('stamps the nonce on every hoistable a full open gallery inserts (Trigger, Slides, Media)', () => {
    render(
      <LightboxCSPProvider nonce={NONCE}>
        <LightboxRoot defaultOpen defaultValue={0}>
          <LightboxTrigger index={0}>open</LightboxTrigger>
          <LightboxPortal>
            <LightboxContent aria-label="viewer">
              <LightboxSlides aria-label="Slides" ssrSlideShift>
                <LightboxSlide>
                  <LightboxItem index={0} aria-label="1 of 1">
                    <LightboxMedia width={800} height={533}>
                      <img src="/photo.jpg" alt="" width={800} height={533} />
                    </LightboxMedia>
                  </LightboxItem>
                </LightboxSlide>
              </LightboxSlides>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>
      </LightboxCSPProvider>,
    );
    const hoisted = hoistedStyles();
    const css = hoisted.map((tag) => tag.textContent ?? '').join('\n');
    // All three rule sets are present…
    expect(css).toContain('[data-ramka-media]:not(#_)'); // media fill
    expect(css).toContain('[data-morph-target]'); // active-trigger hide
    expect(css).toContain('scroll-initial-target'); // SSR initial slide
    // …and every tag carries the nonce.
    for (const tag of hoisted) {
      expect(tag.getAttribute('nonce')).toBe(NONCE);
    }
  });
});
