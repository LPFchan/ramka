import type { StaticImageData } from 'next/image';

import { moodboardImages } from './images.generated';

/**
 * Shared photo catalogue for the moodboard example. Plain data (no
 * `'use client'`) on purpose: the client demo maps it into grid tiles and
 * gallery slides, while the server route (`[[...id]]/page.tsx`) uses the same
 * ids and captions for `generateStaticParams`, per-photo metadata, and 404s —
 * one list, so a photo's URL can never drift from its slide.
 */
export interface MoodboardPhoto {
  /** URL segment for the photo's deep link (`…/moodboard/mb-05`). */
  id: string;
  alt: string;
  caption: string;
  image: StaticImageData;
}

export const moodboardPhotos: MoodboardPhoto[] = (
  [
    { id: 'mb-01', alt: 'Foggy pine ridge at dawn', caption: 'Dawn ridge' },
    { id: 'mb-02', alt: 'Empty coastal highway', caption: 'Open road' },
    { id: 'mb-03', alt: 'Overhead of a linen breakfast table', caption: 'Slow morning' },
    { id: 'mb-04', alt: 'Narrow sunlit alley', caption: 'Warm alley' },
    { id: 'mb-05', alt: 'Wide desert dunes', caption: 'Dunes' },
    { id: 'mb-06', alt: 'Rain on a window', caption: 'Rainy glass' },
    { id: 'mb-07', alt: 'Calm lake reflection', caption: 'Still water' },
    { id: 'mb-08', alt: 'Tall concrete staircase', caption: 'Ascent' },
    { id: 'mb-09', alt: 'Close-up of dried flowers', caption: 'Pressed petals' },
    { id: 'mb-10', alt: 'Panoramic city skyline at dusk', caption: 'Dusk skyline' },
    { id: 'mb-11', alt: 'Single tree in a green field', caption: 'Lone tree' },
    { id: 'mb-12', alt: 'Textured stone wall', caption: 'Stonework' },
  ] as const
).map((photo, i) => ({ ...photo, image: moodboardImages[i]! }));
