export interface ProductImage {
  id: number;
  src: string;
  thumb: string;
  alt: string;
}

export const productImages: ProductImage[] = [
  {
    id: 1,
    src: 'https://picsum.photos/seed/shoe1/600/600',
    thumb: 'https://picsum.photos/seed/shoe1/120/120',
    alt: 'Product front view',
  },
  {
    id: 2,
    src: 'https://picsum.photos/seed/shoe2/600/600',
    thumb: 'https://picsum.photos/seed/shoe2/120/120',
    alt: 'Product side view',
  },
  {
    id: 3,
    src: 'https://picsum.photos/seed/shoe3/600/600',
    thumb: 'https://picsum.photos/seed/shoe3/120/120',
    alt: 'Product back view',
  },
  {
    id: 4,
    src: 'https://picsum.photos/seed/shoe4/600/600',
    thumb: 'https://picsum.photos/seed/shoe4/120/120',
    alt: 'Product detail',
  },
  {
    id: 5,
    src: 'https://picsum.photos/seed/shoe5/600/600',
    thumb: 'https://picsum.photos/seed/shoe5/120/120',
    alt: 'Product on model',
  },
  {
    id: 6,
    src: 'https://picsum.photos/seed/shoe6/600/600',
    thumb: 'https://picsum.photos/seed/shoe6/120/120',
    alt: 'Product packaging',
  },
];
