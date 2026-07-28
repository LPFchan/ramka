import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { LightboxBackdrop } from './lightbox-backdrop';
import { LightboxCaption } from './lightbox-caption';
import { LightboxClose } from './lightbox-close';
import { LightboxContent } from './lightbox-content';
import { LightboxCounter } from './lightbox-counter';
import { LightboxItem } from './lightbox-item';
import { LightboxMedia } from './lightbox-media';
import { LightboxPortal } from './lightbox-portal';
import { LightboxRoot } from './lightbox-root';
import { LightboxSlide } from './lightbox-slide';
import { LightboxSlides } from './lightbox-slides';
import { LightboxThumbnail } from './lightbox-thumbnail';
import { LightboxThumbnailGroup } from './lightbox-thumbnail-group';
import { LightboxTrigger } from './lightbox-trigger';
import { LightboxZoom } from './lightbox-zoom';
import { LightboxZoomIn } from './lightbox-zoom-in';
import { LightboxZoomOut } from './lightbox-zoom-out';

/**
 * Base UI serializes unmapped state keys as `data-${key.toLowerCase()}`.
 * CamelCase keys must be explicitly mapped (hyphenated) or suppressed —
 * otherwise we ship attrs like `data-morphtarget` / `data-maxzoom`.
 */
const FORBIDDEN_SQUASHED_ATTRS = [
  'data-morphtarget',
  'data-activeindex',
  'data-hascaption',
  'data-focuswithin',
  'data-maxzoom',
  'data-offsetx',
  'data-offsety',
  'data-canzoomin',
  'data-canzoomout',
  'data-skipfade',
  'data-pulldismissing',
] as const;

function collectForbiddenAttrs(root: ParentNode = document): string[] {
  const found = new Set<string>();
  for (const attr of FORBIDDEN_SQUASHED_ATTRS) {
    if (root.querySelector(`[${attr}]`)) found.add(attr);
  }
  return [...found].sort();
}

afterEach(() => {
  cleanup();
});

describe('Lightbox state → data-* attributes', () => {
  it('does not emit Base UI camelCase-squashed data attributes', () => {
    render(
      <LightboxRoot defaultOpen defaultValue={0}>
        <LightboxTrigger index={0} data-testid="trigger-0">
          {({ imageRef, morphRef }) => (
            <img
              ref={(node) => {
                imageRef(node);
                morphRef(node);
              }}
              data-testid="morph-el"
              src="thumb.jpg"
              alt="thumb"
            />
          )}
        </LightboxTrigger>
        <LightboxTrigger index={1}>
          <img src="thumb-b.jpg" alt="thumb b" />
        </LightboxTrigger>
        <LightboxPortal>
          <LightboxBackdrop />
          <LightboxContent aria-label="state attrs">
            <LightboxClose>Close</LightboxClose>
            <LightboxCounter />
            <LightboxCaption />
            <LightboxSlides>
              <LightboxSlide>
                <LightboxItem index={0} caption="First">
                  <LightboxZoom maxZoom={4}>
                    <LightboxMedia width={800} height={600}>
                      <img src="full.jpg" alt="full" width={800} height={600} />
                    </LightboxMedia>
                    <LightboxZoomIn data-testid="zoom-in">+</LightboxZoomIn>
                    <LightboxZoomOut>-</LightboxZoomOut>
                  </LightboxZoom>
                </LightboxItem>
              </LightboxSlide>
              <LightboxSlide>
                <LightboxItem index={1} caption="Second">
                  <img src="full-b.jpg" alt="full b" />
                </LightboxItem>
              </LightboxSlide>
            </LightboxSlides>
            <LightboxThumbnailGroup>
              <LightboxThumbnail index={0}>0</LightboxThumbnail>
              <LightboxThumbnail index={1}>1</LightboxThumbnail>
            </LightboxThumbnailGroup>
          </LightboxContent>
        </LightboxPortal>
      </LightboxRoot>,
    );

    // morphRef child gets the documented attr; Trigger must not get the squashed one.
    expect(screen.getByTestId('morph-el')).toHaveAttribute('data-morph-target');
    expect(screen.getByTestId('trigger-0')).not.toHaveAttribute('data-morph-target');
    expect(screen.getByTestId('trigger-0')).not.toHaveAttribute('data-morphtarget');
    expect(collectForbiddenAttrs()).toEqual([]);

    fireEvent.click(screen.getByTestId('zoom-in'));
    expect(collectForbiddenAttrs()).toEqual([]);
  });
});
