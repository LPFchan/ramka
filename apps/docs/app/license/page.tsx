import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';

import { LaunchWeekCapsule } from '../_components/launch-week-capsule';
import { SiteFooter } from '../_components/site-footer';
import { SiteHeader } from '../_components/site-header';
import { TrackedAnchor } from '../_components/tracked-link';
import { pricing } from '../_content/pricing';
import { checkoutUrls, type PaidCheckoutPlan } from '../checkout/hosted-urls';
import { readAgreement } from './documents';
import { cn } from '@/lib/utils';

const GPL_URL = 'https://www.gnu.org/licenses/gpl-3.0.html';

// Embedded / OEM is still quoted over email. The enquiry carries the agreement
// version in force so an order can be recorded against the terms that applied.
const CONTACT_EMAIL = 'artur.bien+ramka@gmail.com';

function enquiryUrl(agreementVersion: string): string {
  const body = [
    'Tier (Indie, Business, Agency, or Embedded / OEM):',
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
    'ramka is free for open source under GPL-3.0-only. For proprietary software, buy once: lifetime license, no subscription, no license keys.',
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
  /**
   * Launch-week anchor: the regular price that applies once launch week
   * ends, always framed as a future price. See `_content/pricing.ts` for the
   * framing rationale and how to end launch week.
   */
  regularPrice?: string;
  /** Sits under the price: the payment model. */
  priceNote: string;
  /** Short differentiators only — everything shared lives in the strip below the cards. */
  items: string[];
  /** The one tier that carries the raised card. */
  featured?: boolean;
  /** Whop hosted checkout for this tier. */
  checkoutPlan: PaidCheckoutPlan;
  buyLabel: string;
}

const tiers: Tier[] = [
  {
    name: 'Indie',
    description: 'For individual developers building their own products.',
    price: pricing.indie.price,
    regularPrice: pricing.indie.regular,
    priceNote: 'One-time payment',
    items: [
      'Unlimited products you personally own',
      'Use in proprietary, closed-source software',
      'No client or employer work',
    ],
    checkoutPlan: 'indie',
    buyLabel: 'Buy Indie',
  },
  {
    // Renamed from "Commercial"; the checkout plan key stays `commercial`
    // because it identifies the unchanged Whop plan, not the display name.
    name: 'Business',
    description: 'For companies building their own proprietary products.',
    price: pricing.business.price,
    regularPrice: pricing.business.regular,
    priceNote: 'One-time payment',
    items: [
      'Unlimited products owned by your company',
      'Whole team, no per-seat pricing',
      'Use in proprietary, closed-source software',
      'Not for client work or redistribution',
    ],
    featured: true,
    checkoutPlan: 'commercial',
    buyLabel: 'Buy Business',
  },
  {
    name: 'Agency',
    description: 'For freelancers and agencies building products for clients.',
    price: pricing.agency.price,
    regularPrice: pricing.agency.regular,
    priceNote: 'One-time payment',
    items: [
      'Unlimited client projects',
      'Whole team, no per-seat pricing',
      'Use in proprietary, closed-source software',
      'Covers work delivered to any client',
    ],
    checkoutPlan: 'agency',
    buyLabel: 'Buy Agency',
  },
];

// What every paid license includes, pulled out of the cards so each card can
// carry only what tells the tiers apart.
const sharedInclusions = ['Lifetime license', 'No subscription', 'No license keys or activation', 'No runtime fees'];

const faqs = [
  {
    question: 'Can I use ramka commercially for free?',
    answer:
      'Yes, but only under GPL-3.0-only — a copyleft license that requires the software using ramka to be released under the GPL as well. The paid licenses are for proprietary use without those obligations.',
  },
  {
    question: 'Can I try ramka before buying?',
    answer:
      'Yes. ramka is publicly available on npm under GPL-3.0-only, so you can evaluate it freely. A paid license matters when you ship proprietary, closed-source software without relying on the GPL.',
  },
  {
    question: 'Is the license a subscription?',
    answer: 'No. Paid licenses are one-time purchases with lifetime usage rights.',
  },
  {
    question: 'Can my whole team use it?',
    answer:
      'Business and Agency cover any number of employees and contractors working on the licensed products; they are not priced per developer. Indie is personal to one individual.',
  },
  {
    question: 'Can I use the Business license for client work?',
    answer: 'No. Use the Agency license for work delivered to clients.',
  },
  {
    question: 'I\u2019m a freelancer building for a client. Can I buy Indie?',
    answer:
      'No. Indie covers products you personally own. Work delivered to clients needs the Agency license, even if you work solo.',
  },
  {
    question: 'Can I use Indie for my employer\u2019s or my company\u2019s product?',
    answer:
      'No. Indie covers products owned by you as an individual. Products owned by a company, including your own company, need the Business license.',
  },
  {
    question: 'What happens if I get a refund or withdraw from the purchase?',
    answer:
      'The paid proprietary license from that purchase no longer applies, so you can no longer rely on it for proprietary use. Any rights you independently have under GPL-3.0-only remain governed by the GPL. See the Return Policy.',
  },
  {
    question: 'Can I include ramka in my open-source library?',
    answer:
      'Yes, under GPL-3.0-only — but the GPL obligations continue downstream. Wrapping ramka in another open-source package does not change its license or remove its copyleft terms. Downstream users who want to use ramka in proprietary software without relying on the GPL need their own commercial license.',
  },
  {
    question: 'Can I include ramka in my component library or site builder?',
    answer:
      'GPL-compliant open-source redistribution is allowed under GPL-3.0-only. Proprietary redistribution that exposes ramka for use by third parties is not covered by the Indie, Business, or Agency licenses. Contact us for an Embedded / OEM license.',
  },
];

function TierCard({ tier }: { tier: Tier }) {
  return (
    <div
      className={cn(
        // Capped and centred while stacked: a full-bleed card at 900px would
        // stretch its pill button across the viewport. The cap lifts once the
        // three sit side by side.
        'mx-auto flex w-full max-w-md flex-col rounded-3xl border p-8 lg:max-w-none',
        tier.featured
          ? // Emphasis by hierarchy, no accent fills: from lg up the card
            // outgrows the row by a few pixels each way (negative margins
            // against the stretched grid track). Elevation is mode-specific —
            // light leans on the ambient shadow (a fill wouldn't read on a
            // white page), dark on a lighter gray surface (shadows barely
            // read on near-black).
            'border-neutral-300 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05),0_24px_56px_-28px_rgba(0,0,0,0.25)] lg:-my-3 dark:border-neutral-700 dark:bg-neutral-900 dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_24px_56px_-28px_rgba(0,0,0,0.9)]'
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
        <div className="flex items-baseline gap-2.5">
          <div className="text-4xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
            {tier.price}
          </div>
          {tier.regularPrice ? (
            // Decorative anchor only; the launch-week capsule above the grid
            // carries the meaning, so screen readers skip the bare struck
            // number.
            <div
              aria-hidden
              className="text-xl font-medium tracking-tight text-neutral-300 line-through decoration-from-font dark:text-neutral-600"
            >
              {tier.regularPrice}
            </div>
          ) : null}
        </div>
        <div className="mt-1.5 text-[13px] text-neutral-400 dark:text-neutral-500">{tier.priceNote}</div>
      </div>

      {/* Two lines' worth of room, so the descriptions' differing lengths
          don't leave the three lists starting at three different heights. */}
      <p className="mt-6 text-pretty text-[15px] leading-6 text-neutral-600 lg:min-h-12 dark:text-neutral-400">
        {tier.description}
      </p>

      {/* The divider is opacity-based so it stays a hairline on both the
          white featured card and the washed side cards. */}
      <ul className="mt-6 flex-1 space-y-2.5 border-t border-neutral-950/[0.07] pt-6 dark:border-white/[0.07]">
        {tier.items.map((item) => (
          <li key={item} className="flex gap-2.5 text-[15px] leading-6 text-neutral-700 dark:text-neutral-300">
            <Check aria-hidden className="mt-1 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-500" />
            {item}
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-8">
        <TrackedAnchor
          event="checkout_click"
          eventData={{ tier: tier.checkoutPlan }}
          href={checkoutUrls[tier.checkoutPlan]}
          className={tier.featured ? primaryCtaClassName : secondaryCtaClassName}
        >
          {tier.buyLabel}
        </TrackedAnchor>
        <p className="mt-3 text-center text-[11px] leading-4 text-neutral-400 dark:text-neutral-500">
          Instant, secure checkout via Whop
        </p>
      </div>
    </div>
  );
}

export default async function LicensePage() {
  // Read from the agreement itself, so the version a purchase is recorded
  // against cannot drift from the version on file.
  const { version } = await readAgreement();

  // FAQ rich-result markup, generated from the same `faqs` array the page
  // renders so the schema can never drift from the visible content.
  const faqStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };

  return (
    <div className="isolate flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />
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
            <span className="block">For proprietary software, one payment. No subscription, for life.</span>
          </p>
        </section>

        {/* max-w-6xl rather than the page's usual 5xl: three cards with card
            padding at 5xl leaves ~250px of content and wraps every other
            bullet; the extra width goes entirely to the cards. */}
        <section className="mx-auto w-full max-w-6xl px-6 pt-14 md:pt-16">
          <h2 className="sr-only">License tiers</h2>

          {/* Renders nothing once launch week ends (see the capsule itself). */}
          <div className="mb-8 flex justify-center empty:hidden">
            <LaunchWeekCapsule />
          </div>

          <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch lg:gap-5">
            {tiers.map((tier) => (
              <TierCard key={tier.name} tier={tier} />
            ))}
          </div>

          {/* One rule resolves the whole tier choice, so nobody stalls at the
              cards or falls back to reading the agreement. */}
          <p className="mx-auto mt-9 max-w-2xl text-balance text-center text-[13px] leading-6 text-neutral-500 dark:text-neutral-400">
            Not sure which tier? Go by who owns what you ship: you personally (Indie), your company (Business), or
            your clients (Agency).
          </p>

          <ul className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-x-7 gap-y-2.5">
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

          {/* Embedded / OEM, deliberately below and quieter than the paid
              cards: it applies to few buyers, has no fixed price, and would
              otherwise compete with the three self-serve tiers for attention.
              One hairline row, no price, a small CTA. */}
          <div className="mx-auto mt-10 flex max-w-3xl flex-col gap-4 rounded-2xl border border-neutral-200 p-6 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800">
            <div>
              <h3 className="text-[14px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
                Embedded / OEM
              </h3>
              <p className="mt-1 text-pretty text-[13px] leading-5 text-neutral-500 dark:text-neutral-400">
                Redistributing ramka in a component library, SDK, site builder, template system, or white-label
                product? Custom terms, quoted over email.
              </p>
            </div>
            <TrackedAnchor
              event="oem_contact_click"
              href={enquiryUrl(version)}
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 px-4 text-[13px] font-medium text-neutral-900 transition hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-900"
            >
              Contact us
            </TrackedAnchor>
          </div>

          <p className="mt-8 text-center text-[13px] leading-6 text-neutral-400 dark:text-neutral-500">
            Prices exclude any applicable taxes; the total including tax is shown at checkout. Licenses are granted
            under the{' '}
            <Link href="/license/commercial" className={quietLinkClassName}>
              Ramka License Agreement
            </Link>
            .
          </p>
          {/* Risk reversal at the point of purchase, scoped to what the return
              policy actually promises: mistakes get fixed, and consumers keep
              their statutory withdrawal right. */}
          <p className="mt-2 text-center text-[13px] leading-6 text-neutral-400 dark:text-neutral-500">
            Purchased by accident or picked the wrong tier?{' '}
            <Link href="/returns" className={quietLinkClassName}>
              We&rsquo;ll make it right
            </Link>
            . Buying as an EU/EEA consumer? A statutory{' '}
            <Link href="/returns" className={quietLinkClassName}>
              14-day right of withdrawal
            </Link>{' '}
            applies.
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
            Purchases are governed by the Ramka License Agreement. The GPL license and the paid licenses are
            alternative license grants: buying grants proprietary rights in addition to the GPL terms anyone can
            already use.
          </p>
          <p className="mt-3 text-[13px] leading-6 text-neutral-400 dark:text-neutral-600">
            <Link href="/license/commercial" className={quietLinkClassName}>
              Ramka License Agreement
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
