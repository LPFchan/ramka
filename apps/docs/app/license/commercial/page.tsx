import type { Metadata } from 'next';

import { SiteFooter } from '../../_components/site-footer';
import { SiteHeader } from '../../_components/site-header';

export const metadata: Metadata = {
  title: 'Commercial License Agreement — ramka',
  description: 'The Ramka Commercial License Agreement.',
};

const clauseHeadingClassName = 'text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50';

// A step larger than the body copy, so the tier a clause belongs to is legible
// at a glance rather than by weight alone.
const subheadingClassName =
  'mt-8 scroll-mt-8 text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100';

const bodyClassName = 'mt-4 text-[15px] leading-7 text-neutral-600 dark:text-neutral-400';

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
            <h2 className={clauseHeadingClassName}>1. License grant</h2>
            <p className={bodyClassName}>
              Subject to payment of the applicable license fee and compliance with this Agreement, Artur Bień grants the
              Licensee a non-exclusive, worldwide, non-transferable license to use, reproduce, modify, and incorporate
              ramka into proprietary software products covered by the purchased license tier.
            </p>
            <p className={bodyClassName}>
              The Licensee may distribute those products to end users without making the Licensee’s proprietary source
              code available under the GNU General Public License v3.0.
            </p>
          </section>

          <section id="license-tiers" className="mt-12 scroll-mt-8">
            <h2 className={clauseHeadingClassName}>2. License tiers</h2>

            <h3 id="tier-commercial" className={subheadingClassName}>
              Commercial
            </h3>
            <p className={bodyClassName}>
              The Commercial license permits one company or legal entity to use ramka in any number of proprietary
              products that it owns and operates.
            </p>
            <p className={bodyClassName}>
              The license covers any number of employees and contractors working on those products on behalf of the
              Licensee.
            </p>
            <p className={bodyClassName}>
              It does not permit use in products created for third-party clients, or redistribution of ramka as part of
              a component library, SDK, site builder, template system, or similar product.
            </p>

            <h3 id="tier-agency" className={subheadingClassName}>
              Agency
            </h3>
            <p className={bodyClassName}>
              The Agency license permits one company, agency, or individual to use ramka in any number of proprietary
              projects created for itself or for third-party clients.
            </p>
            <p className={bodyClassName}>
              The license covers any number of employees and contractors working on those projects on behalf of the
              Licensee.
            </p>
            <p className={bodyClassName}>
              It does not permit redistribution of ramka as part of a component library, SDK, site builder, template
              system, or similar product.
            </p>

            <h3 id="tier-embedded" className={subheadingClassName}>
              Embedded / OEM
            </h3>
            <p className={bodyClassName}>
              Use of ramka in a product that redistributes ramka, exposes ramka for use by third parties, or
              incorporates ramka into a component library, SDK, site builder, template system, white-label product, or
              similar offering requires a separate Embedded / OEM license.
            </p>
          </section>

          {/* Two clauses in, a reader should still not have to guess whether
              this is the whole agreement. */}
          <p className="mt-12 border-t border-neutral-200 pt-8 text-[13px] leading-6 text-neutral-400 dark:border-neutral-800 dark:text-neutral-600">
            Remaining sections coming soon.
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
