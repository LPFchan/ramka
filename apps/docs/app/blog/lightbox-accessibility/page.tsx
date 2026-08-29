import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';

import { ArrowLeft, ArrowRight, Command, Minus, Plus } from 'lucide-react';

import { Kbd, KbdGroup } from '@/components/ui/kbd';

import { CodeBlock } from '../../_components/code-block';
import { LandingDemo } from '../../_components/landing-demo';
import { SiteFooter } from '../../_components/site-footer';
import { SiteHeader } from '../../_components/site-header';
import { siteUrl } from '../../_content/site';
import { FocusTrapDemo } from './focus-trap-demo';
import { SrSimulator } from './sr-simulator';

export const metadata: Metadata = {
  title: 'A lightbox screen readers can actually use',
  description:
    'Most image lightboxes announce nothing, trap nobody, and strand keyboard focus behind the overlay. What a dialog owes assistive technology, with interactive demos: focus traps, live regions, inert slides, and the parts that are still hard.',
};

const PUBLISHED = '2026-08-29';

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: 'A lightbox screen readers can actually use',
  description:
    'What an accessible image lightbox actually requires: focus trapping and restoration, live regions for slide changes, inert slides, reduced motion, and honest notes on what remains hard. With interactive demos.',
  url: `${siteUrl}/blog/lightbox-accessibility`,
  datePublished: PUBLISHED,
  author: { '@type': 'Person', name: 'Artur Bień' },
};

