import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Metadata only: the page is a client component and cannot export it itself.
export const metadata: Metadata = {
  title: 'Film trailers example',
  description:
    'A React video lightbox example: movie posters morph into fullscreen videos that autoplay on becoming active, built with ramka.',
};

export default function FilmTrailersLayout({ children }: { children: ReactNode }) {
  return children;
}
