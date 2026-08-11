'use client';

import { mergeProps, useRender } from '@base-ui/react';
import * as React from 'react';

import { LightboxNextDataAttributes } from './lightbox-data-attributes';
import { useLightboxContext } from './lightbox-context';

interface LightboxNextState extends Record<string, unknown> {
  disabled: boolean;
}

interface LightboxNextProps extends useRender.ComponentProps<'button', LightboxNextState> {}

const stateAttributesMapping = {
  disabled: (value: unknown) => (value ? { 'data-disabled': '' } : null),
};

/**
 * Navigates to the next item in the lightbox.
 * Auto-disables at the last item unless `loop` is enabled on Root.
 */
const LightboxNext = React.forwardRef<HTMLButtonElement, LightboxNextProps>(
  function LightboxNext(props, forwardedRef) {
    const { render, ...elementProps } = props;
    const { activeIndex, setActiveIndex, itemCount, loop, thumbnailStripSelectRef } =
      useLightboxContext();

    const disabled = !loop && activeIndex >= itemCount - 1;

    const handleClick = React.useCallback(() => {
      if (disabled) return;
      const nextIndex = loop ? (activeIndex + 1) % itemCount : Math.min(activeIndex + 1, itemCount - 1);
      if (thumbnailStripSelectRef.current) {
        thumbnailStripSelectRef.current(nextIndex, 'button');
      } else {
        setActiveIndex(nextIndex, 'button');
      }
    }, [activeIndex, disabled, itemCount, loop, setActiveIndex, thumbnailStripSelectRef]);

    const state = React.useMemo<LightboxNextState>(() => ({ disabled }), [disabled]);

    return useRender({
      render,
      ref: forwardedRef,
      state,
      stateAttributesMapping,
      props: mergeProps<'button'>(
        {
          type: 'button',
          [LightboxNextDataAttributes.next]: '',
          disabled,
          'aria-label': 'Next',
          onClick: handleClick,
        } as React.ComponentPropsWithRef<'button'>,
        elementProps as React.ComponentPropsWithRef<'button'>,
      ),
      defaultTagName: 'button',
    });
  },
);

LightboxNext.displayName = 'LightboxNext';

export { LightboxNext };
export type { LightboxNextProps, LightboxNextState };
