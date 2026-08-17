import { CodeBlock } from '../../../../_components/code-block';
import { DocsLink } from '../../../../_components/docs-link';
import { DocsPager } from '../../../../_components/docs-pager';
import { DocsSection, DocsShell, type DocsTocItem } from '../../../../_components/docs-shell';
import { lightboxApiHref, lightboxDocsPages } from '../../../../_content/lightbox/docs-pages';
import { lightboxExcerpts } from '../../../../_content/lightbox/excerpts/generated';

const toc: DocsTocItem[] = [
  { id: 'slides', title: 'Slides + Zoom' },
  { id: 'media-layout', title: 'Media layout' },
  { id: 'stage', title: 'Stage (split layouts)' },
  { id: 'chrome', title: 'Chrome' },
  { id: 'item-count', title: 'Dynamic itemCount' },
];

export default function LightboxCompositionPage() {
  return (
    <DocsShell
      title="Composition"
      description={
        <>
          Default to Slides + Zoom (swipe carousel with pinch zoom), size media to fill Content, then layer chrome.
          Part of{' '}
          <DocsLink href={lightboxDocsPages.overview.href}>Lightbox</DocsLink>.
        </>
      }
      toc={toc}
    >
      <DocsSection id="slides" title="Slides + Zoom">
        <p>
          Prefer <DocsLink href={lightboxApiHref.slides}>Slides</DocsLink> +{' '}
          <DocsLink href={lightboxApiHref.slide}>Slide</DocsLink> for a swipeable snap carousel wired to the active
          index — this is the layout used by nearly every docs demo and example. Slide boxes stay mounted;{' '}
          <code className="text-xs">preload</code> gates heavy Item content.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Nesting rule: put <code className="text-xs">Item</code> and{' '}
            <DocsLink href={lightboxApiHref.zoom}>Zoom</DocsLink> <em>inside</em> each{' '}
            <code className="text-xs">Slide</code>. Pull transforms the item, not the snap box.
          </li>
          <li>
            User flings set an internal scroll lock so pull-to-dismiss, zoom chrome, and discrete prev/next do not fight
            the carousel mid-gesture.
          </li>
          <li>
            Scroll-driven index changes report <code className="text-xs">onValueChange</code> with{' '}
            <code className="text-xs">source: &apos;scroll&apos;</code> — see{' '}
            <DocsLink href={lightboxApiHref.types}>NavigationSource</DocsLink>.
          </li>
          <li>
            Item render-prop <code className="text-xs">active</code> is the current index (drive expensive work here).{' '}
            <code className="text-xs">visible</code> means the item is in the preload window — use it for lightweight
            prefetch, not video autoplay.
          </li>
        </ul>
        <CodeBlock code={lightboxExcerpts['slides-nesting'].code} title={lightboxExcerpts['slides-nesting'].title} />
        <CodeBlock
          code={lightboxExcerpts['slide-track-css'].code}
          title={lightboxExcerpts['slide-track-css'].title}
          lang="css"
        />
      </DocsSection>

      <DocsSection id="media-layout" title="Media layout">
        <p>
          Ramka is <em>cosmetically</em> unstyled — colors and chrome are yours — but Media may apply{' '}
          <em>structural</em> fit-box styles via <code className="text-xs">width</code>/
          <code className="text-xs">height</code> (same idea as Next.js <code className="text-xs">&lt;Image&gt;</code>)
          so the morph target has a correct aspect before pixels load. Slide width is consumer CSS too —{' '}
          <DocsLink href={lightboxApiHref.slide}>Slide</DocsLink> only bakes in snap alignment (
          <code className="text-xs">scroll-snap-align: center</code>,{' '}
          <code className="text-xs">scroll-snap-stop: always</code>); you size each snap box. For a
          full-bleed carousel, use <code className="text-xs">flex: 0 0 100%</code> and{' '}
          <code className="text-xs">min-width: 100%</code> on each slide (see snippet below). Snug /
          variable-width tracks use a different width formula — see the{' '}
          <DocsLink href="/presets/default">Default preset</DocsLink>. Item and Zoom fill the slide
          content box; size the stack so when Zoom scales past 1× the image can cover the viewport and
          is not clipped by a shorter ancestor.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <code className="text-xs">Content</code> — fullscreen surface (
            <code className="text-xs">fixed inset-0</code> / full dialog)
          </li>
          <li>
            <code className="text-xs">Slides</code> — <code className="text-xs">flex-1</code> (or equivalent stretch)
          </li>
          <li>
            <code className="text-xs">Slide</code> —{' '}
            <code className="text-xs">flex: 0 0 100%; min-width: 100%</code> for a full-bleed track;{' '}
            <code className="text-xs">h-full</code> for height; put chrome / safe-area insets here as padding (not on
            Zoom)
          </li>
          <li>
            <code className="text-xs">Item</code> — already fills the Slide (<code className="text-xs">width/height: 100%</code>)
          </li>
          <li>
            <code className="text-xs">Zoom</code> — already fills + centers (structural)
          </li>
          <li>
            <code className="text-xs">Media</code> — sized fit-box (morph + placeholder host);{' '}
            <code className="text-xs">&lt;img&gt;</code> / <code className="text-xs">&lt;video&gt;</code> inside
          </li>
        </ul>
        <p>
          Keep Close, Counter, Caption, and thumbnails as <em>absolutely positioned siblings</em> of Slides (see Chrome
          below) — not in-flow above or below Zoom. Resting insets belong on Slide padding / safe-area so zoomed media
          can still paint into that padding under chrome. Gesture details live in{' '}
          <DocsLink href={lightboxDocsPages.gestures.href}>Gestures</DocsLink>.
        </p>
        <p>
          Set HTML <code className="text-xs">width</code> and <code className="text-xs">height</code> on the destination{' '}
          <code className="text-xs">&lt;img&gt;</code> (from known pixel dims or CMS metadata) so the box and aspect
          ratio exist <em>before</em> pixels load. That avoids CLS, keeps the morph target sized on slow networks, and
          prevents an unloaded <code className="text-xs">size: auto</code> image from collapsing to 0×0 (which can skip
          or weaken the open morph). When dimensions are unknown, see{' '}
          <DocsLink href="/examples/lightbox/moodboard">Moodboard</DocsLink>. For mixed media (photos
          plus WebGL) with <DocsLink href={lightboxApiHref.root}>onBeforeOpen</DocsLink> preheat, see{' '}
          <DocsLink href="/examples/lightbox/3d-models">3D models</DocsLink>.
        </p>
        <p>
          To fill the maximum available space without distorting the source aspect ratio, nest Media under{' '}
          <DocsLink href={lightboxApiHref.zoom}>Lightbox.Zoom</DocsLink> (a size container for{' '}
          <code className="text-xs">cqw</code>/<code className="text-xs">cqh</code>) and pass{' '}
          <code className="text-xs">width</code>/<code className="text-xs">height</code> to{' '}
          <DocsLink href={lightboxApiHref.media}>Lightbox.Media</DocsLink>. Media applies the inscribed fit-box (
          <code className="text-xs">min(100cqw, 100cqh × w/h)</code> +{' '}
          <code className="text-xs">aspect-ratio: w / h</code>). Or put HTML <code className="text-xs">width</code>/
          <code className="text-xs">height</code> on the child image and omit the Media props — Media derives the box.
          When the box matches the source aspect, child <code className="text-xs">object-fit</code> is a no-op and
          Media’s grid stretch fills the box (no <code className="text-xs">size-full</code> needed on a direct media
          child). Put border-radius on Media (morph target). Leave chrome outside Media. Resting insets belong on Slide
          padding / safe-area so zoomed media can paint into that padding under chrome.
        </p>
        <CodeBlock code={lightboxExcerpts['media-fit-box'].code} title={lightboxExcerpts['media-fit-box'].title} />
        <p>
          Live compositions: <DocsLink href="/presets/default">Default preset</DocsLink>,{' '}
          <DocsLink href="/examples/lightbox/photos-app">Photos app</DocsLink>.
        </p>
      </DocsSection>

      <DocsSection id="stage" title="Stage (split layouts)">
        <p>
          Use <DocsLink href={lightboxApiHref.stage}>Lightbox.Stage</DocsLink> when Content holds more than the media
          pane — for example a thread sidebar beside the gallery. Stage is the media interaction surface: trackpad
          wheel pull-to-dismiss, Zoom pan cover geometry, and arrow / Home / End gallery navigation are scoped to it.
          Content remains the dialog shell (focus trap, Escape, zoom shortcuts). Place side panels as siblings of Stage
          under Content so they keep native scroll and their own keyboard behavior. When Stage is omitted, Content
          itself is the stage (default full-bleed viewers need no change).
        </p>
        <CodeBlock
          code={`<Lightbox.Content aria-label="Post">
  <Lightbox.Stage className="media-pane">
    <Lightbox.Close />
    <Lightbox.Slides>{/* media */}</Lightbox.Slides>
    <Lightbox.Previous />
    <Lightbox.Next />
  </Lightbox.Stage>
  <aside>{/* thread / details */}</aside>
</Lightbox.Content>`}
          title="Stage + side panel"
        />
        <p>
          Live example: <DocsLink href="/presets/twitter">Twitter preset</DocsLink>.
        </p>
      </DocsSection>

      <DocsSection id="chrome" title="Chrome">
        <p>
          The site default viewer is Slides + Zoom with Counter (top-left), Close / ZoomIn / ZoomOut, Caption, and a
          desktop <DocsLink href={lightboxApiHref.thumbnailStrip}>ThumbnailStrip</DocsLink> (scroll-linked midline
          track) as siblings inside <DocsLink href={lightboxApiHref.content}>Content</DocsLink>. Midline selection
          chrome is plain consumer markup on the strip root. Prefer{' '}
          <DocsLink href={lightboxApiHref.thumbnailGroup}>ThumbnailGroup</DocsLink> when you want a static tablist
          without scroll-linking. Thumbnails register by <code className="text-xs">index</code> like Triggers. Put
          Backdrop and Content in <DocsLink href={lightboxApiHref.portal}>Portal</DocsLink>. Stacking follows Base UI:{' '}
          <code className="text-xs">isolation: isolate</code> on the app layout root, and — when using{' '}
          <code className="text-xs">keepMounted</code> — a consumer <code className="text-xs">z-index</code> on the
          Portal host (e.g. <code className="text-xs">className=&quot;relative z-[1]&quot;</code>). Inside the portal,
          document order keeps Backdrop under Content.
        </p>
        <CodeBlock
          code={lightboxExcerpts['chrome-composition'].code}
          title={lightboxExcerpts['chrome-composition'].title}
        />
        <p>
          Packaged as a skin: <DocsLink href="/presets/default">Default preset</DocsLink>.
        </p>
      </DocsSection>

      <DocsSection id="item-count" title="Dynamic itemCount">
        <p>
          Items register on mount. The root <code className="text-xs">itemCount</code> is derived from registered items
          — indices do not need to be contiguous, but Counter, loop edges, and preload distance all use that count.
          Prefer dense <code className="text-xs">0…n-1</code> indexes unless you intentionally leave holes.
        </p>
      </DocsSection>

      <DocsPager prev={lightboxDocsPages.stateLifecycle} next={lightboxDocsPages.nextjsImage} />
    </DocsShell>
  );
}
