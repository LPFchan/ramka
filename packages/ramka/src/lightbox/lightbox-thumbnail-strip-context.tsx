'use client';

import * as React from 'react';

interface LightboxThumbnailStripContextValue {
  /** Register the transform target (tablist track element). */
  registerTrack: (node: HTMLElement | null) => void;
  /** Register a thumbnail element for midline / travel measurement. */
  registerThumb: (index: number, node: HTMLElement | null) => void;
  /**
   * Pointer selection from a Thumbnail inside this ThumbnailStrip.
   * Owns optional scrub motion; always respects `navigationLockedRef`.
   * Keyboard navigation stays instant via ThumbnailGroup → setActiveIndex.
   */
  selectIndex: (index: number) => void;
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
export type { LightboxThumbnailStripContextValue };
