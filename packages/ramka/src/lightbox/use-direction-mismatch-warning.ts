'use client';

import * as React from 'react';

import type { TextDirection } from './lightbox-direction';

/**
 * Warn in development when the resolved `dir` disagrees with the CSS direction
 * the scroller actually renders in.
 *
 * Passing `dir` keeps the two in step by itself — `Lightbox.Portal` writes it to
 * the portal host — so what is left for this to catch is the inverse: an app
 * that is RTL in CSS but never passed the prop, which leaves behavior on its
 * `'ltr'` default. That is the one RTL misconfiguration with no visible symptom.
 * The carousel still renders and still scrolls; it just resolves the wrong index
 * for a given scroll position, so the active marker and the visible slide drift
 * apart. It also still catches a `dir` override on Portal or Content that
 * contradicts Root.
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
      `[ramka] Lightbox.Root resolves dir="${dir}" but Lightbox.Slides renders ` +
        `with direction: ${computed}. Navigation will resolve the wrong slide.\n` +
        `Pass dir="${computed}" to Lightbox.Root — it mirrors navigation and is ` +
        'written to the Portal host, so CSS and behavior agree. If a `dir` is set ' +
        'on Portal or Content, make it match Root.',
    );
  }, [elementRef, dir]);
}

export { useDirectionMismatchWarning };
