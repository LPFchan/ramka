import { ApiPartSection } from '../../../../_components/api/api-part';
import { DocsLink } from '../../../../_components/docs-link';
import { DocsPager } from '../../../../_components/docs-pager';
import { DocsSection, DocsShell, type DocsTocItem } from '../../../../_components/docs-shell';
import {
  documentViewTransitionApi,
  hooksApi,
  imperativeApi,
  lightboxApiParts,
} from '../../../../_content/lightbox/api/parts';
import { lightboxApiHref, lightboxDocsPages } from '../../../../_content/lightbox/docs-pages';

const byConcern: { label: string; links: { href: string; title: string }[] }[] = [
  {
    label: 'State',
    links: [
      { href: lightboxApiHref.root, title: 'Root' },
      { href: lightboxApiHref.createHandle, title: 'createHandle' },
    ],
  },
  {
    label: 'Trigger / Item',
    links: [
      { href: lightboxApiHref.trigger, title: 'Trigger' },
      { href: lightboxApiHref.item, title: 'Item' },
      { href: lightboxApiHref.media, title: 'Media' },
    ],
  },
  {
    label: 'Layout',
    links: [
      { href: lightboxApiHref.slides, title: 'Slides' },
      { href: lightboxApiHref.slide, title: 'Slide' },
    ],
  },
  {
    label: 'View transitions',
    links: [
      { href: lightboxApiHref.root, title: 'Root (VT props)' },
      { href: lightboxApiHref.documentVt, title: 'Document (VT)' },
    ],
  },
  {
    label: 'Shell',
    links: [
      { href: lightboxApiHref.portal, title: 'Portal' },
      { href: lightboxApiHref.backdrop, title: 'Backdrop' },
      { href: lightboxApiHref.content, title: 'Content' },
    ],
  },
  {
    label: 'Gestures',
    links: [
      { href: lightboxApiHref.content, title: 'Content' },
      { href: lightboxApiHref.zoom, title: 'Zoom' },
      { href: lightboxApiHref.zoomIn, title: 'ZoomIn' },
      { href: lightboxApiHref.zoomOut, title: 'ZoomOut' },
    ],
  },
  {
    label: 'Chrome',
    links: [
      { href: lightboxApiHref.close, title: 'Close' },
      { href: lightboxApiHref.previous, title: 'Previous' },
      { href: lightboxApiHref.next, title: 'Next' },
      { href: lightboxApiHref.counter, title: 'Counter' },
      { href: lightboxApiHref.caption, title: 'Caption' },
      { href: lightboxApiHref.thumbnailGroup, title: 'ThumbnailGroup' },
      { href: lightboxApiHref.thumbnail, title: 'Thumbnail' },
      { href: lightboxApiHref.thumbnailStrip, title: 'ThumbnailStrip' },
      { href: lightboxApiHref.thumbnailStripTrack, title: 'ThumbnailStripTrack' },
    ],
  },
];

const toc: DocsTocItem[] = [
  { id: 'by-concern', title: 'By concern' },
  ...lightboxApiParts.map((p) => ({ id: p.id, title: p.name })),
  { id: documentViewTransitionApi.id, title: 'Document (VT)' },
  { id: 'types', title: 'Types' },
  { id: 'hooks', title: 'Hooks', children: hooksApi.map((p) => ({ id: p.id, title: p.name })) },
  {
    id: 'imperative',
    title: 'Imperative handles',
    children: imperativeApi.map((p) => ({ id: p.id, title: p.name })),
  },
];

export default function LightboxApiPage() {
  return (
    <DocsShell
      title="API reference"
      description={
        <>
          Props, data attributes, and CSS variables for every{' '}
          <DocsLink href={lightboxDocsPages.overview.href}>Lightbox</DocsLink> part. Tables are
          generated from package TypeScript + JSDoc.
        </>
      }
      toc={toc}
    >
      <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        Each part accepts native element props for its default host (via Base UI{' '}
        <code className="text-xs">render</code> where noted). Custom props are listed below. Guides:{' '}
        <DocsLink href={lightboxDocsPages.composition.href}>Composition</DocsLink>,{' '}
        <DocsLink href={lightboxDocsPages.viewTransitions.href}>View transitions</DocsLink>,{' '}
        <DocsLink href={lightboxDocsPages.gestures.href}>Gestures</DocsLink>.
      </p>

      <DocsSection id="by-concern" title="By concern">
        <ul className="space-y-3">
          {byConcern.map((group) => (
            <li key={group.label}>
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {group.label}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                {group.links.map((link) => (
                  <DocsLink key={link.href} href={link.href}>
                    {link.title}
                  </DocsLink>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </DocsSection>

      {lightboxApiParts.map((part) => (
        <ApiPartSection key={part.id} part={part} />
      ))}

      <ApiPartSection part={documentViewTransitionApi} />

      <DocsSection id="types" title="Types">
        <p>
          Helper types you will see in callbacks and render props (exported from{' '}
          <code className="text-xs">ramka</code> / the Lightbox module):
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <code className="text-xs">NavigationSource</code> —{' '}
            <code className="text-xs">
              &apos;trigger&apos; | &apos;keyboard&apos; | &apos;thumbnail&apos; | &apos;button&apos; |
              &apos;scroll&apos; | &apos;imperative&apos;
            </code>
            . Second argument to Root <code className="text-xs">onValueChange</code>. Handle{' '}
            <code className="text-xs">open</code>/<code className="text-xs">goTo</code> use{' '}
            <code className="text-xs">&apos;imperative&apos;</code>; scroll-driven Slides use{' '}
            <code className="text-xs">&apos;scroll&apos;</code>.
          </li>
          <li>
            <code className="text-xs">LightboxCrossfade</code> —{' '}
            <code className="text-xs">&apos;open&apos; | &apos;close&apos; | &apos;both&apos;</code> for
            Trigger <code className="text-xs">crossfade</code>. See{' '}
            <DocsLink href={`${lightboxDocsPages.viewTransitions.href}#crossfade`}>
              View transitions → crossfade
            </DocsLink>
            .
          </li>
          <li>
            Render-state types such as <code className="text-xs">LightboxTriggerRenderState</code> and Item
            render args (<code className="text-xs">active</code>, <code className="text-xs">visible</code>,
            refs) — documented on <DocsLink href={lightboxApiHref.trigger}>Trigger</DocsLink> /{' '}
            <DocsLink href={lightboxApiHref.item}>Item</DocsLink>.
          </li>
        </ul>
      </DocsSection>

      <DocsSection id="hooks" title="Hooks">
        <p>Optional contexts for nested wrapper components.</p>
      </DocsSection>
      {hooksApi.map((part) => (
        <ApiPartSection key={part.id} part={part} />
      ))}

      <DocsSection id="imperative" title="Imperative handles">
        <p>
          Use <code className="text-xs">Lightbox.createHandle()</code> on Root (and optional detached
          Triggers). Zoom exposes zoom controls via <code className="text-xs">ref</code>.
        </p>
      </DocsSection>
      {imperativeApi.map((part) => (
        <ApiPartSection key={part.id} part={part} />
      ))}

      <DocsPager prev={lightboxDocsPages.zoom} />
    </DocsShell>
  );
}
