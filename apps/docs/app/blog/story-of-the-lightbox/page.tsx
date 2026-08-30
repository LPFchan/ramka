import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';

import { CodeBlock } from '../../_components/code-block';
import { SiteFooter } from '../../_components/site-footer';
import { SiteHeader } from '../../_components/site-header';
import { siteUrl } from '../../_content/site';
import { AnatomyDiagram } from './anatomy-diagram';
import { CloneMarquee } from './clone-marquee';
import { Lightbox2005 } from './lightbox-2005';
import { LightTableGallery } from './light-table-gallery';
import { Shot } from './shots';
import { LightboxTimeline } from './timeline';

const PUBLISHED = '2026-08-30';

// The document title targets the search topic; the visible H1 below keeps the
// editorial headline. The layout template appends " — ramka".
const seoTitle = 'What is a lightbox? The 20-year story of the web\u2019s image overlay';
const seoDescription =
  'How a 2005 blog redesign named a UI pattern. The lightbox\u2019s story: tiled PNG backdrops, the jQuery clone wars, a Wikipedia crisis, and the web catching up.';

export const metadata: Metadata = {
  title: seoTitle,
  description: seoDescription,
  // The root layout's Open Graph / Twitter objects describe the homepage and
  // are inherited wholesale (Next.js does not deep-merge them), so each
  // article must emit its own social metadata.
  openGraph: {
    title: `${seoTitle} — ramka`,
    description: seoDescription,
    url: `${siteUrl}/blog/story-of-the-lightbox`,
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
  headline: 'The story of the lightbox',
  description:
    'The history of the lightbox UI pattern: the photographic light table it is named after, the 2005 script that started it, the jQuery clone era, the touch rewrite, the Wikipedia MediaViewer crisis, and the web platform absorbing the pattern piece by piece.',
  url: `${siteUrl}/blog/story-of-the-lightbox`,
  datePublished: PUBLISHED,
  author: { '@type': 'Person', name: 'Artur Bień' },
  keywords:
    'lightbox, what is a lightbox, lightbox history, lightbox meaning, image overlay, modal dialog, image gallery, javascript lightbox, react lightbox, lightbox vs modal',
};

const relApiCode = `<!-- Lightbox, December 2005. The entire integration: -->
<a href="images/fort-funston.jpg" rel="lightbox" title="Dunes at Fort Funston">
  my photo
</a>

<!-- Lightbox 2, 2006. Name a set inside the brackets and you have a gallery: -->
<a href="images/one.jpg" rel="lightbox[roadtrip]">one</a>
<a href="images/two.jpg" rel="lightbox[roadtrip]">two</a>`;

function Prose({ children }: { children: ReactNode }) {
  return <p className="mt-5 text-pretty text-[15px] leading-7 text-neutral-600 dark:text-neutral-400">{children}</p>;
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-12 text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">{children}</h2>
  );
}

function Quote({ children, cite }: { children: ReactNode; cite: ReactNode }) {
  return (
    <blockquote className="mt-5 border-l-2 border-neutral-200 pl-4 dark:border-neutral-800">
      <div className="text-pretty text-[15px] leading-7 text-neutral-700 italic dark:text-neutral-300">{children}</div>
      <footer className="mt-2 text-[13px] text-neutral-400 not-italic dark:text-neutral-500">{cite}</footer>
    </blockquote>
  );
}

