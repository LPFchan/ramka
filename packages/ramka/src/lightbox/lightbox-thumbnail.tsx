'use client';

import { mergeProps, useRender } from '@base-ui/react';
import * as React from 'react';

import { useLightboxContext } from './lightbox-context';
import { useLightboxFilmstripContextOptional } from './lightbox-filmstrip-context';
import { useLightboxThumbnailGroupContextOptional } from './lightbox-thumbnail-group-context';

interface LightboxThumbnailState extends Record<string, unknown> {
  active: boolean;
  index: number;
}

interface LightboxThumbnailProps extends useRender.ComponentProps<'button', LightboxThumbnailState> {
  /** The index of the item this thumbnail navigates to. */
  index: number;
}

const thumbnailStateAttributesMapping = {
  active: (value: unknown) => (value ? { 'data-active': '' } : null),
  index: (value: unknown) => ({ 'data-index': String(value) }),
};

/**
 * A thumbnail button that navigates to a specific item in the lightbox.
 * Uses role="tab" within a ThumbnailGroup (role="tablist"),
 * with roving tabindex for keyboard navigation.
 *
 * Inside `Lightbox.Filmstrip`, pointer selection goes through the filmstrip so
 * taps can scrub the linked track; keyboard stays instant via ThumbnailGroup.
 * Outside a filmstrip, clicks call `setActiveIndex` directly.
 */
const LightboxThumbnail = React.forwardRef<HTMLButtonElement, LightboxThumbnailProps>(
  function LightboxThumbnail(props, forwardedRef) {
    const { render, index, ...elementProps } = props;
    const { activeIndex, setActiveIndex, baseId } = useLightboxContext();
    const filmstrip = useLightboxFilmstripContextOptional();
    const group = useLightboxThumbnailGroupContextOptional();

    const isActive = index === activeIndex;
    // Matching ids for the WAI-ARIA Tabs association: this tab controls its
    // item's `tabpanel`, and that panel is labelled by this tab.
    const tabId = `${baseId}-tab-${index}`;
    const panelId = `${baseId}-panel-${index}`;

    const assignRef = React.useCallback(
      (node: HTMLButtonElement | null) => {
        group?.registerThumb(index, node);
        filmstrip?.registerThumb(index, node);
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [index, group, filmstrip, forwardedRef],
    );

    const handleClick = React.useCallback(() => {
      if (filmstrip) {
        filmstrip.selectIndex(index);
        return;
      }
      setActiveIndex(index, 'thumbnail');
    }, [index, setActiveIndex, filmstrip]);

    const state = React.useMemo<LightboxThumbnailState>(() => ({ active: isActive, index }), [isActive, index]);

    return useRender({
      render,
      ref: assignRef,
      state,
      stateAttributesMapping: thumbnailStateAttributesMapping,
      props: mergeProps<'button'>(
        {
          type: 'button',
          role: 'tab',
          id: tabId,
          'aria-selected': isActive,
          'aria-controls': panelId,
          tabIndex: isActive ? 0 : -1,
          onClick: handleClick,
        } as React.ComponentPropsWithRef<'button'>,
        elementProps as React.ComponentPropsWithRef<'button'>,
      ),
      defaultTagName: 'button',
    });
  },
);

LightboxThumbnail.displayName = 'LightboxThumbnail';

export { LightboxThumbnail };
export type { LightboxThumbnailProps, LightboxThumbnailState };
