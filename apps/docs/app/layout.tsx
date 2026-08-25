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
        {/* ramka's composited transform-only morph (see vt-composited-morph.ts)
            is the shipped morph; append ?vtstock to force the stock UA morph
            instead, for debugging a suspected regression in the composited
            path. Inline so the flag is set before any user interaction can
            start a transition. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'if(/[?&]vtstock/.test(location.search))window.__RAMKA_VT_COMPOSITED__=false;' +
              // Blind A/B: ?vtab=q7 and ?vtab=k2 map to the two morph engines
              // without revealing which is which (see vt-composited-morph.ts).
              'if(/[?&]vtab=q7/.test(location.search))window.__RAMKA_VT_COMPOSITED__=false;' +
              'if(/[?&]vtab=k2/.test(location.search))window.__RAMKA_VT_COMPOSITED__=true;' +
              // ?flip runs the experimental CSS/WAAPI morph (see flip-morph.ts)
              // instead of View Transitions — same trigger↔item motion, no
              // document capture. ?vtab=m4 is its blind-A/B alias, so m4 vs k2
              // compares engines rather than revealing which is which.
              'if(/[?&]flip/.test(location.search))window.__RAMKA_FLIP__=true;' +
              'if(/[?&]vtab=m4/.test(location.search))window.__RAMKA_FLIP__=true;',
          }}
        />
        <ThemeProvider>
          <TooltipProvider delay={150}>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
