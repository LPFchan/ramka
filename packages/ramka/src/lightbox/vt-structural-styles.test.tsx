import { render } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { LightboxRoot } from './lightbox-root';
import { ensureVtStructuralStyles } from './vt-structural-styles';
import { stubConstructedSheets, type ConstructedSheetsStub } from './lightbox-style-sheets-test-utils';

const selector = 'style[data-ramka-lightbox-vt-styles]';

let stub: ConstructedSheetsStub | null = null;

afterEach(() => {
  stub?.restore();
  stub = null;
  // The fallback path re-creates a removed element, so these tests stay
  // independent of each other's leftovers.
  document.head.querySelectorAll(selector).forEach((el) => el.remove());
});

describe('vt-structural-styles', () => {
  it('adopts the sheet in a browser, so a strict CSP has no <style> to block', () => {
    stub = stubConstructedSheets();

    ensureVtStructuralStyles();

    expect(document.querySelectorAll(selector)).toHaveLength(0);
    expect(stub.adoptedCss().join('')).toContain('view-transition-name: none !important');
  });

  it('does not inject on Root mount — styles load with the morph engine', () => {
    render(
      <>
        <LightboxRoot>{null}</LightboxRoot>
        <LightboxRoot>{null}</LightboxRoot>
      </>,
    );
    expect(document.head.querySelectorAll(selector)).toHaveLength(0);
  });

  it('falls back to a single <style> at the start of <head> without constructable sheets', () => {
    ensureVtStructuralStyles();
    ensureVtStructuralStyles();
    const sheets = document.head.querySelectorAll(selector);
    expect(sheets).toHaveLength(1);
    // Prepended so consumer stylesheets cascade after it and win ties.
    expect(document.head.firstElementChild).toBe(sheets[0]);
  });

  it('contains the structural rules skins used to ship', () => {
    ensureVtStructuralStyles();
    const css = document.head.querySelector(selector)!.textContent!;
    // Name isolation during a morph.
    expect(css).toContain('view-transition-name: none !important');
    // Morph-target hide.
    expect(css).toContain('[data-morph-target]');
    // Group radius interpolation + preset-driven timing.
    expect(css).toContain('@keyframes ramka-morph-border-radius');
    expect(css).toContain('::view-transition-group(lightbox-morph)');
    expect(css).toContain('var(--lightbox-vt-duration');
    // Crossfade dissolve retimed to the preset (open curve; close inverse).
    expect(css).toContain('data-ramka-crossfade');
    expect(css).toContain('data-ramka-view-transition="closing"');
    expect(css).toContain('--lightbox-vt-crossfade-close-easing');
    // Compositor hold — pauses every VT animation while the composited morph
    // swaps in its replacements (Android Blink swap-window tearing).
    expect(css).toContain('data-ramka-vt-hold');
    expect(css).toContain('animation-play-state: paused !important');
    // Thumb-jump slides crossfade.
    expect(css).toContain('[data-ramka-slides]::view-transition-group(root)');
    // Everything animated is reduced-motion gated.
    expect(css).toContain('@media (prefers-reduced-motion: no-preference)');
  });
});
