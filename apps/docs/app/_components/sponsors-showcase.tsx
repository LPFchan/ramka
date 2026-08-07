import { Heart } from 'lucide-react';

const SPONSOR_URL = 'https://github.com/sponsors/arturbien';
const X_URL = 'https://x.com/artur_bien';

/**
 * Sponsor placement showcase, structured like an Apple hero: testimonial as
 * pure typography, CTA buttons right after the pitch, then the sponsor slots
 * below as the "product shot" (one featured banner slot plus a grid of logo
 * slots, rendered as premium empty states sitting directly on the page).
 * Slots link to GitHub Sponsors and get replaced with real logos as sponsors
 * sign up.
 */

const LOGO_SLOTS = 4;

const slotClass =
  'group flex items-center justify-center rounded-2xl bg-neutral-100 transition hover:bg-neutral-200/70 dark:bg-neutral-900 dark:hover:bg-neutral-800/70';

const slotTextClass =
  'text-neutral-400 transition group-hover:text-neutral-600 dark:text-neutral-500 dark:group-hover:text-neutral-300';

/** The X logo; lucide dropped brand icons, so it ships as an inline path. */
function XLogo({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  );
}

export function SponsorsShowcase() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 pb-24 md:pb-32">
      {/* Layer 1: the human story, no container — typography does the work. */}
      <div className="mx-auto max-w-3xl text-center">
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
        <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
          <span className="font-medium text-neutral-900 dark:text-neutral-100">
            Artur Bie&#324;
          </span>
          , the guy who built this
        </p>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-neutral-500 dark:text-neutral-400">
          ramka exists so nobody at your company has to. Sponsors keep it
          maintained, and get their logo here, in front of React developers
          who care about polish.
        </p>

        {/* Layer 2: the action, right where the pitch lands. Buy/Learn-more
            hierarchy: one strong sponsor button, one quiet personal link. */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={SPONSOR_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-900 px-6 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            <Heart aria-hidden className="h-4 w-4 fill-pink-500 text-pink-500" />
            Become a sponsor
          </a>
          <a
            href={X_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-neutral-200 px-6 text-sm font-medium text-neutral-900 transition hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-900"
          >
            <XLogo className="h-3.5 w-3.5" />
            Find me on X
          </a>
        </div>
      </div>

      {/* Layer 3: the sponsor space below, like Apple's product shot after
          the buy buttons. The slots carry their own hairlines and shadows, so
          they sit directly on the page with no tray around them. */}
      <div className="mt-12 md:mt-14">
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

        <div className="mt-3 grid grid-cols-2 gap-3 md:mt-4 md:grid-cols-4 md:gap-4">
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
      </div>
    </section>
  );
}
