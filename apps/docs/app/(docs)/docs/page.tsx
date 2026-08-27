import Link from 'next/link';

import { CodeBlock } from '../../_components/code-block';
import { docsLinkClassName } from '../../_components/docs-link';
import { lightboxDocsPages } from '../../_content/lightbox/docs-pages';
import { lightboxExcerpts } from '../../_content/lightbox/excerpts/generated';

const GPL_URL = 'https://www.gnu.org/licenses/gpl-3.0.html';
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
        <CodeBlock code="pnpm add @ramka/react" lang="bash" />
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

      <section className="mt-14 space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Licensing
        </h2>
        <p className="text-[15px] leading-7 text-neutral-600 dark:text-neutral-400">
          ramka is dual-licensed. Under{' '}
          <a href={GPL_URL} target="_blank" rel="noreferrer" className={docsLinkClassName}>
            GPL-3.0-only
          </a>{' '}
          it is free to use, modify, and redistribute — including commercially, since the GPL does
          not restrict commercial use — as long as you comply with the GPL.
        </p>
        <p className="text-[15px] leading-7 text-neutral-600 dark:text-neutral-400">
          If your use of ramka creates a work that is subject to the GPL, the GPL’s source-code and
          licensing requirements apply to that work when you distribute it. If you’re building
          proprietary software and don’t want to rely on the GPL, you may purchase a{' '}
          <Link href="/license" className={docsLinkClassName}>
            commercial license
          </Link>{' '}
          instead — a separate license grant from the copyright holder, permitting use under its own
          terms rather than the GPL.
        </p>
        <p className="text-[15px] leading-7 text-neutral-700 dark:text-neutral-300">
          Most teams building closed-source products will therefore want the commercial license.
        </p>
        <p className="text-[15px] leading-7 text-neutral-500 dark:text-neutral-500">
          This is practical guidance, not legal advice. The applicable license terms
          govern: the{' '}
          <a href={GPL_URL} target="_blank" rel="noreferrer" className={docsLinkClassName}>
            GPL
          </a>{' '}
          for open-source use, or the{' '}
          <Link href="/license/commercial" className={docsLinkClassName}>
            Commercial License Agreement
          </Link>{' '}
          if you purchase one.
        </p>
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
