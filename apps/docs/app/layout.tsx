import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Sidebar } from './_components/sidebar';
import './globals.css';

export const metadata: Metadata = {
  title: 'react-image-gallery',
  description: 'Unstyled, accessible image gallery primitives for React.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        <div className="flex">
          <Sidebar />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
