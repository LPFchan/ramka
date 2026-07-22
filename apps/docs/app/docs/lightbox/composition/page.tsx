import { CodeBlock } from '../../../_components/code-block';
import { DocsLink } from '../../../_components/docs-link';
import { DocsPager } from '../../../_components/docs-pager';
import { DocsSection, DocsShell, type DocsTocItem } from '../../../_components/docs-shell';
import { lightboxApiHref, lightboxDocsPages } from '../../../_content/lightbox/docs-pages';
import { lightboxExcerpts } from '../../../_content/lightbox/excerpts/generated';

const toc: DocsTocItem[] = [
  { id: 'slides', title: 'Slides + Zoom' },
  { id: 'chrome', title: 'Chrome' },
  { id: 'item-group', title: 'ItemGroup (swap)' },
  { id: 'item-count', title: 'Dynamic itemCount' },
];

export default function LightboxCompositionPage() {
  return (
    <DocsShell
      title="Composition"
      description={
        <>
          Default to Slides + Zoom (swipe carousel with pinch zoom), then layer chrome. ItemGroup is
          the stacked-swap alternative. Part of{' '}
          <DocsLink href={lightboxDocsPages.overview.href}>Lightbox</DocsLink>.
        </>
      }
      toc={toc}
    >
      <DocsSection id="slides" title="Slides + Zoom">
        <p>
          Prefer <DocsLink href={lightboxApiHref.slides}>Slides</DocsLink> +{' '}
          <DocsLink href={lightboxApiHref.slide}>Slide</DocsLink> for a swipeable snap carousel wired to
          the active index — this is the layout used by nearly every docs demo and example. Slide boxes
          stay mounted; <code className="text-xs">preload</code> gates heavy Item content.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Nesting rule: put <code className="text-xs">Item</code> and{' '}
            <DocsLink href={lightboxApiHref.zoom}>Zoom</DocsLink> <em>inside</em> each{' '}
            <code className="text-xs">Slide</code>. Pull transforms the item, not the snap box.
          </li>
          <li>
            User flings set an internal scroll lock so pull-to-dismiss, zoom chrome, and discrete prev/next
            do not fight the carousel mid-gesture.
          </li>
          <li>
            Scroll-driven index changes report{' '}
            <code className="text-xs">onValueChange</code> with{' '}
            <code className="text-xs">source: &apos;scroll&apos;</code> — see{' '}
            <DocsLink href={lightboxApiHref.types}>NavigationSource</DocsLink>.
          </li>
        </ul>
        <CodeBlock
          code={lightboxExcerpts['slides-nesting'].code}
          title={lightboxExcerpts['slides-nesting'].title}
        />
      </DocsSection>

      <DocsSection id="chrome" title="Chrome">
        <p>
          The site default viewer is Slides + Zoom with Counter (top-left), Close / ZoomIn / ZoomOut,
          Caption, and desktop ThumbnailGroup as siblings inside{' '}
          <DocsLink href={lightboxApiHref.content}>Content</DocsLink>. Thumbnails register by{' '}
          <code className="text-xs">index</code> like Triggers.
        </p>
        <CodeBlock
          code={lightboxExcerpts['chrome-composition'].code}
          title={lightboxExcerpts['chrome-composition'].title}
        />
        <p>
          Full product composition:{' '}
          <DocsLink href="/examples/lightbox/responsive-gallery">Responsive gallery</DocsLink>.
        </p>
      </DocsSection>

      <DocsSection id="item-group" title="ItemGroup (swap)">
        <p>
          Use <DocsLink href={lightboxApiHref.itemGroup}>ItemGroup</DocsLink> when you want a stacked
          viewer instead of a swipe carousel — one item visible at a time, typically with Previous /
          Next / Counter chrome. It mounts the active{' '}
          <DocsLink href={lightboxApiHref.item}>Item</DocsLink> plus <code className="text-xs">preload</code>{' '}
          neighbors (default neighbors depend on the prop; use <code className="text-xs">preload={'{0}'}</code>{' '}
          for active-only).
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <code className="text-xs">active</code> — this item is the current index (drive expensive work
            here).
          </li>
          <li>
            <code className="text-xs">visible</code> — mounted in the preload window (may include neighbors).
            Use for lightweight prefetch; prefer <code className="text-xs">active</code> for video autoplay,
            high-res swaps, etc.
          </li>
        </ul>
        <CodeBlock
          code={lightboxExcerpts['item-group-preload'].code}
          title={lightboxExcerpts['item-group-preload'].title}
        />
      </DocsSection>

      <DocsSection id="item-count" title="Dynamic itemCount">
        <p>
          Items register on mount. The root <code className="text-xs">itemCount</code> is derived from
          registered items — indices do not need to be contiguous, but Counter, loop edges, and preload
          distance all use that count. Prefer dense <code className="text-xs">0…n-1</code> indexes unless
          you intentionally leave holes.
        </p>
      </DocsSection>

      <DocsPager prev={lightboxDocsPages.stateLifecycle} next={lightboxDocsPages.viewTransitions} />
    </DocsShell>
  );
}
