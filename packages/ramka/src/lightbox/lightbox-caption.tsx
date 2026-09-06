'use client';

import * as React from 'react';

import { LightboxCaptionDataAttributes } from './lightbox-data-attributes';
import { useLightboxContext } from './lightbox-context';
import { ignoreStateAttribute } from './lightbox-state-attributes';
import { mergeProps } from '../render/merge-props';
import { useRender } from '../render/use-render';

interface LightboxCaptionState extends Record<string, unknown> {
  index: number;
  hasCaption: boolean;
}

interface LightboxCaptionProps extends useRender.ComponentProps<'div', LightboxCaptionState> {
  /**
   * Fallback content, rendered only while the caption registry is empty.
   * Items register their `caption` in effects, which never run during server
   * rendering (and land only after the first client paint) — so a page that
   * renders an open lightbox paints an empty caption until then. Pass the
   * active item's caption here (you know it on such pages — it's how you
   * rendered the metadata) to make the first paint correct. The moment any
   * item registers, the registry wins and the fallback never renders again,
   * so it can't show stale text after navigation.
   */
  children?: React.ReactNode;
}

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
    const { render, children: fallback, ...elementProps } = props;
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

    // The fallback window: items register captions in effects, so the
    // registry is empty on the server, during hydration, and until the first
    // client-mount effects land. The server snapshot is `true` by definition.
    // Once anything registers, the registry is authoritative — a missing
    // entry then means "this item has no caption", not "use the fallback"
    // (the fallback describes one specific item and must not outlive it).
    const registryEmpty = React.useSyncExternalStore(
      subscribeCaptions,
      () => captionsRef.current.size === 0,
      () => true,
    );
    const content = caption !== undefined ? caption : registryEmpty ? fallback : undefined;
    const hasCaption = content !== undefined && content !== null;

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
          [LightboxCaptionDataAttributes.caption]: '',
          'aria-live': 'polite',
          'aria-atomic': true,
        } as React.ComponentPropsWithRef<'div'>,
        elementProps as React.ComponentPropsWithRef<'div'>,
        { children: hasCaption ? content : null } as React.ComponentPropsWithRef<'div'>,
      ),
      defaultTagName: 'div',
    });
  },
);

LightboxCaption.displayName = 'LightboxCaption';

export { LightboxCaption };
export type { LightboxCaptionProps, LightboxCaptionState };
