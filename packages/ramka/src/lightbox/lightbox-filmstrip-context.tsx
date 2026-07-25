'use client';

import * as React from 'react';

interface LightboxFilmstripContextValue {
  /** Register the transform target (tablist track element). */
  registerTrack: (node: HTMLElement | null) => void;
  /** Register a thumbnail element for midline / travel measurement. */
  registerThumb: (index: number, node: HTMLElement | null) => void;
  /**
   * Pointer selection from a Thumbnail inside this Filmstrip.
   * Owns optional scrub motion; always respects `navigationLockedRef`.
   * Keyboard navigation stays instant via ThumbnailGroup → setActiveIndex.
   */
  selectIndex: (index: number) => void;
}

const LightboxFilmstripContext = React.createContext<LightboxFilmstripContextValue | null>(null);

function useLightboxFilmstripContext(): LightboxFilmstripContextValue {
  const ctx = React.useContext(LightboxFilmstripContext);
  if (!ctx) {
    throw new Error('Lightbox.FilmstripTrack / Indicator must be used within Lightbox.Filmstrip');
  }
  return ctx;
}

/** `null` outside a Filmstrip — used by `Thumbnail` to optionally defer selection. */
function useLightboxFilmstripContextOptional(): LightboxFilmstripContextValue | null {
  return React.useContext(LightboxFilmstripContext);
}

export {
  LightboxFilmstripContext,
  useLightboxFilmstripContext,
  useLightboxFilmstripContextOptional,
};
export type { LightboxFilmstripContextValue };
