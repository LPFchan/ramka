import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';

import { ThemeProvider } from './_components/theme-provider';
import { siteUrl } from './_content/site';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

const title = 'ramka — The lightbox for React';
const description =
  'Headless React lightbox with View Transitions morph animations, pinch to zoom, swipe navigation, and pull to dismiss. Unstyled, accessible image gallery primitives built on native scrolling.';

export const viewport: Viewport = {
  themeColor: '#0A0A0A',
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  // Pages that set their own title get "<title> — ramka"; the homepage and
  // pages without one get the keyword-carrying default.
  title: {
    default: title,
    template: '%s — ramka',
  },
  description,
  // Emits a per-page canonical resolved against `metadataBase` (the apex
  // domain), so even if a duplicate host or query-string URL gets crawled,
  // Google consolidates signals onto the canonical apex URL.
  alternates: {
    canonical: './',
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
    ],
    apple: { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    other: [
      {
        rel: 'mask-icon',
        url: '/safari-pinned-tab.svg',
        color: '#0A0A0A',
      },
    ],
  },
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: 'ramka',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
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
      {/* Next streams metadata `manifest` into the body; Chrome only sees a
          parser-head <link rel="manifest">. `app/manifest.ts` serves the JSON. */}
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
      </head>
      {/*
        Base UI portal stacking: `position: relative` on body (iOS 26+ absolute
        backdrops) + `isolation: isolate` on the app root so portaled overlays
        sit above page content without competing with in-app z-index values.
      */}
      <body className="relative min-h-screen bg-background text-foreground antialiased">
        {/* No Whop pixel: it stores browser identifiers, which under ePrivacy
            rules would need a prior-consent banner. Cookieless Vercel
            Analytics (below) is the only measurement. */}
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
              'if(/[?&]vtab=k2/.test(location.search))window.__RAMKA_VT_COMPOSITED__=true;',
          }}
        />
        <ThemeProvider>
          <TooltipProvider delay={150}>{children}</TooltipProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
