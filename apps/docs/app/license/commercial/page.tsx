import type { Metadata } from 'next';

import { SiteFooter } from '../../_components/site-footer';
import { SiteHeader } from '../../_components/site-header';

export const metadata: Metadata = {
  title: 'Commercial License Agreement — ramka',
  description: 'The Ramka Commercial License Agreement.',
  // A placeholder standing in for a legal document is not something to have
  // indexed and cited. Lift this when the terms land.
  robots: { index: false, follow: true },
};

export default function CommercialLicensePage() {
  return (
    <div className="isolate flex min-h-screen flex-col">
      <SiteHeader home />

      <main className="flex-1">
        <section className="mx-auto w-full max-w-2xl px-6 pt-16 pb-20 md:pt-20 md:pb-24">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-neutral-950 md:text-4xl dark:text-neutral-50">
            Ramka Commercial License Agreement
          </h1>
          <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">Version 1.0</p>
          <p className="mt-8 text-[17px] leading-7 text-neutral-600 dark:text-neutral-400">
            Commercial license terms coming soon.
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
