import { CodeBlock } from '../../../_components/code-block';
import { DocsLink } from '../../../_components/docs-link';
import { DocsPager } from '../../../_components/docs-pager';
import { DocsSection, DocsShell, type DocsTocItem } from '../../../_components/docs-shell';
import { lightboxApiHref, lightboxDocsPages } from '../../../_content/lightbox/docs-pages';
import { lightboxExcerpts } from '../../../_content/lightbox/excerpts/generated';

const toc: DocsTocItem[] = [
  { id: 'slides', title: 'Slides + Zoom' },
  { id: 'media-layout', title: 'Media layout' },
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
          Default to Slides + Zoom (swipe carousel with pinch zoom), size media to fill Content, then
          layer chrome. ItemGroup is the stacked-swap alternative. Part of{' '}
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

      <DocsSection id="media-layout" title="Media layout">
        <p>
          Ramka is <em>cosmetically</em> unstyled — colors and chrome are yours — but Media may apply{' '}
          <em>structural</em> fit-box styles via <code className="text-xs">width</code>/
          <code className="text-xs">height</code> (same idea as Next.js{' '}
          <code className="text-xs">&lt;Image&gt;</code>) so the morph target has a correct aspect before
          pixels load. Nothing sizes Slide / Item / Zoom for you: for a fullscreen gallery, make the media
          stack fill <DocsLink href={lightboxApiHref.content}>Content</DocsLink> so when Zoom scales past
          1× the image can cover the viewport and is not clipped by a shorter ancestor.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <code className="text-xs">Content</code> — fullscreen surface (
            <code className="text-xs">fixed inset-0</code> / full dialog)
          </li>
          <li>
            <code className="text-xs">Slides</code> — <code className="text-xs">flex-1</code> (or equivalent
            stretch)
          </li>
          <li>
            <code className="text-xs">Slide</code> — <code className="text-xs">h-full</code>
          </li>
          <li>
            <code className="text-xs">Item</code> — <code className="text-xs">size-full</code>
          </li>
          <li>
            <code className="text-xs">Zoom</code> — already fills + centers (structural); add padding
            for chrome / safe-area insets
          </li>
          <li>
            <code className="text-xs">Media</code> — sized fit-box (morph + placeholder host);{' '}
            <code className="text-xs">&lt;img&gt;</code> / <code className="text-xs">&lt;video&gt;</code>{' '}
            inside
          </li>
        </ul>
        <p>
          Keep Close, Counter, Caption, and thumbnails as <em>absolutely positioned siblings</em> of
          Slides (see Chrome below) — not in-flow above or below Zoom. Resting insets belong on Zoom
          padding / safe-area so zoomed media still paints edge-to-edge under chrome. Gesture details
          live in <DocsLink href={lightboxDocsPages.gestures.href}>Gestures</DocsLink>.
        </p>
        <p>
          Set HTML <code className="text-xs">width</code> and <code className="text-xs">height</code> on
          the destination <code className="text-xs">&lt;img&gt;</code> (from known pixel dims or CMS
          metadata) so the box and aspect ratio exist <em>before</em> pixels load. That avoids CLS,
          keeps the morph target sized on slow networks, and prevents an unloaded{' '}
          <code className="text-xs">size: auto</code> image from collapsing to 0×0 (which can skip or
          weaken the open morph). When dimensions are unknown, see{' '}
          <DocsLink href="/examples/lightbox/moodboard">Moodboard</DocsLink>.
        </p>
        <p>
          To fill the maximum available space without distorting the source aspect ratio, nest Media under{' '}
          <DocsLink href={lightboxApiHref.zoom}>Lightbox.Zoom</DocsLink> (a size container for{' '}
          <code className="text-xs">cqw</code>/<code className="text-xs">cqh</code>) and pass{' '}
          <code className="text-xs">width</code>/<code className="text-xs">height</code> to{' '}
          <DocsLink href={lightboxApiHref.media}>Lightbox.Media</DocsLink>. Media applies the inscribed
          fit-box (
          <code className="text-xs">min(100cqw, 100cqh × w/h)</code> +{' '}
          <code className="text-xs">aspect-ratio: w / h</code>). Or put HTML{' '}
          <code className="text-xs">width</code>/<code className="text-xs">height</code> on the child
          image and omit the Media props — Media derives the box. When the box matches the source
          aspect, child <code className="text-xs">object-fit</code> is a no-op; put border-radius on Media
          (morph target). Leave chrome outside Media. Resting insets belong on Zoom padding / safe-area
          so zoomed media still paints edge-to-edge under chrome.
        </p>
        <CodeBlock
          code={lightboxExcerpts['media-fit-box'].code}
          title={lightboxExcerpts['media-fit-box'].title}
        />
        <p>
          Live compositions:{' '}
          <DocsLink href="/examples/lightbox/responsive-gallery">Responsive gallery</DocsLink>,{' '}
          <DocsLink href="/examples/lightbox/photos-app">Photos app</DocsLink>.
        </p>
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
