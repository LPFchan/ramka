import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Metadata only: the page is a client component and cannot export it itself.
export const metadata: Metadata = {
  title: 'Moodboard example',
  description:
    'A masonry image wall with unknown dimensions in a React lightbox: morph size resolution and trigger thumbnail placeholders, built with ramka.',
};

export default function MoodboardLayout({ children }: { children: ReactNode }) {
  return children;
}
