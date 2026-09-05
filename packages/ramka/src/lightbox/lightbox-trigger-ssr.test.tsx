// @vitest-environment node
//
// Server rendering of an OPEN lightbox (deep links rendering the Portal in
// place). Runs under node — no jsdom — because the trigger's SSR-only
// `data-morph-target` stamp is gated on `typeof window === 'undefined'`,
// which is true in real server rendering but not in a jsdom test.
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { LightboxContent } from './lightbox-content';
import { LightboxPortal } from './lightbox-portal';
import { LightboxRoot } from './lightbox-root';
import { LightboxTrigger } from './lightbox-trigger';

/** Attribute region (up to `>`) of the button tagged with the given testid. */
function buttonAttrs(html: string, testid: string): string {
  const chunk = html
    .split('<button')
    .slice(1)
    .find((c) => c.slice(0, c.indexOf('>')).includes(`data-testid="${testid}"`));
  expect(chunk, `button ${testid} in server HTML`).toBeTruthy();
  return chunk!.slice(0, chunk!.indexOf('>'));
}

describe('LightboxTrigger server rendering (SSR-open pages)', () => {
  it('stamps data-morph-target on the active trigger and ships the hide rule', () => {
    const html = renderToString(
      <LightboxRoot defaultOpen defaultValue={1}>
        {[0, 1, 2].map((i) => (
          <LightboxTrigger key={i} index={i} data-testid={`trigger-${i}`}>
            T{i}
          </LightboxTrigger>
        ))}
        <LightboxPortal container={null}>
          <LightboxContent aria-label="viewer">viewer</LightboxContent>
        </LightboxPortal>
      </LightboxRoot>,
    );

    // The active trigger is hidden from the very first paint: the attribute is
    // stamped on the trigger root (the server cannot know about morphRef
    // nodes; hydration re-syncs), and the hide rule rides along as a hoisted
    // <style>, so no effect has to run before the trigger disappears.
    expect(buttonAttrs(html, 'trigger-1')).toContain('data-morph-target');
    expect(buttonAttrs(html, 'trigger-0')).not.toContain('data-morph-target');
    expect(buttonAttrs(html, 'trigger-2')).not.toContain('data-morph-target');
    expect(html).toContain('[data-morph-target]{opacity:0');
  });

  it('does not stamp data-morph-target when server-rendered closed', () => {
    const html = renderToString(
      <LightboxRoot>
        <LightboxTrigger index={0} data-testid="trigger-0">
          T0
        </LightboxTrigger>
        <LightboxPortal container={null}>
          <LightboxContent aria-label="viewer">viewer</LightboxContent>
        </LightboxPortal>
      </LightboxRoot>,
    );
    expect(buttonAttrs(html, 'trigger-0')).not.toContain('data-morph-target');
  });
});
