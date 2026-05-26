'use client';

import { mergeProps, useRender } from '@base-ui/react';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { useLightboxContext } from './lightbox-context';

interface LightboxBackdropState extends Record<string, unknown> {
  open: boolean;
}

interface LightboxBackdropProps extends useRender.ComponentProps<'div', LightboxBackdropState> {
  /**
   * Container element for the portal. Defaults to `document.body` so the
   * backdrop sits at the top of the document regardless of where it is
   * placed in JSX. Pass `null` to render in-place (no portal).
   */
  container?: Element | DocumentFragment | null;
}

const backdropStateAttributesMapping = {
  open: (value: unknown) => (value ? { 'data-open': '' } : null),
};

/**
 * Visual backdrop behind the Lightbox content. Equivalent in role to the
 * native `<dialog>::backdrop` pseudo-element, but rendered as an explicit
 * primitive so consumers can style it freely (size, color, blur, opacity
 * transitions) and pull-to-dismiss can animate its opacity.
 *
 * Registers itself in `Lightbox.Root`'s `backdropElementRef` so the
 * pull-to-dismiss gesture (implemented in `LightboxContent`) can read /
 * write its inline opacity during a drag without needing a direct ref
 * from the consumer.
 *
 * Clicking the backdrop closes the lightbox, matching native dialog
 * backdrop click behavior. Consumers can override by stopping
 * propagation on a wrapped element, or by overriding `onClick`.
 *
 * The primitive is only mounted while the lightbox is mounted (open or
 * mid-close-animation) — same lifecycle as `Lightbox.Content`. This is
 * important even though closed backdrops are typically invisible
 * (opacity 0): a fixed-position, full-viewport element still receives
 * pointer events while opacity is 0, so leaving it in the tree would
 * swallow clicks on triggers underneath.
 *
 * Rendering this primitive is optional — `Lightbox.Content` already
 * closes on background click of itself, so a separate backdrop is only
 * needed if you want a visible scrim element you can animate.
 */
const LightboxBackdrop = React.forwardRef<HTMLDivElement, LightboxBackdropProps>(
  function LightboxBackdrop(props, forwardedRef) {
    const { render, container, ...elementProps } = props;
    const { open, mounted, setOpen, backdropElementRef } = useLightboxContext();

    const mergedRefCallback = React.useCallback(
      (node: HTMLDivElement | null) => {
        backdropElementRef.current = node;
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef, backdropElementRef],
    );

    const handleClick = React.useCallback(() => {
      setOpen(false);
    }, [setOpen]);

    const state = React.useMemo<LightboxBackdropState>(() => ({ open }), [open]);

    const rendered = useRender({
      render,
      ref: mergedRefCallback,
      state,
      stateAttributesMapping: backdropStateAttributesMapping,
      props: mergeProps<'div'>(
        {
          'aria-hidden': true,
          onClick: handleClick,
        } as React.ComponentPropsWithRef<'div'>,
        elementProps as React.ComponentPropsWithRef<'div'>,
      ),
      defaultTagName: 'div',
    });

    if (!mounted) return null;

    // `container === null` opts out of portaling — render in place.
    if (container === null) return rendered;

    const portalTarget = container ?? (typeof document !== 'undefined' ? document.body : null);

    return portalTarget ? ReactDOM.createPortal(rendered, portalTarget) : rendered;
  },
);

LightboxBackdrop.displayName = 'LightboxBackdrop';

export { LightboxBackdrop };
export type { LightboxBackdropProps, LightboxBackdropState };
