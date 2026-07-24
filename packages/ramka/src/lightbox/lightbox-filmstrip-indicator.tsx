'use client';

import { mergeProps, useRender } from '@base-ui/react';
import * as React from 'react';

import { LightboxFilmstripDataAttributes } from './lightbox-data-attributes';
import { useLightboxFilmstripContext } from './lightbox-filmstrip-context';

interface LightboxFilmstripIndicatorState extends Record<string, unknown> {}

interface LightboxFilmstripIndicatorProps
  extends useRender.ComponentProps<'span', LightboxFilmstripIndicatorState> {}

/**
 * Optional stationary selection chrome for `Lightbox.Filmstrip`.
 *
 * Structurally centered in the filmstrip root (`position` / translate only).
 * Size, outline, and radius are consumer CSS. The active thumb is kept under
 * this midline by Filmstrip’s padding + transform sync.
 */
const LightboxFilmstripIndicator = React.forwardRef<HTMLSpanElement, LightboxFilmstripIndicatorProps>(
  function LightboxFilmstripIndicator(props, forwardedRef) {
    const { render, style, ...elementProps } = props;
    useLightboxFilmstripContext();

    return useRender({
      render,
      ref: forwardedRef,
      state: {},
      props: mergeProps<'span'>(
        {
          'aria-hidden': true,
          [LightboxFilmstripDataAttributes.indicator]: '',
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

LightboxFilmstripIndicator.displayName = 'LightboxFilmstripIndicator';

export { LightboxFilmstripIndicator };
export type { LightboxFilmstripIndicatorProps, LightboxFilmstripIndicatorState };
