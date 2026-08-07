import { Heart } from 'lucide-react';

const SPONSOR_URL = 'https://github.com/sponsors/arturbien';
const GITHUB_URL = 'https://github.com/arturbien/ramka';

/**
 * Closing sponsorship ask, styled like an Apple product buy section: big
 * pricing headline, reassuring subline, one obvious button. "From $0/month"
 * parodies Apple's "From $999" pricing while being literally true for open
 * source.
 */
export function SponsorSection() {
  return (
    <section className="mx-auto w-full max-w-3xl px-6 pb-24 text-center md:pb-32">
      <h2 className="text-balance text-4xl font-semibold tracking-tight text-neutral-950 md:text-5xl dark:text-neutral-50">
        MIT licensed. From $0/month.
      </h2>
      <p className="mx-auto mt-6 max-w-xl text-pretty text-neutral-500 dark:text-neutral-400">
        ramka is free and open source, and always will be. If it saved you a
        sprint, a rewrite, or a jQuery plugin, sponsoring keeps it maintained.
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <a
          href={SPONSOR_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-900 px-6 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          <Heart aria-hidden className="h-4 w-4 fill-pink-500 text-pink-500" />
          Sponsor on GitHub
        </a>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center rounded-full border border-neutral-200 px-6 text-sm font-medium text-neutral-900 transition hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-900"
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
