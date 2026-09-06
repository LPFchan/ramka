import type { StaticImageData } from 'next/image';

import { galleryImages } from './images.generated';

/**
 * Shared photo catalogue for the URL-synced state example. Plain data (no
 * `'use client'`) on purpose: the client demo maps it into grid tiles and
 * gallery slides, while the server route (`[[...id]]/page.tsx`) uses the same
 * ids and captions for `generateStaticParams`, per-photo metadata, and 404s —
 * one list, so a photo's URL can never drift from its slide.
 */
export interface GalleryPhoto {
  /**
   * URL segment for the photo's deep link (`…/url-synced-state/5`). An
   * opaque STABLE id — the routing looks photos up by this value, never by
   * array position, so reordering or removing photos can't repoint existing
   * links. (These happen to be numeric; any string works.)
   */
  id: string;
  alt: string;
  caption: string;
  image: StaticImageData;
}

export const galleryPhotos: GalleryPhoto[] = (
  [
    { id: '1', alt: 'Foggy pine ridge at dawn', caption: 'Dawn ridge' },
    { id: '2', alt: 'Empty coastal highway', caption: 'Open road' },
    { id: '3', alt: 'Overhead of a linen breakfast table', caption: 'Slow morning' },
    { id: '4', alt: 'Narrow sunlit alley', caption: 'Warm alley' },
    { id: '5', alt: 'Wide desert dunes', caption: 'Dunes' },
    { id: '6', alt: 'Rain on a window', caption: 'Rainy glass' },
    { id: '7', alt: 'Calm lake reflection', caption: 'Still water' },
    { id: '8', alt: 'Tall concrete staircase', caption: 'Ascent' },
    { id: '9', alt: 'Close-up of dried flowers', caption: 'Pressed petals' },
    { id: '10', alt: 'Panoramic city skyline at dusk', caption: 'Dusk skyline' },
    { id: '11', alt: 'Single tree in a green field', caption: 'Lone tree' },
    { id: '12', alt: 'Textured stone wall', caption: 'Stonework' },
  ] as const
).map((photo, i) => ({ ...photo, image: galleryImages[i]! }));
