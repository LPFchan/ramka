// @vitest-environment node
//
// CSP nonce delivery for the hoistable <style> tags (lightbox-csp.tsx).
// React 19.2's contract: hoisted styles carry a nonce only when the SAME
// value arrives twice — on the <style> element (via Lightbox.CSPProvider)
// AND on the server render call (`renderToReadableStream(el, { nonce:
// { style } })`). `renderToString` has no nonce option, so these tests render
// through the stream API.
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { createHandle } from './lightbox-handle';
import { LightboxContent } from './lightbox-content';
import { LightboxCSPProvider } from './lightbox-csp';
import { LightboxItem } from './lightbox-item';
import { LightboxMedia } from './lightbox-media';
import { LightboxPortal } from './lightbox-portal';
import { LightboxRoot } from './lightbox-root';
import { LightboxSlide } from './lightbox-slide';
import { LightboxSlides } from './lightbox-slides';
import { LightboxTrigger } from './lightbox-trigger';
import { REACT_SUPPORTS_STYLE_HOISTING } from './react-style-hoisting';

// `renderToReadableStream` lives in the edge server build, which React 18
// doesn't export (`react-dom` 18 has no `./server.edge` in its exports map)
// and whose `@types/react-dom` has no declarations for — while the React 18
// CI leg typechecks AND loads this file even though the suite skips there
// (hoisting is 19+). Hence both guards: the version gate keeps 18 from
// importing the module at runtime, and the assembled (non-literal) specifier
// keeps both TS and Vite's import analysis from resolving it at
// typecheck/transform time — Vite resolves literal dynamic imports even
// under `@vite-ignore`, and under the React 18 install resolution itself
// throws. The local signature restores typing.
const serverEdgeSpecifier = ['react-dom', 'server.edge'].join('/');
const { renderToReadableStream } = (
  REACT_SUPPORTS_STYLE_HOISTING
    ? await import(/* @vite-ignore */ serverEdgeSpecifier)
    : { renderToReadableStream: null }
) as {
  renderToReadableStream: (
    node: React.ReactNode,
    // React 19.2 accepts `nonce: string | { script?, style? }` (react#32461);
    // even the React 19 @types still say `string` only, hence `unknown`.
    options?: { nonce?: unknown },
  ) => Promise<ReadableStream & { allReady: Promise<void> }>;
};

const NONCE = 'test-nonce-value';

/** An open gallery exercising all three hoistable-style owners (Trigger, Slides, Media). */
function openGallery(): React.ReactElement {
  return (
    <LightboxRoot defaultOpen defaultValue={1}>
      <LightboxTrigger index={0}>open</LightboxTrigger>
      <LightboxPortal container={null}>
        <LightboxContent aria-label="viewer">
          <LightboxSlides aria-label="Slides">
            {[0, 1].map((i) => (
              <LightboxSlide key={i}>
                <LightboxItem index={i} aria-label={`${i + 1} of 2`}>
                  <LightboxMedia width={800} height={600}>
                    <img src={`/${i}.jpg`} alt="" width={800} height={600} />
                  </LightboxMedia>
                </LightboxItem>
              </LightboxSlide>
            ))}
          </LightboxSlides>
        </LightboxContent>
      </LightboxPortal>
    </LightboxRoot>
  );
}

async function renderWithStyleNonce(node: React.ReactElement): Promise<string> {
  const stream = await renderToReadableStream(node, { nonce: { style: NONCE } });
  await stream.allReady;
  return new Response(stream).text();
}

/** Attribute region (up to `>`) of every `<style>` tag in the document. */
function styleTagAttrs(html: string): string[] {
  return Array.from(html.matchAll(/<style[^>]*/g), (m) => m[0]);
}

// Skipped under React 18: the hoistable delivery these tests pin down is
// gated to React 19+ (react-style-hoisting.ts) — no tags render there at all.
describe.runIf(REACT_SUPPORTS_STYLE_HOISTING)('Lightbox.CSPProvider (hoistable style nonce)', () => {
  it('stamps the nonce on the hoisted style tags when provider and render option agree', async () => {
    const html = await renderWithStyleNonce(
      <LightboxCSPProvider nonce={NONCE}>{openGallery()}</LightboxCSPProvider>,
    );

    const tags = styleTagAttrs(html);
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) {
      expect(tag).toContain(`nonce="${NONCE}"`);
    }
    // Assert the RULE TEXTS, not DOM markers: under a nonce-configured render
    // React silently DROPS any same-precedence hoistable whose element is
    // missing the nonce (verified empirically — it logs an error and omits
    // the rule), so a component that forgets to stamp would vanish here.
    expect(html).toContain('[data-ramka-media]:not(#_)'); // Media fill
    expect(html).toContain('[data-morph-target]'); // Trigger hide
    expect(html).toContain('scroll-initial-target'); // Slides initial slide
  });

  it('covers a detached Trigger outside any Root — the reason CSPProvider is not a Root prop', async () => {
    const handle = createHandle();
    const html = await renderWithStyleNonce(
      <LightboxCSPProvider nonce={NONCE}>
        <LightboxTrigger handle={handle} index={0}>
          open
        </LightboxTrigger>
      </LightboxCSPProvider>,
    );

    // The detached trigger ships the morph-target-hide hoistable, nonce'd.
    expect(html).toContain('[data-morph-target]');
    for (const tag of styleTagAttrs(html)) {
      expect(tag).toContain(`nonce="${NONCE}"`);
    }
  });

  it('renders un-nonced tags without a provider (the pre-CSP baseline)', () => {
    const html = renderToString(openGallery());
    const tags = styleTagAttrs(html);
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) {
      expect(tag).not.toContain('nonce');
    }
  });
});
