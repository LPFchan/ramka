import { render } from '@testing-library/react';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { LightboxMedia } from './lightbox-media';

const FILL_DECLARATIONS = 'width:100%;height:100%;min-width:0;min-height:0';

function headStyleText(): string {
  return Array.from(document.head.querySelectorAll('style'))
    .map((el) => el.textContent ?? '')
    .join('\n');
}

describe('LightboxMedia child fill rules', () => {
  it('hoists the fill rules into <head> on the client', () => {
    render(
      <LightboxMedia width={800} height={533}>
        <img src="/photo.jpg" alt="" width={800} height={533} />
      </LightboxMedia>,
    );
    const css = headStyleText();
    expect(css).toContain('[data-ramka-media]');
    expect(css).toContain(FILL_DECLARATIONS);
  });

  it('dedupes the hoistable to one tag across many Media instances', () => {
    // The constant `href` + constant rule text is what makes the hoistable
    // sound: React 19 never removes precedence styles, so per-instance text
    // would leak one dead tag per viewer open. Pin the dedupe — N instances,
    // exactly one hoisted copy of the rule.
    render(
      <>
        {[0, 1, 2].map((i) => (
          <LightboxMedia key={i} width={800} height={533}>
            <img src={`/photo-${i}.jpg`} alt="" width={800} height={533} />
          </LightboxMedia>
        ))}
      </>,
    );
    const hoisted = Array.from(document.head.querySelectorAll('style[data-precedence]')).filter(
      (el) => (el.textContent ?? '').includes(FILL_DECLARATIONS),
    );
    expect(hoisted).toHaveLength(1);
  });

  it('serializes the fill rules into server HTML', () => {
    // A page that server-renders an open lightbox (deep links with
    // `Portal container={null}`) must letterbox correctly on the very first
    // paint — before hydration runs any effect. That only holds if the fill
    // rules exist in the server markup itself.
    const html = renderToString(
      <LightboxMedia width={800} height={533}>
        <img src="/photo.jpg" alt="" width={800} height={533} />
      </LightboxMedia>,
    );
    expect(html).toContain(FILL_DECLARATIONS);
  });
});
