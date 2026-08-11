'use client';

import { mergeProps, useRender } from '@base-ui/react';
import * as React from 'react';

import { LightboxThumbnailGroupDataAttributes } from './lightbox-data-attributes';
import { useLightboxContext } from './lightbox-context';
import { LightboxThumbnailGroupContext } from './lightbox-thumbnail-group-context';
import { useLightboxThumbnailStripContextOptional } from './lightbox-thumbnail-strip-context';

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
    const thumbnailStrip = useLightboxThumbnailStripContextOptional();

    const [focusWithin, setFocusWithin] = React.useState(false);
    const thumbsRef = React.useRef(new Map<number, HTMLElement>());

    const registerThumb = React.useCallback((index: number, node: HTMLElement | null) => {
      const map = thumbsRef.current;
      if (node) map.set(index, node);
      else map.delete(index);
    }, []);

    const getThumb = React.useCallback((index: number) => thumbsRef.current.get(index) ?? null, []);

    const groupContext = React.useMemo(
      () => ({ registerThumb, getThumb }),
      [registerThumb, getThumb],
    );

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
        // Inside ThumbnailStrip, reuse its scrub path so arrow keys match
        // pointer motion — but keep the stage commit instant (no Slides view
        // transition), consistent with all other keyboard navigation.
        if (nextIndex === activeIndex) return;
        if (thumbnailStrip) {
          thumbnailStrip.selectIndex(nextIndex, {
            source: 'thumbnail',
            stageViewTransition: false,
          });
        } else {
          setActiveIndex(nextIndex, 'thumbnail');
        }

        getThumb(nextIndex)?.focus();
      },
      [activeIndex, itemCount, loop, navigationLockedRef, setActiveIndex, getThumb, thumbnailStrip],
    );

    const state = React.useMemo<LightboxThumbnailGroupState>(() => ({ focusWithin }), [focusWithin]);

    return (
      <LightboxThumbnailGroupContext.Provider value={groupContext}>
        {useRender({
          render,
          ref: forwardedRef,
          state,
          stateAttributesMapping: thumbnailGroupStateAttributesMapping,
          props: mergeProps<'div'>(
            {
              role: 'tablist',
              [LightboxThumbnailGroupDataAttributes.thumbnailGroup]: '',
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
        })}
      </LightboxThumbnailGroupContext.Provider>
    );
  },
);

LightboxThumbnailGroup.displayName = 'LightboxThumbnailGroup';

export { LightboxThumbnailGroup };
export type { LightboxThumbnailGroupProps, LightboxThumbnailGroupState };
