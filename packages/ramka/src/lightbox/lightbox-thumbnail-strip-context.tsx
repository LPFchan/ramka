'use client';

import * as React from 'react';

import type { NavigationSource } from './lightbox-context';

interface LightboxThumbnailStripSelectOptions {
  /** Reported to `onValueChange`. @default 'thumbnail' */
  source?: NavigationSource;
  /**
   * Whether this selection may run the element-scoped Slides view transition
   * (still gated by the strip's `selectViewTransition` prop). Pointer thumb
   * selection passes `true` (default); keyboard / button navigation passes
   * `false` so the stage commit stays instant while the strip scrubs.
   * @default true
   */
  stageViewTransition?: boolean;
}

interface LightboxThumbnailStripContextValue {
  /** Register the transform target (tablist track element). */
  registerTrack: (node: HTMLElement | null) => void;
  /** Register a thumbnail element for midline / travel measurement. */
  registerThumb: (index: number, node: HTMLElement | null) => void;
  /**
   * Discrete selection into this ThumbnailStrip (pointer thumb, keyboard,
   * Previous/Next). Owns optional scrub motion; always respects
   * `navigationLockedRef`.
   */
  selectIndex: (index: number, options?: LightboxThumbnailStripSelectOptions) => void;
}

const LightboxThumbnailStripContext = React.createContext<LightboxThumbnailStripContextValue | null>(null);

function useLightboxThumbnailStripContext(): LightboxThumbnailStripContextValue {
  const ctx = React.useContext(LightboxThumbnailStripContext);
  if (!ctx) {
    throw new Error('Lightbox.ThumbnailStripTrack must be used within Lightbox.ThumbnailStrip');
  }
  return ctx;
}

/** `null` outside a ThumbnailStrip — used by `Thumbnail` to optionally defer selection. */
function useLightboxThumbnailStripContextOptional(): LightboxThumbnailStripContextValue | null {
  return React.useContext(LightboxThumbnailStripContext);
}

export {
  LightboxThumbnailStripContext,
  useLightboxThumbnailStripContext,
  useLightboxThumbnailStripContextOptional,
};
export type { LightboxThumbnailStripContextValue, LightboxThumbnailStripSelectOptions };
