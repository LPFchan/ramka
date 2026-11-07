import type { Metadata } from 'next';
import Link from 'next/link';

import { SiteFooter } from '../_components/site-footer';
import { SiteHeader } from '../_components/site-header';
import { LICENSE_PATH, readRepoText } from './documents';

export const metadata: Metadata = {
  title: 'License',
  description: 'ramka is free software under the MIT License.',
};

export default async function LicensePage() {
  const license = await readRepoText(LICENSE_PATH);

  return (
    <div className="isolate flex min-h-screen flex-col">
      <SiteHeader home />

      <main className="flex-1">
        <section className="mx-auto w-full max-w-2xl px-6 pt-16 pb-20 md:pt-20 md:pb-24">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-neutral-950 md:text-4xl dark:text-neutral-50">
            License
          </h1>
          <p className="mt-4 text-[15px] leading-7 text-neutral-600 dark:text-neutral-400">
            ramka is free software under the MIT License, for open-source and proprietary use.
          </p>
          <pre className="mt-8 overflow-x-auto rounded-2xl border border-neutral-200 p-5 text-xs leading-6 whitespace-pre-wrap text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            {license}
          </pre>
          <p className="mt-8 text-[15px] leading-7 text-neutral-600 dark:text-neutral-400">
            Third-party code included in the package is listed in{' '}
            <Link
              href="/license/notices"
              className="underline decoration-neutral-300 underline-offset-2 transition hover:decoration-neutral-500 dark:decoration-neutral-700 dark:hover:decoration-neutral-500"
            >
              third-party notices
            </Link>
            .
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