function Term({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="mt-4 first:mt-0">
      <dt className="text-[15px] font-semibold text-neutral-900 dark:text-neutral-50">{term}</dt>
      <dd className="mt-1 text-pretty text-[15px] leading-7 text-neutral-600 dark:text-neutral-400">{children}</dd>
    </div>
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

export default function StoryOfTheLightboxPage() {
  return (
    <div className="isolate flex min-h-screen flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <SiteHeader home />

      <main className="flex-1">
        {/* Every Shot below opens in its own ramka viewer. Obviously. */}
        <article className="mx-auto w-full max-w-2xl px-6 pt-16 pb-20 md:pt-20 md:pb-24">
          <p className="text-[13px] font-medium tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
            <time dateTime={PUBLISHED}>August 30, 2026</time>
          </p>
          <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-neutral-950 md:text-4xl dark:text-neutral-50">
            The story of the lightbox
          </h1>
          <p className="mt-5 text-pretty text-[17px] leading-7 text-neutral-500 dark:text-neutral-400">
            You have typed the word a thousand times. It names a box of light photographers kept in dark rooms, a script
            a blogger wrote in the last weeks of 2005, and the way images have opened on the web ever since. This is the
            story of the lightbox: the name, the parts, the clone wars, and the twenty-year handoff to the platform.
          </p>

          <Heading>The room was dark first</Heading>
          <Prose>
            Before it was JavaScript, a lightbox was furniture. A shallow box, a translucent white top, an even glow
            from inside. Photographers and photo editors spread strips of film and mounted slides across it and leaned
            in with a loupe. The room stayed dim on purpose. All the light in it belonged to the pictures. That is the
            whole idea, and it survived the move to software intact: dim the room, light the picture.
          </Prose>
          <LightTableGallery />
          <Prose>
            The name was already doing rounds outside photography. Radiologists clipped X-rays to wall-mounted
            lightboxes. Advertisers sold backlit poster boxes under the same word. People with seasonal depression sit
            in front of a lightbox every winter morning. And in stock photography the word took one more turn that
            outlived the furniture: picking your selects off the light table became such a fixed ritual that agencies
            like Getty still call a saved collection of images a &ldquo;lightbox&rdquo;, a shortlist named after a piece
            of equipment most of their users have never touched.
          </Prose>
          <Prose>
            So by the time the web needed a name for &ldquo;darken everything except this one photo&rdquo;, the metaphor
            was not just available. It was load-bearing in three industries.
          </Prose>

          <Heading>A blog redesign names a pattern</Heading>
          <Prose>
            In December 2005, a designer named Lokesh Dhakar was redesigning his blog. The new layout had a narrower
            content column, his post images overflowed it, and he did not want to resize every image each time he
            tweaked the design. So he replaced the images with thumbnails and wrote a script that opened the full-size
            photo <em>above</em> the page instead of navigating away. The account is preserved, with charming honesty,
            in <Ext href="https://github.com/lokesh/lightbox">the original repository&rsquo;s README</Ext>. Right before
            New Year&rsquo;s, he emailed a few of his favorite design bloggers:
          </Prose>
          <Quote cite="Lokesh Dhakar, email of December 29, 2005, as preserved in the Lightbox README">
            &ldquo;I&rsquo;ve written a little script to help people, mainly bloggers, handle large images. Its a little
            faux-popup effect with Javascript. It might be useful for you, or not, either way take a look.&rdquo;
          </Quote>
          <Shot
            id="lokesh"
            narrow
            caption={
              <>
                The man behind the email. Lokesh Dhakar, profile photo via{' '}
                <Ext href="https://x.com/lokesh">his X profile</Ext>.
              </>
            }
          />
          <Prose>
            It might be useful for you, or not. Eight days later{' '}
            <Ext href="https://www.wired.com/2006/01/more-floating-photos-introducing-lightbox-js/">
              WIRED wrote it up
            </Ext>
            , describing the effect with a phrase that dates it precisely: a &ldquo;shaded &lsquo;mask&rsquo; layer of
            transparent PNGs&rdquo; between the image and the page. In the IE6 era you could not trust a translucent CSS
            background, so the dim was literally a tiled picture of darkness. The script ran on Prototype and
            script.aculo.us, jQuery not having been announced yet, and it spread through del.icio.us the way things
            spread before GitHub existed: someone you trusted bookmarked it.
          </Prose>
          <div className="mt-5">
            <CodeBlock code={relApiCode} lang="html" title="The entire API, 2005–2006" />
          </div>
          <Prose>
            Look at that integration surface for a second. The whole configuration is an HTML attribute. The link you
            already had, doing double duty. It degraded perfectly: no JavaScript, and the href simply opened the image,
            which is progressive enhancement so clean it still gets cited. And it planted a seed that took two decades
            to finish sprouting. From <code className="text-[13px]">rel=&quot;lightbox&quot;</code> it is a straight
            line through <code className="text-[13px]">class=&quot;thickbox&quot;</code> and today&rsquo;s{' '}
            <code className="text-[13px]">data-</code>-attribute galleries, the idea that your markup is the config
            file. What it is not, is composition. That distinction becomes this story&rsquo;s ending.
          </Prose>
          <Shot
            id="original-2006"
            caption={
              <>
                The entire product, ten days old: huddletogether.com in January 2006, via the{' '}
                <Ext href="https://web.archive.org/web/20060110190535/http://www.huddletogether.com/projects/lightbox/">
                  Wayback Machine
                </Ext>
                . The downloads list is the tell: <code className="text-[12px]">overlay.png</code>, &ldquo;80% opacity,
                black tile used to create shadow&rdquo;, and <code className="text-[12px]">loading.gif</code>. (Click
                it. The images in this article open in a lightbox. Anything else would be a scandal.)
              </>
            }
          />
          <Prose>
            The script became so much bigger than its author that in 2007, when Dhakar published a charming{' '}
            <Ext href="https://lokeshdhakar.com/coffee-drinks-illustrated/">illustrated chart of espresso drinks</Ext>,
            TechCrunch&rsquo;s{' '}
            <Ext href="https://techcrunch.com/2007/08/26/lokesh-dhakars-fancy-coffee-drink-cheat-sheet/">write-up</Ext>{' '}
            opened with its writer admitting he could not place the name: &ldquo;I couldn&rsquo;t figure out for the
            life of me where I&rsquo;d heard his name before but I assumed he was famous for some reason.&rdquo; The
            pattern had already outgrown the person. It was in the process of outgrowing the library too: &ldquo;a
            lightbox&rdquo; stopped meaning Lightbox.js and started meaning the entire category, the way kleenex stopped
            meaning Kleenex.
          </Prose>
          <Shot
            id="coffee-drinks"
            narrow
            caption={
              <>
                The other thing he is famous for.{' '}
                <Ext href="https://lokeshdhakar.com/coffee-drinks-illustrated/">Coffee Drinks Illustrated</Ext> by
                Lokesh Dhakar, <Ext href="https://creativecommons.org/licenses/by-nc/3.0/">CC BY-NC 3.0</Ext>.
              </>
            }
          />
          <Prose>Here is what all that fuss looked like. Click a thumbnail.</Prose>

          <Lightbox2005 />

          <Shot
            id="lightbox2-live"
            caption={
              <>
                Not a museum piece: the real{' '}
                <Ext href="https://lokeshdhakar.com/projects/lightbox2/">Lightbox2 demo page</Ext>, photographed live in
                2026, banner for Lightbox 3 included.
              </>
            }
          />

          <Heading>The clone wars</Heading>

          <CloneMarquee />

          <Prose>
            Four months after that email, the cloning began. In April 2006 Cody Lindley released Thickbox, and the
            announcement came from the highest possible authority,{' '}
            <Ext href="https://blog.jquery.com/2006/04/24/thickbox/">
              John Resig himself, on the official jQuery blog
            </Ext>
            :
          </Prose>
          <Quote cite="John Resig, jquery.com, April 24, 2006">
            &ldquo;Cody Lindley just released a brand new version of Lightbox/Greybox called Thickbox. […] this release
            is completely unobtrusive - it uses the natural href, src, and title attributes to seed the box, when it
            pops up. Even if you don&rsquo;t have Javascript enabled, it still behaves naturally.&rdquo;
          </Quote>
          <Prose>
            Then the floodgates. Slimbox in <Ext href="https://www.digitalia.be/software/slimbox/">October 2006</Ext>, a
            4&nbsp;KB clone whose entire pitch was its file size. Fancybox in{' '}
            <Ext href="https://fancybox.net/changelog/">April 2008</Ext>. Colorbox in{' '}
            <Ext href="https://github.com/jackmoore/colorbox">March 2009</Ext>. Greybox, Shadowbox, prettyPhoto,
            Highslide. For about five years, naming a lightbox meant choosing an adjective and appending
            &ldquo;box&rdquo;. By April 2008 the ecosystem was chaotic enough that one developer built{' '}
            <Ext href="https://planetozh.com/blog/2008/04/the-lightbox-clone-matrix-compare-30-lightbox-scripts/">
              a comparison matrix of more than thirty clones
            </Ext>
            , opening with a sentence that captures the era: &ldquo;Early 2006, a cool guy named Lokesh Dhakar
            introduced Lightbox […] Since, every once in a while, someone comes up with their own take at this concept,
            using this or that javascript library (jQuery, Prototype, Mootools, YUI, you name it).&rdquo; Every
            JavaScript framework of the era needed its own clone, because plugins could not cross framework lines.
          </Prose>
          <Shot
            id="clone-matrix"
            caption={
              <>
                <Ext href="http://planetozh.com/projects/lightbox-clones/">The Lightbox Clones Matrix</Ext>, still
                online today. Every pill in the wall above is one of its rows.
              </>
            }
          />
          <Prose>
            What did they compete on? Kilobytes, transitions, and content types: iframes, inline HTML, Flash, video,
            AJAX. And since the markup-as-config API had nowhere to grow, differentiation moved into options objects,
            which grew, and grew, and never stopped growing.{' '}
            <Link href="/blog/headless-lightbox" className={inlineLinkClassName}>
              The case for a headless React lightbox
            </Link>{' '}
            traces where sixty-option config objects eventually lead; this era is where they were born.
          </Prose>

          <Heading>Lightbox, modal, dialog, popup: who is who</Heading>
          <Prose>
            The clone era also scrambled the vocabulary, and it has never fully recovered. If you have ever lost a
            naming argument in a design review, here is the untangling:
          </Prose>
          <dl className="mt-5">
            <Term term="Popup">
              The ancestor, and the villain of the origin story. A separate browser window via{' '}
              <code className="text-[13px]">window.open()</code>, so despised by 2005 that &ldquo;faux-popup&rdquo;,
              Dhakar&rsquo;s own words, was a selling point. The word now mostly means marketing overlays, which
              inherited the reputation.
            </Term>
            <Term term="Dialog">
              A window that lives inside the page and talks to you. The generic pattern, and since 2022 an HTML element.
            </Term>
            <Term term="Modal">
              Not a thing but a property: a dialog is modal when the rest of the page stops working until you deal with
              it. &ldquo;A modal&rdquo; as a noun is the industry&rsquo;s most successful grammatical error.
            </Term>
            <Term term="Lightbox">
              A modal dialog whose occupant is media. Dim the room, light the picture, navigate between pictures. If it
              has a backdrop and a photo, it is a lightbox, whatever the marketing site calls it.
            </Term>
            <Term term="Carousel">
              The strip of slides itself, which can live inside a lightbox or directly on a page. A lightbox is usually
              a modal wrapped around a carousel, which is why it inherits the accessibility obligations of both.
            </Term>
          </dl>

          <Heading>The anatomy, and the names that stuck</Heading>
          <Prose>
            Strip away twenty years of visual fashion and the machine has barely changed. The parts the pattern settled
            on in its first years are the parts every implementation still has:
          </Prose>

          <AnatomyDiagram />

          <Prose>
            This is also why, when we named ramka&rsquo;s{' '}
            <Link href="/docs/lightbox/composition" className={inlineLinkClassName}>
              composable lightbox primitives
            </Link>
            , we mostly did not have to invent anything. <code className="text-[13px]">Backdrop</code>,{' '}
            <code className="text-[13px]">Stage</code>, <code className="text-[13px]">Slides</code>,{' '}
            <code className="text-[13px]">Counter</code>, <code className="text-[13px]">Caption</code>,{' '}
            <code className="text-[13px]">Close</code>, <code className="text-[13px]">Thumbnail</code>. The pattern
            named its own organs decades ago. A component library&rsquo;s job is to hand them to you individually
            instead of fused together.
          </Prose>

          <Heading>The mobile turn</Heading>
          <Prose>
            Then the iPhone shipped, and the pattern&rsquo;s core assumption, a mouse, quietly died. Look back at the
            2006 recreation above: previous and next appear when you <em>hover</em> the photo&rsquo;s halves. There is
            no hover on glass. An entire generation of lightboxes had hidden their navigation inside an input that
            touchscreens do not have.
          </Prose>
          <Prose>
            The rewrite arrived from an unexpected direction: not a famous framework author but{' '}
            <Ext href="https://github.com/dimsemenov/PhotoSwipe">PhotoSwipe</Ext>, started in 2011 at Code Computerlove,
            a digital agency in Manchester, and built touch-first from day one. Swipe to navigate, pinch to zoom,
            momentum that kept moving after your finger left. In March 2014 the agency handed the project to Dmitry
            Semenov, who had already written Magnific Popup (that is two of the most-deployed lightboxes ever, one
            author), and his rewrite became the standard everyone else chased. The price of the new features was steep,
            though rarely itemized: swipe, momentum and rubber-banding are platform physics, and a JavaScript carousel
            has to reimplement all of them, frame by frame, on the main thread.{' '}
            <Link href="/blog/why-native-scrolling" className={inlineLinkClassName}>
              Why native scrolling beats transform carousels
            </Link>{' '}
            is this story&rsquo;s sequel about exactly that bill coming due.
          </Prose>
          <Prose>
            The design north star also changed. The clone era imitated other websites; the touch era imitated the iOS
            Photos app: pull the photo downward to dismiss it, morph it back into the thumbnail it came from. And in an
            ending nobody would have predicted in 2013, Semenov eventually{' '}
            <Ext href="https://dimsemenov.com/plugins/magnific-popup/">deprecated Magnific Popup</Ext> with advice that
            closes the loop on this whole section of history: use a native{' '}
            <code className="text-[13px]">&lt;dialog&gt;</code> element if you need a basic popup. The author of the
            jQuery era&rsquo;s favorite lightbox now tells you to start with an HTML tag.
          </Prose>
          <Shot
            id="magnific-deprecated"
            caption={
              <>
                <Ext href="https://dimsemenov.com/plugins/magnific-popup/">dimsemenov.com</Ext> today. The era&rsquo;s
                favorite lightbox, pointing you at an HTML element.
              </>
            }
          />

          <Heading>The lightbox that caused a constitutional crisis</Heading>
          <Prose>
            In 2014 the lightbox got its strangest historical footnote. Wikimedia rolled out MediaViewer, a lightbox for
            Wikipedia&rsquo;s article images, and the editing communities pushed back hard, arguing it was not ready.
            Surveys and requests for comment on English Wikipedia, Wikimedia Commons and German Wikipedia reached
            consensus to turn it off by default. The Foundation declined. On German Wikipedia, an administrator disabled
            the viewer anyway, by editing the site&rsquo;s <code className="text-[13px]">Common.js</code>.
          </Prose>
          <Prose>
            What happened next escalated past software entirely. On August 10, 2014, the Foundation created a brand-new
            user right called <Ext href="https://meta.wikimedia.org/wiki/Superprotect">superprotect</Ext> and used it,
            the same day, to lock that JavaScript page above the reach of the site&rsquo;s own administrators.{' '}
            <Ext href="https://signpost.news/2014-08-13/News_and_notes">The Signpost</Ext>, Wikipedia&rsquo;s internal
            newspaper, explained the new power flatly: &ldquo;&lsquo;Superprotect&rsquo; is a level above full
            protection, and prevents edits by administrators.&rdquo; The German community responded by blocking the
            Foundation&rsquo;s deputy director for a month. An open letter against the move collected nearly a thousand
            signatures. The protection came off the page that same August; the superprotect right itself was abolished
            in 2015.
          </Prose>
          <Prose>
            Somewhere between &ldquo;dim the page&rdquo; and &ldquo;show the next photo&rdquo;, an image overlay had
            triggered a constitutional crisis in the largest collaborative project in human history. No other UI
            component can put that on its résumé.
          </Prose>
          <Shot
            id="mediaviewer-live"
            caption={
              <>
                And it won: MediaViewer, photographed on the{' '}
                <Ext href="https://en.wikipedia.org/wiki/Apollo_11">Apollo 11 article</Ext> in 2026. Counter, arrows,
                caption, backdrop: a lightbox. (Photo: NASA, public domain.)
              </>
            }
          />

          <Heading>The platform catches up</Heading>
          <Prose>
            Here is a different way to read the clone-era feature matrices: as a stack of bug reports against the web
            platform. Centering a box. Dimming a page. Trapping focus. Closing on Escape. Every lightbox since 2005 had
            shipped the same few hundred lines of workaround, and the platform eventually absorbed them: the{' '}
            <Ext href="https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog">
              <code className="text-[13px]">&lt;dialog&gt;</code> element
            </Ext>{' '}
            shipped in Chrome in 2014 but became usable in earnest in March 2022, when Safari 15.4 and Firefox 98
            shipped it weeks apart. With it came the top layer, which ended the z-index arms race, and{' '}
            <Ext href="https://developer.mozilla.org/en-US/docs/Web/CSS/::backdrop">
              <code className="text-[13px]">::backdrop</code>
            </Ext>
            , which turned the dim from a tiled PNG into a pseudo-element the browser draws for you. The{' '}
            <code className="text-[13px]">inert</code> attribute made &ldquo;the rest of the page stops working&rdquo; a
            one-word contract.
          </Prose>
          <Prose>
            The gallery half followed the same road. CSS scroll snap, cross-browser since 2019, made &ldquo;a scroller
            that stops one photo at a time&rdquo; a stylesheet rule instead of a physics engine.{' '}
            <code className="text-[13px]">overscroll-behavior</code> tamed the edges. Native scrolling brought platform
            momentum with it, no reimplementation required. And the View Transitions API is currently absorbing the last
            showpiece: the morph between thumbnail and full photo that the touch era copied from iOS. Twenty years of
            library features, standardized one spec at a time.
          </Prose>
          <Prose>
            What the platform cannot absorb is the part that was never generic: your markup, your design, your captions
            and buttons and layout. Which is precisely the part the current generation of lightboxes, the headless
            generation, hands back to you.
          </Prose>

          <Heading>Twenty years in one scroll</Heading>

          <LightboxTimeline />

          <Heading>Where the story goes next</Heading>
          <Prose>
            Four eras, four architectures. An attribute on a link, degrading gracefully to a page load. A jQuery plugin
            with an options object. A React component with a bigger options object. And now primitives you compose,
            where the library ships the behavior and the pixels are yours. The old eras never fully leave, though. They
            linger in production. <Ext href="https://webaim.org/projects/million/">WebAIM&rsquo;s 2026 scan</Ext> of the
            top million homepages still detects the original Lightbox script on nearly 39,000 of them, averaging 25.7
            percent more accessibility errors than the mean, with FancyBox at 60.3 percent more. History, in this
            pattern, is not something you read about. It is something you inherit and{' '}
            <Link href="/blog/lightbox-accessibility" className={inlineLinkClassName}>
              something screen readers still trip over
            </Link>
            .
          </Prose>
          <Prose>
            ramka is our contribution to the current chapter: a{' '}
            <Link href="/blog/headless-lightbox" className={inlineLinkClassName}>
              headless React lightbox
            </Link>{' '}
            built on the parts this pattern spent twenty years discovering: a real scroller for the slides, real dialog
            semantics for the modal, and every visible piece of chrome rendered by you. If the history made you want to
            build one, the{' '}
            <Link href="/docs" className={inlineLinkClassName}>
              docs
            </Link>{' '}
            take about ten minutes. Dim the room. Light the picture.
          </Prose>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
