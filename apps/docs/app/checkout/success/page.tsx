import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';

import { SiteFooter } from '../../_components/site-footer';
import { SiteHeader } from '../../_components/site-header';
import { ThankYouBalloons } from './thank-you-balloons';

const primaryCtaClassName =
  'inline-flex h-11 items-center justify-center rounded-full bg-neutral-900 px-5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-300';

const quietLinkClassName =
  'underline decoration-neutral-300 underline-offset-2 transition hover:decoration-neutral-500 dark:decoration-neutral-700 dark:hover:decoration-neutral-500';

export const metadata: Metadata = {
  title: 'Purchase complete',
  description: 'Thanks for purchasing a ramka license.',
};

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const failed = status === 'error';

  return (
    <div className="isolate flex min-h-screen flex-col">
      <SiteHeader home />

      {/* The one-glance page: content centered in the viewport, one headline,
          one line of copy, one button. Everything else (receipt, license
          text) already lives in the buyer's inbox. */}
      <main className="flex flex-1 items-center justify-center">
        <section className="mx-auto w-full max-w-md px-6 py-20 text-center">
          {failed ? (
            <>
              <h1 className="text-balance text-3xl font-semibold tracking-tight text-neutral-950 md:text-4xl dark:text-neutral-50">
                Payment not completed
              </h1>
              <p className="mt-4 text-pretty text-[17px] leading-7 text-neutral-500 dark:text-neutral-400">
                The payment was cancelled or did not go through. Nothing was charged; you can return and try again.
              </p>
              <Link href="/license" className={`${primaryCtaClassName} mt-10`}>
                Return to licensing
              </Link>
            </>
          ) : (
            <>
              <ThankYouBalloons />
              <div
                aria-hidden
                className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950"
              >
                <Check className="size-5 text-emerald-700 dark:text-emerald-400" strokeWidth={2.5} />
              </div>
              <h1 className="mt-6 text-balance text-3xl font-semibold tracking-tight text-neutral-950 md:text-4xl dark:text-neutral-50">
                Purchase complete
              </h1>
              <p className="mt-4 text-pretty text-[17px] leading-7 text-neutral-500 dark:text-neutral-400">
                Your license is active. The receipt and purchase details are on their way to your inbox.
              </p>

              {/* The entire setup, since there are no keys to paste: declare
                  the license on the root component and move on. */}
              <div className="mt-8 rounded-2xl border border-neutral-200 p-5 text-left dark:border-neutral-800">
                <p className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
                  Setup is one prop
                </p>
                <div className="mt-3 overflow-x-auto rounded-lg bg-neutral-50 px-3.5 py-2.5 dark:bg-neutral-900">
                  <code className="whitespace-nowrap font-mono text-[13px] text-neutral-800 dark:text-neutral-200">
                    {'<Lightbox.Root license="commercial">'}
                  </code>
                </div>
                <p className="mt-3 text-pretty text-[13px] leading-6 text-neutral-500 dark:text-neutral-400">
                  An honor-system declaration: no license keys, no activation, nothing validated remotely.
                </p>
              </div>

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
