import Link from 'next/link';
import * as React from 'react';

import { docsLinkClassName } from './docs-link';

interface ExampleShellProps {
  title: string;
  description?: React.ReactNode;
  /** Deep link into Lightbox docs (e.g. `/docs/lightbox/api#api-root`). */
  docsHref?: string;
  docsLabel?: string;
  children: React.ReactNode;
}

export function ExampleShell({
  title,
  description,
  docsHref,
  docsLabel = 'Lightbox docs',
  children,
}: ExampleShellProps) {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-14 md:px-10 md:py-16">
      <header className="mb-10">
        <h1 className="text-balance text-4xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          {title}
        </h1>
        {description ? (
          <div className="mt-4 max-w-2xl text-pretty text-[15px] leading-7 text-neutral-500 dark:text-neutral-400">
            {description}
          </div>
        ) : null}
        {docsHref ? (
          <p className="mt-4 text-[13px] text-neutral-500">
            See also:{' '}
            <Link href={docsHref} className={docsLinkClassName}>
              {docsLabel}
            </Link>
          </p>
        ) : null}
      </header>
      <div>{children}</div>
    </div>
  );
}
