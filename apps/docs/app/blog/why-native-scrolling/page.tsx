import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';

import { Kbd, KbdGroup } from '@/components/ui/kbd';

import { CodeBlock } from '../../_components/code-block';
import { LandingDemo } from '../../_components/landing-demo';
import { SiteFooter } from '../../_components/site-footer';
import { SiteHeader } from '../../_components/site-header';
import { siteUrl } from '../../_content/site';
import { JankPlayground } from './jank-playground';
import { MomentumLab } from './momentum-lab';

export const metadata: Metadata = {
  title: 'Why native scrolling beats transform carousels',
  description:
    'Most React lightboxes and carousels reimplement scrolling with pointer events and transforms. That moves swiping onto the main thread, where it janks. The data, the browser internals, and the interactive proof.',
};

const PUBLISHED = '2026-08-29';

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: 'Why native scrolling beats transform carousels',
  description:
    'Why swiping in most web lightboxes feels subtly wrong: transform-emulated carousels run on the main thread, native scrolling runs on the compositor. With measurements from Chrome, web.dev case studies, and interactive demos.',
  url: `${siteUrl}/blog/why-native-scrolling`,
  datePublished: PUBLISHED,
  author: { '@type': 'Person', name: 'Artur Bień' },
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

const slidesCode = `/* What ramka's Slides actually render. This is the whole trick. */
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
            Why native scrolling
          </h1>
          <p className="mt-5 text-pretty text-[17px] leading-7 text-neutral-500 dark:text-neutral-400">
            Swipe through photos in your phone's gallery app and they stick to your finger. Swipe through most web
            lightboxes and something is off. You probably can't name it, but your thumb knows. This post is about
            what your thumb knows.
          </p>

          <Prose>
            The footer of the <Link href="/" className={inlineLinkClassName}>ramka</Link> landing page jokes that
            proceeds fund the ongoing fight against scroll emulation. This is the serious version of that joke.
            It's the story of a decision most carousel and lightbox libraries made years ago, what it costs, and
            why <Link href="/docs/lightbox" className={inlineLinkClassName}>ramka's slides</Link> are built on a
            boring real scroller instead.
          </Prose>

          <Prose>Let's start with the demo, because the demo is the whole argument.</Prose>

          <JankPlayground />

          <Heading>Browsers scroll on a different thread</Heading>
          <Prose>
            Scrolling is the single interaction browser engineers have spent the most years protecting. In
            Chromium's architecture it runs on the compositor thread, completely isolated from JavaScript. The
            Chrome team's own{' '}
            <Ext href="https://developer.chrome.com/docs/chromium/renderingng">RenderingNG docs</Ext> hold it up as
            their flagship example of performance isolation: even on pages full of slow JavaScript, scrolling
            stays smooth, because it never has to ask the main thread for permission to move.
          </Prose>
          <Prose>
            That's what you saw in the demo above. The busy-wait blocks React, blocks timers, blocks
            requestAnimationFrame, blocks everything you can write in JavaScript. The native strip doesn't care.
            The browser has a rasterized texture of that scroller sitting on the GPU, and moving it is a matter of
            changing an offset on a thread your code cannot touch.
          </Prose>
          <Prose>
            Firefox and Safari have equivalent architectures. This is not a Chrome trick, it's fifteen years of
            engine work across every vendor, and every page gets it for free. Unless it opts out.
          </Prose>

          <Heading>What a transform carousel opts into</Heading>
          <Prose>
            Most JavaScript carousels, and most lightbox swipe implementations, don't scroll. They listen to
            pointer events, translate a flex row with <code className="text-[13px]">transform</code>, and when your
            finger lifts, they run their own physics in a requestAnimationFrame loop:
          </Prose>
          <div className="mt-5">
            <CodeBlock code={carouselCode} lang="typescript" title="Scroll emulation, the standard recipe" />
          </div>
          <Prose>
            There's nothing incompetent about this code. The transform even runs on the compositor once it's
            committed. The problem is who commits it: every frame of that fling is a JavaScript callback on the
            main thread, scheduled between whatever else the page is doing. On a lightbox, "whatever else" has
            terrible timing. The exact moment you start swiping is the moment the next full-resolution photo is
            being fetched, decoded, and rendered.
          </Prose>
          <Prose>
            And the cost starts before the first frame. Chrome's telemetry found that{' '}
            <Ext href="https://developer.chrome.com/blog/scrolling-intervention">
              around 80 percent of touch listeners that block scrolling never actually prevent it
            </Ext>
            , yet the browser had to wait for them anyway. In{' '}
            <Ext href="https://github.com/WICG/EventListenerOptions/blob/gh-pages/explainer.md">
              10 percent of those scrolls the waiting added over 100 milliseconds
            </Ext>{' '}
            before anything moved, and in 1 percent it added more than half a second. When Chrome 56 started
            treating root touch listeners as passive by default, worst-case scroll start latency across the
            entire Android web dropped by about 38 percent. One intervention, no site changed a line of code.
            That's how much JavaScript was sitting between fingers and pixels.
          </Prose>

          <Heading>The physics you cannot fake</Heading>
          <Prose>
            Say the main thread is quiet and every frame lands. The fling still has to feel right, and here the
            emulation chase gets genuinely funny. People have spent years reverse-engineering Apple's scroll
            feel:{' '}
            <Ext href="https://ariya.io/2013/11/javascript-kinetic-scrolling-part-2">
              momentum decays by a factor of about 0.95 per frame
            </Ext>
            , a 325 millisecond time constant. The rubber band at the edge follows a formula with a 0.55
            coefficient that Apple eventually published themselves in the Designing Fluid Interfaces sample code.
            Whole libraries exist to ship these magic numbers to production.
          </Prose>

          <MomentumLab />

          <Prose>
            Here's the trap: even a perfect clone is a snapshot of one platform's physics for one input device.
            A trackpad two-finger fling, a mouse wheel notch, and a thumb swipe feel completely different in a
            native scroller, because the OS tunes each one. The emulated version flattens them into a single
            curve, calibrated on the developer's own laptop. And when the OS updates its feel, native scrollers
            update with it. The magic numbers don't.
          </Prose>
          <Prose>
            Overscroll makes the point visually. Below is the same ramka lightbox pulled past its first photo on
            an iPhone and on an Android phone. iOS answers with its rubber band. Android answers with the
            stretch effect it has shipped since Android 12. Neither behavior exists anywhere in ramka's code.
            The slides are a real scroller, so the edge belongs to the OS, and each platform speaks its own
            dialect. An emulated carousel ships one hardcoded rubber band to everyone and hopes iPhone physics
            feel right on a Pixel.
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
            Nobody publishes an A/B test titled "we replaced our transform carousel with native scroll," so I
            won't pretend one exists. What's published is the next best thing: what happens to businesses when
            they get scroll-adjacent work off the main thread.
          </Prose>
          <Prose>
            <Ext href="https://web.dev/case-studies/redbus-inp">redBus</Ext> traced poor responsiveness on their
            search page partly to a scroll listener scheduling piles of main-thread work. Fixing that class of
            contention cut the page's Interaction to Next Paint by 72 percent, and the INP effort as a whole
            lifted sales by 7 percent. <Ext href="https://web.dev/case-studies/quintoandar-inp">QuintoAndar</Ext>{' '}
            cut INP by 80 percent and saw conversions grow 36 percent year over year.{' '}
            <Ext href="https://web.dev/case-studies/trendyol-inp">Trendyol</Ext> halved INP and measured a 1
            percent click-through uplift in an A/B test. Main-thread contention is not an aesthetic concern. It
            shows up in revenue, and these companies did the accounting.
          </Prose>
          <Prose>
            The pattern is old, too. When Pinterest{' '}
            <Ext href="https://medium.com/dev-channel/a-pinterest-progressive-web-app-performance-case-study-3bd6ed2e6154">
              rebuilt their mobile web experience
            </Ext>{' '}
            around a leaner main thread in 2017, time on site went up 40 percent and core engagement 60 percent.
            None of these are "native scrolling" studies. They're all the same lesson: the main thread is where
            responsiveness goes to die, and the winning move is to give it less to do. A swipe engine is main
            thread work you can delete entirely.
          </Prose>

          <Heading>Everything else real scroll gives you</Heading>
          <Prose>
            The performance argument gets the headlines, but the freebies might matter more. A real scroller
            comes with keyboard support, screen reader behavior, visible scrollbars for people who want them, RTL
            mirroring, <code className="text-[13px]">overscroll-behavior</code>, scroll anchoring, and reduced
            motion handling, all maintained by browser vendors, forever. A transform carousel reimplements each
            of those by hand or ships without them. The assistive technology half of that story got{' '}
            <Link href="/blog/lightbox-accessibility" className={inlineLinkClassName}>
              its own post
            </Link>
            .
          </Prose>
          <Prose>
            My favorite freebie is one we found while profiling: in Safari's Low Power Mode the main thread ticks
            at 30 frames per second, but compositor-driven work keeps running at 60. A JavaScript fling literally
            halves its frame rate when the user's battery gets low. A native one doesn't notice.
          </Prose>

          <Heading>"But native scroll can't do X"</Heading>
          <Prose>
            This is usually where the objections start, so let me go through the ones that made lightbox authors
            reach for emulation in the first place.
          </Prose>
          <Prose>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Snapping to slides.</strong>{' '}
            Solved in CSS since 2019, and the snap physics run on the compositor too:
          </Prose>
          <div className="mt-5">
            <CodeBlock code={slidesCode} lang="css" title="Native slide snapping" />
          </div>
          <Prose>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Tracking the active slide,
            navigating programmatically.</strong> Scroll position is state you can read and write. ramka wires
            the active index, the{' '}
            <KbdGroup>
              <Kbd>←</Kbd>
              <Kbd>→</Kbd>
            </KbdGroup>{' '}
            keys, and next/previous buttons to the scroller rather than around it, and
            the swipe itself stays untouched:
          </Prose>
          <div className="mt-5">
            <CodeBlock code={slidesJsxCode} title="Slides in ramka" />
          </div>
          <Prose>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Gestures on top.</strong> The
            real reason lightboxes emulate: pinch to zoom and pull to dismiss need pointer tracking, and once
            you're tracking pointers it's tempting to own the horizontal axis too. ramka draws the line
            differently. Zoom and pull are their own engines, lazy-loaded and layered over the scroller with{' '}
            <Link href="/docs/lightbox/gestures" className={inlineLinkClassName}>
              careful rules about who owns which axis
            </Link>
            , and the horizontal swipe is never intercepted. The browser keeps the part it does best. A side
            effect worth noticing: because the swipe is a real scroll, a two-finger trackpad swipe just works,
            an input plenty of drag-driven carousels never receive at all, since trackpads emit wheel events
            rather than the pointer events their drag code listens for.
          </Prose>

          <Heading>Feel it in a real lightbox</Heading>
          <Prose>
            Here's the full thing: morphing open, native swipe between slides, pinch to zoom, pull to dismiss.
            Every horizontal movement you feel in the viewer is a real scroller.
          </Prose>

          <div className="mt-8">
            <LandingDemo eager={false} />
          </div>

          <Prose>
            If you're building a gallery, the{' '}
            <Link href="/docs" className={inlineLinkClassName}>docs</Link> take about ten minutes, and the{' '}
            <Link href="/docs/lightbox/gestures" className={inlineLinkClassName}>gestures guide</Link> covers how
            the scroll, zoom, and dismiss layers coexist. ramka is free for open source under the GPL, and{' '}
            <Link href="/license" className={inlineLinkClassName}>one payment</Link> covers proprietary use for
            your whole team. The fight against scroll emulation accepts contributions either way.
          </Prose>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
