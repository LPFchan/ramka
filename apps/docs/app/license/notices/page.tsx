import type { Metadata } from 'next';

import { SiteFooter } from '../../_components/site-footer';
import { SiteHeader } from '../../_components/site-header';
import { NOTICES_PATH, readMarkdownDoc } from '../documents';
import { LegalMarkdown } from '../legal-markdown';

export const metadata: Metadata = {
  title: 'Third-party notices',
  description: 'Third-party code included in @ramka/react, with its license.',
};

export default async function ThirdPartyNoticesPage() {
  const { title, body } = await readMarkdownDoc(NOTICES_PATH);

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
