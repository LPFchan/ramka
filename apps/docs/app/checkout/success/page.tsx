import type { Metadata } from 'next';
import Link from 'next/link';

import { SiteFooter } from '../../_components/site-footer';
import { SiteHeader } from '../../_components/site-header';

const primaryCtaClassName =
  'inline-flex h-11 items-center justify-center rounded-full bg-neutral-900 px-5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-300';

const quietLinkClassName =
  'underline decoration-neutral-300 underline-offset-2 transition hover:decoration-neutral-500 dark:decoration-neutral-700 dark:hover:decoration-neutral-500';

export const metadata: Metadata = {
  title: 'Purchase complete — ramka',
  description: 'Thanks for purchasing a ramka commercial license.',
};

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const failed = status === 'error';

  return (
    <div className="isolate flex min-h-screen flex-col">
      <SiteHeader home />

      <main className="flex-1">
        <section className="mx-auto w-full max-w-lg px-6 pt-16 pb-20 text-center md:pt-20 md:pb-24">
          {failed ? (
            <>
              <h1 className="text-balance text-3xl font-semibold tracking-tight text-neutral-950 md:text-4xl dark:text-neutral-50">
                Payment not completed
              </h1>
              <p className="mt-4 text-pretty text-[17px] leading-7 text-neutral-500 dark:text-neutral-400">
                The payment was cancelled or did not go through. You can return to checkout and try again.
              </p>
              <Link href="/license" className={`${primaryCtaClassName} mt-10`}>
                Return to licensing
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-balance text-3xl font-semibold tracking-tight text-neutral-950 md:text-4xl dark:text-neutral-50">
                Purchase complete
              </h1>
              <p className="mt-4 text-pretty text-[17px] leading-7 text-neutral-500 dark:text-neutral-400">
                Thanks for purchasing Ramka.
                <span className="mt-1 block">Check your email for your receipt and purchase details.</span>
              </p>
              <Link href="/docs" className={`${primaryCtaClassName} mt-10`}>
                Read the docs
              </Link>
              <p className="mt-6 text-[13px] leading-6 text-neutral-400 dark:text-neutral-600">
                <Link href="/" className={quietLinkClassName}>
                  Back to homepage
                </Link>
              </p>
            </>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
