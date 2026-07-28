import { render, cleanup } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { LIGHTBOX_PART_IDENTITY_ATTRIBUTES } from './lightbox-data-attributes';
import { LightboxBackdrop } from './lightbox-backdrop';
import { LightboxCaption } from './lightbox-caption';
import { LightboxClose } from './lightbox-close';
import { LightboxContent } from './lightbox-content';
import { LightboxCounter } from './lightbox-counter';
import { LightboxItem } from './lightbox-item';
import { LightboxItemGroup } from './lightbox-item-group';
import { LightboxMedia } from './lightbox-media';
import { LightboxNext } from './lightbox-next';
import { LightboxPortal } from './lightbox-portal';
import { LightboxPrevious } from './lightbox-previous';
import { LightboxRoot } from './lightbox-root';
import { LightboxSlide } from './lightbox-slide';
import { LightboxSlides } from './lightbox-slides';
import { LightboxThumbnail } from './lightbox-thumbnail';
import { LightboxThumbnailGroup } from './lightbox-thumbnail-group';
import { LightboxThumbnailStrip } from './lightbox-thumbnail-strip';
import { LightboxThumbnailStripTrack } from './lightbox-thumbnail-strip-track';
import { LightboxTrigger } from './lightbox-trigger';
import { LightboxZoom } from './lightbox-zoom';
import { LightboxZoomIn } from './lightbox-zoom-in';
import { LightboxZoomOut } from './lightbox-zoom-out';

afterEach(() => {
  cleanup();
});

/**
 * Mounts every DOM-rendering Lightbox part so identity-marker coverage can be
 * asserted in one pass. Includes both Slides and ItemGroup layouts (they are
 * mutually exclusive in real apps, but both publish distinct markers).
 */
function FullChromeLightbox() {
  return (
    <LightboxRoot defaultOpen>
      <LightboxTrigger index={0}>Open</LightboxTrigger>
      <LightboxPortal>
        <LightboxBackdrop />
        <LightboxContent aria-label="Gallery">
          <LightboxClose />
          <LightboxPrevious />
          <LightboxNext />
          <LightboxCounter />
          <LightboxCaption />
          <LightboxZoomIn />
          <LightboxZoomOut />
          <LightboxSlides aria-label="Slides">
            <LightboxSlide>
              <LightboxItem index={0} caption="One">
                <LightboxZoom>
                  <LightboxMedia width={100} height={100}>
                    <img src="/a.jpg" alt="A" width={100} height={100} />
                  </LightboxMedia>
                </LightboxZoom>
              </LightboxItem>
            </LightboxSlide>
          </LightboxSlides>
          <LightboxThumbnailStrip>
            <LightboxThumbnailStripTrack aria-label="Filmstrip">
              <LightboxThumbnail index={0}>1</LightboxThumbnail>
            </LightboxThumbnailStripTrack>
          </LightboxThumbnailStrip>
        </LightboxContent>
      </LightboxPortal>
    </LightboxRoot>
  );
}

function ItemGroupLightbox() {
  return (
    <LightboxRoot defaultOpen>
      <LightboxPortal>
        <LightboxContent aria-label="Swap gallery">
          <LightboxItemGroup aria-label="Items">
            <LightboxItem index={0}>
              <img src="/a.jpg" alt="A" />
            </LightboxItem>
          </LightboxItemGroup>
          <LightboxThumbnailGroup aria-label="Thumbs">
            <LightboxThumbnail index={0}>1</LightboxThumbnail>
          </LightboxThumbnailGroup>
        </LightboxContent>
      </LightboxPortal>
    </LightboxRoot>
  );
}

describe('Lightbox part identity markers', () => {
  it('lists only data-ramka-* identity attributes', () => {
    for (const attr of LIGHTBOX_PART_IDENTITY_ATTRIBUTES) {
      expect(attr.startsWith('data-ramka-')).toBe(true);
    }
  });

  it('publishes every listed identity marker on a mounted tree', () => {
    render(<FullChromeLightbox />);
    render(<ItemGroupLightbox />);

    const missing = LIGHTBOX_PART_IDENTITY_ATTRIBUTES.filter(
      (attr) => document.querySelector(`[${attr}]`) === null,
    );

    expect(missing).toEqual([]);
  });
});
