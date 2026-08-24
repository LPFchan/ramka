'use client';

import * as React from 'react';

import { LightboxPreviousDataAttributes } from './lightbox-data-attributes';
import { useLightboxContext } from './lightbox-context';
import { useAccessibleNameWarning } from './use-accessible-name-warning';
import { mergeProps } from '../render/merge-props';
import { useRender } from '../render/use-render';

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
 *
 * Ships no `aria-label` — give it visible text or your own localized label.
 */
const LightboxPrevious = React.forwardRef<HTMLButtonElement, LightboxPreviousProps>(
  function LightboxPrevious(props, forwardedRef) {
    const { render, ...elementProps } = props;
    const { activeIndex, navigate, itemCount, loop } = useLightboxContext();

    const disabled = !loop && activeIndex <= 0;

    const handleClick = React.useCallback(() => {
      if (disabled) return;
      const nextIndex = loop ? (activeIndex - 1 + itemCount) % itemCount : Math.max(activeIndex - 1, 0);
      navigate(nextIndex, 'button');
    }, [activeIndex, disabled, itemCount, loop, navigate]);

    const state = React.useMemo<LightboxPreviousState>(() => ({ disabled }), [disabled]);
    const ref = useAccessibleNameWarning('Lightbox.Previous', forwardedRef);

    return useRender({
      render,
      ref,
      state,
      stateAttributesMapping,
      props: mergeProps<'button'>(
        {
          type: 'button',
          [LightboxPreviousDataAttributes.previous]: '',
          disabled,
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
