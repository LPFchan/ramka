'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import * as React from 'react';

import { LightboxBackdropDataAttributes } from './lightbox-data-attributes';
import { useLightboxContext } from './lightbox-context';
import { useLightboxPortalContext } from './lightbox-portal';
import { inertWhen } from './react-compat';

interface LightboxBackdropState extends Record<string, unknown> {
  open: boolean;
}

interface LightboxBackdropProps extends useRender.ComponentProps<'div', LightboxBackdropState> {}

// Stable hooks (Base UI style) so the open/closed union doesn't widen to
// `{ data-open?: undefined }` and break `StateAttributesMapping`.
const BACKDROP_OPEN_HOOK: Record<string, string> = {
  [LightboxBackdropDataAttributes.open]: '',
};
const BACKDROP_CLOSED_HOOK: Record<string, string> = {
  [LightboxBackdropDataAttributes.closed]: '',
};

const backdropStateAttributesMapping = {
  open: (value: unknown) => (value ? BACKDROP_OPEN_HOOK : BACKDROP_CLOSED_HOOK),
};

/**
 * Visual backdrop behind the Lightbox content. Equivalent in role to the
 * native `<dialog>::backdrop` pseudo-element, but rendered as an explicit
 * primitive so consumers can style it freely (size, color, blur, opacity
 * transitions).
 *
 * Place inside `Lightbox.Portal` (typically as a sibling of `Lightbox.Content`).
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
 * opacity: calc(1 - var(--lightbox-pull-progress, 0) * 0.6);
 * transition: opacity var(--lightbox-pull-snap-duration, 300ms)
 *   var(--lightbox-pull-snap-easing, ease);
 * &[data-pulling] { transition: none; }
 * ```
 *
 * On release the gesture resets the variable to 0 and removes `data-pulling`,
 * so the consumer's transition eases the backdrop back. It also publishes the
 * snap-back's `--lightbox-pull-snap-duration` / `--lightbox-pull-snap-easing`
 * for that moment — referencing them (as above) makes the backdrop spring back
 * on the exact same curve and duration as the item, automatically. Your own
 * fallbacks (`300ms ease` here) still own the open/close fade.
 *
 * Clicking the backdrop closes the lightbox, matching native dialog
 * backdrop click behavior. Consumers can override by stopping
 * propagation on a wrapped element, or by overriding `onClick`.
 *
 * By default the primitive mounts only while the lightbox is mounted (open
 * or mid-close-animation) — same lifecycle as `Lightbox.Content`. With
 * `Lightbox.Portal keepMounted`, it stays in the DOM while closed but is
 * inert / non-interactive so it cannot swallow clicks on the page.
 *
 * Rendering this primitive is optional — `Lightbox.Content` already
 * closes on background click of itself, so a separate backdrop is only
 * needed if you want a visible scrim element you can animate.
 */
const LightboxBackdrop = React.forwardRef<HTMLDivElement, LightboxBackdropProps>(
  function LightboxBackdrop(props, forwardedRef) {
    const { render, ...elementProps } = props;
    const { open, mounted, preparing, setOpen, backdropElementRef } = useLightboxContext();
    const { keepMounted } = useLightboxPortalContext();
    const present = mounted || keepMounted;
    const parked = keepMounted && !mounted;

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
      if (!mounted) return;
      // Backdrop click is a pointer interaction → don't force a focus ring on
      // the trigger that regains focus.
      setOpen(false, { focusVisible: false });
    }, [mounted, setOpen]);

    const state = React.useMemo<LightboxBackdropState>(() => ({ open }), [open]);

    const rendered = useRender({
      render,
      ref: mergedRefCallback,
      state,
      stateAttributesMapping: backdropStateAttributesMapping,
      props: mergeProps<'div'>(
        {
          [LightboxBackdropDataAttributes.backdrop]: '',
          'aria-hidden': true,
          ...inertWhen(parked),
          onClick: handleClick,
          // Hidden during VT pre-mount and while parked with keepMounted so a
          // fixed full-viewport scrim never paints or intercepts input when
          // the lightbox is closed.
          style: {
            ...(preparing || parked ? { visibility: 'hidden' as const } : null),
            ...(parked ? { pointerEvents: 'none' as const } : null),
          },
        } as React.ComponentPropsWithRef<'div'>,
        elementProps as React.ComponentPropsWithRef<'div'>,
      ),
      defaultTagName: 'div',
    });

    if (!present) return null;

    return rendered;
  },
);

LightboxBackdrop.displayName = 'LightboxBackdrop';

export { LightboxBackdrop };
export type { LightboxBackdropProps, LightboxBackdropState };
