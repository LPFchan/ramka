import type { CSSProperties } from 'react';

import { Heart } from 'lucide-react';

import { BrokenGlassShine } from './broken-glass-shine';

const SPONSOR_URL = 'https://github.com/sponsors/arturbien';
const X_URL = 'https://x.com/artur_bien';

/**
 * Sponsor placement showcase. The maintainer's testimonial hangs in a
 * skeuomorphic gilded picture frame — a wink at the library's name (ramka is
 * Polish for "frame") — built entirely from CSS gradients and inset shadows:
 * gold molding, a thin dark lip, and a warm matte board. The matte keeps
 * fixed warm colors in both schemes, like a real object would. Below it,
 * the sponsor slots (one
 * featured banner plus a grid of logo spots) sit flat on the page and link
 * to GitHub Sponsors until real logos replace them.
 */

const LOGO_SLOTS = 4;

const slotClass =
  'group flex items-center justify-center rounded-2xl bg-neutral-100 transition hover:bg-neutral-200/70 dark:bg-neutral-900 dark:hover:bg-neutral-800/70';

const slotTextClass =
  'text-neutral-400 transition group-hover:text-neutral-600 dark:text-neutral-500 dark:group-hover:text-neutral-300';

/**
 * The gilded molding, drawn as an SVG and applied via CSS border-image.
 *
 * Each side is a trapezoid whose gradient runs across the molding, tracing an
 * ogee profile (bead, fillet, cove crest, cove trough, groove, inner bead,
 * rabbet). All four sides share the profile but get a different flat tint —
 * top lit, bottom in shadow — so the 45-degree miter joints read at the
 * corners like physically joined molding. border-image slices the corners
 * out and stretches only the straight runs, so the joinery stays crisp at
 * any element size.
 */
const MOLDING_PROFILE: Array<[number, string]> = [
  [0, '#fdf6c0'],
  [0.06, '#d9b854'],
  [0.14, '#96741f'],
  [0.2, '#c8a53f'],
  [0.32, '#f2e196'],
  [0.5, '#c09a31'],
  [0.66, '#7a5e18'],
  [0.74, '#a98a2b'],
  [0.8, '#64511b'],
  [0.85, '#ead88b'],
  [0.92, '#bd9c35'],
  [1, '#7c6320'],
];

const PROFILE_STOPS = MOLDING_PROFILE.map(
  ([offset, color]) => `<stop offset="${offset}" stop-color="${color}"/>`,
).join('');

// 240x240 canvas with a 40px molding; slice value below must stay in sync.
const FRAME_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">` +
    `<defs>` +
    `<linearGradient id="t" x1="0" y1="0" x2="0" y2="40" gradientUnits="userSpaceOnUse">${PROFILE_STOPS}</linearGradient>` +
    `<linearGradient id="b" x1="0" y1="240" x2="0" y2="200" gradientUnits="userSpaceOnUse">${PROFILE_STOPS}</linearGradient>` +
    `<linearGradient id="l" x1="0" y1="0" x2="40" y2="0" gradientUnits="userSpaceOnUse">${PROFILE_STOPS}</linearGradient>` +
    `<linearGradient id="r" x1="240" y1="0" x2="200" y2="0" gradientUnits="userSpaceOnUse">${PROFILE_STOPS}</linearGradient>` +
    `</defs>` +
    `<polygon points="0,0 240,0 200,40 40,40" fill="url(#t)"/>` +
    `<polygon points="0,0 240,0 200,40 40,40" fill="#fff" opacity=".14"/>` +
    `<polygon points="0,240 40,200 200,200 240,240" fill="url(#b)"/>` +
    `<polygon points="0,240 40,200 200,200 240,240" fill="#000" opacity=".2"/>` +
    `<polygon points="0,0 40,40 40,200 0,240" fill="url(#l)"/>` +
    `<polygon points="0,0 40,40 40,200 0,240" fill="#000" opacity=".06"/>` +
    `<polygon points="240,0 240,240 200,200 200,40" fill="url(#r)"/>` +
    `<polygon points="240,0 240,240 200,200 200,40" fill="#000" opacity=".12"/>` +
    `</svg>`,
);

const frameStyle: CSSProperties = {
  borderImage: `url("data:image/svg+xml,${FRAME_SVG}") 40`,
};

