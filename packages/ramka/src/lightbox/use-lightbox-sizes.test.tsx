import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as React from 'react';

import { ZoomContext, type ZoomContextValue } from './lightbox-zoom-context';
import {
  lightboxSizesZoomFactor,
  scaleLightboxSizes,
  useLightboxSizes,
} from './use-lightbox-sizes';

describe('lightboxSizesZoomFactor', () => {
  it('stays at 1× below 2', () => {
    expect(lightboxSizesZoomFactor(1)).toBe(1);
    expect(lightboxSizesZoomFactor(1.99)).toBe(1);
  });

  it('snaps to powers of two from 2×', () => {
    expect(lightboxSizesZoomFactor(2)).toBe(2);
    expect(lightboxSizesZoomFactor(3.9)).toBe(2);
    expect(lightboxSizesZoomFactor(4)).toBe(4);
    expect(lightboxSizesZoomFactor(7.9)).toBe(4);
    expect(lightboxSizesZoomFactor(8)).toBe(8);
  });

  it('treats non-finite / sub-1 zoom as 1×', () => {
    expect(lightboxSizesZoomFactor(0)).toBe(1);
    expect(lightboxSizesZoomFactor(Number.NaN)).toBe(1);
  });
});

describe('scaleLightboxSizes', () => {
  it('returns the input at 1×', () => {
    expect(scaleLightboxSizes('100vw', 1)).toBe('100vw');
  });

  it('scales a single length', () => {
    expect(scaleLightboxSizes('100vw', 2)).toBe('200vw');
    expect(scaleLightboxSizes('400px', 4)).toBe('1600px');
  });

  it('scales only the size token in a media-condition list', () => {
    expect(scaleLightboxSizes('(max-width: 600px) 100vw, 50vw', 2)).toBe(
      '(max-width: 600px) 200vw, 100vw',
    );
  });
});

function Probe({ base }: { base?: string }) {
  const sizes = useLightboxSizes(base);
  return <span data-testid="sizes">{sizes}</span>;
}

function stubZoom(zoom: number): ZoomContextValue {
  return {
    zoom,
    maxZoom: 8,
    offsetX: 0,
    offsetY: 0,
    canZoomIn: true,
    canZoomOut: zoom > 1,
    zoomIn: () => {},
    zoomOut: () => {},
    zoomTo: () => {},
    reset: () => {},
    changeOffsets: () => {},
  };
}

describe('useLightboxSizes', () => {
  it('returns the base sizes outside Zoom', () => {
    render(<Probe />);
    expect(screen.getByTestId('sizes').textContent).toBe('100vw');
  });

  it('scales the base sizes at snapped zoom', () => {
    render(
      <ZoomContext.Provider value={stubZoom(2.4)}>
        <Probe base="400px" />
      </ZoomContext.Provider>,
    );
    expect(screen.getByTestId('sizes').textContent).toBe('800px');
  });
});
