import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LightboxClose } from './lightbox-close';
import { LightboxContent } from './lightbox-content';
import { LightboxNext } from './lightbox-next';
import { LightboxPortal } from './lightbox-portal';
import { LightboxPrevious } from './lightbox-previous';
import { LightboxRoot } from './lightbox-root';
import { LightboxZoomIn } from './lightbox-zoom-in';
import { LightboxZoomOut } from './lightbox-zoom-out';

/**
 * The control parts ship no `aria-label`, so a consumer's own copy is the only
 * name a screen reader ever reads. These pin both halves of that deal: nothing
 * English leaks into the DOM, and a nameless control is called out in dev.
 */

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function Chrome({ children }: { children: React.ReactNode }) {
  return (
    <LightboxRoot defaultOpen>
      <LightboxPortal>
        <LightboxContent aria-label="viewer">{children}</LightboxContent>
      </LightboxPortal>
    </LightboxRoot>
  );
}

const parts = [
  { name: 'Lightbox.Close', Part: LightboxClose },
  { name: 'Lightbox.Previous', Part: LightboxPrevious },
  { name: 'Lightbox.Next', Part: LightboxNext },
  { name: 'Lightbox.ZoomIn', Part: LightboxZoomIn },
  { name: 'Lightbox.ZoomOut', Part: LightboxZoomOut },
] as const;

describe('control parts ship no label', () => {
  it.each(parts)('$name renders without an aria-label', ({ Part }) => {
    render(
      <Chrome>
        <Part data-testid="part" />
      </Chrome>,
    );

    expect(screen.getByTestId('part')).not.toHaveAttribute('aria-label');
  });

  it.each(parts)('$name keeps the consumer’s own label', ({ Part }) => {
    render(
      <Chrome>
        <Part data-testid="part" aria-label="Zamknij" />
      </Chrome>,
    );

    expect(screen.getByTestId('part')).toHaveAttribute('aria-label', 'Zamknij');
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('development nudge for a nameless control', () => {
  it.each(parts)('$name warns when it has no name at all', ({ name, Part }) => {
    render(
      <Chrome>
        <Part />
      </Chrome>,
    );

    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`${name} has no accessible name`));
  });

  it('stays quiet when the control has visible text instead of a label', () => {
    render(
      <Chrome>
        <LightboxClose>Zamknij</LightboxClose>
      </Chrome>,
    );

    expect(warn).not.toHaveBeenCalled();
  });

  it('stays quiet when the control is labelled by another element', () => {
    render(
      <Chrome>
        <span id="close-label">Zamknij</span>
        <LightboxClose aria-labelledby="close-label" />
      </Chrome>,
    );

    expect(warn).not.toHaveBeenCalled();
  });

  it('forwards the ref while watching for a missing name', () => {
    const ref = React.createRef<HTMLButtonElement>();

    render(
      <Chrome>
        <LightboxClose ref={ref} aria-label="Zamknij" />
      </Chrome>,
    );

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
