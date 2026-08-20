import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';

import { ThemeProvider } from './_components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

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
      {/*
        Base UI portal stacking: `position: relative` on body (iOS 26+ absolute
        backdrops) + `isolation: isolate` on the app root so portaled overlays
        sit above page content without competing with in-app z-index values.
      */}
      <body className="relative min-h-screen bg-background text-foreground antialiased">
        {/* The experimental transform-only compositor morph (see ramka's
            vt-composited-morph.ts) is ON by default; append ?vtstock to fall
            back to the stock UA morph for A/B comparison. Inline so the flag is
            set before any user interaction can start a transition. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'if(/[?&]vtstock/.test(location.search))window.__RAMKA_VT_COMPOSITED__=false;' +
              // Blind A/B: ?vtab=q7 and ?vtab=k2 map to the two morph engines
              // without revealing which is which (see vt-composited-morph.ts).
              'if(/[?&]vtab=q7/.test(location.search))window.__RAMKA_VT_COMPOSITED__=false;' +
              'if(/[?&]vtab=k2/.test(location.search))window.__RAMKA_VT_COMPOSITED__=true;',
          }}
        />
        <ThemeProvider>
          <TooltipProvider delay={150}>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
