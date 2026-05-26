export interface LightboxImage {
  id: number;
  src: string;
  thumb: string;
  alt: string;
  caption: string;
}

export const lightboxImages: LightboxImage[] = [
  {
    id: 1,
    src: 'https://picsum.photos/seed/lb1/1200/800',
    thumb: 'https://picsum.photos/seed/lb1/200/200',
    alt: 'Mountain landscape at sunrise',
    caption: 'Mountain landscape at sunrise — Dolomites, Italy',
  },
  {
    id: 2,
    src: 'https://picsum.photos/seed/lb2/1200/800',
    thumb: 'https://picsum.photos/seed/lb2/200/200',
    alt: 'Ocean waves crashing on rocks',
    caption: 'Ocean waves crashing on coastal rocks — Big Sur, California',
  },
  {
    id: 3,
    src: 'https://picsum.photos/seed/lb3/1200/800',
    thumb: 'https://picsum.photos/seed/lb3/200/200',
    alt: 'Forest path in autumn',
    caption: 'Autumn forest path — Black Forest, Germany',
  },
  {
    id: 4,
    src: 'https://picsum.photos/seed/lb4/1200/800',
    thumb: 'https://picsum.photos/seed/lb4/200/200',
    alt: 'City skyline at night',
    caption: 'City skyline at night — Tokyo, Japan',
  },
  {
    id: 5,
    src: 'https://picsum.photos/seed/lb5/1200/800',
    thumb: 'https://picsum.photos/seed/lb5/200/200',
    alt: 'Desert sand dunes',
    caption: 'Sand dunes at golden hour — Sahara Desert',
  },
  {
    id: 6,
    src: 'https://picsum.photos/seed/lb6/1200/800',
    thumb: 'https://picsum.photos/seed/lb6/200/200',
    alt: 'Northern lights over a lake',
    caption: 'Aurora borealis — Lofoten, Norway',
  },
];
