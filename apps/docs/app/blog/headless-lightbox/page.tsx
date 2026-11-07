import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';

import { CodeBlock } from '../../_components/code-block';
import { LandingDemo } from '../../_components/landing-demo';
import { SiteFooter } from '../../_components/site-footer';
import { SiteHeader } from '../../_components/site-header';
import { siteUrl } from '../../_content/site';
import { ChromeBuilder } from './chrome-builder';

const PUBLISHED = '2026-08-29';

const seoTitle = 'The case for a headless React lightbox';
const seoDescription =
  'How a headless React lightbox turns custom buttons, captions, layouts and sidebars into ordinary JSX instead of config options. With a live composer demo.';

export const metadata: Metadata = {
  title: seoTitle,
  description: seoDescription,
  // The root layout's Open Graph / Twitter objects describe the homepage and
  // are inherited wholesale (Next.js does not deep-merge them), so each
  // article must emit its own social metadata.
  openGraph: {
    title: `${seoTitle} — ramka`,
    description: seoDescription,
    url: `${siteUrl}/blog/headless-lightbox`,
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
  headline: 'The case for a headless React lightbox',
  description:
    'Why a composable, headless API is the lightbox feature that makes every other feature reachable: config objects versus composition, what render slots cannot fit, and a live demo that composes an image viewer piece by piece.',
  url: `${siteUrl}/blog/headless-lightbox`,
  datePublished: PUBLISHED,
  author: { '@type': 'Person', name: 'Artur Bień' },
  keywords:
    'headless lightbox, headless ui, react lightbox, image gallery component, unstyled components, composable api, react image viewer, radix-style primitives',
};

const workaroundCode = `// The documented workaround, from the maintainer, for
// "hide the arrows when there is only one image":
const renderNavigation = slides.length <= 1 ? () => null : undefined;

<Lightbox
  render={{ buttonPrev: renderNavigation, buttonNext: renderNavigation }}
  // ...and a separate setting so the keyboard agrees with the buttons
  carousel={{ finite: true }}
/>`;

const composedFixCode = `{/* The same fix when the buttons are yours to render */}
{items.length > 1 && (
  <>
    <PrevButton />
    <NextButton />
  </>
)}`;

const shapeOneCode = `const lightbox = new Lightbox({
  gallery: '#gallery',
  children: 'a',
});

// A custom toolbar button is an HTML string with a z-order.
// The built-ins have fixed slots: the counter is order 5,
// zoom is 10, info is 15, the close button is order 20.
lightbox.on('uiRegister', () => {
  lightbox.pswp.ui.registerElement({
    name: 'share-button',
    ariaLabel: 'Share photo',
    order: 9,
    isButton: true,
    html: '<svg viewBox="0 0 24 24">…</svg>',
    onClick: (event, el) => {
      /* … */
    },
  });
});`;

const shapeTwoCode = `<!-- The caption is HTML, in a string, in an attribute. -->
<a
  href="photos/coast.jpg"
  data-sub-html="<h4>Golden hour</h4><p>Shot on the coast road.</p>"
>
  <img src="photos/coast-thumb.jpg" alt="Golden hour" />
</a>`;

const shapeTwoConfigCode = `lightbox(element, {
  licenseKey: '0000-0000-000-0000',
  nextHtml: '<svg>…</svg>', // the next button, as a string
  prevHtml: '<svg>…</svg>',
  strings: { closeGallery: 'Close gallery' }, // i18n, as config
  ariaLabelledby: 'gallery-heading', // ARIA, as config
  mobileSettings: { controls: false, showCloseIcon: true },
});`;

const shapeThreeCode = `<Lightbox
  open={open}
  close={() => setOpen(false)}
  slides={[{ src, title, description }]}
  plugins={[Captions, Counter, Thumbnails, Zoom]}
  labels={{ Next: 'Next photo', Close: 'Close' }}
  render={{
    buttonPrev: () => <MyPrevButton />,
    iconClose: () => <MyCloseIcon />,
  }}
  styles={{ container: { ... }, button: { ... }, icon: { ... } }}
/>`;

const ramkaShapeCode = `<Lightbox.Root>
  <Lightbox.Trigger index={0}>
    <img src={photo.thumb} alt={photo.alt} />
  </Lightbox.Trigger>

  <Lightbox.Portal>
    <Lightbox.Backdrop className="…" />
    <Lightbox.Content aria-label={t('viewer.title')} className="…">
      <Lightbox.Slides className="…">{/* your slides */}</Lightbox.Slides>

      {/* Every element below is yours: attach anything an element can carry. */}
      <Tooltip content={t('viewer.closeHint')}>
        <Lightbox.Close aria-label={t('viewer.close')} data-testid="viewer-close">
          <X />
        </Lightbox.Close>
      </Tooltip>
    </Lightbox.Content>
  </Lightbox.Portal>
</Lightbox.Root>`;

const sidebarCode = `<Lightbox.Content className="grid md:grid-cols-[1fr_360px]">
  {/* Stage scopes the gestures to the media pane */}
  <Lightbox.Stage>
    <Lightbox.Slides>{/* … */}</Lightbox.Slides>
  </Lightbox.Stage>

  {/* A real sidebar: your components, live beside the photo,
      with native scroll and its own keyboard behavior. */}
  <aside aria-label="Comments">
    <CommentThread photoId={activePhotoId} />
  </aside>
</Lightbox.Content>`;

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

export default function HeadlessLightboxPage() {
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
            The case for a headless React lightbox
          </h1>
          <p className="mt-5 text-pretty text-[17px] leading-7 text-neutral-500 dark:text-neutral-400">
            Here is a feature request from a popular lightbox&rsquo;s issue tracker: hide the arrow buttons when the
            gallery has a single image. A reasonable ask. It was closed the same day, and the resolution was not a
            feature. It was a workaround, and &ldquo;how do I do this&rdquo; comments kept arriving for the next two
            years.
          </p>

          <div className="mt-6">
            <CodeBlock code={workaroundCode} title="Hiding two buttons, config-object style" />
          </div>

          <Prose>
            Pass a function that renders nothing into a render slot, conditionally, remembering the keyboard needs its
            own flag. Compare the same fix in a lightbox where the buttons are elements you were already rendering:
          </Prose>

          <div className="mt-5">
            <CodeBlock code={composedFixCode} title="Hiding two buttons, composition style" />
          </div>

          <Prose>
            An if statement. Nobody files an issue for an if statement. That gap is what this post is about, and it has
            nothing to do with effort or code quality. The maintainer&rsquo;s{' '}
            <Ext href="https://github.com/igordanchenko/yet-another-react-lightbox/issues/17">workaround</Ext> is clever
            and the library it belongs to is good. The gap comes from the shape of the API, nothing else: the shape
            decides which problems are yours to solve in an afternoon and which ones are feature requests to a stranger.
          </Prose>

          <Heading>The three shapes of lightbox APIs</Heading>
          <Prose>
            Survey the popular lightbox and image gallery libraries and nearly every API is one of three shapes. No
            names here, because the point is not that these libraries are bad. They are the most polished versions of
            their pattern. The point is the ceiling each pattern builds in.
          </Prose>
          <Prose>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">
              Shape one: a selector and a config object.
            </strong>{' '}
            You hand the library a CSS selector and it takes the DOM from there. The markup inside the viewer is the
            library&rsquo;s, so adding your own button means serializing your UI into a string and aiming it with a
            magic number:
          </Prose>
          <div className="mt-5">
            <CodeBlock code={shapeOneCode} lang="javascript" title="Shape one: UI as strings, position as a number" />
          </div>
          <Prose>
            Your share button is <code className="text-[13px]">html: '&lt;svg&gt;…&lt;/svg&gt;'</code>. Not a component.
            A string, positioned relative to the built-ins by knowing that the close button lives at order 20. If the
            button needs state, a tooltip from your design system, or a React portal, you are now managing a DOM island
            inside someone else&rsquo;s DOM.
          </Prose>
          <Prose>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Shape two: data attributes.</strong>{' '}
            The gallery is declared in HTML — a lineage that runs straight back to{' '}
            <Link href="/blog/story-of-the-lightbox" className={inlineLinkClassName}>
              2005&rsquo;s <code className="text-[13px]">rel=&quot;lightbox&quot;</code> attribute
            </Link>{' '}
            — which sounds friendly until your caption is a heading and a paragraph:
          </Prose>
          <div className="mt-5">
            <CodeBlock
              code={shapeTwoCode}
              lang="jsx"
              title="Shape two: your caption is HTML in a string in an attribute"
            />
          </div>
          <Prose>
            HTML, in a string, in an attribute, waiting to be parsed and injected at open time. Everything else routes
            through the config object: the next and previous buttons are <code className="text-[13px]">nextHtml</code>{' '}
            and <code className="text-[13px]">prevHtml</code> option strings, translations are a{' '}
            <code className="text-[13px]">strings</code> map, and even ARIA wiring arrives as options:
          </Prose>
          <div className="mt-5">
            <CodeBlock code={shapeTwoConfigCode} lang="javascript" title="Shape two: everything is a setting" />
          </div>
          <Prose>
            One library of this shape documents more than sixty core settings before you have installed a single plugin,
            and the plugins bring their own. That number is not bloat. It is the honest cost of keeping the DOM: every
            decision the library makes for you has to come back to you as an option.
          </Prose>
          <Prose>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">
              Shape three: React, but still a config object.
            </strong>{' '}
            The modern React take accepts arrays and maps instead of selectors and strings, which is real progress. But
            look at where your UI goes:
          </Prose>
          <div className="mt-5">
            <CodeBlock code={shapeThreeCode} title="Shape three: composition through a keyhole" />
          </div>
          <Prose>
            Slides are data, features are a plugin array, words are a <code className="text-[13px]">labels</code> map,
            your components enter one at a time through named <code className="text-[13px]">render</code> slots, and
            styling gets five sanctioned customization points. This is composition through a keyhole. Each slot is real
            and each slot works, but the set of slots is finite, and it is exactly the set the author thought to cut. To
            its credit, this shape cuts generous holes — there is a slot for rendering whole custom slides and one for
            overlaying extra controls — yet each is still a named opening in the same wall, usable exactly where the
            author aimed it. The one-image workaround that opened this post lives in this shape, and no wonder: when
            rendering belongs to the library, you customize by exception.
          </Prose>
          <Prose>
            One more thing all three shapes share: step zero of every install guide is importing the library&rsquo;s
            stylesheet. That import sets the terms for every pixel after it. Making the viewer look like your product
            means overriding someone else&rsquo;s selectors. The better libraries document CSS variables and class names
            for exactly this, but the documented list is one more config surface, and everything off the list is an
            internal you hope survives the next release. Dark mode has to undo their colors before applying yours. And
            the bytes ship regardless, including the ones for pixels you just repainted. A required stylesheet is the
            config object of styling: a list of decisions someone else already made, plus escape hatches.
          </Prose>

          <Heading>Why config APIs grow forever</Heading>
          <Prose>
            None of these authors set out to build a settings museum. The options accumulate one reasonable request at a
            time. Someone needs the counter on the left. Someone needs captions under the image instead of over it.
            Someone needs the close button to say &ldquo;Schließen&rdquo;. When the library owns the DOM, the only way
            to say yes is a new option, so the options page becomes a list of every customization the author predicted.
            The requests the author did not predict become wrapper-div hacks, CSS fights against inline styles, forks,
            or that politely closed issue with a workaround.
          </Prose>
          <Prose>
            The deeper problem is that a config API has to be designed twice. Once for the feature, once for every way
            someone might want the feature to differ. A rendered element needs no second design. If you render the
            counter, you can also move it, restyle it, translate it, or wrap it in a tooltip, and none of those verbs
            needed to be anticipated by anyone.
          </Prose>

          <Heading>The ecosystem already voted</Heading>
          <Prose>
            This is not some niche philosophy. The React ecosystem already builds every other overlay this way. Headless
            primitives sit under a huge share of production dialogs, menus, and selects:{' '}
            <Ext href="https://www.npmjs.com/package/@radix-ui/react-dialog">the most-installed primitive library</Ext>{' '}
            counts its npm downloads in the hundreds of millions per month at the time of writing, and the most-starred
            React UI project on GitHub, <Ext href="https://github.com/shadcn-ui/ui">at roughly 122,000 stars</Ext>, is a
            CLI that copies composable component source into your repo so you own every line. In the{' '}
            <Ext href="https://2024.stateofreact.com/en-US/libraries/component-libraries/">State of React survey</Ext>,
            its usage doubled from 20 to 42 percent in a single year. Adoption numbers are not a controlled study of
            motives, but the direction is hard to misread: offered both models, developers keep picking ownership.
          </Prose>
          <Prose>
            React lightboxes mostly sat this shift out, for a defensible reason. A fullscreen image viewer is the
            hardest overlay there is: scroll physics, pinch zoom, pull to dismiss, morph transitions. Authors kept the
            DOM because handing it over risks the physics. ramka&rsquo;s bet is that the two concerns split cleanly: the
            physics live in the engine, on{' '}
            <Link href="/blog/why-native-scrolling" className={inlineLinkClassName}>
              a real scroller the browser drives
            </Link>
            , and the DOM lives with you, the way Radix, Base UI, and shadcn/ui trained everyone to expect.
          </Prose>

          <Heading>What owning the markup buys</Heading>
          <Prose>Here is the whole API shape. It should look familiar if you have used any headless primitive:</Prose>
          <div className="mt-5">
            <CodeBlock code={ramkaShapeCode} title="ramka: the API is the markup" />
          </div>
          <Prose>
            Every visible piece of chrome in the viewer is one you rendered — the library&rsquo;s own additions are
            plumbing, like the focus guards and the portal host, never a button or a pixel of UI — so every element can
            carry whatever your app needs it to carry. An <code className="text-[13px]">aria-label</code> in your
            user&rsquo;s language rather than{' '}
            <Link href="/blog/lightbox-accessibility" className={inlineLinkClassName}>
              a hard-coded English string
            </Link>
            . The tooltip component the rest of your product uses. A <code className="text-[13px]">data-testid</code>{' '}
            for the end-to-end suite, an analytics attribute for the click tracker. Your{' '}
            <code className="text-[13px]">Image</code> component as the slide, with its own{' '}
            <code className="text-[13px]">srcset</code> logic and placeholders. None of that is a feature of ramka. It
            is what falls out of the library not standing between you and your own elements.
          </Prose>
          <Prose>
            Styling follows the same rule. There is no <code className="text-[13px]">ramka.css</code>, so there is
            nothing to import, nothing to override, and no specificity contest to win. The primitives apply only the
            functional styles they cannot work without, like the scroll and snap geometry on Slides; every visual
            decision waits for you. Every part takes a <code className="text-[13px]">className</code> like any element
            you wrote, whether that means Tailwind, CSS Modules, or your design tokens; every viewer on this site is
            styled with plain Tailwind against these same primitives. And an upgrade cannot break your styles by
            renaming a private selector or reshuffling an internal DOM you were forced to target, because your styles
            were never attached to either.
          </Prose>
          <Prose>
            Do not take the claim on faith. Below is a viewer in the split, social-app layout, media pane plus post
            thread, built from the same primitives. Toggle its pieces and watch the JSX follow:
          </Prose>

          <ChromeBuilder />

          <p className="mt-6 text-[15px] leading-7">
            <Link href="/docs/lightbox/composition" className={inlineLinkClassName}>
              Build this yourself with ramka&rsquo;s composition guide&nbsp;&rarr;
            </Link>
          </p>

          <Heading>What a keyhole can never fit</Heading>
          <Prose>
            Render slots cover the customizations the author predicted, and predictions run out fast. The requests that
            end as wontfix in config lightboxes are the ones where your UI is not replacing a built-in piece but adding
            structure the config schema has no word for. A comment thread beside the photo, say, the pattern every
            social app uses:
          </Prose>
          <div className="mt-5">
            <CodeBlock code={sidebarCode} title="Structure no config schema has a word for" />
          </div>
          <Prose>
            In ramka that is a grid with an <code className="text-[13px]">aside</code> in it, because the viewer is your
            markup and{' '}
            <Link href="/docs/lightbox/composition" className={inlineLinkClassName}>
              Stage scopes the gestures
            </Link>{' '}
            to the media pane. It is the exact structure the &ldquo;Post sidebar&rdquo; switch was toggling in the demo
            above. In a config lightbox the nearest escape hatch is a slot for overlaying absolutely positioned elements
            on top of the viewer, which is not the same as giving the photo a neighbor: a comment sidebar drags in
            layout, scrolling, focus, forms, and state that no options object can describe. The same logic covers the{' '}
            <Link href="/docs/lightbox/view-transitions" className={inlineLinkClassName}>
              morph
            </Link>{' '}
            targeting any element you choose via <code className="text-[13px]">morphRef</code>, the counter rendering
            wherever the design puts it, and video or a canvas or a diagram as a slide. Not because ramka shipped a
            feature for each, but because there is nothing to ask permission from.
          </Prose>

          <Heading>What config APIs do better</Heading>
          <Prose>
            Honesty section, as usual. The config shapes won their popularity for a reason: a working viewer in three
            lines is a genuinely great pitch, and composition cannot match it. A headless lightbox hands you a blank
            page, and a blank page is a real cost. You will write markup on day one that a config library would have
            given you for free.
          </Prose>
          <Prose>
            The answer is the same one shadcn/ui gave for every other component: start from source you own.
            ramka&rsquo;s{' '}
            <Link href="/presets/default" className={inlineLinkClassName}>
              presets
            </Link>{' '}
            are complete, styled viewers, photos, stories, a Twitter-style feed, that you copy into your project and
            edit like code you wrote, because from that moment it is. Day one costs a paste. And the first time you need
            anything the options page would not have listed, the trade flips: your gnarliest customization is an if
            statement, a class name, or an <code className="text-[13px]">aside</code>, in markup you already own.
          </Prose>

          <Heading>Feel it in a real photo gallery</Heading>
          <Prose>
            The gallery below is the composed result: morph open, native swipe, pinch zoom, pull to dismiss, and every
            visible element, buttons, counter, caption, thumbnails, is consumer markup styled with Tailwind. The library
            shipped the behavior and zero pixels of the chrome.
          </Prose>

          <div className="mt-8">
            <LandingDemo eager={false} />
          </div>

          <Prose>
            That is the whole pitch: ramka is a headless React lightbox. The behavior ships in the library; the visible
            structure and styling live in your codebase; the presets keep day one cheap. The{' '}
            <Link href="/docs/lightbox/composition" className={inlineLinkClassName}>
              composition guide
            </Link>{' '}
            is a ten-minute tour of the markup, and the{' '}
            <Link href="/docs/lightbox" className={inlineLinkClassName}>
              lightbox docs
            </Link>{' '}
            go from install to first viewer. ramka is free under the MIT License. Bring your own buttons.
          </Prose>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
