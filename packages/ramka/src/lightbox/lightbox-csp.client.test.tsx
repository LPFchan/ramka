// Client-side (jsdom) CSP nonce delivery. Unlike the server path — which
// only emits the nonce when the render call is also configured with it
// (lightbox-csp.test.tsx) — client-inserted hoistables carry the nonce prop
// unconditionally. This is the path that matters on frameworks that cannot
// pass a style nonce to the server render yet (Next.js, vercel/next.js#76317):
// every client-side open still injects nonce'd tags that pass a strict CSP.
import { render } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it } from 'vitest';

import { LightboxCSPProvider } from './lightbox-csp';
import { LightboxMedia } from './lightbox-media';

const NONCE = 'client-nonce-value';

describe('Lightbox.CSPProvider (client-inserted hoistables)', () => {
  it('stamps the nonce on hoistables React inserts on the client', () => {
    render(
      <LightboxCSPProvider nonce={NONCE}>
        <LightboxMedia width={800} height={533}>
          <img src="/photo.jpg" alt="" width={800} height={533} />
        </LightboxMedia>
      </LightboxCSPProvider>,
    );
    const hoisted = Array.from(document.head.querySelectorAll('style[data-precedence]'));
    expect(hoisted.length).toBeGreaterThan(0);
    for (const tag of hoisted) {
      expect(tag.getAttribute('nonce')).toBe(NONCE);
    }
  });
});
