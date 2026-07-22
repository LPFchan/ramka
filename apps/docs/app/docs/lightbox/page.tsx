import Link from 'next/link';

import { ApiPartSection } from '../../_components/api/api-part';
import { CodeBlock } from '../../_components/code-block';
import { DocsSection, DocsShell, type DocsTocItem } from '../../_components/docs-shell';
import {
  documentViewTransitionApi,
  hooksApi,
  imperativeApi,
  lightboxApiParts,
} from '../../_content/lightbox/api/parts';
import { LightboxHeroDemo } from './hero-demo';

const anatomy = `import { Lightbox } from 'ramka';

<Lightbox.Root>
  <Lightbox.Trigger index={0}>{/* thumb */}</Lightbox.Trigger>
  <Lightbox.Backdrop />
  <Lightbox.Content>
    <Lightbox.Close />
    <Lightbox.ItemGroup>
      <Lightbox.Item index={0}>{/* full image */}</Lightbox.Item>
    </Lightbox.ItemGroup>
    {/* or: Lightbox.Slides > Lightbox.Slide > Lightbox.Item */}
  </Lightbox.Content>
</Lightbox.Root>`;

const examplePatterns: {
  title: string;
  description: string;
  href: string;
}[] = [
  {
    title: 'Controlled state',
    description: 'Drive open and the active index from external React state.',
    href: '/examples/lightbox/controlled',
  },
  {
    title: 'Imperative API',
    description: 'Call open / close / goTo on a Root ref without a trigger click.',
    href: '/examples/lightbox/imperative-api',
  },
  {
    title: 'Lifecycle callbacks',
    description: 'Distinguish onOpenChange (immediate) from onOpenChangeComplete (after motion).',
    href: '/examples/lightbox/lifecycle-callbacks',
  },
  {
    title: 'Lazy loading',
    description: 'Mount heavy item content only when active with Item render props and preload.',
    href: '/examples/lightbox/lazy-loading',
  },
  {
    title: 'morphTo strategies',
    description: 'Compare active, origin, and closest close-morph targets.',
    href: '/examples/lightbox/morph-to-setting',
  },
  {
    title: 'Trigger crossfade',
    description: 'When to omit crossfade vs both / close / open for dissimilar trigger↔item snapshots.',
    href: '/examples/lightbox/crossfade',
  },
  {
    title: 'Zoom + pull-to-dismiss',
    description: 'Full product composition with pinch zoom, thumbs, and pull-to-close.',
    href: '/examples/lightbox/responsive-gallery',
  },
];

const toc: DocsTocItem[] = [
  { id: 'usage-guidelines', title: 'Usage guidelines' },
  { id: 'anatomy', title: 'Anatomy' },
  { id: 'examples', title: 'Examples' },
  {
    id: 'api-reference',
    title: 'API reference',
    children: [
      ...lightboxApiParts.map((p) => ({ id: p.id, title: p.name })),
      { id: documentViewTransitionApi.id, title: 'Document (VT)' },
      ...hooksApi.map((p) => ({ id: p.id, title: p.name })),
      ...imperativeApi.map((p) => ({ id: p.id, title: p.name })),
    ],
  },
];

export default function LightboxDocsPage() {
  return (
    <DocsShell
      title="Lightbox"
      description="Unstyled, accessible primitives for building fullscreen media lightboxes — compound parts in the style of Base UI and Radix. You own all layout and CSS; ramka owns state, focus, gestures, and optional view-transition morphs."
      toc={toc}
    >
      <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <LightboxHeroDemo />
      </div>

      <DocsSection id="usage-guidelines" title="Usage guidelines">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Headless:</strong>{' '}
            the library ships no visual styles. Style open/close, chrome, and morphs with your own
            classes and the documented <code className="text-xs">data-*</code> attributes / CSS
            variables.
          </li>
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Swap vs slides:</strong>{' '}
            use <code className="text-xs">ItemGroup</code> for a stacked viewer (one item visible);
            use <code className="text-xs">Slides</code> + <code className="text-xs">Slide</code> for a
            swipeable snap carousel wired to the active index.
          </li>
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">View transitions:</strong>{' '}
            set <code className="text-xs">viewTransition</code> on Root and attach{' '}
            <code className="text-xs">imageRef</code> on Trigger/Item images so the open morph can
            bridge with the already-decoded thumb. Use Trigger{' '}
            <code className="text-xs">crossfade</code> when trigger and item do not show the same
            picture.
          </li>
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Gestures:</strong>{' '}
            pull-to-dismiss lives on Content; zoom lives in <code className="text-xs">Zoom</code>.
            They gate each other via <code className="text-xs">data-pulling</code> /{' '}
            <code className="text-xs">data-zooming</code>.
          </li>
        </ul>
      </DocsSection>

      <DocsSection id="anatomy" title="Anatomy">
        <p>Import the namespace and compose parts. Every part is optional except Root for state.</p>
        <CodeBlock code={anatomy} title="Anatomy" />
      </DocsSection>

      <DocsSection id="examples" title="Examples">
        <p>
          Pattern demos and product case studies live under{' '}
          <Link href="/examples/lightbox/default" className="underline underline-offset-2">
            Examples
          </Link>
          . Start here for the APIs they illustrate:
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {examplePatterns.map((ex) => (
            <li key={ex.href}>
              <Link
                href={ex.href}
                className="block h-full rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700 dark:hover:bg-neutral-800"
              >
                <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                  {ex.title}
                </div>
                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{ex.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </DocsSection>

      <DocsSection id="api-reference" title="API reference">
        <p>
          Each part accepts native element props for its default host (via Base UI{' '}
          <code className="text-xs">render</code> where noted). Custom props are listed below.
        </p>
      </DocsSection>

      {lightboxApiParts.map((part) => (
        <ApiPartSection key={part.id} part={part} />
      ))}

      <ApiPartSection part={documentViewTransitionApi} />

      <DocsSection id="api-hooks" title="Hooks">
        <p>Optional contexts for nested wrapper components.</p>
      </DocsSection>
      {hooksApi.map((part) => (
        <ApiPartSection key={part.id} part={part} />
      ))}

      <DocsSection id="api-imperative" title="Imperative handles">
        <p>Attach a ref to Root or Zoom to drive the lightbox from outside the tree.</p>
      </DocsSection>
      {imperativeApi.map((part) => (
        <ApiPartSection key={part.id} part={part} />
      ))}
    </DocsShell>
  );
}
