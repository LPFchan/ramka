import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'VT gates debug · ramka',
  description: 'On-device View Transition gate + morph diagnostics for ramka lightbox.',
  robots: { index: false, follow: false },
};

export default function VtGatesLayout({ children }: { children: ReactNode }) {
  return children;
}
