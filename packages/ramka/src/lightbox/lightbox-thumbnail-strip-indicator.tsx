'use client';

import { mergeProps, useRender } from '@base-ui/react';
import * as React from 'react';

import { LightboxThumbnailStripDataAttributes } from './lightbox-data-attributes';
import { useLightboxThumbnailStripContext } from './lightbox-thumbnail-strip-context';

interface LightboxThumbnailStripIndicatorState extends Record<string, unknown> {}

interface LightboxThumbnailStripIndicatorProps
  extends useRender.ComponentProps<'span', LightboxThumbnailStripIndicatorState> {}

/**
 * Optional stationary selection chrome for `Lightbox.ThumbnailStrip`.
 *
 * Structurally centered in the thumbnail-strip root (`position` / translate only).
 * Size, outline, and radius are consumer CSS. The active thumb is kept under
 * this midline by ThumbnailStrip’s padding + transform sync.
 */
const LightboxThumbnailStripIndicator = React.forwardRef<HTMLSpanElement, LightboxThumbnailStripIndicatorProps>(
  function LightboxThumbnailStripIndicator(props, forwardedRef) {
    const { render, style, ...elementProps } = props;
    useLightboxThumbnailStripContext();

    return useRender({
      render,
      ref: forwardedRef,
      state: {},
      props: mergeProps<'span'>(
        {
          'aria-hidden': true,
          [LightboxThumbnailStripDataAttributes.indicator]: '',
          style: {
            position: 'absolute',
            left: '50%',
            top: '50%',
            pointerEvents: 'none',
            transform: 'translate(-50%, -50%)',
            ...style,
          },
        } as React.ComponentPropsWithRef<'span'>,
        elementProps as React.ComponentPropsWithRef<'span'>,
      ),
      defaultTagName: 'span',
    });
  },
);

LightboxThumbnailStripIndicator.displayName = 'LightboxThumbnailStripIndicator';

export { LightboxThumbnailStripIndicator };
export type { LightboxThumbnailStripIndicatorProps, LightboxThumbnailStripIndicatorState };
