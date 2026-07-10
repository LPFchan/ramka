'use client';

import { mergeProps, useRender } from '@base-ui/react';
import * as React from 'react';

import { useOptionalActiveZoom, useOptionalZoomContext } from './lightbox-zoom-context';

interface LightboxZoomInState extends Record<string, unknown> {
  disabled: boolean;
}

interface LightboxZoomInProps extends useRender.ComponentProps<'button', LightboxZoomInState> {}

const stateAttributesMapping = {
  disabled: (value: unknown) => (value ? { 'data-disabled': '' } : null),
};

const LightboxZoomIn = React.forwardRef<HTMLButtonElement, LightboxZoomInProps>(
  function LightboxZoomIn(props, forwardedRef) {
    const { render, ...elementProps } = props;
    // A button nested inside a specific Lightbox.Zoom controls that zoom
    // directly; otherwise fall back to the active slide's zoom via the bridge
    // so a single global button set can live in the lightbox chrome.
    const localCtx = useOptionalZoomContext();
    const activeCtx = useOptionalActiveZoom();
    const ctx = localCtx ?? activeCtx;
    const disabled = ctx ? !ctx.canZoomIn : true;

    const state = React.useMemo<LightboxZoomInState>(() => ({ disabled }), [disabled]);

    return useRender({
      render,
      ref: forwardedRef,
      state,
      stateAttributesMapping,
      props: mergeProps<'button'>(
        {
          type: 'button',
          'aria-label': 'Zoom in',
          disabled,
          onClick: ctx?.zoomIn,
        } as React.ComponentPropsWithRef<'button'>,
        elementProps as React.ComponentPropsWithRef<'button'>,
      ),
      defaultTagName: 'button',
    });
  },
);

LightboxZoomIn.displayName = 'LightboxZoomIn';

export { LightboxZoomIn };
export type { LightboxZoomInProps, LightboxZoomInState };
