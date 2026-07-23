'use client';

import { mergeProps, useRender } from '@base-ui/react';
import * as React from 'react';

import { useLightboxContext } from './lightbox-context';

interface LightboxThumbnailGroupState extends Record<string, unknown> {
  focusWithin: boolean;
}

interface LightboxThumbnailGroupProps
  extends useRender.ComponentProps<'div', LightboxThumbnailGroupState> {}

const thumbnailGroupStateAttributesMapping = {
  focusWithin: (value: unknown) => (value ? { 'data-focus-within': '' } : null),
};

/**
 * Container for Lightbox.Thumbnail buttons.
 * Uses role="tablist" — each child Thumbnail has role="tab".
 * Keyboard navigation: arrow keys with roving tabindex.
 */
const LightboxThumbnailGroup = React.forwardRef<HTMLDivElement, LightboxThumbnailGroupProps>(
  function LightboxThumbnailGroup(props, forwardedRef) {
    const { render, ...elementProps } = props;
    const { activeIndex, setActiveIndex, navigationLockedRef, itemCount, loop, registerTablist } =
      useLightboxContext();

    const [focusWithin, setFocusWithin] = React.useState(false);

    // Announce this tablist so `Lightbox.Item`s adopt `tabpanel` semantics and
    // associate with their controlling tab (the APG "tabbed carousel" variant).
    React.useEffect(() => registerTablist(), [registerTablist]);

    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        let nextIndex: number | null = null;

        switch (event.key) {
          case 'ArrowRight':
          case 'ArrowDown':
            nextIndex = loop ? (activeIndex + 1) % itemCount : Math.min(activeIndex + 1, itemCount - 1);
            break;
          case 'ArrowLeft':
          case 'ArrowUp':
            nextIndex = loop
              ? (activeIndex - 1 + itemCount) % itemCount
              : Math.max(activeIndex - 1, 0);
            break;
          case 'Home':
            nextIndex = 0;
            break;
          case 'End':
            nextIndex = itemCount - 1;
            break;
          default:
            return;
        }

        // We own these keys in the tablist: always block native scroll / signal
        // `Lightbox.Content`'s handler to defer (single navigation authority).
        event.preventDefault();

        // A user scroll/fling is in flight — disregard entirely. Crucially this
        // also skips the focus rove, so focus can't drift away from the active
        // thumbnail while the scroll settles (the "jump by many" bug).
        if (navigationLockedRef.current || itemCount === 0) return;

        // Navigate relative to the *active* index (the source of truth), not the
        // currently-focused tab. A swipe moves `activeIndex` without moving focus,
        // so roving off `document.activeElement` would compute from a stale tab.
        if (nextIndex === activeIndex) return;
        setActiveIndex(nextIndex, 'thumbnail');

        // Keep roving focus on the newly-active tab.
        const tab = event.currentTarget.querySelector<HTMLElement>(
          `[role="tab"][data-index="${nextIndex}"]`,
        );
        tab?.focus();
      },
      [activeIndex, itemCount, loop, navigationLockedRef, setActiveIndex],
    );

    const state = React.useMemo<LightboxThumbnailGroupState>(() => ({ focusWithin }), [focusWithin]);

    return useRender({
      render,
      ref: forwardedRef,
      state,
      stateAttributesMapping: thumbnailGroupStateAttributesMapping,
      props: mergeProps<'div'>(
        {
          role: 'tablist',
          onKeyDown: handleKeyDown,
          onFocus: () => setFocusWithin(true),
          onBlur: (e: React.FocusEvent<HTMLDivElement>) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setFocusWithin(false);
            }
          },
        } as React.ComponentPropsWithRef<'div'>,
        elementProps as React.ComponentPropsWithRef<'div'>,
      ),
      defaultTagName: 'div',
    });
  },
);

LightboxThumbnailGroup.displayName = 'LightboxThumbnailGroup';

export { LightboxThumbnailGroup };
export type { LightboxThumbnailGroupProps, LightboxThumbnailGroupState };
