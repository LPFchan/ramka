'use client';

import * as React from 'react';

import { LightboxNextDataAttributes } from './lightbox-data-attributes';
import { useLightboxContext } from './lightbox-context';
import { useAccessibleNameWarning } from './use-accessible-name-warning';
import { mergeProps } from '../render/merge-props';
import { useRender } from '../render/use-render';

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
 *
 * Ships no `aria-label` — give it visible text or your own localized label.
 */
const LightboxNext = React.forwardRef<HTMLButtonElement, LightboxNextProps>(
  function LightboxNext(props, forwardedRef) {
    const { render, ...elementProps } = props;
    const { activeIndex, navigate, itemCount, loop } = useLightboxContext();

    const disabled = !loop && activeIndex >= itemCount - 1;

    const handleClick = React.useCallback(() => {
      if (disabled) return;
      const nextIndex = loop ? (activeIndex + 1) % itemCount : Math.min(activeIndex + 1, itemCount - 1);
      navigate(nextIndex, 'button');
    }, [activeIndex, disabled, itemCount, loop, navigate]);

    const state = React.useMemo<LightboxNextState>(() => ({ disabled }), [disabled]);
    const ref = useAccessibleNameWarning('Lightbox.Next', forwardedRef);

    return useRender({
      render,
      ref,
      state,
      stateAttributesMapping,
      props: mergeProps<'button'>(
        {
          type: 'button',
          [LightboxNextDataAttributes.next]: '',
          disabled,
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
