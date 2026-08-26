import Link from 'next/link';

import { CodeBlock } from '../../_components/code-block';
import { docsLinkClassName } from '../../_components/docs-link';
import { lightboxDocsPages } from '../../_content/lightbox/docs-pages';
import { lightboxExcerpts } from '../../_content/lightbox/excerpts/generated';

const COMMERCIAL_LICENSE_URL = 'https://ramka.dev/license';
const GPL_URL = 'https://www.gnu.org/licenses/gpl-3.0.html';
const LICENSE_URL = 'https://github.com/arturbien/ramka/blob/main/LICENSE';

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
          it is free, including in something you sell — the GPL does not restrict commercial use.
          What it asks in return is reciprocity: a work that is subject to the GPL as a derivative or
          combined work carries the same terms, and its source has to be available to the people you
          distribute it to. A{' '}
          <a href={COMMERCIAL_LICENSE_URL} target="_blank" rel="noreferrer" className={docsLinkClassName}>
            commercial license
          </a>{' '}
          lifts that requirement, which is what you want if your own source stays closed.
        </p>
        <p className="text-[15px] leading-7 text-neutral-600 dark:text-neutral-400">
          Worth knowing before you choose: ramka is not a service you call across a boundary, it is
          code your bundler compiles into your application and ships to every visitor. Whether that
          makes your app a combined work under the GPL depends on how you integrate it, and for
          JavaScript bundling the question has never been settled in court. Teams shipping a
          closed-source product generally buy the commercial license rather than ship on an
          interpretation they would have to defend.
        </p>
        <p className="text-[15px] leading-7 text-neutral-500 dark:text-neutral-500">
          This section is practical guidance, not legal advice, and it is not part of either
          license — the terms are in{' '}
          <a href={LICENSE_URL} target="_blank" rel="noreferrer" className={docsLinkClassName}>
            LICENSE
          </a>
          , and they govern.
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
