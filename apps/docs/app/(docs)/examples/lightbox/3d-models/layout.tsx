import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Metadata only: the page is a client component and cannot export it itself.
export const metadata: Metadata = {
  title: '3D models example',
  description:
    'A Three.js product grid in a React lightbox: onBeforeOpen preheats GLB models before the morph, with a shared orbit between trigger and slide.',
};

export default function ThreeDModelsLayout({ children }: { children: ReactNode }) {
  return children;
}
