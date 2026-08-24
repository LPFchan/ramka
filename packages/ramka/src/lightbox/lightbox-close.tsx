'use client';

import * as React from 'react';

import { LightboxCloseDataAttributes } from './lightbox-data-attributes';
import { useLightboxContext } from './lightbox-context';
import { useAccessibleNameWarning } from './use-accessible-name-warning';
import { mergeProps } from '../render/merge-props';
import { useRender } from '../render/use-render';

interface LightboxCloseState extends Record<string, unknown> {}

interface LightboxCloseProps extends useRender.ComponentProps<'button', LightboxCloseState> {}

/**
 * Closes the lightbox when clicked.
 *
 * Ships no `aria-label` — give it visible text or your own localized label.
 */
const LightboxClose = React.forwardRef<HTMLButtonElement, LightboxCloseProps>(
  function LightboxClose(props, forwardedRef) {
    const { render, ...elementProps } = props;
    const { setOpen } = useLightboxContext();

    const handleClick = React.useCallback(
      (event: React.MouseEvent) => {
        // Keyboard activation of a <button> (Enter/Space) dispatches a click with
        // `detail === 0`; a real pointer click has `detail >= 1`. Show the focus
        // ring on the returned trigger only for keyboard activation.
        setOpen(false, { focusVisible: event.detail === 0 });
      },
      [setOpen],
    );

    const state = React.useMemo<LightboxCloseState>(() => ({}), []);
    const ref = useAccessibleNameWarning('Lightbox.Close', forwardedRef);

    return useRender({
      render,
      ref,
      state,
      props: mergeProps<'button'>(
        {
          type: 'button',
          [LightboxCloseDataAttributes.close]: '',
          onClick: handleClick,
        } as React.ComponentPropsWithRef<'button'>,
        elementProps as React.ComponentPropsWithRef<'button'>,
      ),
      defaultTagName: 'button',
    });
  },
);

LightboxClose.displayName = 'LightboxClose';

export { LightboxClose };
export type { LightboxCloseProps, LightboxCloseState };
