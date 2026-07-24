'use client';

import * as React from 'react';

import { LightboxFilmstripDataAttributes } from './lightbox-data-attributes';
import { useLightboxFilmstripContext } from './lightbox-filmstrip-context';
import { LightboxThumbnailGroup } from './lightbox-thumbnail-group';
import type { LightboxThumbnailGroupProps } from './lightbox-thumbnail-group';

interface LightboxFilmstripTrackProps extends LightboxThumbnailGroupProps {}

/**
 * Linked tablist track for `Lightbox.Filmstrip`.
 *
 * A `ThumbnailGroup` that registers as the ScrollTimeline transform target.
 * The parent Filmstrip writes midline `padding-inline`, travel CSS var, and the
 * link animation. Flex, gap, and thumb sizing stay consumer CSS.
 */
const LightboxFilmstripTrack = React.forwardRef<HTMLDivElement, LightboxFilmstripTrackProps>(
  function LightboxFilmstripTrack(props, forwardedRef) {
    const { registerTrack } = useLightboxFilmstripContext();

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
        {...{ [LightboxFilmstripDataAttributes.track]: '' }}
      />
    );
  },
);

LightboxFilmstripTrack.displayName = 'LightboxFilmstripTrack';

export { LightboxFilmstripTrack };
export type { LightboxFilmstripTrackProps };
