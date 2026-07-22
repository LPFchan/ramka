import Link from 'next/link';

import { CodeBlock } from '../../_components/code-block';
import { DocsLink } from '../../_components/docs-link';
import { DocsPager } from '../../_components/docs-pager';
import { DocsSection, DocsShell, type DocsTocItem } from '../../_components/docs-shell';
import { lightboxDocsPages } from '../../_content/lightbox/docs-pages';
import { lightboxExcerpts } from '../../_content/lightbox/excerpts/generated';
import { LightboxHeroDemo } from './hero-demo';

const guideLinks: {
  title: string;
  description: string;
  href: string;
}[] = [
  {
    title: 'State & lifecycle',
    description: 'Controlled open/index, createHandle, and open-change callbacks.',
    href: lightboxDocsPages.stateLifecycle.href,
  },
  {
    title: 'Composition',
    description: 'Slides + Zoom chrome, media fill / fit-box sizing, ItemGroup swap, and itemCount.',
    href: lightboxDocsPages.composition.href,
  },
  {
    title: 'View transitions',
    description: 'Morph refs (on by default), crossfade, morphTo, and scrollTriggerIntoView.',
    href: lightboxDocsPages.viewTransitions.href,
  },
  {
    title: 'Gestures',
    description: 'Pull-to-dismiss, zoom bridge, keyboard, and what wins when.',
    href: lightboxDocsPages.gestures.href,
  },
  {
    title: 'API reference',
    description: 'Props, data attributes, and CSS variables for every part.',
    href: lightboxDocsPages.api.href,
  },
];

const toc: DocsTocItem[] = [
  { id: 'usage-guidelines', title: 'Usage guidelines' },
  { id: 'anatomy', title: 'Anatomy' },
  { id: 'next-steps', title: 'Next steps' },
];

export default function LightboxOverviewPage() {
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
        <p>Work through these decisions in order:</p>
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">State</strong> —
            controlled props, createHandle, or both? See{' '}
            <DocsLink href={lightboxDocsPages.stateLifecycle.href}>State & lifecycle</DocsLink>.
          </li>
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Layout</strong> —
            default to the swipe carousel (
            <DocsLink href={`${lightboxDocsPages.composition.href}#slides`}>Slides + Zoom</DocsLink>
            ); use stacked swap (
            <DocsLink href={`${lightboxDocsPages.composition.href}#item-group`}>ItemGroup</DocsLink>)
            only when you do not want a carousel. See{' '}
            <DocsLink href={lightboxDocsPages.composition.href}>Composition</DocsLink>.
          </li>
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Morph</strong> — on by
            default; attach <code className="text-xs">imageRef</code>, choose{' '}
            <code className="text-xs">crossfade</code> / <code className="text-xs">morphTo</code>, or pass{' '}
            <code className="text-xs">viewTransition={'{false}'}</code> to opt out. See{' '}
            <DocsLink href={lightboxDocsPages.viewTransitions.href}>View transitions</DocsLink>.
          </li>
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Gestures</strong> — pull-to-dismiss
            on Content, Zoom on media, keyboard on Content. See{' '}
            <DocsLink href={lightboxDocsPages.gestures.href}>Gestures</DocsLink>.
          </li>
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Headless styling</strong> — ship
            your own CSS; use documented <code className="text-xs">data-*</code> attributes and CSS variables from
            the <DocsLink href={lightboxDocsPages.api.href}>API reference</DocsLink>.
          </li>
        </ol>
      </DocsSection>

      <DocsSection id="anatomy" title="Anatomy">
        <p>
          Import the namespace and compose parts. The sketch below is the default gallery shape (Slides
          + Zoom + chrome). Every part is optional except Root for state.
        </p>
        <CodeBlock code={lightboxExcerpts.anatomy.code} title={lightboxExcerpts.anatomy.title} />
      </DocsSection>

      <DocsSection id="next-steps" title="Next steps">
        <ul className="grid gap-3 sm:grid-cols-2">
          {guideLinks.map((ex) => (
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
        <p className="mt-4">
          Browse product demos under{' '}
          <DocsLink href="/examples/lightbox/responsive-gallery">Examples</DocsLink>. Guides above are
          canonical for behavior; examples are compositions.
        </p>
      </DocsSection>

      <DocsPager next={lightboxDocsPages.stateLifecycle} />
    </DocsShell>
  );
}
