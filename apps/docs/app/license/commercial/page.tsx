import type { Metadata } from 'next';

import { SiteFooter } from '../../_components/site-footer';
import { SiteHeader } from '../../_components/site-header';
import { readAgreement } from '../documents';
import { LegalMarkdown } from '../legal-markdown';

export const metadata: Metadata = {
  title: 'Commercial License Agreement — ramka',
  description: 'The Ramka Commercial License Agreement.',
};

export default async function CommercialLicensePage() {
  const { title, version, body } = await readAgreement();

  return (
    <div className="isolate flex min-h-screen flex-col">
      <SiteHeader home />

      <main className="flex-1">
        <section className="mx-auto w-full max-w-2xl px-6 pt-16 pb-20 md:pt-20 md:pb-24">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-neutral-950 md:text-4xl dark:text-neutral-50">
            {title}
          </h1>
          <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">{version}</p>

          <LegalMarkdown>{body}</LegalMarkdown>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
