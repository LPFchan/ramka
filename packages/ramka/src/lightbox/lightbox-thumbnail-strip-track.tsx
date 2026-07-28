'use client';

import * as React from 'react';

import { LightboxThumbnailStripDataAttributes } from './lightbox-data-attributes';
import { useLightboxThumbnailStripContext } from './lightbox-thumbnail-strip-context';
import { LightboxThumbnailGroup } from './lightbox-thumbnail-group';
import type { LightboxThumbnailGroupProps } from './lightbox-thumbnail-group';

interface LightboxThumbnailStripTrackProps extends LightboxThumbnailGroupProps {}

/**
 * Linked tablist track for `Lightbox.ThumbnailStrip`.
 *
 * A `ThumbnailGroup` that registers as the ScrollTimeline transform target.
 * The parent ThumbnailStrip writes midline `padding-inline`, travel CSS var, and the
 * link animation. Flex, gap, and thumb sizing stay consumer CSS.
 */
const LightboxThumbnailStripTrack = React.forwardRef<HTMLDivElement, LightboxThumbnailStripTrackProps>(
  function LightboxThumbnailStripTrack(props, forwardedRef) {
    const { registerTrack } = useLightboxThumbnailStripContext();

    const setTrackRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        registerTrack(node);
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef, registerTrack],
    );

    return (
      <LightboxThumbnailGroup
        {...props}
        ref={setTrackRef}
        {...{ [LightboxThumbnailStripDataAttributes.track]: '' }}
      />
    );
  },
);

LightboxThumbnailStripTrack.displayName = 'LightboxThumbnailStripTrack';

export { LightboxThumbnailStripTrack };
export type { LightboxThumbnailStripTrackProps };
