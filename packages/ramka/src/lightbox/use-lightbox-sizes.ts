'use client';

import * as React from 'react';

import { useOptionalZoomContext } from './lightbox-zoom-context';

const DEFAULT_SIZES = '100vw';

/**
 * Snap zoom to 1, 2, 4, 8… so `sizes` only changes when a new `srcset`
 * candidate is likely useful — not on every pinch frame.
 */
function lightboxSizesZoomFactor(zoom: number): number {
  if (!Number.isFinite(zoom) || zoom < 2) return 1;
  return 2 ** Math.floor(Math.log2(zoom));
}

function formatScaledLength(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(4)));
}

/**
 * Multiply each source-size length in a `sizes` list by `factor`.
 * Media-condition breakpoints are left untouched
 * (`(max-width: 600px) 100vw` → `(max-width: 600px) 200vw` at 2×).
 */
function scaleLightboxSizes(sizes: string, factor: number): string {
  if (factor === 1) return sizes;
  return sizes
    .split(',')
    .map((part) =>
      part.replace(
        /([0-9]*\.?[0-9]+)(px|vw|vh|em|rem|cqw|cqh|%)\s*$/,
        (_, n: string, unit: string) => `${formatScaledLength(Number(n) * factor)}${unit}`,
      ),
    )
    .join(',');
}

/**
 * `sizes` attribute scaled by the enclosing Zoom (snapped to 1× / 2× / 4× / …).
 * Pass this to `<img sizes>` or `next/image` so the browser can pick a denser
 * `srcset` candidate when the user zooms. Outside Zoom, returns `base` unchanged.
 *
 * @param base Resting `sizes` value (default `100vw`). Media-condition lists are
 *   supported; only the length tokens are multiplied, not query breakpoints.
 */
function useLightboxSizes(base: string = DEFAULT_SIZES): string {
  const zoom = useOptionalZoomContext()?.zoom ?? 1;
  const factor = lightboxSizesZoomFactor(zoom);
  return React.useMemo(() => scaleLightboxSizes(base, factor), [base, factor]);
}

export { useLightboxSizes, lightboxSizesZoomFactor, scaleLightboxSizes };
