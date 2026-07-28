'use client';

import { mergeProps, useRender } from '@base-ui/react';
import * as React from 'react';

import { useLightboxContext } from './lightbox-context';
import { ignoreStateAttribute } from './lightbox-state-attributes';

interface LightboxCaptionState extends Record<string, unknown> {
  index: number;
  hasCaption: boolean;
}

interface LightboxCaptionProps extends useRender.ComponentProps<'div', LightboxCaptionState> {}

const captionStateAttributesMapping = {
  index: ignoreStateAttribute,
  hasCaption: (value: unknown) => (value ? { 'data-has-caption': '' } : null),
};

/**
 * Renders the caption for the currently active lightbox item.
 * Reads from the caption registry populated by each Lightbox.Item's
 * `caption` prop.
 *
 * Renders nothing visible when no caption is set for the active item,
 * but stays in the DOM for ARIA purposes.
 */
const LightboxCaption = React.forwardRef<HTMLDivElement, LightboxCaptionProps>(
  function LightboxCaption(props, forwardedRef) {
    const { render, ...elementProps } = props;
    const { activeIndex, captionsRef, subscribeCaptions } = useLightboxContext();

    // Read the ref-based registry reactively. `.get()` returns a stable
    // reference until the caption actually changes, so it's a valid
    // useSyncExternalStore snapshot (no re-render loop), and the component
    // now updates on caption register/unregister — not only on activeIndex.
    const getCaption = React.useCallback(
      () => captionsRef.current.get(activeIndex),
      [captionsRef, activeIndex],
    );
    const caption = React.useSyncExternalStore(subscribeCaptions, getCaption, getCaption);
    const hasCaption = caption !== undefined;

    const state = React.useMemo<LightboxCaptionState>(
      () => ({ index: activeIndex, hasCaption }),
      [activeIndex, hasCaption],
    );

    return useRender({
      render,
      ref: forwardedRef,
      state,
      stateAttributesMapping: captionStateAttributesMapping,
      props: mergeProps<'div'>(
        {
          'aria-live': 'polite',
          'aria-atomic': true,
        } as React.ComponentPropsWithRef<'div'>,
        elementProps as React.ComponentPropsWithRef<'div'>,
        { children: hasCaption ? caption : null } as React.ComponentPropsWithRef<'div'>,
      ),
      defaultTagName: 'div',
    });
  },
);

LightboxCaption.displayName = 'LightboxCaption';

export { LightboxCaption };
export type { LightboxCaptionProps, LightboxCaptionState };
