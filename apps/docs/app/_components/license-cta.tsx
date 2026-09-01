import { startingPrice } from '../_content/pricing';
import { LaunchWeekCapsule } from './launch-week-capsule';
import { TrackedLink } from './tracked-link';

const GITHUB_URL = 'https://github.com/arturbien/ramka';

/**
 * Closing ask, styled like an Apple product buy section: big pricing headline,
 * reassuring subline, one obvious button. "From $79. Once." parodies Apple's
 * "From $999" while being literally true for the Indie license.
 */
export function LicenseCta() {
  return (
    <section className="mx-auto w-full max-w-3xl px-6 pb-24 text-center md:pb-32">
      <h2 className="text-balance text-4xl font-semibold tracking-tight text-neutral-950 md:text-5xl dark:text-neutral-50">
        From {startingPrice}. Once.
      </h2>
      <div className="mt-5 flex justify-center empty:hidden">
        <LaunchWeekCapsule />
      </div>
      <p className="mx-auto mt-6 max-w-xl text-pretty text-neutral-500 dark:text-neutral-400">
        Free for open source under the GPL. For proprietary software, a one-time
        license (solo or whole-team, depending on the tier) is yours forever.
        No subscription, no per-seat pricing.
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <TrackedLink
          event="get_license_click"
          eventData={{ location: 'closing_cta' }}
          href="/license"
          className="inline-flex h-11 items-center rounded-full bg-neutral-900 px-4 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          Get a license
        </TrackedLink>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center rounded-full border border-neutral-200 px-4 text-sm font-medium text-neutral-900 transition hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-900"
        >
          Or leave a star. Stars are free.
        </a>
      </div>

      <p className="mt-8 text-xs text-neutral-400 dark:text-neutral-600">
        Proceeds fund the ongoing fight against scroll emulation.
      </p>
    </section>
  );
}
