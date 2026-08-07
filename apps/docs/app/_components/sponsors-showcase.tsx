const SPONSOR_URL = 'https://github.com/sponsors/arturbien';

/**
 * Sponsor placement showcase: one featured banner slot and a grid of logo
 * slots, all rendered as intentional, premium-looking empty states that link
 * to GitHub Sponsors. When sponsors sign up, slots get replaced with real
 * logos. "Put your logo in the frame" trades on ramka meaning "frame".
 */

const LOGO_SLOTS = 4;

export function SponsorsShowcase() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 pb-24 md:pb-32">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-balance text-3xl font-semibold tracking-tight text-neutral-950 md:text-4xl dark:text-neutral-50">
          Put your logo in the frame.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-neutral-500 dark:text-neutral-400">
          Sponsors get their brand here, in front of React developers who care
          about polish. One featured spot, a handful of logo spots, all of
          them currently very available.
        </p>
      </div>

      <div className="mt-12">
        <a
          href={SPONSOR_URL}
          target="_blank"
          rel="noreferrer"
          className="group flex min-h-40 flex-col items-center justify-center gap-1.5 rounded-2xl bg-neutral-100 px-6 py-10 text-center transition hover:bg-neutral-200/70 md:min-h-48 dark:bg-neutral-900 dark:hover:bg-neutral-800/70"
        >
          <span className="text-lg font-medium tracking-tight text-neutral-400 transition group-hover:text-neutral-600 dark:text-neutral-600 dark:group-hover:text-neutral-300">
            Your banner here
          </span>
          <span className="text-xs uppercase tracking-wide text-neutral-400/70 dark:text-neutral-600/70">
            Featured sponsor &middot; one spot
          </span>
        </a>

        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {Array.from({ length: LOGO_SLOTS }, (_, i) => (
            <a
              key={i}
              href={SPONSOR_URL}
              target="_blank"
              rel="noreferrer"
              className="group flex min-h-24 items-center justify-center rounded-2xl bg-neutral-100 px-4 py-8 transition hover:bg-neutral-200/70 md:min-h-28 dark:bg-neutral-900 dark:hover:bg-neutral-800/70"
            >
              <span className="text-sm font-medium text-neutral-400 transition group-hover:text-neutral-600 dark:text-neutral-600 dark:group-hover:text-neutral-300">
                Your logo
              </span>
            </a>
          ))}
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-neutral-400 dark:text-neutral-600">
        Logos are displayed at their native aspect ratio. It&rsquo;s kind of
        our thing.
      </p>
    </section>
  );
}
