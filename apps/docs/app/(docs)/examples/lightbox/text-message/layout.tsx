import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Metadata only: the page is a client component and cannot export it itself.
export const metadata: Metadata = {
  title: 'Text message example',
  description:
    'An iMessage-style chat in React where photo attachments open in a morphing lightbox from a single morphTo="origin" trigger, built with ramka.',
};

export default function TextMessageLayout({ children }: { children: ReactNode }) {
  return children;
}
