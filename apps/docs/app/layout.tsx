import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';

import { MobileNav } from './_components/mobile-nav';
import { Sidebar } from './_components/sidebar';
import { ThemeProvider } from './_components/theme-provider';
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
    <html
      lang="en"
      // Reserve the sticky MobileNav's height (h-14) as scroll-padding on the
      // document scroller, so Lightbox `scrollTriggerIntoView` (which uses
      // scrollIntoView({ block: 'nearest' })) doesn't leave a trigger tucked
      // under the nav. MobileNav is md:hidden, so the padding only applies below md.
      className={cn('scroll-pt-14 font-sans md:scroll-pt-0', inter.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>
          <TooltipProvider delay={150}>
            <div className="flex">
              <Sidebar />
              <div className="flex min-w-0 flex-1 flex-col">
                <MobileNav />
                <main className="min-w-0 flex-1">{children}</main>
              </div>
            </div>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
