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

const title = 'ramka';
const description = 'Unstyled, accessible image gallery primitives for React.';

export const viewport: Viewport = {
  themeColor: '#0A0A0A',
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
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
    siteName: title,
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
        {/* Whop pixel (business biz_k1Wgt8FGamwpvh), verbatim from Whop's
            install snippet. Inline rather than next/script so it runs on the
            first paint of every full page load; it appends its own async
            <script> for t.whop.tw. Note this fires one "page" event per
            document load, not per client-side route change. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              '!function(w,d,s,u,n,a,b){if(w[n])return;a=w[n]={q:[],t:+new Date,s:[],o:u,track:function(){a.q.push([+new Date].concat([].slice.call(arguments)))},setScope:function(){a.s=[].slice.call(arguments).filter(function(x){return typeof x==="string"});a.q.push([+new Date,"setScope"].concat(a.s))},scope:function(){var c=[].slice.call(arguments);return{track:function(){a.q.push([+new Date].concat([].slice.call(arguments)).concat([{__scope:c}]))}}}};b=d.createElement(s);b.async=1;b.src=u+"/s.js";d.getElementsByTagName(s)[0].parentNode.insertBefore(b,d.getElementsByTagName(s)[0])}(window,document,"script","https://t.whop.tw","whop");whop.setScope("biz_k1Wgt8FGamwpvh");whop.track("page");',
          }}
        />
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
