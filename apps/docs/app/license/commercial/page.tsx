import type { Metadata } from 'next';

import { SiteFooter } from '../../_components/site-footer';
import { SiteHeader } from '../../_components/site-header';

export const metadata: Metadata = {
  title: 'Commercial License Agreement — ramka',
  description: 'The Ramka Commercial License Agreement.',
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

          {/* Numbered so clauses can be cited, with ids so they can be linked. */}
          <section id="license-grant" className="mt-12 scroll-mt-8">
            <h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              1. License grant
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-neutral-600 dark:text-neutral-400">
              Subject to payment of the applicable license fee and compliance with this Agreement, Artur Bień grants the
              Licensee a non-exclusive, worldwide, non-transferable license to use, reproduce, modify, and incorporate
              ramka into proprietary software products covered by the purchased license tier.
            </p>
            <p className="mt-4 text-[15px] leading-7 text-neutral-600 dark:text-neutral-400">
              The Licensee may distribute those products to end users without making the Licensee’s proprietary source
              code available under the GNU General Public License v3.0.
            </p>
          </section>

          {/* The agreement is one clause long, and a buyer reading it should not
              have to guess whether that is all of it. */}
          <p className="mt-12 border-t border-neutral-200 pt-8 text-[13px] leading-6 text-neutral-400 dark:border-neutral-800 dark:text-neutral-600">
            Remaining sections coming soon.
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
