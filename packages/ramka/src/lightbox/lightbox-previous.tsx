'use client';

import { mergeProps, useRender } from '@base-ui/react';
import * as React from 'react';

import { useLightboxContext } from './lightbox-context';

interface LightboxPreviousState extends Record<string, unknown> {
  disabled: boolean;
}

interface LightboxPreviousProps extends useRender.ComponentProps<'button', LightboxPreviousState> {}

const stateAttributesMapping = {
  disabled: (value: unknown) => (value ? { 'data-disabled': '' } : null),
};

/**
 * Navigates to the previous item in the lightbox.
 * Auto-disables at the first item unless `loop` is enabled on Root.
 */
const LightboxPrevious = React.forwardRef<HTMLButtonElement, LightboxPreviousProps>(
  function LightboxPrevious(props, forwardedRef) {
    const { render, ...elementProps } = props;
    const { activeIndex, setActiveIndex, itemCount, loop } = useLightboxContext();

    const disabled = !loop && activeIndex <= 0;

    const handleClick = React.useCallback(() => {
      if (disabled) return;
      const nextIndex = loop ? (activeIndex - 1 + itemCount) % itemCount : Math.max(activeIndex - 1, 0);
      setActiveIndex(nextIndex, 'button');
    }, [activeIndex, disabled, itemCount, loop, setActiveIndex]);

    const state = React.useMemo<LightboxPreviousState>(() => ({ disabled }), [disabled]);

    return useRender({
      render,
      ref: forwardedRef,
      state,
      stateAttributesMapping,
      props: mergeProps<'button'>(
        {
          type: 'button',
          disabled,
          'aria-label': 'Previous',
          onClick: handleClick,
        } as React.ComponentPropsWithRef<'button'>,
        elementProps as React.ComponentPropsWithRef<'button'>,
      ),
      defaultTagName: 'button',
    });
  },
);

LightboxPrevious.displayName = 'LightboxPrevious';

export { LightboxPrevious };
export type { LightboxPreviousProps, LightboxPreviousState };
