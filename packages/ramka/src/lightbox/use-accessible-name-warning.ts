'use client';

import * as React from 'react';

interface AccessibleNameWarningOptions {
  /**
   * Whether text rendered inside the element names it. True for a button, where
   * the label is its content. False for a container role such as `group`, where
   * descendant text is the slide's content and names nothing — counting it
   * would let a captioned slide pass the check while still being nameless.
   *
   * @default true
   */
  namedByContent?: boolean;
  /** Appended to the warning, to say what a good name looks like for the part. */
  hint?: string;
}

/**
 * Warn in development when a part renders with no accessible name.
 *
 * The library ships no `aria-label` defaults: an English string baked into a
 * primitive is wrong for most of the world, silently ships copy the consumer
 * never approved, and cannot be localized without prop drilling. Naming these
 * parts is the consumer's job.
 *
 * A nameless icon button is still a WCAG 4.1.2 failure though, so nudge in
 * development the way `Lightbox.Content` does for the dialog. `aria-label`,
 * `aria-labelledby` and `title` always count; visible text counts only where
 * content names the element (see `namedByContent`).
 *
 * Returns a ref callback to hand to `useRender` in place of the forwarded ref.
 */
function useAccessibleNameWarning<T extends HTMLElement>(
  partName: string,
  forwardedRef: React.Ref<T> | null | undefined,
  options?: AccessibleNameWarningOptions,
): (node: T | null) => void {
  const { namedByContent = true, hint } = options ?? {};
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
  // check is a couple of attribute reads. The read itself is deferred a
  // macrotask because a sibling's mount effect in the same commit can still
  // name this part — a ThumbnailGroup registers its tablist in an effect that
  // runs after this one, flipping Item to a `tabpanel` named by its tab. By
  // the time a timeout fires, that re-render has committed. Each render
  // clears the previous timer, so the check always reads the settled DOM.
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const timer = setTimeout(() => {
      const el = elementRef.current;
      if (!el || el.getAttribute('aria-hidden') === 'true') return;
      const named =
        !!el.getAttribute('aria-label')?.trim() ||
        !!el.getAttribute('aria-labelledby')?.trim() ||
        !!el.getAttribute('title')?.trim() ||
        (namedByContent && !!el.textContent?.trim());
      if (!named) {
        // eslint-disable-next-line no-console
        console.warn(
          `[ramka] ${partName} has no accessible name. ` +
            (hint ?? 'Give it visible text, or pass `aria-label` / `aria-labelledby`.') +
            ' The library ships no default label so it never hard-codes English into your UI.',
        );
      }
    }, 0);
    return () => clearTimeout(timer);
  });

  return setRef;
}

export { useAccessibleNameWarning };