const guardsCode = `// Two invisible spans bracket the dialog. Tab past either edge and the
// guard hands focus back to the opposite end. This is the entire trap.
<span tabIndex={0} aria-hidden="true" onFocus={focusLastTabbable} />
<div role="dialog" aria-modal="true" tabIndex={-1}>
  {children}
</div>
<span tabIndex={0} aria-hidden="true" onFocus={focusFirstTabbable} />`;

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
            Turn on VoiceOver and open a photo in a typical web lightbox. You hear &ldquo;image&rdquo;, maybe.
            Swipe to the next photo: nothing. Try to leave: <Kbd>Esc</Kbd> does nothing, and the close button
            announces itself as &ldquo;clickable&rdquo;.{' '}
            <Link href="/blog/why-native-scrolling" className={inlineLinkClassName}>
              The last post
            </Link>{' '}
            was about what your thumb knows. This one is about what a screen reader hears.
          </p>

          <Prose>
            The scale of the problem is measured annually.{' '}
            <Ext href="https://webaim.org/projects/million/">WebAIM&rsquo;s 2026 scan</Ext> of the top million
            homepages found detectable WCAG failures on 95.9 percent of them, averaging 56.1 errors per page, and
            repeated its most uncomfortable finding: pages that use ARIA have more errors than pages that
            don&rsquo;t, because ARIA applied wrong builds barriers that plain HTML never had. A{' '}
            <Ext href="https://accessibility.build/research/accessibility-by-technology">
              2026 study of widget libraries
            </Ext>{' '}
            sharpened that picture: the components most associated with extra errors are carousels, lightboxes,
            and custom selects. The thing you are reading about is, statistically, one of the worst-implemented
            patterns on the web. It also has legal weight: over{' '}
            <Ext href="https://info.usablenet.com/hubfs/Remediated%20-%202025_Year-End_Digital_Accessibility_Lawsuit_Report_FINAL.pdf">
              5,000 digital accessibility lawsuits
            </Ext>{' '}
            were filed in the US in 2025, around 70 percent against e-commerce, which is exactly where image
            galleries live.
          </Prose>

          <Prose>
            None of this is because dialogs are mysterious. The{' '}
            <Ext href="https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/">W3C&rsquo;s dialog pattern</Ext>{' '}
            spells out the contract. A lightbox just happens to sit on the intersection of three hard things at
            once: it is a modal dialog, a carousel, and a gesture surface. Let&rsquo;s take them in order.
          </Prose>

          <Heading>Watch focus fall out of the dialog</Heading>
          <Prose>
            Start with the modal part, and with the failure you can see. When a lightbox opens, keyboard focus
            must move into it, stay inside while it is open, and return to the element that opened it when it
            closes. Skip the middle requirement and Tab walks straight out of the overlay into the page behind
            it, where a keyboard user is now operating invisible controls.
          </Prose>

          <FocusTrapDemo />

          <Prose>
            The trap itself is less code than its reputation suggests. ramka brackets the dialog with two
            invisible focus guards, the same technique Base UI uses. Tab past the last control and the guard
            catches focus and hands it to the first one; Shift+Tab past the first and it lands on the last:
          </Prose>
          <div className="mt-5">
            <CodeBlock code={guardsCode} title="The sentinel trap" />
          </div>
          <Prose>
            The subtler half of the contract is the exit. When the lightbox closes, focus must return to the
            trigger, and here ramka does something I have not seen elsewhere: it remembers how you closed. Close
            with <Kbd>Esc</Kbd> or the keyboard and the trigger gets its focus ring back, because a keyboard user needs
            to see where they are. Close by clicking the backdrop or pulling the photo away and focus still
            returns, but without forcing a ring onto a screen where nobody is keyboarding. Modality-aware focus
            restoration, three lines of bookkeeping, and it makes both kinds of users feel like the thing was
            built for them.
          </Prose>

          <Heading>What a screen reader hears</Heading>
          <Prose>
            Focus is the failure you can see. The other one is silence. A lightbox built from divs announces
            nothing when it opens, nothing when the slide changes, and nothing when it closes; a screen reader
            user gets a click that appears to do nothing at all. The fix has two parts: real semantics on the
            container, and a live region for the thing that changes.
          </Prose>

          <SrSimulator />

          <Prose>
            The container part is the dialog contract again: <code className="text-[13px]">role="dialog"</code>,{' '}
            <code className="text-[13px]">aria-modal</code>, and an accessible name, so opening announces
            &ldquo;Photos, dialog&rdquo; instead of nothing. The changing part is the interesting one. Swiping to
            the next slide moves a scroller; no focus changes, so nothing announces itself. ramka&rsquo;s{' '}
            <code className="text-[13px]">Counter</code> primitive is the fix: it renders the &ldquo;2 of
            9&rdquo; you can see, and it is also an <code className="text-[13px]">aria-live="polite"</code>{' '}
            region, so every slide change speaks. Same for <code className="text-[13px]">Caption</code>. Mount
            them and navigation narrates itself; leave them out and it is silent, which is exactly what the demo
            above shows.
          </Prose>
          <Prose>
            The docs chrome uses a trick worth stealing: on desktop, the thumbnail strip already shows position,
            so a visible counter would be noise. Instead of unmounting it, the counter collapses to{' '}
            <code className="text-[13px]">sr-only</code> and keeps announcing:
          </Prose>
          <div className="mt-5">
            <CodeBlock code={counterCode} title="The counter you hear but do not see" />
          </div>
          <Prose>
            Off-screen slides get the opposite treatment. Every inactive slide is{' '}
            <code className="text-[13px]">inert</code> and <code className="text-[13px]">aria-hidden</code>, so a
            screen reader exploring the dialog finds one photo, not nine, and keyboard focus physically cannot
            wander into a slide you cannot see. ramka goes a step further and makes the zoom surface
            non-focusable precisely so that a slide being deactivated mid-gesture can never strand focus inside
            an inert subtree. That is the kind of edge case you only find by testing, and the kind a library
            should own so you never think about it.
          </Prose>
          <Prose>
            Two smaller pieces of the same structure are easy to miss. Thumbnails are a real{' '}
            <Ext href="https://www.w3.org/WAI/ARIA/apg/patterns/tabs/">tabs pattern</Ext>: a{' '}
            <code className="text-[13px]">tablist</code> of <code className="text-[13px]">tab</code>s with roving
            tabindex,{' '}
            <KbdGroup>
              <Kbd aria-label="Left arrow"><ArrowLeft /></Kbd>
              <Kbd aria-label="Right arrow"><ArrowRight /></Kbd>
            </KbdGroup>, <Kbd>Home</Kbd> and <Kbd>End</Kbd>, and the selection tracked from the active slide rather than from
            DOM focus, so swiping can never desync what the keyboard thinks is selected. And the trigger that
            opened the lightbox carries <code className="text-[13px]">aria-haspopup="dialog"</code> and{' '}
            <code className="text-[13px]">aria-expanded</code>, on that specific element, so a screen reader user
            browsing a grid of twenty thumbnails can tell which one is currently open.
          </Prose>

          <Heading>Why ramka ships no English</Heading>
          <Prose>
            One thing ramka deliberately does not do: bake in default labels. There is no built-in{' '}
            <code className="text-[13px]">aria-label="Close"</code> on the close button, no
            &ldquo;carousel&rdquo; roledescription hard-coded on the slides. A comment in the source explains
            why: an English string baked into a primitive is wrong for most of the world. The numbers back that
            up. In{' '}
            <Ext href="https://webaim.org/projects/screenreadersurvey10/">
              WebAIM&rsquo;s screen reader survey
            </Ext>
            , NVDA leads everywhere outside North America and Australia, across Europe, Africa, the Middle East,
            and Asia, and 91.3 percent of respondents use a screen reader on a phone, where VoiceOver alone has
            70.6 percent. A hard-coded &ldquo;Close&rdquo; is a wrong answer read aloud, in the wrong language,
            to most screen reader users on Earth.
          </Prose>
          <Prose>
            So the words are yours, and the structure is the library&rsquo;s. In development, ramka warns when a
            dialog or an icon button has no accessible name, which keeps the contract visible without shipping
            anyone&rsquo;s locale. Passing it is a few attributes, following the{' '}
            <Ext href="https://www.w3.org/WAI/ARIA/apg/patterns/carousel/">APG carousel pattern</Ext>:
          </Prose>
          <div className="mt-5">
            <CodeBlock code={namingCode} title="Naming the carousel, your words" />
          </div>

          <Heading>Keyboard and motion</Heading>
          <Prose>
            The rest of the keyboard contract: <Kbd>Esc</Kbd> closes,{' '}
            <KbdGroup>
              <Kbd aria-label="Left arrow"><ArrowLeft /></Kbd>
              <Kbd aria-label="Right arrow"><ArrowRight /></Kbd>
            </KbdGroup>{' '}
            move between slides, <Kbd>Home</Kbd> and <Kbd>End</Kbd> jump to the ends,{' '}
            <Kbd aria-label="Plus"><Plus /></Kbd> and <Kbd aria-label="Minus"><Minus /></Kbd> zoom, and{' '}
            <KbdGroup>
              <Kbd aria-label="Command"><Command /></Kbd>
              <Kbd>0</Kbd>
            </KbdGroup>{' '}
            or{' '}
            <KbdGroup>
              <Kbd>Ctrl</Kbd>
              <Kbd>0</Kbd>
            </KbdGroup>{' '}
            resets. Two details are easy to get wrong. When
            the photo is zoomed in, ramka&rsquo;s arrow keys stop navigating and start panning, because
            &ldquo;move within the thing I am looking at&rdquo; is what arrows mean everywhere else in an OS. And
            every shortcut steps aside when focus is in an input or textarea, so a comment field inside a
            lightbox does not eat your arrow keys.
          </Prose>
          <Prose>
            Keyboard zoom is where testing gets almost comic. While writing this post I tried the two most
            popular lightbox libraries: in both, <Kbd aria-label="Plus"><Plus /></Kbd> and{' '}
            <Kbd aria-label="Minus"><Minus /></Kbd> do nothing at all. Muscle memory
            then reaches for{' '}
            <KbdGroup>
              <Kbd aria-label="Command"><Command /></Kbd>
              <Kbd aria-label="Plus"><Plus /></Kbd>
            </KbdGroup>, and the browser does what that shortcut has always done: it zooms the page. The entire UI inflates,
            thumbnails included, and in one of the two the enlarged thumbnail strip claims so much of the
            viewport that the photo you were trying to zoom into gets <em>smaller</em>. ramka intercepts the
            browser zoom shortcuts while the dialog is open and points them at the image, because while a photo
            fills your screen, &ldquo;zoom&rdquo; can only mean one thing.
          </Prose>
          <Prose>
            Motion is an accessibility setting too. Vestibular disorders make large moving surfaces genuinely
            nauseating, and the OS-level reduced motion toggle is how people say so. ramka treats that setting as
            a hard gate on the{' '}
            <Link href="/docs/lightbox/view-transitions" className={inlineLinkClassName}>
              morph transition
            </Link>
            : if it is on, the morph simply is not attempted, and open and close fall back to a plain fade.
            Gesture springs collapse to instant snaps the same way.
          </Prose>
          <div className="mt-5">
            <CodeBlock code={reducedMotionCode} lang="typescript" title="Reduced motion as a gate, not a theme" />
          </div>

          <Heading>Every input, its native idiom</Heading>
          <Prose>
            Most lightboxes navigate by pointer drag: press the photo, pull it sideways, release. It works, and
            it is the least accessible input on the menu. Dragging is the hardest pointer operation there is for
            anyone with a tremor or limited dexterity, press and hold and move and release without slipping,
            which is why WCAG 2.2 added{' '}
            <Ext href="https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html">
              2.5.7 Dragging Movements
            </Ext>
            : anything operated by drag needs a single-pointer alternative that does not drag. A drag-to-scroll
            gallery that hides its next button for a cleaner look is a straight failure. And with VoiceOver or
            TalkBack running it is worse than a failure, because mobile screen readers consume single-finger
            gestures before the page ever sees them. To a blind user, a drag-only carousel is not hard to use.
            It does not exist.
          </Prose>
          <Prose>
            Drag-first carousels also fail an audience nobody thinks to test: trackpads. Pointer-drag code
            listens for pointer events, but a two-finger trackpad swipe emits wheel events, so in a surprising
            number of galleries mouse drag works and the trackpad does nothing. The fix on their side is a
            non-passive wheel handler, which is its own{' '}
            <Link href="/blog/why-native-scrolling" className={inlineLinkClassName}>
              performance story
            </Link>
            . ramka&rsquo;s slides are a real scroller, so every scroll input the operating system knows about
            works without a line of code: touch, trackpad swipe, shift plus wheel, tilt wheels, pen.
          </Prose>
          <Prose>
            The parity goes past swiping. A trackpad pinch zooms the photo, through Safari&rsquo;s gesture
            events and through the synthesized ctrl-wheel stream Chrome and Firefox emit for pinches, with the
            same elastic overshoot and snap-back as fingers on glass. A two-finger downward swipe pulls the
            photo away to dismiss, exactly like the touch gesture. Pinching in the middle of a swipe hands the
            gesture from the scroller to the zoom instead of fighting for it. Drag is welcome as one input among
            many. It just is not allowed to be the foundation, because everyone whose hands or eyes or hardware
            work differently is standing on it.
          </Prose>

          <Heading>What is still hard</Heading>
          <Prose>
            The honest section. ramka does not currently set <code className="text-[13px]">inert</code> on the
            page content behind the dialog; it relies on <code className="text-[13px]">aria-modal</code> and the
            focus trap, which the dialog pattern permits, but belt-and-suspenders inerting of the background is
            stronger with some older mobile screen readers. Slide announcements depend on you mounting{' '}
            <code className="text-[13px]">Counter</code> or <code className="text-[13px]">Caption</code>; a
            lightbox without either is visually fine and aurally silent. And panning a zoomed image is a drag
            gesture without a single-tap alternative yet, which the{' '}
            <Link href="/docs/lightbox/zoom" className={inlineLinkClassName}>
              zoom docs
            </Link>{' '}
            mark plainly as partial WCAG 2.5.7 support. These are on the list. A library that claims its
            accessibility story is finished is describing a library nobody has tested.
          </Prose>

          <Heading>Test it yourself in five minutes</Heading>
          <Prose>
            You do not need an audit to catch the failures in this post; you need five minutes and the software
            already on your machine. On a Mac, press{' '}
            <KbdGroup>
              <Kbd aria-label="Command"><Command /></Kbd>
              <Kbd>F5</Kbd>
            </KbdGroup>{' '}
            to start VoiceOver. On Windows,{' '}
            <Ext href="https://www.nvaccess.org/download/">NVDA is free</Ext>. Then, on your own gallery: open
            the lightbox and listen for a dialog announcement with a name. Press <Kbd>Tab</Kbd> repeatedly and
            watch whether focus stays inside. Change slides and listen for the new position. Press{' '}
            <Kbd>Esc</Kbd>, and check focus is back on the thumbnail you started from. Turn on reduced motion
            and open it again. Five checks, one per failure that actually ships.
          </Prose>
          <Prose>Here is that checklist running against ramka. Try it with your screen reader on.</Prose>

          <div className="mt-8">
            <LandingDemo eager={false} />
          </div>

          <Prose>
            If you are building a gallery, the{' '}
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
