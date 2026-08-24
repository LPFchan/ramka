'use client';

import * as React from 'react';

/**
 * Warn in development when a control part renders with no accessible name.
 *
 * The library ships no `aria-label` defaults: an English string baked into a
 * primitive is wrong for most of the world, silently ships copy the consumer
 * never approved, and cannot be localized without prop drilling. Naming these
 * controls is the consumer's job.
 *
 * A nameless icon button is still a WCAG 4.1.2 failure though, so nudge in
 * development the way `Lightbox.Content` does for the dialog. Visible text,
 * `aria-label`, `aria-labelledby` and `title` all count — only a control with
 * none of them warns.
 *
 * Returns a ref callback to hand to `useRender` in place of the forwarded ref.
 */
function useAccessibleNameWarning<T extends HTMLElement>(
  partName: string,
  forwardedRef: React.Ref<T> | null | undefined,
): (node: T | null) => void {
  const elementRef = React.useRef<T | null>(null);

  const setRef = React.useCallback(
    (node: T | null) => {
      elementRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<T | null>).current = node;
    },
    [forwardedRef],
  );

  // No dependency array: a name can appear or disappear on any render, and the
  // check is a couple of attribute reads.
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const el = elementRef.current;
    if (!el || el.getAttribute('aria-hidden') === 'true') return;
    const named =
      !!el.getAttribute('aria-label')?.trim() ||
      !!el.getAttribute('aria-labelledby')?.trim() ||
      !!el.getAttribute('title')?.trim() ||
      !!el.textContent?.trim();
    if (!named) {
      // eslint-disable-next-line no-console
      console.warn(
        `[ramka] ${partName} has no accessible name. Give it visible text, or pass ` +
          '`aria-label` / `aria-labelledby` in your own copy — the library ships no ' +
          'default label so it never hard-codes English into your UI.',
      );
    }
  });

  return setRef;
}

export { useAccessibleNameWarning };
