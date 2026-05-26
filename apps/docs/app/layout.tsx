import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';

import { Sidebar } from './_components/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import './globals.css';

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'ramka',
  description: 'Unstyled, accessible image gallery primitives for React.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={cn('font-sans', inter.variable)}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <TooltipProvider delay={150}>
          <div className="flex">
            <Sidebar />
            <main className="min-w-0 flex-1">{children}</main>
          </div>
        </TooltipProvider>
      </body>
    </html>
  );
}
