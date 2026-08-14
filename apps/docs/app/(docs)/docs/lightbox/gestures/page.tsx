import { CodeBlock } from '../../../../_components/code-block';
import { DocsLink } from '../../../../_components/docs-link';
import { DocsPager } from '../../../../_components/docs-pager';
import { DocsSection, DocsShell, type DocsTocItem } from '../../../../_components/docs-shell';
import { PropSectionTitle } from '../../../../_components/prop-section-title';
import { lightboxApiHref, lightboxDocsPages } from '../../../../_content/lightbox/docs-pages';
import { lightboxExcerpts } from '../../../../_content/lightbox/excerpts/generated';

const toc: DocsTocItem[] = [
  { id: 'pull', title: 'Pull-to-dismiss' },
  { id: 'zoom', title: 'Zoom' },
  { id: 'keyboard', title: 'Keyboard & focus' },
  { id: 'matrix', title: 'Interaction matrix' },
];

export default function LightboxGesturesPage() {
  return (
    <DocsShell
      title="Gestures"
      description={
        <>
          Pull-to-dismiss, zoom/pan, and keyboard ownership. Part of{' '}
          <DocsLink href={lightboxDocsPages.overview.href}>Lightbox</DocsLink>. For a full product composition see the{' '}
          <DocsLink href="/presets/twitter">Twitter preset</DocsLink>.
        </>
      }
      toc={toc}
    >
      <DocsSection
        id="pull"
        title={
          <PropSectionTitle partHref={lightboxApiHref.content} part="Content" prop="pullToClose" sectionId="pull" />
        }
      >
        <p>
          Content enables pull-to-dismiss by default (<code className="text-xs">pullToClose</code>). Drag down (touch)
          or wheel-dismiss (trackpad) scales the surface and sets <code className="text-xs">data-pulling</code> /{' '}
          <code className="text-xs">data-pull-dismissing</code> plus{' '}
          <code className="text-xs">--lightbox-pull-progress</code> (0→1).
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Hit target is Stage-wide (or Content when Stage is omitted) — letterbox and empty Stage area can start a
            pull, matching trackpad wheel. Interactive controls (buttons, links, inputs,{' '}
            <code className="text-xs">[data-ramka-no-pull]</code>) keep their press. Side panels outside Stage do not
            start a pull.
          </li>
          <li>
            Disabled while zoomed above 1×, and while Slides is scrolling until <code className="text-xs">scrollend</code>{' '}
            (so a gallery swipe that turns vertical cannot pull mid-gesture).
          </li>
          <li>
            Backdrop is optional — when used, nest it inside <DocsLink href={lightboxApiHref.portal}>Portal</DocsLink>{' '}
            beside Content. Pull still works if you omit Backdrop.
          </li>
        </ul>
        <p>
          Open/close fades live on <code className="text-xs">.lightbox-demo-backdrop</code> /{' '}
          <code className="text-xs">.lightbox-demo-content</code> (
          <code className="text-xs">app/lightbox-demo/open-close.css</code>). Pull then modulates the open scrim (media
          stays opaque) via <code className="text-xs">pull-progress.css</code>.
        </p>
        <p>
          When a pull is released short of the threshold, the surface springs back and the library publishes{' '}
          <code className="text-xs">--lightbox-pull-snap-duration</code> /{' '}
          <code className="text-xs">--lightbox-pull-snap-easing</code> for the duration of that spring. Reference them in
          your <code className="text-xs">transition</code> (with your open/close values as the fallbacks, as below) and
          anything keyed to <code className="text-xs">--lightbox-pull-progress</code> — backdrop opacity, chrome, blur —
          eases back on the exact same curve and duration as the item, automatically.
        </p>
        <CodeBlock
          code={lightboxExcerpts['open-close-css'].code}
          title={lightboxExcerpts['open-close-css'].title}
          lang="css"
        />
        <CodeBlock
          code={lightboxExcerpts['pull-progress-css'].code}
          title={lightboxExcerpts['pull-progress-css'].title}
          lang="css"
        />
      </DocsSection>

      <DocsSection id="zoom" title="Zoom">
        <p>
          Wrap media in <DocsLink href={lightboxApiHref.zoom}>Zoom</DocsLink> (inside Item, typically inside Slide).
          Prefer <DocsLink href={lightboxApiHref.media}>Media</DocsLink> inside Zoom so pan / maxZoom use the sized
          content box. Supports pinch, pan, double-tap, ctrl/meta+wheel (or{' '}
          <code className="text-xs">scrollToZoom</code>), and keyboard pan when focused.
        </p>
        <p>
          Zoomed media can cover the full Content surface only if Slide → Item → Zoom → Media fill that box — see{' '}
          <DocsLink href={`${lightboxDocsPages.composition.href}#media-layout`}>Composition → Media layout</DocsLink>.
        </p>
        <p>
          <DocsLink href={lightboxApiHref.zoomIn}>ZoomIn</DocsLink> /{' '}
          <DocsLink href={lightboxApiHref.zoomOut}>ZoomOut</DocsLink> can sit in toolbar chrome outside Zoom — they
          target the <em>active</em> slide via Root’s active-zoom bridge. Content reflects{' '}
          <code className="text-xs">data-zooming</code> / <code className="text-xs">data-zoomed</code> for styling.
        </p>
        <CodeBlock code={lightboxExcerpts['zoom-bridge'].code} title={lightboxExcerpts['zoom-bridge'].title} />
      </DocsSection>

      <DocsSection id="keyboard" title="Keyboard & focus">
        <p>
          <DocsLink href={lightboxApiHref.content}>Content</DocsLink> is the keyboard authority while open:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <code className="text-xs">Escape</code> — close
          </li>
          <li>Arrow keys — pan when zoomed, otherwise previous/next</li>
          <li>
            <code className="text-xs">+</code> / <code className="text-xs">-</code> /{' '}
            <code className="text-xs">⌘/Ctrl+0</code> — zoom in / out / reset (active Zoom)
          </li>
        </ul>
        <p>
          Focus is trapped in the dialog; closing restores focus to the opening Trigger. Native page pinch-zoom is
          blocked while Content is mounted so it does not fight <code className="text-xs">Lightbox.Zoom</code>.
        </p>
      </DocsSection>

      <DocsSection id="matrix" title="Interaction matrix">
        <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
              <tr>
                <th className="px-3 py-2 font-medium">State</th>
                <th className="px-3 py-2 font-medium">Pull</th>
                <th className="px-3 py-2 font-medium">Zoom chrome / buttons</th>
                <th className="px-3 py-2 font-medium">Prev / Next</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              <tr>
                <td className="px-3 py-2 text-neutral-700 dark:text-neutral-300">Idle, zoom = 1</td>
                <td className="px-3 py-2">Allowed</td>
                <td className="px-3 py-2">Allowed</td>
                <td className="px-3 py-2">Allowed</td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-neutral-700 dark:text-neutral-300">Zoomed &gt; 1</td>
                <td className="px-3 py-2">Blocked</td>
                <td className="px-3 py-2">Allowed</td>
                <td className="px-3 py-2">Arrows pan; buttons still navigate</td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-neutral-700 dark:text-neutral-300">Slides flinging</td>
                <td className="px-3 py-2">Blocked</td>
                <td className="px-3 py-2">Blocked</td>
                <td className="px-3 py-2">Blocked until settle</td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-neutral-700 dark:text-neutral-300">Pulling</td>
                <td className="px-3 py-2">Active</td>
                <td className="px-3 py-2">Should idle</td>
                <td className="px-3 py-2">Should idle</td>
              </tr>
            </tbody>
          </table>
        </div>
      </DocsSection>

      <DocsPager prev={lightboxDocsPages.viewTransitions} next={lightboxDocsPages.zoom} />
    </DocsShell>
  );
}
