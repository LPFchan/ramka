import type { StaticImageData } from 'next/image';

import { lightboxImageFiles } from './images.generated';

export interface LightboxImage {
  id: number;
  /** Single local asset per photo — next/image derives thumb sizes via srcset. */
  src: StaticImageData;
  thumb: StaticImageData;
  alt: string;
  caption: string;
}

const meta = [
  {
    alt: 'Mountain landscape at sunrise',
    caption: 'Mountain landscape at sunrise — Dolomites, Italy',
  },
  {
    alt: 'Ocean waves crashing on rocks',
    caption: 'Ocean waves crashing on coastal rocks — Big Sur, California',
  },
  {
    alt: 'Forest path in autumn',
    caption: 'Autumn forest path — Black Forest, Germany',
  },
  {
    alt: 'City skyline at night',
    caption: 'City skyline at night — Tokyo, Japan',
  },
  {
    alt: 'Desert sand dunes',
    caption: 'Sand dunes at golden hour — Sahara Desert',
  },
  {
    alt: 'Northern lights over a lake',
    caption: 'Aurora borealis — Lofoten, Norway',
  },
];

export const lightboxImages: LightboxImage[] = meta.map((m, i) => ({
  id: i + 1,
  src: lightboxImageFiles[i]!,
  thumb: lightboxImageFiles[i]!,
  ...m,
}));
