'use client';

import * as React from 'react';

import { LightboxCounterDataAttributes } from './lightbox-data-attributes';
import { useLightboxContext } from './lightbox-context';
import { ignoreStateAttribute } from './lightbox-state-attributes';
import { mergeProps } from '../render/merge-props';
import { useRender } from '../render/use-render';

interface LightboxCounterState extends Record<string, unknown> {
  current: number;
  total: number;
}

interface LightboxCounterProps extends Omit<useRender.ComponentProps<'div', LightboxCounterState>, 'children'> {
  /**
   * Render function for custom counter format.
   * @default renders "1 / 12"
   */
  children?: (state: { current: number; total: number }) => React.ReactNode;
}

const counterStateAttributesMapping = {
  current: ignoreStateAttribute,
  total: ignoreStateAttribute,
};

/**
 * Displays the current position in the lightbox collection.
 * Also serves as an aria-live region for screen reader announcements.
 *
 * Default rendering: "1 / 12". Use the render-prop children for
 * custom formatting (e.g., "Image 1 of 12").
 */
const LightboxCounter = React.forwardRef<HTMLDivElement, LightboxCounterProps>(
  function LightboxCounter(props, forwardedRef) {
    const { render, children: renderProp, ...elementProps } = props;
    const { activeIndex, itemCount } = useLightboxContext();

    const current = activeIndex + 1;
    const total = itemCount;

    const state = React.useMemo<LightboxCounterState>(() => ({ current, total }), [current, total]);

    const defaultContent = `${current} / ${total}`;
    const resolvedChildren = renderProp ? renderProp({ current, total }) : defaultContent;

    return useRender({
      render,
      ref: forwardedRef,
      state,
      stateAttributesMapping: counterStateAttributesMapping,
      props: mergeProps<'div'>(
        {
          [LightboxCounterDataAttributes.counter]: '',
          'aria-live': 'polite',
          'aria-atomic': true,
        } as React.ComponentPropsWithRef<'div'>,
        elementProps as React.ComponentPropsWithRef<'div'>,
        { children: resolvedChildren } as React.ComponentPropsWithRef<'div'>,
      ),
      defaultTagName: 'div',
    });
  },
);

LightboxCounter.displayName = 'LightboxCounter';

export { LightboxCounter };
export type { LightboxCounterProps, LightboxCounterState };
