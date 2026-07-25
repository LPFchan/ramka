'use client';

import * as React from 'react';

interface LightboxThumbnailGroupContextValue {
  /** Register a thumbnail element by index (callback-ref collection). */
  registerThumb: (index: number, node: HTMLElement | null) => void;
  /** Look up a registered thumbnail for focus roving, etc. */
  getThumb: (index: number) => HTMLElement | null;
}

const LightboxThumbnailGroupContext =
  React.createContext<LightboxThumbnailGroupContextValue | null>(null);

function useLightboxThumbnailGroupContext(): LightboxThumbnailGroupContextValue {
  const ctx = React.useContext(LightboxThumbnailGroupContext);
  if (!ctx) {
    throw new Error('Lightbox.Thumbnail must be used within Lightbox.ThumbnailGroup');
  }
  return ctx;
}

/** `null` outside a ThumbnailGroup — Thumbnail may render without a group. */
function useLightboxThumbnailGroupContextOptional(): LightboxThumbnailGroupContextValue | null {
  return React.useContext(LightboxThumbnailGroupContext);
}

export {
  LightboxThumbnailGroupContext,
  useLightboxThumbnailGroupContext,
  useLightboxThumbnailGroupContextOptional,
};
export type { LightboxThumbnailGroupContextValue };
