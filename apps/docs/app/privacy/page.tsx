import type { Metadata } from 'next';

import { SiteFooter } from '../_components/site-footer';
import { SiteHeader } from '../_components/site-header';
import { PRIVACY_PATH, readMarkdownDoc } from '../license/documents';
import { LegalMarkdown } from '../license/legal-markdown';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How ramka collects, uses, and shares information on ramka.dev and for commercial licenses.',
};

export default async function PrivacyPage() {
  const { title, body } = await readMarkdownDoc(PRIVACY_PATH);

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
