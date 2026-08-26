import { CodeBlock } from '../../../../_components/code-block';
import { DocsDemo } from '../../../../_components/docs-demo';
import { DocsLink } from '../../../../_components/docs-link';
import { DocsPager } from '../../../../_components/docs-pager';
import { DocsSection, DocsShell, type DocsTocItem } from '../../../../_components/docs-shell';
import { lightboxApiHref, lightboxDocsPages } from '../../../../_content/lightbox/docs-pages';
import { lightboxExcerpts } from '../../../../_content/lightbox/excerpts/generated';
import { RtlHandleDemo } from '../rtl-demos';

const toc: DocsTocItem[] = [
  { id: 'setup', title: 'Setting the direction' },
  { id: 'scoped', title: 'Already-RTL apps' },
  { id: 'mirrors', title: 'What mirrors' },
  { id: 'imperative', title: 'Indices never mirror' },
  { id: 'styling', title: 'Styling for RTL' },
  { id: 'copy', title: 'Copy is yours' },
];

const tableWrap = 'overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800';
const headRow = 'bg-neutral-50 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400';
const th = 'px-3 py-2 font-medium whitespace-nowrap';
const td = 'px-3 py-2 align-top';
const tdLabel = 'px-3 py-2 align-top text-neutral-700 dark:text-neutral-300';

const mirrorRows: { surface: string; rtl: string; why: string }[] = [
  {
    surface: 'Slide order & scroll',
    rtl: 'Mirrored',
    why: 'Index 0 sits at the inline-start (right) edge; the scroller runs right-to-left.',
  },
  {
    surface: 'Horizontal arrow keys',
    rtl: 'Mirrored',
    why: 'ArrowLeft advances, ArrowRight goes back — travel follows reading order.',
  },
  {
    surface: 'Home / End',
    rtl: 'Not mirrored',
    why: 'Home is always the first item, End the last. They address indices, not sides.',
  },
  {
    surface: 'Thumbnail strip',
    rtl: 'Mirrored',
    why: 'Track, padding, and the active-thumb indicator all run on the inline axis.',
  },
  {
    surface: 'Previous / Next',
    rtl: 'Mirrored position',
    why: 'Previous is the item nearer index 0, so it belongs on the inline-start side.',
  },
  {
    surface: 'Zoomed panning',
    rtl: 'Not mirrored',
    why: 'Direct manipulation of a surface: ArrowRight pans right, as on a map.',
  },
  {
    surface: 'Pull-to-dismiss',
    rtl: 'Not mirrored',
    why: 'The sheet follows your finger, which has no reading direction.',
  },
  {
    surface: 'Morph / view transitions',
    rtl: 'Mirrored',
    why: 'The morph measures the trigger and the slide, so it follows whatever they do.',
  },
];

