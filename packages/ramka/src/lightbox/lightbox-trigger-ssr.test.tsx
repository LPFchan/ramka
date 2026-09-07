// @vitest-environment node
//
// Server rendering of an OPEN lightbox (deep links rendering the Portal in
// place). Runs under node — no jsdom — to exercise the real server
// environment (the trigger's `data-morph-target` stamp is gated on
// `useIsServerPaint`, whose server snapshot renderToString serves in any
// environment).
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { LightboxContent } from './lightbox-content';
import { LightboxItem } from './lightbox-item';
import { LightboxPortal } from './lightbox-portal';
import { LightboxRoot } from './lightbox-root';
import { LightboxSlide } from './lightbox-slide';
import { LightboxSlides } from './lightbox-slides';
import { LightboxThumbnail } from './lightbox-thumbnail';
import { LightboxThumbnailStrip } from './lightbox-thumbnail-strip';
import { LightboxThumbnailStripTrack } from './lightbox-thumbnail-strip-track';
import { LightboxTrigger } from './lightbox-trigger';
import { REACT_SUPPORTS_STYLE_HOISTING } from './react-style-hoisting';

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
    // The hide rule itself is React 19+ (hoistable version gate in
    // react-style-hoisting.ts); the stamp above ships on both majors.
    if (REACT_SUPPORTS_STYLE_HOISTING) {
      expect(html).toContain('[data-morph-target]{opacity:0');
    }
  });

  it('stamps the active trigger under morphTo="closest" (ref maps are empty on the server)', () => {
    // The client-side `closest` resolver walks the trigger-element ref map,
    // which never populates during server rendering — resolving through it
    // would stamp nothing and resurrect the un-hidden-trigger flash for
    // non-default configs. The stamp derives from `active` instead, which is
    // what `closest` resolves to after hydration whenever the active trigger
    // is registered (it is — it's in this same markup).
    const html = renderToString(
      <LightboxRoot defaultOpen defaultValue={2} morphTo="closest">
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
    expect(buttonAttrs(html, 'trigger-2')).toContain('data-morph-target');
    expect(buttonAttrs(html, 'trigger-0')).not.toContain('data-morph-target');
  });

  it('stamps nothing under morphTo="origin" — a server render has no opening trigger', () => {
    const html = renderToString(
      <LightboxRoot defaultOpen defaultValue={1} morphTo="origin">
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
    for (const i of [0, 1, 2]) {
      expect(buttonAttrs(html, `trigger-${i}`)).not.toContain('data-morph-target');
    }
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

describe('LightboxThumbnailStrip server rendering (SSR-open pages)', () => {
  it('never serializes data-positioned — the server cannot position the track', () => {
    // `data-positioned` is the consumer's cue that the track has genuinely
    // been measured and placed against the Slides scroller, which requires
    // client layout. If it ever leaked into server HTML, CSS hiding the strip
    // until positioning would stop working and the pre-hydration strip would
    // paint at offset 0. Pin the absence.
    const html = renderToString(
      <LightboxRoot defaultOpen defaultValue={1}>
        <LightboxTrigger index={0}>open</LightboxTrigger>
        <LightboxPortal container={null}>
          <LightboxContent aria-label="viewer">
            <LightboxSlides aria-label="Slides">
              {[0, 1, 2].map((i) => (
                <LightboxSlide key={i}>
                  <LightboxItem index={i}>item {i}</LightboxItem>
                </LightboxSlide>
              ))}
            </LightboxSlides>
            <LightboxThumbnailStrip data-testid="strip">
              <LightboxThumbnailStripTrack aria-label="Thumbs">
                {[0, 1, 2].map((i) => (
                  <LightboxThumbnail key={i} index={i}>
                    t{i}
                  </LightboxThumbnail>
                ))}
              </LightboxThumbnailStripTrack>
            </LightboxThumbnailStrip>
          </LightboxContent>
        </LightboxPortal>
      </LightboxRoot>,
    );
    expect(html).toContain('data-ramka-thumbnail-strip');
    expect(html).not.toContain('data-positioned');
  });
});
