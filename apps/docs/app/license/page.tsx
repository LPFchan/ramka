import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';

import { SiteFooter } from '../_components/site-footer';
import { SiteHeader } from '../_components/site-header';
import { checkoutUrls, type PaidCheckoutPlan } from '../checkout/hosted-urls';
import { readAgreement } from './documents';
import { cn } from '@/lib/utils';

const GPL_URL = 'https://www.gnu.org/licenses/gpl-3.0.html';

// Embedded / OEM is still quoted over email. The enquiry carries the agreement
// version in force so an order can be recorded against the terms that applied.
const CONTACT_EMAIL = 'artur.bien+ramka@gmail.com';

function enquiryUrl(agreementVersion: string): string {
  const body = [
    'Tier (Commercial / Agency / Embedded — OEM):',
    'Name / company:',
    'Billing email:',
    '',
    `Agreement: ${agreementVersion}`,
  ].join('\n');

  // Hand-encoded rather than via URLSearchParams, which spells a space `+` —
  // mail clients render that literally instead of as a space.
  const subject = encodeURIComponent('ramka commercial license');
  return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${encodeURIComponent(body)}`;
}

export const metadata: Metadata = {
  title: 'License',
  description:
    'ramka is free for open source under GPL-3.0-only. For proprietary software, buy once — lifetime license, unlimited developers, no subscription.',
};

const primaryCtaClassName =
  'inline-flex h-11 w-full items-center justify-center rounded-full bg-neutral-900 px-4 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-300';

const secondaryCtaClassName =
  'inline-flex h-11 w-full items-center justify-center rounded-full border border-neutral-200 px-4 text-sm font-medium text-neutral-900 transition hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-900';

const quietLinkClassName =
  'underline decoration-neutral-300 underline-offset-2 transition hover:decoration-neutral-500 dark:decoration-neutral-700 dark:hover:decoration-neutral-500';

interface Tier {
  name: string;
  description: string;
  price: string;
  /** Sits under the price: the payment model for paid tiers, the process for OEM. */
  priceNote: string;
  /** Short differentiators only — everything shared lives in the strip below the cards. */
  items: string[];
  /** The one tier that carries the raised card. */
  featured?: boolean;
  /** Paid tiers go to Whop hosted checkout; OEM stays on email. */
  checkoutPlan?: PaidCheckoutPlan;
  buyLabel?: string;
}

const tiers: Tier[] = [
  {
    name: 'Commercial',
    description: 'For companies building their own proprietary products.',
    price: '$129',
    priceNote: 'One-time payment',
    items: [
      'Unlimited products owned by your company',
      'Use in proprietary, closed-source software',
      'Not for client work or redistribution',
    ],
    featured: true,
    checkoutPlan: 'commercial',
    buyLabel: 'Buy Commercial',
  },
  {
    name: 'Agency',
    description: 'For freelancers and agencies building products for clients.',
    price: '$299',
    priceNote: 'One-time payment',
    items: [
      'Unlimited client projects',
      'Use in proprietary, closed-source software',
      'Covers work delivered to any client',
    ],
    checkoutPlan: 'agency',
    buyLabel: 'Buy Agency',
  },
  {
    name: 'Embedded / OEM',
    description: 'For proprietary redistribution — products that expose ramka for use by third parties.',
    price: 'Custom',
    priceNote: 'Quoted over email',
    items: ['Component libraries and SDKs', 'Site builders and template systems', 'White-label products'],
  },
];

// What every paid license includes, pulled out of the cards so each card can
// carry only what tells the tiers apart.
const sharedInclusions = ['Lifetime license', 'Unlimited developers', 'No subscription', 'No runtime fees'];

const faqs = [
  {
    question: 'Can I use ramka commercially for free?',
    answer:
      'Yes, but only under GPL-3.0-only — a copyleft license that requires the software using ramka to be released under the GPL as well. The paid licenses are for proprietary use without those obligations.',
  },
  {
    question: 'Is the license a subscription?',
    answer: 'No. Commercial and Agency licenses are one-time purchases with lifetime usage rights.',
  },
  {
    question: 'Can my whole team use it?',
    answer: 'Yes. Licenses are not priced per developer.',
  },
  {
    question: 'Can I use the Commercial license for client work?',
    answer: 'No. Use the Agency license for work delivered to clients.',
  },
  {
    question: 'Can I include ramka in my open-source library?',
    answer:
      'Yes, under GPL-3.0-only — but the GPL obligations continue downstream. Wrapping ramka in another open-source package does not change its license or remove its copyleft terms. Downstream users who want to use ramka in proprietary software without relying on the GPL need their own commercial license.',
  },
  {
    question: 'Can I include ramka in my component library or site builder?',
    answer:
      'GPL-compliant open-source redistribution is allowed under GPL-3.0-only. Proprietary redistribution that exposes ramka for use by third parties is not covered by the standard Commercial or Agency licenses. Contact us for an Embedded / OEM license.',
  },
];

function TierCard({ tier, contactHref, checkoutHref }: { tier: Tier; contactHref: string; checkoutHref?: string }) {
  return (
    <div
      className={cn(
        // Capped and centred while stacked: a full-bleed card at 900px would
        // stretch its pill button across the viewport. The cap lifts once the
        // three sit side by side.
        'mx-auto flex w-full max-w-md flex-col rounded-3xl border p-8 lg:max-w-none',
        tier.featured
          ? // Emphasis by hierarchy: a darker hairline and one soft ambient
            // shadow lift this card without any accent colour or badge fill.
            'border-neutral-300 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-24px_rgba(0,0,0,0.18)] dark:border-neutral-700 dark:bg-neutral-950 dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_16px_40px_-24px_rgba(0,0,0,0.8)]'
          : 'border-neutral-200 dark:border-neutral-800',
      )}
    >
      <div className="flex min-h-6 items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">{tier.name}</h3>
        {tier.featured ? (
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium leading-none text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            Most popular
          </span>
        ) : null}
      </div>

      <div className="mt-6">
        <div className="text-4xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">{tier.price}</div>
        <div className="mt-1.5 text-[13px] text-neutral-400 dark:text-neutral-500">{tier.priceNote}</div>
      </div>

      {/* Two lines' worth of room, so the descriptions' differing lengths
          don't leave the three lists starting at three different heights. */}
      <p className="mt-6 text-pretty text-[15px] leading-6 text-neutral-600 lg:min-h-12 dark:text-neutral-400">
        {tier.description}
      </p>

      <ul className="mt-6 flex-1 space-y-2.5 border-t border-neutral-100 pt-6 dark:border-neutral-900">
        {tier.items.map((item) => (
          <li key={item} className="flex gap-2.5 text-[15px] leading-6 text-neutral-700 dark:text-neutral-300">
            <Check aria-hidden className="mt-1 size-3.5 shrink-0 text-neutral-400 dark:text-neutral-500" />
            {item}
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-8">
        {checkoutHref ? (
          <a href={checkoutHref} className={tier.featured ? primaryCtaClassName : secondaryCtaClassName}>
            {tier.buyLabel}
          </a>
        ) : tier.checkoutPlan ? null : (
          <a href={contactHref} className={secondaryCtaClassName}>
            Contact us
          </a>
        )}
      </div>
    </div>
  );
}

export default async function LicensePage() {
  // Read from the agreement itself, so the version a purchase is recorded
  // against cannot drift from the version on file.
  const { version } = await readAgreement();

  return (
    <div className="isolate flex min-h-screen flex-col">
      <SiteHeader home />

      <main className="flex-1">
        <section className="mx-auto w-full max-w-2xl px-6 pt-16 text-center md:pt-20">
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-neutral-950 md:text-5xl dark:text-neutral-50">
            Buy once. Yours forever.
          </h1>
          {/* Two sentences, two lines — the second is the one that sends a
              proprietary team to the pricing row, so it gets its own line
              rather than trailing off the end of the first. */}
          <p className="mx-auto mt-5 max-w-xl text-pretty text-[17px] leading-7 text-neutral-500 dark:text-neutral-400">
            <span className="block">ramka is free for open source under GPL-3.0-only.</span>
            <span className="block">For proprietary software, one payment covers your whole team, for life.</span>
          </p>
        </section>

        <section className="mx-auto w-full max-w-5xl px-6 pt-14 md:pt-16">
          <h2 className="sr-only">License tiers</h2>
          <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch lg:gap-5">
            {tiers.map((tier) => (
              <TierCard
                key={tier.name}
                tier={tier}
                contactHref={enquiryUrl(version)}
                checkoutHref={tier.checkoutPlan ? checkoutUrls[tier.checkoutPlan] : undefined}
              />
            ))}
          </div>

          <ul className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-x-7 gap-y-2.5">
            {sharedInclusions.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 text-[13px] leading-6 text-neutral-500 dark:text-neutral-400"
              >
                <Check aria-hidden className="size-3.5 shrink-0 text-neutral-400 dark:text-neutral-500" />
                {item}
              </li>
            ))}
          </ul>

          <p className="mt-8 text-center text-[13px] leading-6 text-neutral-400 dark:text-neutral-500">
            Prices exclude any applicable taxes, calculated at checkout. Licenses are granted under the{' '}
            <Link href="/license/commercial" className={quietLinkClassName}>
              Ramka Commercial License Agreement
            </Link>
            .
          </p>
        </section>

        <section className="mx-auto w-full max-w-2xl px-6 pt-20 text-center md:pt-24">
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            Building open source?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-[15px] leading-7 text-neutral-600 dark:text-neutral-400">
            ramka is free under GPL-3.0-only — a copyleft license that requires software using ramka to be released
            under the GPL as well, with full source code. Keeping your source closed? That&rsquo;s what the commercial
            licenses are for.
          </p>
          <p className="mt-4 text-[15px]">
            <a
              href={GPL_URL}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-2 transition hover:decoration-neutral-500 dark:text-neutral-50 dark:decoration-neutral-700 dark:hover:decoration-neutral-500"
            >
              View the GPL license
            </a>
          </p>
        </section>

        <section className="mx-auto w-full max-w-5xl px-6 pt-20 md:pt-24">
          <h2 className="text-center text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            Questions
          </h2>
          <dl className="mt-8 grid gap-x-12 gap-y-7 md:grid-cols-2">
            {faqs.map((faq) => (
              <div key={faq.question}>
                <dt className="text-[15px] font-medium text-neutral-900 dark:text-neutral-100">{faq.question}</dt>
                <dd className="mt-1.5 text-[15px] leading-6 text-neutral-500 dark:text-neutral-400">{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mx-auto w-full max-w-2xl px-6 pt-16 pb-20 text-center md:pb-24">
          <p className="text-[13px] leading-6 text-neutral-400 dark:text-neutral-600">
            Purchases are governed by the Ramka Commercial License Agreement. The GPL license and commercial license are
            alternative license grants.
          </p>
          <p className="mt-3 text-[13px] leading-6 text-neutral-400 dark:text-neutral-600">
            <Link href="/license/commercial" className={quietLinkClassName}>
              Commercial License Agreement
            </Link>
            <span aria-hidden className="px-2">
              ·
            </span>
            <a href={GPL_URL} target="_blank" rel="noreferrer" className={quietLinkClassName}>
              GPL-3.0-only
            </a>
            <span aria-hidden className="px-2">
              ·
            </span>
            <Link href="/license/notices" className={quietLinkClassName}>
              Third-party notices
            </Link>
            <span aria-hidden className="px-2">
              ·
            </span>
            <Link href="/terms" className={quietLinkClassName}>
              Terms of Service
            </Link>
            <span aria-hidden className="px-2">
              ·
            </span>
            <Link href="/privacy" className={quietLinkClassName}>
              Privacy Policy
            </Link>
            <span aria-hidden className="px-2">
              ·
            </span>
            <Link href="/returns" className={quietLinkClassName}>
              Return Policy
            </Link>
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
