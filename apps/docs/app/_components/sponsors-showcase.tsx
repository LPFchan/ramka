const SPONSOR_URL = 'https://github.com/sponsors/arturbien';

/**
 * Sponsor placement showcase: one featured banner slot and a grid of logo
 * slots, all rendered as intentional, premium-looking empty states that link
 * to GitHub Sponsors. When sponsors sign up, slots get replaced with real
 * logos. The headline quote is deliberately unattributed — the maintainer's
 * avatar above it does the attribution, and reads as "made by a human".
 *
 * The whole section sits in a tinted rounded card so it separates cleanly
 * from the photo grid above; the slots invert to white/elevated surfaces
 * inside it so they read as mounting plaques for logos.
 */

const LOGO_SLOTS = 4;

const slotClass =
  'group flex items-center justify-center rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-950/[0.06] transition hover:ring-neutral-950/[0.12] dark:bg-neutral-800 dark:shadow-none dark:ring-white/[0.08] dark:hover:ring-white/[0.16]';

const slotTextClass =
  'text-neutral-400 transition group-hover:text-neutral-600 dark:text-neutral-500 dark:group-hover:text-neutral-300';

export function SponsorsShowcase() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 pb-24 md:pb-32">
      <div className="rounded-3xl bg-neutral-50 px-5 py-14 ring-1 ring-neutral-950/[0.05] md:px-14 md:py-16 dark:bg-neutral-900 dark:ring-white/[0.06]">
        <div className="mx-auto max-w-3xl text-center">
          {/* The maintainer's real GitHub avatar: the quote below is a real
              quote, and a face makes that legible at a glance. */}
          <img
            src="https://github.com/arturbien.png?size=192"
            alt="Artur, creator of ramka"
            width={96}
            height={96}
            loading="lazy"
            className="mx-auto mb-7 size-20 rounded-full ring-1 ring-neutral-950/10 md:size-24 dark:ring-white/15"
          />
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-neutral-950 md:text-4xl dark:text-neutral-50">
            &ldquo;I&rsquo;d rather eat glass than build this again.&rdquo;
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-neutral-500 dark:text-neutral-400">
            ramka exists so nobody at your company has to. Sponsors keep it
            maintained, and get their logo here, in front of React developers
            who care about polish.
          </p>
        </div>

        <div className="mt-12">
          <a
            href={SPONSOR_URL}
            target="_blank"
            rel="noreferrer"
            className={`${slotClass} min-h-40 flex-col gap-1.5 px-6 py-10 text-center md:min-h-48`}
          >
            <span className={`${slotTextClass} text-lg font-medium tracking-tight`}>
              Your banner here
            </span>
            <span className="text-xs uppercase tracking-wide text-neutral-400/70 dark:text-neutral-500/70">
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
                className={`${slotClass} min-h-24 px-4 py-8 md:min-h-28`}
              >
                <span className={`${slotTextClass} text-sm font-medium`}>Your logo</span>
              </a>
            ))}
          </div>

          <p className="mt-8 text-center text-sm">
            <a
              href={SPONSOR_URL}
              target="_blank"
              rel="noreferrer"
              className="text-neutral-500 underline-offset-4 transition hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              Become a sponsor &rarr;
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