/**
 * Fine monochrome grain, tiled over the whole framed object in soft-light
 * blend: the gold reads as leafed metal, the matte as paper board. Tiny tile
 * (120px) keeps the data URI small; stitchTiles hides the seams.
 */
const NOISE_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">` +
    `<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>` +
    `<feColorMatrix type="saturate" values="0"/></filter>` +
    `<rect width="120" height="120" filter="url(#n)"/>` +
    `</svg>`,
);

const noiseStyle: CSSProperties = {
  backgroundImage: `url("data:image/svg+xml,${NOISE_SVG}")`,
};

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
      {/* The framed testimonial. Colors inside the frame are fixed (not
          scheme-aware): a physical gold frame with a dark matte looks the
          same on a light wall or a dark one. The matte is dark on purpose —
          the glass glints are additive white light and need a dark surface
          to be visible. */}
      {/* A traditional landscape frame on desktop: 4:3, wide enough that the
          quote breathes, not so wide it dwarfs the content column. */}
      <div className="mx-auto max-w-3xl">
        {/* The SVG molding as border-image. Two shadows ground it: a tight
            contact shadow and a broad soft one, like a frame on a wall. */}
        <div
          className="relative border-16 bg-[#1a1915] shadow-[0_2px_6px_rgba(0,0,0,0.25),0_32px_64px_-16px_rgba(0,0,0,0.4)] md:aspect-4/3 md:border-28"
          style={frameStyle}
        >
          {/* Glass pane over the matte ("I'd rather eat glass"): intact until
              clicked, then shattered around the click, with static specular
              glints along the cracks. */}
          <BrokenGlassShine className="absolute inset-0 z-10" />

          {/* Grain overlay; negative inset stretches it over the border-image
              molding, which sits outside the padding box. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-4 opacity-40 mix-blend-soft-light md:-inset-7"
            style={noiseStyle}
          />
          {/* Matte board: warm charcoal with a beveled cut edge under the
              frame's rabbet. */}
          {/* On desktop the frame is a fixed 4:3, so the matte fills it and
              centers the content in the extra vertical room. */}
          {/* Everything inside steps down one size on mobile — avatar, type
              scale, and spacing — so the frame stays a plausible portrait
              instead of a 1:2 tower on phones. */}
          <div className="bg-[#1a1915] px-5 py-9 text-center shadow-[inset_0_2px_6px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(255,255,255,0.05)] md:flex md:h-full md:flex-col md:items-center md:justify-center md:px-8 md:py-14">
              <img
                src="https://github.com/arturbien.png?size=192"
                alt="Artur, creator of ramka"
                width={96}
                height={96}
                loading="lazy"
                className="mx-auto mb-5 size-16 rounded-full ring-1 ring-white/15 md:mb-7 md:size-24"
              />
              <h2 className="text-balance text-2xl font-semibold tracking-tight text-[#f5f3ec] md:text-4xl">
                &ldquo;I&rsquo;d rather eat glass than build this again.&rdquo;
              </h2>

              {/* Attribution: tight under the quote, a step smaller and
                  dimmer than the pitch, so it groups with the quote instead
                  of reading as another paragraph. */}
              <p className="mt-3 text-xs text-[#7c7a70] md:mt-4 md:text-sm">
                Artur Bie&#324; &middot; the guy who built this
              </p>

              <p className="mx-auto mt-6 max-w-xl text-pretty text-sm text-[#a8a69d] md:mt-10 md:text-base">
                ramka exists so nobody at your company has to. Sponsors keep
                it maintained, and get their logo here, in front of React
                developers who care about polish.
              </p>

              {/* Buttons keep fixed colors tuned for the dark matte. */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5 md:mt-8 md:gap-3">
                <a
                  href={SPONSOR_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-[#f5f3ec] px-5 text-sm font-medium text-neutral-900 transition hover:bg-[#dedcd2] md:h-11 md:px-6"
                >
                  <Heart aria-hidden className="h-4 w-4 fill-pink-500 text-pink-500" />
                  Become a sponsor
                </a>
                <a
                  href={X_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-white/20 px-5 text-sm font-medium text-[#f5f3ec] transition hover:bg-white/10 md:h-11 md:px-6"
                >
                  <XLogo className="h-3.5 w-3.5" />
                  Find me on X
                </a>
              </div>
          </div>
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
