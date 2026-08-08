import { render } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it } from 'vitest';

import { LightboxRoot } from './lightbox-root';
import { ensureVtStructuralStyles } from './vt-structural-styles';

const selector = 'style[data-ramka-lightbox-vt-styles]';

describe('vt-structural-styles', () => {
  it('injects the stylesheet once, at the start of <head>, on Root mount', () => {
    render(
      <>
        <LightboxRoot>{null}</LightboxRoot>
        <LightboxRoot>{null}</LightboxRoot>
      </>,
    );

    const sheets = document.head.querySelectorAll(selector);
    expect(sheets).toHaveLength(1);
    // Prepended so consumer stylesheets cascade after it and win ties.
    expect(document.head.firstElementChild).toBe(sheets[0]);
  });

  it('is idempotent when called directly', () => {
    ensureVtStructuralStyles();
    ensureVtStructuralStyles();
    expect(document.head.querySelectorAll(selector)).toHaveLength(1);
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
    // Crossfade dissolve retimed to the preset.
    expect(css).toContain('data-ramka-crossfade');
    // FLIP engine: backdrop/content fades re-paced to the morph curve.
    expect(css).toContain('[data-ramka-flip-morph] [data-ramka-backdrop]');
    // Thumb-jump slides crossfade.
    expect(css).toContain('[data-ramka-slides]::view-transition-group(root)');
    // Everything animated is reduced-motion gated.
    expect(css).toContain('@media (prefers-reduced-motion: no-preference)');
  });
});
