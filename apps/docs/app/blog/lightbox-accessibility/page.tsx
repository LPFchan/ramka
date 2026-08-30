import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';

import { ArrowLeft, ArrowRight, Command, Minus, Plus } from 'lucide-react';

import { Kbd, KbdGroup, KbdIcon } from '@/components/ui/kbd';

import { CodeBlock } from '../../_components/code-block';
import { LandingDemo } from '../../_components/landing-demo';
import { SiteFooter } from '../../_components/site-footer';
import { SiteHeader } from '../../_components/site-header';
import { siteUrl } from '../../_content/site';
import { FocusTrapDemo } from './focus-trap-demo';
import { SrSimulator } from './sr-simulator';

const PUBLISHED = '2026-08-29';

// The document title targets the search topic; the visible H1 below keeps the
// editorial headline. The layout template appends " — ramka".
const seoTitle = 'Lightbox accessibility: focus, screen readers and WCAG';
const seoDescription =
  'Learn how an accessible React lightbox handles focus traps, screen reader announcements, keyboard navigation, inert slides and reduced motion. With live demos.';

export const metadata: Metadata = {
  title: seoTitle,
  description: seoDescription,
  // The root layout's Open Graph / Twitter objects describe the homepage and
  // are inherited wholesale (Next.js does not deep-merge them), so each
  // article must emit its own social metadata.
  openGraph: {
    title: `${seoTitle} — ramka`,
    description: seoDescription,
    url: `${siteUrl}/blog/lightbox-accessibility`,
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
  headline: 'A lightbox screen readers can actually use',
  description:
    'What an accessible React lightbox actually requires: focus trapping and restoration, live regions for slide changes, inert slides, reduced motion, and honest notes on what remains hard. With interactive demos.',
  url: `${siteUrl}/blog/lightbox-accessibility`,
  datePublished: PUBLISHED,
  author: { '@type': 'Person', name: 'Artur Bień' },
  keywords:
    'accessible lightbox, accessible image gallery, react lightbox, photo gallery accessibility, focus trap, aria-live, screen reader, WCAG, modal dialog, aria-modal',
};

const guardsCode = `// Two invisible spans bracket the dialog. Tab past either edge and the
// guard hands focus back to the opposite end. This is the entire trap.
// Note what is *not* here: no aria-hidden. A focusable element must never
// be hidden from assistive tech (axe flags it as a serious violation) —
// an empty span announces nothing anyway, and focus never rests on it.
<span tabIndex={0} data-focus-guard onFocus={focusLastTabbable} />
<div role="dialog" aria-modal="true" tabIndex={-1}>
  {children}
</div>
<span tabIndex={0} data-focus-guard onFocus={focusFirstTabbable} />`;

const namingCode = `<Lightbox.Slides
  aria-label="Full-size images"
  // The library ships no copy for these; the words are yours to pass.
  // In a localized app they come from your translation catalogue.
  aria-roledescription="carousel"
>
  {items.map((item, i) => (
    <Lightbox.Slide key={item.id}>
      <Lightbox.Item
        index={i}
        aria-roledescription="slide"
        aria-label={\`\${i + 1} of \${items.length}\`}
      >
        …
      </Lightbox.Item>
    </Lightbox.Slide>
  ))}
</Lightbox.Slides>`;

const counterCode = `{/* Visible on mobile, where there is no thumbnail strip to show
    position. On desktop the strip covers that, so the counter
    collapses to sr-only and keeps only its announcement role. */}
<Lightbox.Counter className="text-xs md:sr-only">
  {({ current, total }) => \`\${current} of \${total}\`}
</Lightbox.Counter>`;

const reducedMotionCode = `// The morph never runs for users who asked for less motion.
// They get the plain fade instead; nothing to configure.
export function supportsViewTransitions(): boolean {
  return (
    typeof document !== 'undefined' &&
    'startViewTransition' in document &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}`;

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

export default function LightboxAccessibilityPage() {
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
            A lightbox screen readers can actually use
          </h1>
          <p className="mt-5 text-pretty text-[17px] leading-7 text-neutral-500 dark:text-neutral-400">
            Turn on VoiceOver and open a photo in a typical web lightbox. You hear &ldquo;image&rdquo;, maybe. Swipe to
            the next photo: nothing. Try to leave: <Kbd>Esc</Kbd> does nothing, and the close button announces itself as
            &ldquo;clickable&rdquo;.{' '}
            <Link href="/blog/why-native-scrolling" className={inlineLinkClassName}>
              The last post
            </Link>{' '}
            was about what your thumb knows. This one is about what a screen reader hears.
          </p>

          <Prose>
            The scale of the problem is measured annually.{' '}
            <Ext href="https://webaim.org/projects/million/">WebAIM&rsquo;s 2026 scan</Ext> of the top million homepages
            found automatically detectable WCAG 2 failures on 95.9 percent of them, averaging 56.1 errors per page. (An
            automated scan only catches the machine-testable failures, so the true rate is higher, not lower.) The same
            report repeats its most uncomfortable correlation: pages that use ARIA average significantly more detected
            errors than pages that don&rsquo;t, 59.1 versus 42. Correlation is not a verdict on ARIA, but it is a
            measure of how often ARIA is applied wrong, and wrong ARIA builds barriers plain HTML never had.
          </Prose>

          <Prose>
            The same scan breaks its results down by the JavaScript libraries it detected, and the gallery scripts
            cluster at the bad end of that table. Home pages running{' '}
            <Link href="/blog/story-of-the-lightbox" className={inlineLinkClassName}>
              the original 2005 Lightbox script
            </Link>{' '}
            averaged 25.7 percent more errors than the million-page mean; Slick 26.4 percent more, Swiper 31.8 percent
            more, FancyBox 60.3 percent more. A detected library is not proof it caused those errors, sites that reach
            for a carousel plugin differ in a hundred other ways. But the pattern you are reading about keeps company at
            the wrong end of the distribution. It also has money attached: at the time of writing, UsableNet&rsquo;s{' '}
            <Ext href="https://info.usablenet.com/hubfs/Remediated%20-%202025_Year-End_Digital_Accessibility_Lawsuit_Report_FINAL.pdf">
              year-end report
            </Ext>{' '}
            counts more than 5,000 ADA-related digital accessibility lawsuits filed in the US during 2025, and puts
            e-commerce, exactly where image galleries live, at about 70 percent of the industry breakdown. (Counts of
            filings, not a statement about who wins, and nothing here is legal advice.)
          </Prose>

          <Prose>
            None of this is because dialogs are mysterious. The{' '}
            <Ext href="https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/">W3C&rsquo;s dialog pattern</Ext> spells
            out the contract. An accessible React lightbox just happens to sit on the intersection of three hard things
            at once: it is a fullscreen modal dialog, an image carousel, and a gesture surface. Let&rsquo;s take them in
            order.
          </Prose>

          <Heading>Watch focus fall out of the dialog</Heading>
          <Prose>
            Start with the modal part, and with the failure you can see. When a lightbox opens, keyboard focus must move
            into it, stay inside while it is open, and return to the element that opened it when it closes. Skip the
            middle requirement and Tab walks straight out of the overlay into the page behind it, where a keyboard user
            is now operating invisible controls.
          </Prose>

          <FocusTrapDemo />

          <Prose>
            The trap itself is less code than its reputation suggests. ramka brackets the dialog with two invisible
            focus guards, the same sentinel technique Radix and Base UI use. Tab past the last control and the guard
            catches focus and hands it to the first one; Shift+Tab past the first and it lands on the last:
          </Prose>
          <div className="mt-5">
            <CodeBlock code={guardsCode} title="The sentinel trap" />
          </div>
          <Prose>
            The subtler half of the contract is the exit. When the lightbox closes, focus must return to the trigger,
            and here ramka does something I have not seen elsewhere: it remembers how you closed. Close with{' '}
            <Kbd>Esc</Kbd> or the keyboard and the trigger gets its focus ring back, because a keyboard user needs to
            see where they are. Close by clicking the backdrop or pulling the photo away and focus still returns, but
            without forcing a ring onto a screen where nobody is keyboarding. Modality-aware focus restoration, three
            lines of bookkeeping, and it makes both kinds of users feel like the thing was built for them.
          </Prose>

          <Heading>What a screen reader hears</Heading>
          <Prose>
            Focus is the failure you can see. The other one is silence. A lightbox built from divs announces nothing
            when it opens, nothing when the slide changes, and nothing when it closes; a screen reader user gets a click
            that appears to do nothing at all. The fix has two parts: real semantics on the container, and a live region
            for the thing that changes.
          </Prose>

          <SrSimulator />

          <Prose>
            The container part is the dialog contract again: <code className="text-[13px]">role="dialog"</code>,{' '}
            <code className="text-[13px]">aria-modal</code>, and an accessible name, so opening announces &ldquo;Photos,
            dialog&rdquo; instead of nothing. The changing part is the interesting one. Swiping to the next slide moves
            a scroller; no focus changes, so nothing announces itself. ramka&rsquo;s{' '}
            <code className="text-[13px]">Counter</code> primitive is the fix: it renders the &ldquo;2 of 9&rdquo; you
            can see, and it is also an <code className="text-[13px]">aria-live="polite"</code> region, so every slide
            change speaks. <code className="text-[13px]">Caption</code> announces the same way, and because both regions
            are polite they queue rather than interrupt: with both mounted, a slide change reads as the position, then
            the caption. If you would rather have a single voice, pass{' '}
            <code className="text-[13px]">aria-live="off"</code> to the one you want visual-only; your props win. Mount
            the Counter and navigation narrates itself; leave it out and it is silent, which is exactly what the demo
            above shows.
          </Prose>
          <Prose>
            The docs chrome uses a trick worth stealing: on desktop, the thumbnail strip already shows position, so a
            visible counter would be noise. Instead of unmounting it, the counter collapses to{' '}
            <code className="text-[13px]">sr-only</code> and keeps announcing:
          </Prose>
          <div className="mt-5">
            <CodeBlock code={counterCode} title="The counter you hear but do not see" />
          </div>
          <Prose>
            Off-screen slides get the opposite treatment. Every inactive slide is{' '}
            <code className="text-[13px]">inert</code> and <code className="text-[13px]">aria-hidden</code>, so a screen
            reader exploring the dialog finds one photo, not nine, and keyboard focus physically cannot wander into a
            slide you cannot see. ramka goes a step further and makes the zoom surface non-focusable precisely so that a
            slide being deactivated mid-gesture can never strand focus inside an inert subtree. That is the kind of edge
            case you only find by testing, and the kind a library should own so you never think about it.
          </Prose>
          <Prose>
            Two smaller pieces of the same structure are easy to miss. Thumbnails are a real{' '}
            <Ext href="https://www.w3.org/WAI/ARIA/apg/patterns/tabs/">tabs pattern</Ext>: a{' '}
            <code className="text-[13px]">tablist</code> of <code className="text-[13px]">tab</code>s with roving
            tabindex,{' '}
            <KbdGroup>
              <KbdIcon label="Left arrow">
                <ArrowLeft />
              </KbdIcon>
              <KbdIcon label="Right arrow">
                <ArrowRight />
              </KbdIcon>
            </KbdGroup>
            , <Kbd>Home</Kbd> and <Kbd>End</Kbd>, and the selection tracked from the active slide rather than from DOM
            focus, so swiping can never desync what the keyboard thinks is selected. And a refinement the dialog pattern
            does not require but disclosure buttons taught us to appreciate: the trigger that opened the lightbox
            carries <code className="text-[13px]">aria-haspopup="dialog"</code> and{' '}
            <code className="text-[13px]">aria-expanded</code>, on that specific element, so a screen reader user
            browsing a grid of twenty thumbnails can tell which one is currently open.
          </Prose>

          <Heading>Why ramka ships no English</Heading>
          <Prose>
            One thing ramka deliberately does not do: bake in default labels. There is no built-in{' '}
            <code className="text-[13px]">aria-label="Close"</code> on the close button, no &ldquo;carousel&rdquo;
            roledescription hard-coded on the slides. A comment in the source explains why: an English string baked into
            a primitive is wrong for most of the world. The numbers sketch who that world is. In{' '}
            <Ext href="https://webaim.org/projects/screenreadersurvey10/">
              WebAIM&rsquo;s tenth screen reader survey
            </Ext>{' '}
            (2024), NVDA leads in every surveyed region outside North America and Australia — Europe, Africa and the
            Middle East, and Asia — and 91.3 percent of respondents use a screen reader on a phone, where 70.6 percent
            of them reach for VoiceOver. Market share says nothing about the languages those users prefer; what it says
            is that a React primitive ships to a global, mostly mobile audience. A built-in English &ldquo;Close&rdquo;
            is wrong the moment the interface around it is not in English, and a primitive cannot know that. The
            application can. So ramka owns the semantic requirement, the button must have a name, and leaves the
            localized words to the application.
          </Prose>
          <Prose>
            So the words are yours, and the structure is the library&rsquo;s. In development, ramka warns when a dialog
            or an icon button has no accessible name, which keeps the contract visible without shipping anyone&rsquo;s
            locale. Passing it is a few attributes, following the{' '}
            <Ext href="https://www.w3.org/WAI/ARIA/apg/patterns/carousel/">APG carousel pattern</Ext>:
          </Prose>
          <Prose>
            Notice what makes this possible at all: every element in the viewer is one you render, so there is nothing
            you cannot label, describe, or hang a tooltip on. A config-object lightbox inverts that. You get whatever
            escape hatches its author remembered to expose, an <code className="text-[13px]">ariaLabelledby</code>{' '}
            option here, a <code className="text-[13px]">strings</code> map there, and anything they forgot is unfixable
            without a fork.{' '}
            <Link href="/blog/headless-lightbox" className={inlineLinkClassName}>
              The case for a headless lightbox
            </Link>{' '}
            makes that argument in full.
          </Prose>
          <div className="mt-5">
            <CodeBlock code={namingCode} title="Naming the carousel, your words" />
          </div>

          <Heading>Keyboard and motion</Heading>
          <Prose>
            The rest of the keyboard contract: <Kbd>Esc</Kbd> closes,{' '}
            <KbdGroup>
              <KbdIcon label="Left arrow">
                <ArrowLeft />
              </KbdIcon>
              <KbdIcon label="Right arrow">
                <ArrowRight />
              </KbdIcon>
            </KbdGroup>{' '}
            move between slides, <Kbd>Home</Kbd> and <Kbd>End</Kbd> jump to the ends,{' '}
            <KbdIcon label="Plus">
              <Plus />
            </KbdIcon>{' '}
            and{' '}
            <KbdIcon label="Minus">
              <Minus />
            </KbdIcon>{' '}
            zoom, and <Kbd>0</Kbd> resets. Two details are easy to get wrong. When the photo is zoomed in, ramka&rsquo;s
            arrow keys stop navigating and start panning, because &ldquo;move within the thing I am looking at&rdquo; is
            what arrows mean everywhere else in an OS. And every shortcut steps aside when focus is in an input or
            textarea, so a comment field inside a lightbox does not eat your arrow keys.
          </Prose>
          <Prose>
            Keyboard zoom is where testing gets almost comic. While writing this post I tried the two most popular
            lightbox libraries: in both,{' '}
            <KbdIcon label="Plus">
              <Plus />
            </KbdIcon>{' '}
            and{' '}
            <KbdIcon label="Minus">
              <Minus />
            </KbdIcon>{' '}
            do nothing at all. Muscle memory then reaches for{' '}
            <KbdGroup>
              <KbdIcon label="Command">
                <Command />
              </KbdIcon>
              <KbdIcon label="Plus">
                <Plus />
              </KbdIcon>
            </KbdGroup>
            , and the browser does what that shortcut has always done: it zooms the page. The entire UI inflates,
            thumbnails included, and in one of the two the enlarged thumbnail strip claims so much of the viewport that
            the photo you were trying to zoom into gets <em>smaller</em>. ramka&rsquo;s answer is to give the image its
            own keyboard zoom without taking the browser&rsquo;s away: unmodified{' '}
            <KbdIcon label="Plus">
              <Plus />
            </KbdIcon>
            ,{' '}
            <KbdIcon label="Minus">
              <Minus />
            </KbdIcon>{' '}
            and <Kbd>0</Kbd> operate the photo, while the{' '}
            <KbdGroup>
              <KbdIcon label="Command">
                <Command />
              </KbdIcon>
              <KbdIcon label="Plus">
                <Plus />
              </KbdIcon>
            </KbdGroup>{' '}
            family stays with the browser. Page zoom is how low-vision users resize text, WCAG 1.4.4 in practice, so a
            viewer that swallows it is fixing one zoom by breaking another. Keeping both means you can enlarge the
            viewer&rsquo;s controls and captions independently of the photo.
          </Prose>
          <Prose>
            Motion is an accessibility setting too. Vestibular disorders make large moving surfaces genuinely
            nauseating, and the OS-level reduced motion toggle is how people say so. ramka treats that setting as a hard
            gate on the{' '}
            <Link href="/docs/lightbox/view-transitions" className={inlineLinkClassName}>
              morph transition
            </Link>
            : if it is on, the morph simply is not attempted, and open and close fall back to a plain fade. Gesture
            springs collapse to instant snaps the same way.
          </Prose>
          <div className="mt-5">
            <CodeBlock code={reducedMotionCode} lang="typescript" title="Reduced motion as a gate, not a theme" />
          </div>

          <Heading>Every input, its native idiom</Heading>
          <Prose>
            Most lightboxes navigate by pointer drag: press the photo, pull it sideways, release. It works, and it is
            the least accessible input on the menu. Dragging is the hardest pointer operation there is for anyone with a
            tremor or limited dexterity, press and hold and move and release without slipping, which is why WCAG 2.2
            added{' '}
            <Ext href="https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html">
              2.5.7 Dragging Movements
            </Ext>
            : anything operated by drag needs a single-pointer alternative that does not drag. A drag-to-scroll gallery
            that hides its next button for a cleaner look is a straight failure. And with VoiceOver or TalkBack running
            it is worse than a failure, because mobile screen readers consume single-finger gestures before the page
            ever sees them. To a blind user, a drag-only carousel is not hard to use. It does not exist.
          </Prose>
          <Prose>
            Drag-first carousels also fail an audience nobody thinks to test: trackpads. Pointer-drag code listens for
            pointer events, but a two-finger trackpad swipe emits wheel events, so in a surprising number of galleries
            mouse drag works and the trackpad does nothing. The fix on their side is a non-passive wheel handler, which
            is its own{' '}
            <Link href="/blog/why-native-scrolling" className={inlineLinkClassName}>
              performance story
            </Link>
            . ramka&rsquo;s slides are a real scroller, so every scroll input the operating system knows about works
            without a line of code: touch, trackpad swipe, shift plus wheel, tilt wheels, pen.
          </Prose>
          <Prose>
            The parity goes past swiping. A trackpad pinch zooms the photo, through Safari&rsquo;s gesture events and
            through the synthesized ctrl-wheel stream Chrome and Firefox emit for pinches, with the same elastic
            overshoot and snap-back as fingers on glass. A two-finger downward swipe pulls the photo away to dismiss,
            exactly like the touch gesture. Pinching in the middle of a swipe hands the gesture from the scroller to the
            zoom instead of fighting for it. Drag is welcome as one input among many. It just is not allowed to be the
            foundation, because everyone whose hands or eyes or hardware work differently is standing on it.
          </Prose>

          <Heading>What is still hard</Heading>
          <Prose>
            The honest section. The dialog pattern requires that content behind a modal be non-interactive for{' '}
            <em>every</em> user, not just keyboard users. ramka covers the inputs it controls: the focus trap contains
            Tab, the scroll lock and the viewport-covering surface block pointers and scrolling, and{' '}
            <code className="text-[13px]">aria-modal</code> tells assistive technology to treat the background as off
            limits, the mechanism ARIA 1.1 introduced to replace hiding the page by hand. What it does not yet do is{' '}
            <em>also</em> set <code className="text-[13px]">inert</code> on the rest of the page, the
            belt-and-suspenders that covers older mobile screen readers with weak{' '}
            <code className="text-[13px]">aria-modal</code> support. That one is on the list, carefully: blindly
            inerting everything outside the portal would break the menus and nested dialogs consumers legitimately
            portal out of the viewer. Slide announcements depend on you mounting{' '}
            <code className="text-[13px]">Counter</code> or <code className="text-[13px]">Caption</code>; a lightbox
            without either is visually fine and aurally silent. And panning a zoomed image is a drag gesture without a
            single-tap alternative yet, which the{' '}
            <Link href="/docs/lightbox/zoom" className={inlineLinkClassName}>
              zoom docs
            </Link>{' '}
            mark plainly as partial WCAG 2.5.7 support. All of it is on the roadmap. A library that claims its
            accessibility story is finished is describing a library nobody has tested.
          </Prose>

          <Heading>Test it yourself in five minutes</Heading>
          <Prose>
            You do not need an audit to catch the failures in this post; you need five minutes and the software already
            on your machine. On a Mac, press{' '}
            <KbdGroup>
              <KbdIcon label="Command">
                <Command />
              </KbdIcon>
              <Kbd>F5</Kbd>
            </KbdGroup>{' '}
            to start VoiceOver. On Windows, <Ext href="https://www.nvaccess.org/download/">NVDA is free</Ext>. Then, on
            your own photo gallery: open the lightbox and listen for a dialog announcement with a name. Press{' '}
            <Kbd>Tab</Kbd> repeatedly and watch whether focus stays inside. Change slides and listen for the new
            position. Press <Kbd>Esc</Kbd>, and check focus is back on the thumbnail you started from. Turn on reduced
            motion and open it again. Five checks, one per failure that actually ships.
          </Prose>
          <Prose>Here is that checklist running against ramka. Try it with your screen reader on.</Prose>

          <div className="mt-8">
            <LandingDemo eager={false} />
          </div>

          <Prose>
            If you are building an accessible image gallery, the{' '}
            <Link href="/docs" className={inlineLinkClassName}>
              docs
            </Link>{' '}
            take about ten minutes, and the{' '}
            <Link href="/docs/lightbox/rtl" className={inlineLinkClassName}>
              RTL and copy guide
            </Link>{' '}
            covers the naming patterns above. ramka is free for open source under the GPL, and{' '}
            <Link href="/license" className={inlineLinkClassName}>
              one payment
            </Link>{' '}
            covers proprietary use for your whole team. Either way, mount the Counter.
          </Prose>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
