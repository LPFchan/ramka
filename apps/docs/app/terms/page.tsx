import type { Metadata } from 'next';

import { SiteFooter } from '../_components/site-footer';
import { SiteHeader } from '../_components/site-header';
import { TERMS_PATH, readMarkdownDoc } from '../license/documents';
import { LegalMarkdown } from '../license/legal-markdown';

export const metadata: Metadata = {
  title: 'Terms of Service — ramka',
  description: 'Terms for using ramka.dev and purchasing a commercial ramka license.',
};

export default async function TermsPage() {
  const { title, body } = await readMarkdownDoc(TERMS_PATH);

  return (
    <div className="isolate flex min-h-screen flex-col">
      <SiteHeader home />

      <main className="flex-1">
        <section className="mx-auto w-full max-w-2xl px-6 pt-16 pb-20 md:pt-20 md:pb-24">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-neutral-950 md:text-4xl dark:text-neutral-50">
            {title}
          </h1>

          <LegalMarkdown>{body}</LegalMarkdown>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
