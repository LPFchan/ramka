import { render, screen, fireEvent } from '@testing-library/react';
import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { LightboxContent } from './lightbox-content';
import { LightboxCounter } from './lightbox-counter';
import { LightboxItem } from './lightbox-item';
import { LightboxNext } from './lightbox-next';
import { LightboxPortal } from './lightbox-portal';
import { LightboxPrevious } from './lightbox-previous';
import { LightboxRoot } from './lightbox-root';
import { LightboxSlide } from './lightbox-slide';
import { LightboxVirtualSlides } from './lightbox-virtual-slides';
import {
  SLIDE_TEST_WIDTH as WIDTH,
  endScroll,
  flushResizeObservers,
  installSlidesLayoutMocks,
  resetSlidesLayoutMocks,
  swipeTo,
} from './lightbox-slides-test-utils';

beforeEach(() => {
  installSlidesLayoutMocks();
  if (!Element.prototype.getAnimations) {
    Element.prototype.getAnimations = vi.fn(() => []);
  } else {
    vi.spyOn(Element.prototype, 'getAnimations').mockReturnValue([]);
  }
});

afterEach(() => {
  resetSlidesLayoutMocks();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

/**
 * Windowed-track geometry mocks. Unlike `applySlideGeometry` (which models a
 * fully-mounted track: slide j at j×WIDTH), mounted slide j here sits at
 * `(start + j) × WIDTH` — the position the leading spacer gives it in a real
 * layout — and the scroll extent covers the FULL collection via the spacers.
 */
function applyVirtualGeometry(viewport: HTMLElement, count: number, start: number) {
  let scrollLeft = viewport.scrollLeft || 0;
  Object.defineProperty(viewport, 'clientWidth', { configurable: true, get: () => WIDTH });
  Object.defineProperty(viewport, 'scrollWidth', { configurable: true, get: () => WIDTH * count });
  Object.defineProperty(viewport, 'scrollLeft', {
    configurable: true,
    get: () => scrollLeft,
    set: (v: number) => {
      scrollLeft = v;
    },
  });
  const slides = viewport.querySelectorAll<HTMLElement>('[data-ramka-slide]');
  slides.forEach((slide, j) => {
    const offsetLeft = (start + j) * WIDTH;
    Object.defineProperty(slide, 'offsetLeft', { configurable: true, get: () => offsetLeft });
    Object.defineProperty(slide, 'offsetWidth', { configurable: true, get: () => WIDTH });
  });
}

function setupVirtualGeometry(viewport: HTMLElement, count: number, start: number) {
  applyVirtualGeometry(viewport, count, start);
  flushResizeObservers();
}

function VirtualLightbox({
  count = 100,
  defaultValue = 50,
  preload = 1,
  overscan = 2,
  loop = false,
}: {
  count?: number;
  defaultValue?: number;
  preload?: number;
  overscan?: number;
  loop?: boolean;
} = {}) {
  return (
    <LightboxRoot defaultOpen defaultValue={defaultValue} loop={loop}>
      <LightboxPortal>
        <LightboxContent data-testid="content" aria-label="Virtual lightbox">
          <LightboxVirtualSlides
            data-testid="slides"
            aria-label="Photos"
            aria-roledescription="carousel"
            count={count}
            preload={preload}
            overscan={overscan}
          >
            {(index) => (
              <LightboxSlide data-testid={`slide-${index}`}>
                <LightboxItem
                  index={index}
                  data-testid={`item-${index}`}
                  aria-label={`${index + 1} of ${count}`}
                >
                  Item {index}
                </LightboxItem>
              </LightboxSlide>
            )}
          </LightboxVirtualSlides>
          <LightboxPrevious data-testid="prev">Prev</LightboxPrevious>
          <LightboxNext data-testid="next">Next</LightboxNext>
          <LightboxCounter data-testid="counter" />
        </LightboxContent>
      </LightboxPortal>
    </LightboxRoot>
  );
}

function mountedSlideIndexes(): number[] {
  return Array.from(document.querySelectorAll('[data-ramka-slide]')).map((slide) =>
    Number(slide.getAttribute('data-testid')!.replace('slide-', '')),
  );
}

function spacers(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-ramka-virtual-spacer]'));
}

const GAP = 'var(--lightbox-slide-gap, 0px)';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Lightbox.VirtualSlides', () => {
  it('mounts only the window of slides around the active index, between two spacers', () => {
    render(<VirtualLightbox count={100} defaultValue={50} preload={1} overscan={2} />);
    // radius = preload + overscan = 3 → indexes 47..53.
    expect(mountedSlideIndexes()).toEqual([47, 48, 49, 50, 51, 52, 53]);

    const [leading, trailing] = spacers();
    expect(spacers()).toHaveLength(2);
    expect(leading!.style.width).toBe(`calc(47 * (100% + ${GAP}) - ${GAP})`);
    expect(trailing!.style.width).toBe(`calc(46 * (100% + ${GAP}) - ${GAP})`);
    // Spacers must never snap or intercept input, and stay out of the a11y tree.
    expect(leading!.style.scrollSnapAlign).toBe('none');
    expect(leading!).toHaveAttribute('aria-hidden');
  });

  it('renders no leading spacer at the start edge and no trailing spacer at the end edge', () => {
    const { unmount } = render(<VirtualLightbox count={100} defaultValue={0} />);
    expect(mountedSlideIndexes()).toEqual([0, 1, 2, 3]);
    expect(spacers()).toHaveLength(1);
    expect(spacers()[0]!.style.width).toBe(`calc(96 * (100% + ${GAP}) - ${GAP})`);
    unmount();

    render(<VirtualLightbox count={100} defaultValue={99} />);
    expect(mountedSlideIndexes()).toEqual([96, 97, 98, 99]);
    expect(spacers()).toHaveLength(1);
    expect(spacers()[0]!.style.width).toBe(`calc(96 * (100% + ${GAP}) - ${GAP})`);
  });

  it('mounts everything and no spacers when the window covers the whole collection', () => {
    render(<VirtualLightbox count={5} defaultValue={2} preload={1} overscan={2} />);
    expect(mountedSlideIndexes()).toEqual([0, 1, 2, 3, 4]);
    expect(spacers()).toHaveLength(0);
  });

  it('gates Item contents by preload within the mounted window', () => {
    render(<VirtualLightbox count={100} defaultValue={50} preload={1} overscan={2} />);
    // Boxes 47..53 are mounted, but only 49..51 (active ± preload) have content.
    expect(screen.getByTestId('item-50')).toBeInTheDocument();
    expect(screen.getByTestId('item-49')).toBeInTheDocument();
    expect(screen.getByTestId('item-51')).toBeInTheDocument();
    expect(screen.queryByTestId('item-47')).toBeNull();
    expect(screen.queryByTestId('item-53')).toBeNull();
  });

  it('reports the full collection as itemCount (Counter, Next/Previous boundaries)', () => {
    render(<VirtualLightbox count={100} defaultValue={99} />);
    // Only 4 items are mounted/registered, but the total must be the full count.
    expect(screen.getByTestId('counter')).toHaveTextContent('100 / 100');
    // At the true end the boundary applies; one step back it must not —
    // even though the registry only ever saw the window.
    expect(screen.getByTestId('next')).toBeDisabled();
    expect(screen.getByTestId('prev')).not.toBeDisabled();
  });

  it('publishes synthesized full-track geometry and positions the initial slide', () => {
    render(<VirtualLightbox count={100} defaultValue={50} />);
    const viewport = screen.getByTestId('slides');
    setupVirtualGeometry(viewport, 100, 47);
    // Extrapolated uniform track: offsets[50] = 50 × WIDTH, clamped inside
    // the full scroll extent provided by the spacers.
    expect(viewport.scrollLeft).toBe(50 * WIDTH);
  });

  it('recenters the window when navigation jumps (End key)', () => {
    render(<VirtualLightbox count={100} defaultValue={50} />);
    const viewport = screen.getByTestId('slides');
    setupVirtualGeometry(viewport, 100, 47);

    fireEvent.keyDown(screen.getByTestId('content'), { key: 'End' });

    expect(screen.getByTestId('slides')).toHaveAttribute('data-active-index', '99');
    expect(mountedSlideIndexes()).toEqual([96, 97, 98, 99]);
    expect(spacers()).toHaveLength(1); // trailing gone, leading only
    expect(viewport.scrollLeft).toBe(99 * WIDTH);
  });

  it('recenters the window when a swipe settles on a new index', () => {
    render(<VirtualLightbox count={100} defaultValue={50} />);
    const viewport = screen.getByTestId('slides');
    setupVirtualGeometry(viewport, 100, 47);

    swipeTo(viewport, 51);
    endScroll(viewport);

    expect(screen.getByTestId('slides')).toHaveAttribute('data-active-index', '51');
    expect(mountedSlideIndexes()).toEqual([48, 49, 50, 51, 52, 53, 54]);
    expect(spacers()[0]!.style.width).toBe(`calc(48 * (100% + ${GAP}) - ${GAP})`);
  });

  it('grows the track when count increases (infinite scroll append)', () => {
    const { rerender } = render(<VirtualLightbox count={100} defaultValue={99} />);
    expect(screen.getByTestId('next')).toBeDisabled();

    rerender(<VirtualLightbox count={120} defaultValue={99} />);

    expect(screen.getByTestId('counter')).toHaveTextContent('100 / 120');
    expect(screen.getByTestId('next')).not.toBeDisabled();
    // The former end edge now has a trailing spacer again and mounts ahead.
    expect(mountedSlideIndexes()).toEqual([96, 97, 98, 99, 100, 101, 102]);
    expect(spacers()).toHaveLength(2);
    expect(spacers()[1]!.style.width).toBe(`calc(17 * (100% + ${GAP}) - ${GAP})`);
  });

  it('warns in dev when loop is enabled on Root', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<VirtualLightbox count={100} loop />);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('does not support `loop`'));
  });
});
