'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import * as React from 'react';

import { LightboxZoomOutDataAttributes } from './lightbox-data-attributes';
import { useLightboxContext } from './lightbox-context';
import { useOptionalActiveZoom, useOptionalZoomContext } from './lightbox-zoom-context';
import { useAccessibleNameWarning } from './use-accessible-name-warning';

interface LightboxZoomOutState extends Record<string, unknown> {
  disabled: boolean;
}

interface LightboxZoomOutProps extends useRender.ComponentProps<'button', LightboxZoomOutState> {}

const stateAttributesMapping = {
  disabled: (value: unknown) => (value ? { 'data-disabled': '' } : null),
};

/**
 * Zooms the active media out.
 *
 * Ships no `aria-label` — give it visible text or your own localized label.
 */
const LightboxZoomOut = React.forwardRef<HTMLButtonElement, LightboxZoomOutProps>(
  function LightboxZoomOut(props, forwardedRef) {
    const { render, ...elementProps } = props;
    // A button nested inside a specific Lightbox.Zoom controls that zoom
    // directly; otherwise fall back to the active slide's zoom via the bridge
    // so a single global button set can live in the lightbox chrome.
    const localCtx = useOptionalZoomContext();
    const activeCtx = useOptionalActiveZoom();
    const ctx = localCtx ?? activeCtx;
    const disabled = ctx ? !ctx.canZoomOut : true;

    const { navigationLockedRef } = useLightboxContext();
    const handleClick = React.useCallback(() => {
      // A Lightbox.Slides swipe/fling is in flight — drop the click so a scroll
      // can't be hijacked into a zoom (matches the pinch/wheel gesture guards).
      if (navigationLockedRef.current) return;
      ctx?.zoomOut();
    }, [ctx, navigationLockedRef]);

    const state = React.useMemo<LightboxZoomOutState>(() => ({ disabled }), [disabled]);
    const ref = useAccessibleNameWarning('Lightbox.ZoomOut', forwardedRef);

    return useRender({
      render,
      ref,
      state,
      stateAttributesMapping,
      props: mergeProps<'button'>(
        {
          type: 'button',
          [LightboxZoomOutDataAttributes.zoomOut]: '',
          disabled,
          onClick: handleClick,
        } as React.ComponentPropsWithRef<'button'>,
        elementProps as React.ComponentPropsWithRef<'button'>,
      ),
      defaultTagName: 'button',
    });
  },
);

LightboxZoomOut.displayName = 'LightboxZoomOut';

export { LightboxZoomOut };
export type { LightboxZoomOutProps, LightboxZoomOutState };