export default function LightboxRtlPage() {
  return (
    <DocsShell
      title="RTL support"
      description={
        <>
          Run the lightbox in a right-to-left reading direction — Arabic, Hebrew, Persian, Urdu. Part
          of <DocsLink href={lightboxDocsPages.overview.href}>Lightbox</DocsLink>.
        </>
      }
      toc={toc}
    >
      <DocsSection id="setup" title="Setting the direction">
        <p>
          One prop. <code className="text-xs">dir=&quot;rtl&quot;</code> on{' '}
          <DocsLink href={lightboxApiHref.root}>Root</DocsLink> mirrors the lightbox’s behaviour —
          scroll geometry, arrow keys, thumbnail-strip travel — and is written to the{' '}
          <DocsLink href={lightboxApiHref.portal}>Portal</DocsLink> host as a{' '}
          <code className="text-xs">dir</code> attribute, so CSS direction follows it too. That matters
          because the host mounts on <code className="text-xs">document.body</code>: a{' '}
          <code className="text-xs">dir</code> on your own layout wrapper would style the page and
          never reach the viewer.
        </p>
        <p>
          Because the prop crosses the portal boundary on its own, it is also all you need to run a
          single RTL lightbox inside an otherwise-LTR page — no wrapper element, no portal{' '}
          <code className="text-xs">container</code>. The demo further down this page does exactly
          that: these docs are LTR.
        </p>
        <DocsDemo
          code={lightboxExcerpts['rtl-setup'].code}
          title={lightboxExcerpts['rtl-setup'].title}
        >
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Behaviour and layout both follow the prop — see the live gallery below.
          </p>
        </DocsDemo>
      </DocsSection>

      <DocsSection id="scoped" title="Already-RTL apps">
        <p>
          If the whole app is RTL — <code className="text-xs">dir=&quot;rtl&quot;</code> on{' '}
          <code className="text-xs">&lt;html&gt;</code> — you can omit the prop and the lightbox will
          still <em>look</em> right: nothing is written to the portal host when the prop is absent, so
          it inherits the document’s direction. Layout mirrors, and the page keeps control of it.
        </p>
        <p>
          Pass the prop anyway. Behaviour has no way to read your CSS during render, so it stays on
          its <code className="text-xs">&apos;ltr&apos;</code> default — and RTL layout with LTR
          behaviour is the one misconfiguration with no visible symptom. The carousel still renders and
          still scrolls; it just resolves the wrong index for a scroll position, so the active marker
          and the visible slide drift apart. In development the library compares the two and warns.
        </p>
      </DocsSection>

      <DocsSection id="mirrors" title="What mirrors">
        <p>
          Not everything flips, and the split is not arbitrary. Moving through an ordered list follows
          reading order, so it mirrors. Manipulating a surface directly — panning a zoomed photo,
          dragging a sheet away — does not: a drag follows your hand, and mirroring it would fight the
          gesture. The arrow keys serve both, which is why they mirror while navigating and stay
          physical while zoomed.
        </p>
        <div className={tableWrap}>
          <table className="w-full border-collapse text-left text-sm">
            <thead className={headRow}>
              <tr>
                <th className={th}>Surface</th>
                <th className={th}>Under RTL</th>
                <th className={th}>Why</th>
              </tr>
            </thead>
            <tbody>
              {mirrorRows.map((row) => (
                <tr key={row.surface} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className={tdLabel}>{row.surface}</td>
                  <td className={td}>{row.rtl}</td>
                  <td className={td}>{row.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DocsSection>

      <DocsSection id="imperative" title="Indices never mirror">
        <p>
          The imperative API is index-based, and indices are not sides.{' '}
          <DocsLink href={lightboxApiHref.createHandle}>createHandle()</DocsLink>’s{' '}
          <code className="text-xs">open(3)</code> and <code className="text-xs">goTo(3)</code> land on
          the fourth item in either direction; what changes is that RTL renders it further left and the
          track travels the other way to reach it. The same holds for{' '}
          <code className="text-xs">value</code> / <code className="text-xs">onValueChange</code> and for{' '}
          <DocsLink href={lightboxApiHref.trigger}>Trigger</DocsLink>’s{' '}
          <code className="text-xs">index</code>.
        </p>
        <p>
          The buttons inside the viewer below jump by index. Open it, then watch the strip: the photo
          you land on is the same one an LTR gallery would show.
        </p>
        <DocsDemo
          code={lightboxExcerpts['rtl-handle'].code}
          title={lightboxExcerpts['rtl-handle'].title}
        >
          <RtlHandleDemo />
        </DocsDemo>
      </DocsSection>

      <DocsSection id="styling" title="Styling for RTL">
        <p>
          The library ships no styles, so mirroring your own chrome is your job — and logical
          properties do nearly all of it. Reach for{' '}
          <code className="text-xs">inset-inline-start</code> /{' '}
          <code className="text-xs">inset-inline-end</code> over{' '}
          <code className="text-xs">left</code> / <code className="text-xs">right</code>,{' '}
          <code className="text-xs">padding-inline</code> over{' '}
          <code className="text-xs">padding-left</code>, and{' '}
          <code className="text-xs">border-inline-start</code> for a divider beside a panel that
          changes sides. In Tailwind those are <code className="text-xs">start-*</code>,{' '}
          <code className="text-xs">end-*</code>, <code className="text-xs">ps-*</code>,{' '}
          <code className="text-xs">pe-*</code>, <code className="text-xs">ms-*</code>, and{' '}
          <code className="text-xs">text-start</code>. Every preset in this documentation is written
          this way.
        </p>
        <p>
          Three things logical properties will not fix. Directional glyphs need flipping —{' '}
          <code className="text-xs">.nav:dir(rtl) svg &#123; transform: scaleX(-1); &#125;</code> turns a
          chevron around, since mirroring only the button’s position leaves it pointing the wrong way.
          Safe-area insets are physical, so pairing{' '}
          <code className="text-xs">inset-inline-start</code> with{' '}
          <code className="text-xs">env(safe-area-inset-left)</code> clears the notch on the wrong side;
          map them to the inline axis through a custom property that you swap under{' '}
          <code className="text-xs">:dir(rtl)</code>. And a counter like{' '}
          <code className="text-xs">1 / 7</code> is two digit runs around a neutral separator with
          nothing to anchor them, so an RTL base direction reorders it into{' '}
          <code className="text-xs">7 / 1</code> — give{' '}
          <DocsLink href={lightboxApiHref.counter}>Counter</DocsLink>{' '}
          <code className="text-xs">direction: ltr; unicode-bidi: isolate;</code>.
        </p>
      </DocsSection>

      <DocsSection id="copy" title="Copy is yours">
        <p>
          Direction is only half of internationalization. The other half is words, and the library
          ships none of them — not a label, not a role description, not a slide name. A headless
          library cannot know your language, and a string baked into a primitive is copy you never
          approved: an English “carousel” announced inside Hebrew speech is worse than no
          announcement at all, and there is no prop-drilling escape once it is compiled in.
        </p>
        <p>
          So every string a screen reader reads comes from you. Two of them are easy to miss because
          they are not visible on screen:{' '}
          <code className="text-xs">aria-roledescription</code> on{' '}
          <DocsLink href={lightboxApiHref.slides}>Slides</DocsLink> and{' '}
          <DocsLink href={lightboxApiHref.item}>Item</DocsLink>, which replaces the word for the
          role, and the slide’s <code className="text-xs">aria-label</code>, which is where the{' '}
          <a
            className="underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-500 dark:decoration-neutral-700 dark:hover:decoration-neutral-500"
            href="https://www.w3.org/WAI/ARIA/apg/patterns/carousel/"
            target="_blank"
            rel="noreferrer"
          >
            APG carousel pattern
          </a>{' '}
          puts the position, because a <code className="text-xs">group</code> cannot carry{' '}
          <code className="text-xs">aria-posinset</code>. A slide’s caption does not name it either,
          so a captioned slide with no label is still nameless. In development the library says so
          rather than letting it ship silently.
        </p>
        <p>
          Add a thumbnail strip and the naming moves: each item becomes a{' '}
          <code className="text-xs">tabpanel</code> named by its thumbnail tab, so label the
          thumbnails and leave the items to inherit it.
        </p>
        <CodeBlock
          code={lightboxExcerpts['i18n-copy'].code}
          title={lightboxExcerpts['i18n-copy'].title}
        />
      </DocsSection>

      <DocsPager prev={lightboxDocsPages.zoom} next={lightboxDocsPages.api} />
    </DocsShell>
  );
}
