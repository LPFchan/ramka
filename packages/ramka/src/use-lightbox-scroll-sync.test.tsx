import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import * as React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';

import { useLightboxScrollSync, type UseLightboxScrollSyncOptions } from './use-lightbox-scroll-sync';

afterEach(cleanup);

/**
 * Renders the hook and exposes its output through the DOM, matching the
 * render-based style used across the suite (instead of `renderHook`).
 * `setTo` is read from a data attribute so tests can trigger updates via a
 * button click, keeping everything inside React's event system.
 */
function Harness({ options = {}, setTo }: { options?: UseLightboxScrollSyncOptions; setTo?: number }) {
  const sync = useLightboxScrollSync(options);
  return (
    <div>
      <span data-testid="active">{sync.activeIndex}</span>
      <span data-testid="lightbox-value">{sync.lightboxRootProps.value}</span>
      <span data-testid="lightbox-loop">{String(sync.lightboxRootProps.loop)}</span>
      <span data-testid="gallery-value">{sync.scrollGalleryRootProps.value}</span>
      <span data-testid="gallery-loop">{String(sync.scrollGalleryRootProps.loop)}</span>
      <span data-testid="gallery-orientation">{sync.scrollGalleryRootProps.orientation}</span>
      <span data-testid="gallery-scroll-behavior">{sync.scrollGalleryRootProps.scrollBehavior}</span>
      <button data-testid="set" type="button" onClick={() => sync.setActiveIndex(setTo ?? 0)}>
        set
      </button>
      {/* Exercise the prop-bag callback path (what the roots would call). */}
      <button
        data-testid="lightbox-emit"
        type="button"
        onClick={() => sync.lightboxRootProps.onValueChange(setTo ?? 0)}
      >
        emit
      </button>
    </div>
  );
}

describe('useLightboxScrollSync', () => {
  it('is uncontrolled by default and updates the shared index', () => {
    render(<Harness setTo={2} />);
    expect(screen.getByTestId('active')).toHaveTextContent('0');

    fireEvent.click(screen.getByTestId('set'));

    expect(screen.getByTestId('active')).toHaveTextContent('2');
    expect(screen.getByTestId('lightbox-value')).toHaveTextContent('2');
    expect(screen.getByTestId('gallery-value')).toHaveTextContent('2');
  });

  it('honors defaultValue for the initial index', () => {
    render(<Harness options={{ defaultValue: 3 }} />);
    expect(screen.getByTestId('active')).toHaveTextContent('3');
    expect(screen.getByTestId('lightbox-value')).toHaveTextContent('3');
    expect(screen.getByTestId('gallery-value')).toHaveTextContent('3');
  });

  it('fires onValueChange when the index changes (uncontrolled)', () => {
    const onValueChange = vi.fn();
    render(<Harness options={{ onValueChange }} setTo={1} />);

    fireEvent.click(screen.getByTestId('set'));

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(1);
  });

  it('dedupes redundant updates to the current value', () => {
    const onValueChange = vi.fn();
    // setTo defaults to 0, which equals the initial index.
    render(<Harness options={{ onValueChange }} setTo={0} />);

    fireEvent.click(screen.getByTestId('set'));

    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('active')).toHaveTextContent('0');
  });

  it('is controlled when value is provided: external value drives the index', () => {
    const onValueChange = vi.fn();
    const { rerender } = render(<Harness options={{ value: 1, onValueChange }} setTo={2} />);
    expect(screen.getByTestId('active')).toHaveTextContent('1');

    // Attempting to change does not mutate internal state, but calls onValueChange.
    fireEvent.click(screen.getByTestId('set'));
    expect(onValueChange).toHaveBeenCalledWith(2);
    expect(screen.getByTestId('active')).toHaveTextContent('1');

    // Only the parent moving the controlled value updates the index.
    rerender(<Harness options={{ value: 2, onValueChange }} setTo={2} />);
    expect(screen.getByTestId('active')).toHaveTextContent('2');
  });

  it('funnels a root prop-bag onValueChange through the same deduped setter', () => {
    const onValueChange = vi.fn();
    render(<Harness options={{ onValueChange }} setTo={2} />);

    fireEvent.click(screen.getByTestId('lightbox-emit'));

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(2);
    expect(screen.getByTestId('active')).toHaveTextContent('2');
  });

  it('passes loop to both root prop bags', () => {
    render(<Harness options={{ loop: true }} />);
    expect(screen.getByTestId('lightbox-loop')).toHaveTextContent('true');
    expect(screen.getByTestId('gallery-loop')).toHaveTextContent('true');
  });

  it('defaults loop to false on both root prop bags', () => {
    render(<Harness />);
    expect(screen.getByTestId('lightbox-loop')).toHaveTextContent('false');
    expect(screen.getByTestId('gallery-loop')).toHaveTextContent('false');
  });

  it('passes orientation and scrollBehavior to the gallery prop bag', () => {
    render(<Harness options={{ orientation: 'vertical', scrollBehavior: 'instant' }} />);
    expect(screen.getByTestId('gallery-orientation')).toHaveTextContent('vertical');
    expect(screen.getByTestId('gallery-scroll-behavior')).toHaveTextContent('instant');
  });

  it('defaults orientation to horizontal and scrollBehavior to smooth', () => {
    render(<Harness />);
    expect(screen.getByTestId('gallery-orientation')).toHaveTextContent('horizontal');
    expect(screen.getByTestId('gallery-scroll-behavior')).toHaveTextContent('smooth');
  });
});
