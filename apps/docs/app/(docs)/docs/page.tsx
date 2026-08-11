import Link from 'next/link';

import { CodeBlock } from '../../_components/code-block';
import { docsLinkClassName } from '../../_components/docs-link';
import { lightboxDocsPages } from '../../_content/lightbox/docs-pages';
import { lightboxExcerpts } from '../../_content/lightbox/excerpts/generated';

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-14 md:px-10 md:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-400 dark:text-neutral-600">
        Getting started
      </p>
      <h1 className="mt-3 text-5xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
        ramka
      </h1>
      <p className="mt-5 max-w-2xl text-pretty text-[17px] leading-7 text-neutral-500 dark:text-neutral-400">
        Unstyled, accessible lightbox primitives for React — in the style of Radix UI and Base UI.
        Compose your own lightbox UI on headless parts with view-transition morph by default, swipe
        slides, zoom, and pull-to-dismiss.
      </p>

      <section className="mt-14 space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Installation
        </h2>
        <CodeBlock code="pnpm add ramka" lang="bash" />
        <p className="text-[15px] leading-7 text-neutral-600 dark:text-neutral-400">
          Peer dependencies: <code className="text-xs">react</code> and{' '}
          <code className="text-xs">react-dom</code> &gt;= 18.
        </p>
      </section>

      <section className="mt-14 space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Quick start
        </h2>
        <CodeBlock
          code={lightboxExcerpts['quick-start'].code}
          title={lightboxExcerpts['quick-start'].title}
        />
      </section>

      <section className="mt-14 rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
          Next steps
        </h2>
        <ul className="mt-3 space-y-2.5 text-[15px] leading-7 text-neutral-600 dark:text-neutral-400">
          <li>
            <Link href={lightboxDocsPages.overview.href} className={docsLinkClassName}>
              Lightbox overview
            </Link>
            {' — '}
            guidelines and anatomy, then{' '}
            <Link href={lightboxDocsPages.composition.href} className={docsLinkClassName}>
              Composition
            </Link>
            .
          </li>
          <li>
            <Link href="/examples/lightbox/photos-app" className={docsLinkClassName}>
              Examples
            </Link>
            {' — '}
            live product demos and API pattern pages.
          </li>
        </ul>
      </section>
    </div>
  );
}
