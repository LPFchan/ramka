import { act, render, screen } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LightboxClose } from './lightbox-close';
import { LightboxContent } from './lightbox-content';
import { LightboxItem } from './lightbox-item';
import { LightboxNext } from './lightbox-next';
import { LightboxPortal } from './lightbox-portal';
import { LightboxPrevious } from './lightbox-previous';
import { LightboxRoot } from './lightbox-root';
import { SlidesHost } from './lightbox-slides-test-utils';
import { LightboxThumbnail } from './lightbox-thumbnail';
import { LightboxThumbnailGroup } from './lightbox-thumbnail-group';
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

// The name check is deferred a macrotask so sibling mount effects (e.g. a
// tablist registering) can settle first — flush it before asserting either way.
async function settleNameCheck() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

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

  it.each(parts)('$name keeps the consumer’s own label', async ({ Part }) => {
    render(
      <Chrome>
        <Part data-testid="part" aria-label="Zamknij" />
      </Chrome>,
    );
    await settleNameCheck();

    expect(screen.getByTestId('part')).toHaveAttribute('aria-label', 'Zamknij');
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('development nudge for a nameless control', () => {
  it.each(parts)('$name warns when it has no name at all', async ({ name, Part }) => {
    render(
      <Chrome>
        <Part />
      </Chrome>,
    );
    await settleNameCheck();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`${name} has no accessible name`));
  });

  it('stays quiet when the control has visible text instead of a label', async () => {
    render(
      <Chrome>
        <LightboxClose>Zamknij</LightboxClose>
      </Chrome>,
    );
    await settleNameCheck();

    expect(warn).not.toHaveBeenCalled();
  });

  it('stays quiet when the control is labelled by another element', async () => {
    render(
      <Chrome>
        <span id="close-label">Zamknij</span>
        <LightboxClose aria-labelledby="close-label" />
      </Chrome>,
    );
    await settleNameCheck();

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

/**
 * A slide is a `group`, and a `group` is not named by the text inside it — so
 * the check that suffices for a button would let a captioned slide pass while
 * a screen reader still announces it as nameless.
 */
describe('development nudge for a nameless slide', () => {
  function Gallery({ children }: { children: React.ReactNode }) {
    return (
      <LightboxRoot defaultOpen>
        <LightboxPortal>
          <LightboxContent aria-label="viewer">
            <SlidesHost aria-roledescription="karuzela" aria-label="zdjęcia">
              {children}
            </SlidesHost>
          </LightboxContent>
        </LightboxPortal>
      </LightboxRoot>
    );
  }

  it('warns when the slide has no name at all', async () => {
    render(
      <Gallery>
        <LightboxItem index={0} />
      </Gallery>,
    );
    await settleNameCheck();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Lightbox.Item has no accessible name'));
  });

  it('still warns when the slide only has content, which does not name a group', async () => {
    render(
      <Gallery>
        <LightboxItem index={0}>Zachód słońca nad morzem</LightboxItem>
      </Gallery>,
    );
    await settleNameCheck();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Lightbox.Item has no accessible name'));
  });

  it('stays quiet once the consumer names the slide', async () => {
    render(
      <Gallery>
        <LightboxItem index={0} aria-roledescription="slajd" aria-label="1 z 1" />
      </Gallery>,
    );
    await settleNameCheck();

    expect(warn).not.toHaveBeenCalled();
  });

  // Inactive slides are `aria-hidden`, so a long gallery nudges once for the
  // slide on screen rather than once per slide.
  it('nudges only for the slide that is not aria-hidden', async () => {
    render(
      <Gallery>
        <LightboxItem index={0} aria-label="1 z 3" />
        <LightboxItem index={1} />
        <LightboxItem index={2} />
      </Gallery>,
    );
    await settleNameCheck();

    expect(warn).not.toHaveBeenCalled();
  });

  // With a ThumbnailGroup mounted the item is a `tabpanel` named by its tab
  // via the auto-wired `aria-labelledby`, so no consumer label is needed.
  // The tablist registers in an effect that runs after the items' name check,
  // so this also pins that the deferred check tolerates the one-commit gap
  // instead of warning off the pre-registration DOM.
  it('stays quiet for an unnamed item when a thumbnail tablist names it', async () => {
    render(
      <Gallery>
        <LightboxItem index={0} data-testid="item-0" />
        <LightboxItem index={1} />
        <LightboxThumbnailGroup aria-label="miniatury">
          <LightboxThumbnail index={0}>1</LightboxThumbnail>
          <LightboxThumbnail index={1}>2</LightboxThumbnail>
        </LightboxThumbnailGroup>
      </Gallery>,
    );
    await settleNameCheck();

    expect(screen.getByTestId('item-0')).toHaveAttribute('role', 'tabpanel');
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('Lightbox.Item has no accessible name'));
  });
});
