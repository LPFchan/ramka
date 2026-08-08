import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';

import { MobileNav } from './_components/mobile-nav';
import { Sidebar } from './_components/sidebar';
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
        {/* View Transition debugging (see ramka's vt-debug.ts and
            vt-composited-morph.ts): append ?vtdebug to stream per-frame morph
            traces to /api/vt-log. The experimental transform-only compositor
            morph is ON by default; append ?vtstock to fall back to the stock
            UA morph for A/B comparison. Inline so the flags are set before
            any user interaction can start a transition. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'if(/[?&]vtdebug/.test(location.search))window.__RAMKA_VT_DEBUG__=true;' +
              'if(/[?&]vtstock/.test(location.search))window.__RAMKA_VT_COMPOSITED__=false;' +
              // Blind A/B: ?vtab=q7 and ?vtab=k2 map to the two morph engines
              // without revealing which is which (see vt-composited-morph.ts).
              'if(/[?&]vtab=q7/.test(location.search))window.__RAMKA_VT_COMPOSITED__=false;' +
              'if(/[?&]vtab=k2/.test(location.search))window.__RAMKA_VT_COMPOSITED__=true;' +
              // Live-tune the composited morph timing (all browsers) without
              // rebuilds: ?vttiming=duration,x1,y1,x2,y2 (e.g. 400,.5,0,.15,1).
              'var vtt=/[?&]vttiming=([^&]+)/.exec(location.search);' +
              'if(vtt)window.__RAMKA_VT_TIMING__=decodeURIComponent(vtt[1]);',
          }}
        />
        <ThemeProvider>
          <TooltipProvider delay={150}>
            <div className="isolate flex min-h-screen">
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
