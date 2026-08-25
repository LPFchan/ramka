'use client';

import * as React from 'react';

import type { TextDirection } from './lightbox-direction';

/**
 * Warn in development when the `dir` prop disagrees with the CSS direction the
 * scroller actually renders in.
 *
 * The split is deliberate (and matches Base UI): `dir` drives *behavior* —
 * snap geometry, strip travel, arrow keys — while CSS direction is the
 * consumer's to set. But the two disagreeing is the one RTL misconfiguration
 * with no visible symptom: the carousel still renders and still scrolls, it
 * just resolves the wrong index for a given scroll position, so the marker and
 * the visible slide drift apart.
 *
 * `Lightbox.Portal` renders into `document.body`, so this is easy to hit by
 * accident — `dir="rtl"` on an app wrapper element styles the page but never
 * reaches the portaled lightbox. Putting it on `<html>` does.
 */
function useDirectionMismatchWarning(
  elementRef: React.RefObject<HTMLElement | null>,
  dir: TextDirection,
): void {
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const el = elementRef.current;
    if (!el || typeof getComputedStyle !== 'function') return;

    const computed = getComputedStyle(el).direction === 'rtl' ? 'rtl' : 'ltr';
    if (computed === dir) return;

    // eslint-disable-next-line no-console
    console.warn(
      `[ramka] Lightbox.Root has dir="${dir}" but Lightbox.Slides renders with ` +
        `direction: ${computed}. Navigation will resolve the wrong slide.\n` +
        'The `dir` prop sets behavior only — set the CSS direction too, ideally ' +
        '`dir="rtl"` on <html>. A `dir` on an app wrapper element will not reach ' +
        'the lightbox, which portals into document.body.',
    );
  }, [elementRef, dir]);
}

export { useDirectionMismatchWarning };
