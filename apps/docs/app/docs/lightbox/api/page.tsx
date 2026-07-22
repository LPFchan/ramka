import { ApiPartSection } from '../../../_components/api/api-part';
import { DocsLink } from '../../../_components/docs-link';
import { DocsPager } from '../../../_components/docs-pager';
import { DocsSection, DocsShell, type DocsTocItem } from '../../../_components/docs-shell';
import {
  documentViewTransitionApi,
  hooksApi,
  imperativeApi,
  lightboxApiParts,
} from '../../../_content/lightbox/api/parts';
import { lightboxDocsPages } from '../../../_content/lightbox/docs-pages';

const toc: DocsTocItem[] = [
  ...lightboxApiParts.map((p) => ({ id: p.id, title: p.name })),
  { id: documentViewTransitionApi.id, title: 'Document (VT)' },
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
        <code className="text-xs">render</code> where noted). Custom props are listed below.
      </p>

      {lightboxApiParts.map((part) => (
        <ApiPartSection key={part.id} part={part} />
      ))}

      <ApiPartSection part={documentViewTransitionApi} />

      <DocsSection id="hooks" title="Hooks">
        <p>Optional contexts for nested wrapper components.</p>
      </DocsSection>
      {hooksApi.map((part) => (
        <ApiPartSection key={part.id} part={part} />
      ))}

      <DocsSection id="imperative" title="Imperative handles">
        <p>Attach a ref to Root or Zoom to drive the lightbox from outside the tree.</p>
      </DocsSection>
      {imperativeApi.map((part) => (
        <ApiPartSection key={part.id} part={part} />
      ))}

      <DocsPager prev={lightboxDocsPages.viewTransitions} />
    </DocsShell>
  );
}
