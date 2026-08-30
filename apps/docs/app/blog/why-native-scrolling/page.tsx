import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';

import { ArrowLeft, ArrowRight } from 'lucide-react';

import { KbdGroup, KbdIcon } from '@/components/ui/kbd';

import { CodeBlock } from '../../_components/code-block';
import { LandingDemo } from '../../_components/landing-demo';
import { SiteFooter } from '../../_components/site-footer';
import { SiteHeader } from '../../_components/site-header';
import { siteUrl } from '../../_content/site';
import { JankPlayground } from './jank-playground';
import { MomentumLab } from './momentum-lab';

const PUBLISHED = '2026-08-29';

const seoTitle = 'Why native scrolling beats transform carousels';
const seoDescription =
  'Most React lightboxes and image carousels emulate scrolling with transforms on the main thread, where swiping janks. How native scrolling and CSS scroll snap fix it.';

export const metadata: Metadata = {
  title: seoTitle,
  description: seoDescription,
  // The root layout's Open Graph / Twitter objects describe the homepage and
  // are inherited wholesale (Next.js does not deep-merge them), so each
  // article must emit its own social metadata.
  openGraph: {
    title: `${seoTitle} — ramka`,
    description: seoDescription,
    url: `${siteUrl}/blog/why-native-scrolling`,
    siteName: 'ramka',
    type: 'article',
    publishedTime: PUBLISHED,
    authors: ['Artur Bień'],
    locale: 'en_US',
    // The site-wide social card. Defining `openGraph` here replaces the whole
    // inherited object, so the root `opengraph-image` file no longer cascades —
    // reference it explicitly. Alt text matches the generic image; it is not an
    // article-specific graphic.
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: 'ramka — the lightbox for React' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${seoTitle} — ramka`,
    description: seoDescription,
    images: [{ url: '/twitter-image.png', alt: 'ramka — the lightbox for React' }],
  },
};

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: 'Why native scrolling beats transform carousels',
  description:
    'Why swiping in most web lightboxes feels subtly wrong: transform-emulated carousels tie every frame to the main thread, while browsers can process native scrolling on a compositor thread. With measurements from Chrome, web.dev case studies, and interactive demos.',
  url: `${siteUrl}/blog/why-native-scrolling`,
  datePublished: PUBLISHED,
  author: { '@type': 'Person', name: 'Artur Bień' },
  keywords:
    'react lightbox, image gallery, photo gallery, image carousel, image slider, native scrolling, CSS scroll snap, carousel performance, main thread jank',
};

const carouselCode = `// The heart of nearly every JS carousel, simplified.
el.addEventListener('pointermove', (e) => {
  offset += e.clientX - lastX;
  lastX = e.clientX;
  track.style.transform = \`translateX(\${offset}px)\`;
});

el.addEventListener('pointerup', () => {
  requestAnimationFrame(function fling() {
    velocity *= 0.95; // the reverse-engineered iOS constant
    offset += velocity;
    track.style.transform = \`translateX(\${offset}px)\`;
    if (Math.abs(velocity) > 0.1) requestAnimationFrame(fling);
  });
});`;

const slidesCode = `/* The scroll core of ramka's Slides, shown as CSS.
   (ramka applies these as inline styles.) */
[data-ramka-slides] {
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scroll-snap-type: x mandatory;
}

[data-ramka-slide] {
  scroll-snap-align: center;
  scroll-snap-stop: always;
}`;

const slidesJsxCode = `<Lightbox.Slides aria-label="Photos">
  {items.map((item, i) => (
    <Lightbox.Slide key={item.id}>
      <Lightbox.Item index={i}>…</Lightbox.Item>
    </Lightbox.Slide>
  ))}
</Lightbox.Slides>`;

function Prose({ children }: { children: ReactNode }) {
  return <p className="mt-5 text-pretty text-[15px] leading-7 text-neutral-600 dark:text-neutral-400">{children}</p>;
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-12 text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">{children}</h2>
  );
}

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={inlineLinkClassName}>
      {children}
    </a>
  );
}

const inlineLinkClassName =
  'font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-2 transition hover:decoration-neutral-500 dark:text-neutral-50 dark:decoration-neutral-700 dark:hover:decoration-neutral-500';

export default function WhyNativeScrollingPage() {
  return (
    <div className="isolate flex min-h-screen flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <SiteHeader home />

      <main className="flex-1">
        <article className="mx-auto w-full max-w-2xl px-6 pt-16 pb-20 md:pt-20 md:pb-24">
          <p className="text-[13px] font-medium tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
            <time dateTime={PUBLISHED}>August 29, 2026</time>
          </p>
          <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-neutral-950 md:text-4xl dark:text-neutral-50">
            Why native scrolling beats transform carousels
          </h1>
          <p className="mt-5 text-pretty text-[17px] leading-7 text-neutral-500 dark:text-neutral-400">
            Swipe through photos in your phone's gallery app and they stick to your finger. Swipe through most web
            lightboxes and something is off. You probably can't name it, but your thumb knows. This post is about what
            your thumb knows.
          </p>

          <Prose>
            The footer of the{' '}
            <Link href="/" className={inlineLinkClassName}>
              ramka
            </Link>{' '}
            landing page jokes that proceeds fund the ongoing fight against scroll emulation. This is the serious
            version of that joke. It's the story of a decision most carousel and lightbox libraries made years ago, what
            it costs, and why{' '}
            <Link href="/docs/lightbox" className={inlineLinkClassName}>
              ramka's slides
            </Link>{' '}
            are built on a boring real scroller instead.
          </Prose>

          <Prose>
            The short answer, for the impatient: native scrolling is more resilient than a transform-driven JavaScript
            carousel because browsers can process eligible scrolls on a compositor or dedicated scrolling thread,
            without waiting for main-thread JavaScript. And it keeps each platform's own momentum, overscroll and input
            handling instead of re-creating them in an animation loop. The rest of this post is the evidence.
          </Prose>

          <Prose>Let's start with the demo, because the demo is the whole argument.</Prose>

          <JankPlayground />

          <Heading>Browsers scroll on a different thread</Heading>
          <Prose>
            Scrolling is the single interaction browser engineers have spent the most years protecting. In Chromium's
            architecture, eligible scrolls run on the compositor thread, so they don't have to wait for JavaScript. The
            Chrome team's own <Ext href="https://developer.chrome.com/docs/chromium/renderingng">RenderingNG docs</Ext>{' '}
            hold it up as their flagship example of performance isolation: even on pages full of slow JavaScript,
            scrolling stays smooth, because it doesn't have to ask the main thread for permission to move.
          </Prose>
          <Prose>
            That's what you saw in the demo above. The busy-wait blocks React, blocks timers, blocks
            requestAnimationFrame, blocks everything you can write in JavaScript. The native strip doesn't care. The
            browser keeps rasterized tiles of that scroller cached on the GPU, and moving them is a matter of changing
            an offset on a thread your code cannot touch.
          </Prose>
          <Prose>
            Firefox and Safari have their own versions of the same design: Gecko documents its{' '}
            <Ext href="https://firefox-source-docs.mozilla.org/gfx/AsyncPanZoom.html">
              asynchronous panning and zooming
            </Ext>{' '}
            architecture, and WebKit runs a dedicated{' '}
            <Ext href="https://docs.webkit.org/Ports/WebKitGTK%20and%20WPE%20WebKit/Graphics.html">
              scrolling thread
            </Ext>
            . This is not a Chrome trick, it's fifteen years of engine work across every vendor, and every page gets it
            for free. The word "eligible" is doing honest work, though: a page can forfeit the fast path. Blocking touch
            or wheel listeners in the wrong place, or effects that make scrolling depend on layout, drag it back to the
            main thread. Which brings us to what carousels do.
          </Prose>

          <Heading>What a transform carousel opts into</Heading>
          <Prose>
            Most JavaScript carousels and image sliders, and most lightbox swipe implementations, don't scroll. They
            listen to pointer events, translate a flex row with <code className="text-[13px]">transform</code>, and when
            your finger lifts, they run their own physics in a requestAnimationFrame loop:
          </Prose>
          <div className="mt-5">
            <CodeBlock code={carouselCode} lang="typescript" title="Scroll emulation, the standard recipe" />
          </div>
          <Prose>
            There's nothing incompetent about this code, and the problem is not the{' '}
            <code className="text-[13px]">transform</code> property. A committed transform is composited; a CSS
            transition or Web Animations fling that JavaScript kicks off once can even keep running while the main
            thread stalls. The problem is who owns the gesture: in the recipe above, JavaScript re-decides the position
            on every frame, so every frame of the drag and the fling is a main-thread callback, scheduled between
            whatever else the page is doing. On a lightbox, "whatever else" has terrible timing. The exact moment you
            start swiping is the moment the next full-resolution photo triggers fetches, state updates and rendering
            work, and much of that lands exactly where the fling's callbacks need to run.
          </Prose>
          <Prose>
            And the cost starts before the first frame. Chrome's telemetry on Android found that{' '}
            <Ext href="https://developer.chrome.com/blog/scrolling-intervention">
              around 80 percent of touch listeners that block scrolling never actually prevent it
            </Ext>
            , yet the browser had to wait for them anyway. In{' '}
            <Ext href="https://github.com/WICG/EventListenerOptions/blob/gh-pages/explainer.md">
              10 percent of those scrolls the waiting added over 100 milliseconds
            </Ext>{' '}
            before anything moved, and in 1 percent it added more than half a second. When Chrome 56 started treating
            root touch listeners as passive by default, the slowest 1 percent of scroll starts across the Android web
            dropped from just over 400 milliseconds to about 250, a 38 percent cut from one intervention, with no site
            changing a line of code. Those are page-scrolling numbers, not carousel numbers, but they measure the same
            tax the carousel recipe pays by design: input that has to wait for JavaScript.
          </Prose>

          <Heading>The physics you cannot fake</Heading>
          <Prose>
            Say the main thread is quiet and every frame lands. The fling still has to feel right, and here the
            emulation chase gets genuinely funny. People have spent years reverse-engineering Apple's scroll feel:{' '}
            <Ext href="https://ariya.io/2013/11/javascript-kinetic-scrolling-part-2">
              momentum decays by a factor of about 0.95 per frame
            </Ext>{' '}
            at 60 frames per second, a 325 millisecond time constant. The rubber band at the edge follows a formula with
            a 0.55 coefficient that Apple never published at all: it was{' '}
            <Ext href="https://gist.github.com/originell/6961057">pulled out of UIScrollView</Ext> and has been passed
            around in tweets and gists ever since. These are snapshots of one historical iOS implementation, and whole
            libraries exist to ship them to production as if they were the spec.
          </Prose>

          <MomentumLab />

          <Prose>
            Here's the trap: even a perfect clone is a snapshot of one platform's physics for one input device. A
            trackpad two-finger fling, a mouse wheel notch, and a thumb swipe feel completely different in a native
            scroller, because the OS tunes each one. The emulated version flattens them into a single curve, calibrated
            on the developer's own laptop. And when the OS updates its feel, native scrollers update with it. The magic
            numbers don't.
          </Prose>
          <Prose>
            Overscroll makes the point visually. Below is the same ramka lightbox pulled past its first photo in Safari
            on an iPhone and in Chrome on an Android phone. iOS answers with its rubber band. Android answers with the
            stretch effect it introduced in Android 12. Neither behavior exists anywhere in ramka's code. The slides are
            a real scroller, so the edge belongs to the browser and the OS, and each platform speaks its own dialect. An
            emulated carousel ships one hardcoded rubber band to everyone and hopes iPhone physics feel right on a
            Pixel.
          </Prose>
          <figure className="mt-8">
            <video
              className="w-full rounded-2xl border border-neutral-200 dark:border-neutral-800"
              width={1100}
              height={1036}
              autoPlay
              loop
              muted
              playsInline
              aria-label="The same ramka lightbox overscrolled past its first photo on an iPhone and an Android phone, showing each platform's native edge behavior"
            >
              <source src="/blog/overscroll-ios-vs-android.mp4" type="video/mp4" />
            </video>
            <figcaption className="mt-3 text-center text-[13px] leading-6 text-neutral-400 dark:text-neutral-500">
              Same lightbox, zero platform-specific code. iOS rubber-bands, Android stretches.
            </figcaption>
          </figure>

          <Heading>What this costs, in numbers</Heading>
          <Prose>
            Nobody publishes an A/B test titled "we replaced our transform carousel with native scroll," so I won't
            pretend one exists. What's published is the next best thing: what happens to businesses when they take work
            off the main thread.
          </Prose>
          <Prose>
            <Ext href="https://web.dev/case-studies/redbus-inp">redBus</Ext> traced poor responsiveness on their search
            page partly to a scroll listener scheduling piles of main-thread work. That fix, together with the rest of
            their responsiveness effort, cut the page's Interaction to Next Paint by 72 percent, and the INP effort as a
            whole lifted sales by 7 percent. <Ext href="https://web.dev/case-studies/quintoandar-inp">QuintoAndar</Ext>{' '}
            cut INP by 80 percent across a broad main-thread cleanup and saw conversions grow 36 percent year over year.{' '}
            <Ext href="https://web.dev/case-studies/trendyol-inp">Trendyol</Ext> halved INP by breaking up long
            main-thread tasks and measured a 1 percent click-through uplift in an A/B test. Main-thread contention is
            not an aesthetic concern. It shows up in revenue, and these companies did the accounting.
          </Prose>
          <Prose>
            The pattern is old, too. When Pinterest{' '}
            <Ext href="https://medium.com/dev-channel/a-pinterest-progressive-web-app-performance-case-study-3bd6ed2e6154">
              rebuilt their mobile web experience
            </Ext>{' '}
            around a leaner main thread in 2017, time on site went up 40 percent and core engagement 60 percent. None of
            these are "native scrolling" studies. They're all the same lesson: the main thread is where responsiveness
            goes to die, and the winning move is to give it less to do. A swipe engine is main thread work you can
            delete entirely.
          </Prose>

          <Heading>Everything else real scroll gives you</Heading>
          <Prose>
            The performance argument gets the headlines, but the freebies might matter more. A real scroller mirrors
            itself in right-to-left layouts, respects <code className="text-[13px]">overscroll-behavior</code>, shows a
            scrollbar when your design wants one, and keeps absorbing whatever input hardware ships next, all maintained
            by browser vendors, forever. A transform carousel reimplements each of those by hand or ships without them.
          </Prose>
          <Prose>
            Two things you might expect on that list are pointedly <em>not</em> free, and pretending otherwise is how
            carousels get bad reputations. A scroll container is only keyboard-operable once something in it can take
            focus — Chrome didn't make plain scrollers{' '}
            <Ext href="https://developer.chrome.com/blog/keyboard-focusable-scrollers">
              keyboard-focusable by default
            </Ext>{' '}
            until 2024 — which is why ramka's dialog takes focus itself and drives the scroller from Arrow, Home and
            End. And a screen reader gets no carousel semantics from an overflowing div; the naming and slide structure
            are still your work. That half of the story got{' '}
            <Link href="/blog/lightbox-accessibility" className={inlineLinkClassName}>
              its own post on lightbox accessibility
            </Link>
            , and so did{' '}
            <Link href="/blog/headless-lightbox" className={inlineLinkClassName}>
              the headless API shape
            </Link>{' '}
            that leaves every visible element yours to render.
          </Prose>
          <Prose>
            My favorite freebie is one we noticed while profiling, and it's an observation, not documented behavior: on
            the iPhones we tested, Safari's Low Power Mode throttles the main thread — and with it requestAnimationFrame
            — to 30 frames per second, while compositor-driven scrolling keeps rendering at 60. A JavaScript fling
            literally halves its frame rate when the user's battery gets low. A native one doesn't notice.
          </Prose>

          <Heading>Can CSS scroll snap replace a JavaScript carousel?</Heading>
          <Prose>
            This is usually where the objections start — "but native scroll can't do X" — so let me go through the X's
            that made lightbox authors reach for emulation in the first place.
          </Prose>
          <Prose>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Snapping to slides.</strong> Solved
            in CSS: <Ext href="https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll_snap">scroll snap</Ext> has
            been cross-browser since 2019, <code className="text-[13px]">scroll-snap-stop</code> — which keeps a hard
            fling from skipping slides — since 2022, and the snap animation belongs to the browser, driven by the same
            machinery as the fling:
          </Prose>
          <div className="mt-5">
            <CodeBlock code={slidesCode} lang="css" title="Native slide snapping" />
          </div>
          <Prose>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">
              Tracking the active slide, navigating programmatically.
            </strong>{' '}
            Scroll position is state you can read and write. That CSS is genuinely the heart of it; what remains is
            bookkeeping, and ramka does it for you: it wires the active index, the{' '}
            <KbdGroup>
              <KbdIcon label="Left arrow">
                <ArrowLeft />
              </KbdIcon>
              <KbdIcon label="Right arrow">
                <ArrowRight />
              </KbdIcon>
            </KbdGroup>{' '}
            keys, and next/previous buttons to the scroller rather than around it, and the swipe itself stays untouched:
          </Prose>
          <div className="mt-5">
            <CodeBlock code={slidesJsxCode} title="Slides in ramka" />
          </div>
          <Prose>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Gestures on top.</strong> The real
            reason lightboxes emulate: pinch to zoom and pull to dismiss need pointer tracking, and once you're tracking
            pointers it's tempting to own the horizontal axis too. ramka draws the line differently. Zoom and pull are
            their own engines, lazy-loaded and layered over the scroller with{' '}
            <Link href="/docs/lightbox/gestures" className={inlineLinkClassName}>
              careful rules about who owns which axis
            </Link>
            , and the horizontal swipe is never intercepted. The browser keeps the part it does best.
          </Prose>
          <Prose>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">
              Inputs you forgot to support.
            </strong>{' '}
            Here is a side effect of drag emulation that rarely makes the bug tracker: drag engines listen for pointer
            events, but a two-finger trackpad swipe emits wheel events, so in a surprising number of drag-driven
            carousels the trackpad does nothing at all. Patching it means adding a wheel handler, and that handler has
            to be non-passive so it can <code className="text-[13px]">preventDefault</code> the page&rsquo;s own
            scrolling. A non-passive wheel listener forces the browser to wait for your JavaScript before it can scroll
            anything, which hauls wheel input back onto the main thread, the exact place this whole article has been
            trying to leave. A real scroller skips the dilemma: trackpad swipe, Shift plus mouse wheel, tilt wheels,
            touch, and pen input all work because the browser already routes scroll input to scrollers. Drag-first input
            has an accessibility cost too, and that half of the story is in{' '}
            <Link href="/blog/lightbox-accessibility" className={inlineLinkClassName}>
              the accessibility post
            </Link>
            .
          </Prose>

          <Prose>Side by side, the two architectures divide the work like this:</Prose>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-left text-[13px] leading-6">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-900 dark:border-neutral-800 dark:text-neutral-50">
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    Capability
                  </th>
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    Native scrolling
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    JavaScript momentum carousel
                  </th>
                </tr>
              </thead>
              <tbody className="text-neutral-600 dark:text-neutral-400">
                {(
                  [
                    ['Momentum', 'Platform-provided', 'Application-defined'],
                    ['Main-thread stalls', 'Eligible scrolling continues', 'JS-driven frames stall'],
                    ['Trackpad and wheel', 'Native scroll inputs', 'Requires explicit handling'],
                    ['Overscroll', 'Platform and browser behavior', 'Usually simulated'],
                    ['Slide snapping', 'CSS scroll snap', 'Custom navigation and physics'],
                    ['RTL and semantics', 'Native foundation, still needs author work', 'Built by hand'],
                  ] as const
                ).map(([capability, native, emulated]) => (
                  <tr key={capability} className="border-b border-neutral-100 dark:border-neutral-900">
                    <th scope="row" className="py-2 pr-4 font-medium text-neutral-800 dark:text-neutral-200">
                      {capability}
                    </th>
                    <td className="py-2 pr-4">{native}</td>
                    <td className="py-2">{emulated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Heading>Feel it in a real lightbox</Heading>
          <Prose>
            Here's the full thing: morphing open, native swipe between slides, pinch to zoom, pull to dismiss. Every
            horizontal movement you feel in the viewer is a real scroller.
          </Prose>

          <div className="mt-8">
            <LandingDemo eager={false} />
          </div>

          <Prose>
            If you're building a React image gallery or lightbox, this is what ramka is: composable lightbox primitives
            on a native scroller, with pinch to zoom and pull to dismiss layered on top. The{' '}
            <Link href="/docs/lightbox" className={inlineLinkClassName}>
              React lightbox docs
            </Link>{' '}
            take about ten minutes, the{' '}
            <Link href="/docs/lightbox/gestures" className={inlineLinkClassName}>
              gestures guide
            </Link>{' '}
            covers how the scroll, zoom, and dismiss layers coexist, and the{' '}
            <Link href="/presets/default" className={inlineLinkClassName}>
              image gallery presets
            </Link>{' '}
            are complete viewers to copy. ramka is free for open source under the GPL, and{' '}
            <Link href="/license" className={inlineLinkClassName}>
              one payment
            </Link>{' '}
            covers proprietary use for your whole team. The fight against scroll emulation accepts contributions either
            way.
          </Prose>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
