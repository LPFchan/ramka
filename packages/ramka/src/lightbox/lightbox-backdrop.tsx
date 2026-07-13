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
 * transitions).
 *
 * Registers itself in `Lightbox.Root`'s `backdropElementRef` so the
 * pull-to-dismiss gesture (implemented in `LightboxContent`) can drive it
 * during a drag without needing a direct ref from the consumer. Rather
 * than hardcoding an opacity curve, the gesture:
 *
 *   - sets `data-pulling` on the backdrop for the duration of the drag, and
 *   - exposes a `--lightbox-pull-progress` CSS variable (0 at rest → 1 at
 *     the dismiss threshold) so consumers decide how the pull maps to
 *     visuals.
 *
 * A typical consumer style suppresses the transition while pulling (for
 * 1:1 finger tracking) and derives opacity from the variable:
 *
 * ```css
 * transition: opacity 300ms;
 * opacity: calc(1 - var(--lightbox-pull-progress, 0) * 0.6);
 * &[data-pulling] { transition: none; }
 * ```
 *
 * On release the gesture resets the variable to 0 and removes
 * `data-pulling`, so the consumer's own transition eases the backdrop back.
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
    const { open, mounted, preparing, setOpen, backdropElementRef } = useLightboxContext();

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
          // Hidden during the VT pre-mount phase so a dark scrim isn't painted
          // into the transition's old snapshot. Consumers don't set
          // `visibility`, so this transient flag survives the style merge.
          ...(preparing ? { style: { visibility: 'hidden' as const } } : null),
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
