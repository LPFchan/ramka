import Link from 'next/link';
import * as React from 'react';

interface ExampleShellProps {
  title: string;
  description?: React.ReactNode;
  /** Deep link into the Lightbox API docs (e.g. `/docs/lightbox#api-root`). */
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
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          {title}
        </h1>
        {description ? (
          <div className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            {description}
          </div>
        ) : null}
        {docsHref ? (
          <p className="mt-3 text-sm text-neutral-500">
            See also:{' '}
            <Link
              href={docsHref}
              className="font-medium text-neutral-800 underline underline-offset-2 dark:text-neutral-200"
            >
              {docsLabel}
            </Link>
          </p>
        ) : null}
      </header>
      <div>{children}</div>
    </div>
  );
}
