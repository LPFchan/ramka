import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';

import { SiteFooter } from '../_components/site-footer';
import { SiteHeader } from '../_components/site-header';
import { cn } from '@/lib/utils';

const GPL_URL = 'https://www.gnu.org/licenses/gpl-3.0.html';
const THIRD_PARTY_NOTICES_URL = 'https://github.com/arturbien/ramka/blob/main/packages/ramka/THIRD-PARTY-NOTICES.md';

// Checkout is not wired up yet, so every buy path is the same mailto until a
// payment provider is in place. Kept in one block so switching to real
// checkout URLs is a single edit, not a hunt through the markup.
const CONTACT_EMAIL = 'artur.bien+ramka@gmail.com';
const BUY_COMMERCIAL_URL = `mailto:${CONTACT_EMAIL}?subject=Commercial%20license`;
const BUY_AGENCY_URL = `mailto:${CONTACT_EMAIL}?subject=Agency%20license`;
const CONTACT_URL = `mailto:${CONTACT_EMAIL}?subject=Embedded%20%2F%20OEM%20license`;

export const metadata: Metadata = {
  title: 'License — ramka',
  description: 'ramka is free under GPL-3.0-only. For proprietary software, choose a one-time commercial license.',
};

const primaryCtaClassName =
  'inline-flex h-11 w-full items-center justify-center rounded-full bg-neutral-900 px-4 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-300';

const secondaryCtaClassName =
  'inline-flex h-11 w-full items-center justify-center rounded-full border border-neutral-200 px-4 text-sm font-medium text-neutral-900 transition hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-900';

const quietLinkClassName =
  'underline decoration-neutral-300 underline-offset-2 transition hover:decoration-neutral-500 dark:decoration-neutral-700 dark:hover:decoration-neutral-500';

interface Tier {
  name: string;
  price: string;
  /** Sits under the price. Omitted for the quote-based tier, which has no term. */
  term?: string;
  description: string;
  /** Heading above the list, since the OEM tier lists examples rather than what is included. */
  listTitle: string;
  items: string[];
  cta: { label: string; href: string };
  /** The one tier that carries the filled button and the raised card. */
  featured?: boolean;
}

const tiers: Tier[] = [
  {
    name: 'Commercial',
    price: '$129',
    term: 'one-time',
    description: 'For companies building their own proprietary products.',
    listTitle: 'Includes',
    items: [
      'Unlimited developers',
      'Unlimited products owned by the licensee',
      'Lifetime license',
      'All updates for the current major version',
      'No subscription',
      'No runtime fees',
      'Commercial and proprietary use',
    ],
    cta: { label: 'Buy Commercial', href: BUY_COMMERCIAL_URL },
    featured: true,
  },
  {
    name: 'Agency',
    price: '$299',
    term: 'one-time',
    description: 'For freelancers and agencies building proprietary products for clients.',
    listTitle: 'Includes',
    items: [
      'Unlimited developers',
      'Unlimited client projects',
      'Commercial and proprietary use',
      'Lifetime license',
      'All updates for the current major version',
      'No subscription',
      'No runtime fees',
    ],
    cta: { label: 'Buy Agency', href: BUY_AGENCY_URL },
  },
  {
    name: 'Embedded / OEM',
    price: 'Custom',
    description: 'For products that redistribute ramka or make it available to their own users.',
    listTitle: 'For example',
    items: ['Component libraries', 'SDKs', 'Site builders', 'Template systems', 'White-label products'],
    cta: { label: 'Contact us', href: CONTACT_URL },
  },
];

const faqs = [
  {
    question: 'Can I use ramka commercially for free?',
    answer:
      'Yes, if your use complies with GPL-3.0-only. The paid licenses are for proprietary use without relying on the GPL.',
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
    question: 'Can I include ramka in my component library or site builder?',
    answer: 'Not under the standard Commercial or Agency licenses. Contact us for an Embedded / OEM license.',
  },
];

function PricingCard({ tier }: { tier: Tier }) {
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
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400 dark:text-neutral-500">
            Recommended
          </span>
        ) : null}
      </div>

      <div className="mt-6">
        <div className="text-5xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">{tier.price}</div>
        {/* Reserve the term line's height on the quote-based card too, so the
            three prices sit on one baseline and the lists start together. */}
        <div className="mt-2 h-5 text-sm text-neutral-500 dark:text-neutral-400">{tier.term}</div>
      </div>

      {/* Three lines' worth of room, so the descriptions' differing lengths
          don't leave the three lists starting at three different heights. */}
      <p className="mt-6 text-pretty text-[15px] leading-6 text-neutral-600 lg:min-h-18 dark:text-neutral-400">
        {tier.description}
      </p>

      <div className="mt-8 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400 dark:text-neutral-500">
        {tier.listTitle}
      </div>
      <ul className="mt-3 space-y-2.5">
        {tier.items.map((item) => (
          <li key={item} className="flex gap-2.5 text-[15px] leading-6 text-neutral-700 dark:text-neutral-300">
            <Check aria-hidden className="mt-1 size-3.5 shrink-0 text-neutral-400 dark:text-neutral-500" />
            {item}
          </li>
        ))}
      </ul>

      {/* mt-auto pins every CTA to the bottom edge, so uneven list lengths
          don't leave the buttons on three different lines. */}
      <div className="mt-10 pt-2 lg:mt-auto">
        <a href={tier.cta.href} className={tier.featured ? primaryCtaClassName : secondaryCtaClassName}>
          {tier.cta.label}
        </a>
      </div>
    </div>
  );
}

export default function LicensePage() {
  return (
    <div className="isolate flex min-h-screen flex-col">
      <SiteHeader home />

      <main className="flex-1">
        <section className="mx-auto w-full max-w-2xl px-6 pt-16 text-center md:pt-20">
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-neutral-950 md:text-5xl dark:text-neutral-50">
            Simple licensing. Yours forever.
          </h1>
          {/* Two sentences, two lines — the second is the one that sends a
              proprietary team to the pricing row, so it gets its own line
              rather than trailing off the end of the first. */}
          <p className="mx-auto mt-5 max-w-xl text-pretty text-[17px] leading-7 text-neutral-500 dark:text-neutral-400">
            <span className="block">ramka is free under GPL-3.0-only.</span>
            <span className="block">For proprietary software, choose a commercial license.</span>
          </p>
        </section>

        <section className="mx-auto w-full max-w-5xl px-6 pt-14 md:pt-16">
          <h2 className="sr-only">Pricing</h2>
          <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch lg:gap-5">
            {tiers.map((tier) => (
              <PricingCard key={tier.name} tier={tier} />
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-6 pt-16">
          <div className="rounded-3xl border border-neutral-200 px-8 py-8 text-center dark:border-neutral-800">
            <h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              Prefer open source?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-[15px] leading-7 text-neutral-600 dark:text-neutral-400">
              ramka is also available under GPL-3.0-only at no cost, including for commercial use, provided your use
              complies with the GPL.
            </p>
            <a
              href={GPL_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-full border border-neutral-200 px-5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-900"
            >
              View the GPL license
            </a>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-6 pt-16">
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
            <a href={THIRD_PARTY_NOTICES_URL} target="_blank" rel="noreferrer" className={quietLinkClassName}>
              Third-party notices
            </a>
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
