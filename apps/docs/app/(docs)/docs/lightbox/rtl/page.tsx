import { DocsDemo } from '../../../../_components/docs-demo';
import { DocsLink } from '../../../../_components/docs-link';
import { DocsPager } from '../../../../_components/docs-pager';
import { DocsSection, DocsShell, type DocsTocItem } from '../../../../_components/docs-shell';
import { lightboxApiHref, lightboxDocsPages } from '../../../../_content/lightbox/docs-pages';
import { lightboxExcerpts } from '../../../../_content/lightbox/excerpts/generated';
import { RtlHandleDemo } from '../rtl-demos';

const toc: DocsTocItem[] = [
  { id: 'setup', title: 'Setting the direction' },
  { id: 'scoped', title: 'Scoping RTL to one viewer' },
  { id: 'mirrors', title: 'What mirrors' },
  { id: 'imperative', title: 'Indices never mirror' },
  { id: 'styling', title: 'Styling for RTL' },
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
          RTL takes two things, and they are deliberately separate. The{' '}
          <code className="text-xs">dir</code> prop on{' '}
          <DocsLink href={lightboxApiHref.root}>Root</DocsLink> mirrors the lightbox’s{' '}
          <em>behaviour</em> — scroll geometry, arrow keys, the thumbnail strip. CSS{' '}
          <code className="text-xs">direction</code> mirrors the <em>layout</em>. Setting{' '}
          <code className="text-xs">dir=&quot;rtl&quot;</code> on <code className="text-xs">&lt;html&gt;</code>{' '}
          gives you the second one for the whole app, including the portaled viewer.
        </p>
        <p>
          Keep them in agreement. A <code className="text-xs">dir</code> attribute on an app wrapper{' '}
          <em>looks</em> like it should be enough, but <DocsLink href={lightboxApiHref.portal}>Portal</DocsLink>{' '}
          mounts on <code className="text-xs">document.body</code>, so the viewer never inherits it — you get
          RTL behaviour inside an LTR box. In development the library detects that mismatch and warns
          with the fix.
        </p>
        <DocsDemo
          code={lightboxExcerpts['rtl-setup'].code}
          title={lightboxExcerpts['rtl-setup'].title}
        >
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            These docs are an LTR page, so the live demo below uses the scoped technique instead.
          </p>
        </DocsDemo>
      </DocsSection>

      <DocsSection id="scoped" title="Scoping RTL to one viewer">
        <p>
          If the surrounding app is LTR and only one surface is RTL, you cannot flip{' '}
          <code className="text-xs">&lt;html&gt;</code>. Give{' '}
          <DocsLink href={lightboxApiHref.portal}>Portal</DocsLink> a{' '}
          <code className="text-xs">container</code> that carries{' '}
          <code className="text-xs">dir=&quot;rtl&quot;</code> itself: the viewer then mounts inside an
          element whose direction it can inherit, and the CSS direction matches the{' '}
          <code className="text-xs">dir</code> prop again.
        </p>
        <p>
          Mount the host on <code className="text-xs">document.body</code> rather than inside your own
          layout. A fixed-position viewer is positioned against the viewport, but any ancestor with a{' '}
          <code className="text-xs">transform</code>, <code className="text-xs">filter</code>, or{' '}
          <code className="text-xs">contain</code> becomes its containing block instead — which would
          shrink the viewer to that box.
        </p>
        <DocsDemo
          code={lightboxExcerpts['rtl-scoped-portal'].code}
          title={lightboxExcerpts['rtl-scoped-portal'].title}
        >
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            This is the technique powering the demo further down the page.
          </p>
        </DocsDemo>
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

      <DocsPager prev={lightboxDocsPages.zoom} next={lightboxDocsPages.api} />
    </DocsShell>
  );
}
