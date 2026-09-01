'use client';

import * as React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import * as Lightbox from '@ramka/react/lightbox';
import { Check, ChevronLeft, ChevronRight, Sparkles, Star, X } from 'lucide-react';

import { ramkaA, ramkaC, ramkaD, ramkaE } from '../../../_components/images.generated';
import { lightboxChromeButton } from '../../../_components/lightbox-chrome';

/**
 * Dev-only playground: five candidate easter eggs for the landing page's
 * "Morph view transitions" bento card. Each variant is the same card wired
 * to a different custom lightbox, so the concepts can be compared before one
 * ships. The card itself is the Trigger (the trigger root is the default
 * morph source), and each viewer marks its own destination via the Item's
 * `morphRef`.
 */

/* ------------------------------------------------------------------ */
/* The gilded frame, borrowed from the landing testimonial.            */
/* ------------------------------------------------------------------ */

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

const PROFILE_STOPS = MOLDING_PROFILE.map(([offset, color]) => `<stop offset="${offset}" stop-color="${color}"/>`).join(
  '',
);

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

/** A framed exhibit: gold molding, dark matte, whatever hangs inside. */
function GoldFrame({
  children,
  morphRef,
  className,
}: {
  children: ReactNode;
  morphRef?: (node: HTMLElement | null) => void;
  className?: string;
}) {
  return (
    <div
      ref={morphRef}
      className={`border-16 bg-[#1a1915] shadow-[0_2px_6px_rgba(0,0,0,0.35),0_32px_64px_-16px_rgba(0,0,0,0.55)] md:border-20 ${className ?? ''}`}
      style={frameStyle}
    >
      <div className="h-full bg-[#1a1915] shadow-[inset_0_2px_6px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(255,255,255,0.05)]">
        {children}
      </div>
    </div>
  );
}

/** Museum placard under an exhibit. */
function Placard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="mx-auto mt-6 w-fit max-w-sm rounded-[3px] bg-[#f5f3ec] px-4 py-3 text-left shadow-[0_1px_2px_rgba(0,0,0,0.4),0_8px_24px_-12px_rgba(0,0,0,0.5)]">
      <p className="font-serif text-[13px] font-semibold italic leading-snug text-neutral-900">{title}</p>
      {lines.map((line) => (
        <p key={line} className="mt-0.5 font-serif text-[12px] leading-snug text-neutral-600">
          {line}
        </p>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared card trigger + viewer shell.                                 */
/* ------------------------------------------------------------------ */

/** Replica of the landing bento card, as a Lightbox.Trigger with a Try-me pill. */
function CardTrigger({ crossfade }: { crossfade?: 'open' | 'close' | 'both' }) {
  return (
    <Lightbox.Trigger
      index={0}
      crossfade={crossfade}
      className="block w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-7 text-left transition hover:border-neutral-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-700"
    >
      <Sparkles aria-hidden className="size-5 text-neutral-400 dark:text-neutral-500" strokeWidth={1.75} />
      <span className="mt-4 block text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
        Morph view transitions
      </span>
      <span className="mt-2 block text-pretty text-[14px] leading-6 text-neutral-500 dark:text-neutral-400">
        Thumbnails morph into the open image with shared-element View Transitions, then morph back to the matching
        thumbnail on close.
      </span>
      <span className="mt-5 inline-flex h-8 items-center rounded-full bg-neutral-900 px-3.5 text-xs font-medium text-white dark:bg-neutral-50 dark:text-neutral-900">
        Try me
      </span>
    </Lightbox.Trigger>
  );
}

/** Portal + backdrop + content shell shared by every egg. */
function EggViewer({ ariaLabel, children }: { ariaLabel: string; children: ReactNode }) {
  return (
    <Lightbox.Portal>
      <Lightbox.Backdrop className="lightbox-demo-backdrop fixed inset-0 bg-neutral-950/90" />
      <Lightbox.Content
        aria-label={ariaLabel}
        className="lightbox-demo-content fixed inset-0 flex flex-col overscroll-contain outline-none"
      >
        {children}
        <div className="lightbox-demo-chrome-hide absolute end-4 top-4 z-30">
          <Lightbox.Close className={lightboxChromeButton} aria-label="Close">
            <X aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </Lightbox.Close>
        </div>
      </Lightbox.Content>
    </Lightbox.Portal>
  );
}

type SlideRefs = {
  imageRef: (node: HTMLImageElement | null) => void;
  morphRef: (node: HTMLElement | null) => void;
};

/** Single-slide scaffold used by the one-item eggs. */
function SoloSlide({ children }: { children: (refs: SlideRefs) => ReactNode }) {
  return (
    <Lightbox.Slides aria-label="Showcase" className="flex-1 [&::-webkit-scrollbar]:hidden">
      <Lightbox.Slide className="h-full min-w-full flex-[0_0_100%]">
        <Lightbox.Item index={0} className="flex h-full w-full items-center justify-center px-6 py-14">
          {({ imageRef, morphRef }) => children({ imageRef, morphRef })}
        </Lightbox.Item>
      </Lightbox.Slide>
    </Lightbox.Slides>
  );
}

/* ------------------------------------------------------------------ */
/* V1 — the card gets framed.                                          */
/* ------------------------------------------------------------------ */

function FramedExhibitEgg() {
  return (
    <Lightbox.Root>
      <CardTrigger crossfade="both" />
      <EggViewer ariaLabel="Morph view transitions, framed">
        <SoloSlide>
          {({ morphRef }) => (
            <div className="flex max-h-full flex-col items-center">
              <GoldFrame morphRef={morphRef} className="max-w-lg">
                <div className="px-8 py-12 text-center md:px-12 md:py-16">
                  <Sparkles aria-hidden className="mx-auto size-6 text-[#d9b854]" strokeWidth={1.5} />
                  <p className="mt-5 text-balance text-2xl font-semibold tracking-tight text-[#f5f3ec] md:text-3xl">
                    Morph view transitions
                  </p>
                  <p className="mx-auto mt-4 max-w-xs text-pretty text-sm leading-6 text-[#a8a69d]">
                    You just watched a flat white card become a gilded frame. That was the feature. This is the
                    exhibit.
                  </p>
                </div>
              </GoldFrame>
              <Placard
                title="Morph view transition (2026)"
                lines={['CSS, View Transitions API, and stubbornness on canvas.', 'On loan from the ramka collection.']}
              />
            </div>
          )}
        </SoloSlide>
      </EggViewer>
    </Lightbox.Root>
  );
}

/* ------------------------------------------------------------------ */
/* V2 — lightboxes all the way down.                                   */
/* ------------------------------------------------------------------ */

/**
 * Each nesting level is one photo in one shape: a circle, then a wide
 * rectangle, then a square. The thumb trigger inside a level wears the next
 * level's shape, so every open morphs shape-to-shape — which is the feature
 * doing the joke's stunt work.
 */
const RECURSION_LEVELS = [
  {
    img: ramkaA,
    alt: 'Person standing in a sunlit meadow at golden hour',
    frameClass: 'size-[min(66vmin,26rem)] rounded-full',
    thumbClass: 'size-12 rounded-full',
    hint: 'and inside it\u2026 another lightbox',
  },
  {
    img: ramkaD,
    alt: 'Airplane crossing a purple sky above the clouds',
    frameClass: 'aspect-3/2 w-[min(84vw,34rem)] rounded-2xl',
    thumbClass: 'h-12 w-[4.5rem] rounded-lg',
    hint: 'told you. all the way down',
  },
  {
    img: ramkaC,
    alt: 'Curved building facade in black and white',
    frameClass: 'size-[min(66vmin,24rem)] rounded-md',
    thumbClass: 'size-12 rounded',
  },
];

function RecursionLevel({ depth }: { depth: number }) {
  const level = RECURSION_LEVELS[depth - 1]!;
  const next = depth < RECURSION_LEVELS.length ? RECURSION_LEVELS[depth] : undefined;
  return (
    <Lightbox.Root>
      {depth === 1 ? (
        <CardTrigger crossfade="both" />
      ) : (
        <Lightbox.Trigger
          index={0}
          aria-label={`Open lightbox level ${depth}`}
          className={`pointer-events-auto block shrink-0 overflow-hidden shadow-lg ring-1 ring-white/30 transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${level.thumbClass}`}
        >
          {({ imageRef }) => (
            <Image
              ref={imageRef}
              src={level.img}
              alt={level.alt}
              sizes="96px"
              draggable={false}
              className="block size-full select-none object-cover"
            />
          )}
        </Lightbox.Trigger>
      )}
      <EggViewer ariaLabel={`Lightbox, level ${depth} of ${RECURSION_LEVELS.length}`}>
        <SoloSlide>
          {({ imageRef, morphRef }) => (
            <div className="flex max-h-full flex-col items-center">
              <div ref={morphRef} className={`overflow-hidden shadow-2xl ${level.frameClass}`}>
                <Image
                  ref={imageRef}
                  src={level.img}
                  alt={level.alt}
                  sizes="34rem"
                  loading="eager"
                  draggable={false}
                  className="block size-full select-none object-cover"
                />
              </div>
              <div className="mt-7 flex min-h-12 items-center gap-3.5">
                {next ? (
                  <>
                    <p className="text-sm text-white/75">{level.hint}</p>
                    <RecursionLevel depth={depth + 1} />
                  </>
                ) : (
                  <p className="text-sm text-white/75">
                    Okay. That&rsquo;s enough. <span className="text-white/45">(ramka, probably)</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </SoloSlide>
      </EggViewer>
    </Lightbox.Root>
  );
}

/* ------------------------------------------------------------------ */
/* V3 — a tiny museum wing.                                            */
/* ------------------------------------------------------------------ */

function FlipDiagramArt() {
  return (
    <svg viewBox="0 0 320 200" className="block h-full w-full" aria-hidden>
      <rect width="320" height="200" fill="#f2ecdb" />
      <rect x="28" y="28" width="64" height="48" fill="none" stroke="#4a4438" strokeWidth="2" />
      <text x="30" y="94" fontSize="10" fill="#6b6354" fontFamily="monospace">first</text>
      <rect x="208" y="96" width="88" height="66" fill="none" stroke="#4a4438" strokeWidth="2" />
      <text x="212" y="178" fontSize="10" fill="#6b6354" fontFamily="monospace">last</text>
      <path d="M96 56 C 150 40, 180 70, 204 108" fill="none" stroke="#8a2f22" strokeWidth="2" strokeDasharray="6 5" />
      <path d="M196 100 l10 6 -3 -12" fill="#8a2f22" />
      <text x="108" y="34" fontSize="10" fill="#8a2f22" fontFamily="monospace" transform="rotate(-4 108 34)">invert…?</text>
      <text x="40" y="140" fontSize="10" fill="#4a4438" fontFamily="monospace">scale = last / first</text>
      <line x1="38" y1="136" x2="176" y2="136" stroke="#8a2f22" strokeWidth="1.5" transform="rotate(-1 38 136)" />
      <text x="40" y="160" fontSize="10" fill="#4a4438" fontFamily="monospace">scale = first / last ??</text>
      <text x="252" y="52" fontSize="18" fill="#8a2f22" fontFamily="serif" fontStyle="italic" transform="rotate(6 252 52)">no.</text>
    </svg>
  );
}

function ScrollEmulationArt() {
  return (
    <div className="relative flex h-full w-full items-center justify-center bg-[#20242b] px-6">
      <code className="text-[13px] leading-7 text-[#9fb0c3] md:text-sm">
        transform: translateX(
        <span className="text-[#d6a35c]">-index * 100%</span>);
      </code>
      <span
        aria-hidden
        className="absolute rotate-[-14deg] rounded border-[3px] border-[#b3392b]/80 px-3 py-1 text-xl font-bold tracking-[0.2em] text-[#b3392b]/80"
      >
        REJECTED
      </span>
    </div>
  );
}

function BrokenGlassArt() {
  return (
    <svg viewBox="0 0 320 200" className="block h-full w-full bg-[#101014]" aria-hidden>
      {[
        '190,84 240,60 292,44',
        '190,84 236,96 296,104',
        '190,84 208,130 224,196',
        '190,84 160,140 148,196',
        '190,84 130,100 42,110',
        '190,84 150,58 84,24',
        '190,84 198,44 204,4',
        '190,84 158,76 120,64 60,52',
      ].map((points) => (
        <polyline key={points} points={points} fill="none" stroke="rgba(235,240,255,0.5)" strokeWidth="1.2" />
      ))}
      <polyline points="212,62 222,74 216,92 198,100" fill="none" stroke="rgba(235,240,255,0.32)" strokeWidth="0.8" />
      <circle cx="190" cy="84" r="2.4" fill="rgba(255,255,255,0.75)" />
    </svg>
  );
}

const MUSEUM_EXHIBITS = [
  {
    id: 'flip',
    art: <FlipDiagramArt />,
    title: 'FLIP animation, take three (2025)',
    lines: ['Mixed media: translate, scale, and tears.', 'Abandoned when the artist discovered View Transitions.'],
  },
  {
    id: 'emulation',
    art: <ScrollEmulationArt />,
    title: 'Scroll emulation (rejected)',
    lines: ['The artist refused to fake physics.', 'Slides ride real CSS scroll snapping to this day.'],
  },
  {
    id: 'glass',
    art: <BrokenGlassArt />,
    title: 'Untitled (broken glass)',
    lines: ['From the artist\u2019s early period.', 'See also: the quote hanging downstairs.'],
  },
];

function MuseumWingEgg() {
  return (
    <Lightbox.Root morphTo="closest">
      <CardTrigger crossfade="both" />
      <EggViewer ariaLabel="The ramka museum wing">
        <Lightbox.Slides aria-label="Exhibits" aria-roledescription="carousel" className="flex-1 [&::-webkit-scrollbar]:hidden">
          {MUSEUM_EXHIBITS.map((exhibit, i) => (
            <Lightbox.Slide key={exhibit.id} className="h-full min-w-full flex-[0_0_100%]">
              <Lightbox.Item
                index={i}
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${MUSEUM_EXHIBITS.length}`}
                className="flex h-full w-full items-center justify-center px-6 py-14"
              >
                {({ morphRef }) => (
                  <div className="flex max-h-full flex-col items-center">
                    <GoldFrame morphRef={morphRef} className="w-full max-w-lg">
                      <div className="aspect-[8/5] w-full p-3 md:p-4">{exhibit.art}</div>
                    </GoldFrame>
                    <Placard title={exhibit.title} lines={exhibit.lines} />
                  </div>
                )}
              </Lightbox.Item>
            </Lightbox.Slide>
          ))}
        </Lightbox.Slides>
        <div className="lightbox-demo-chrome-hide absolute start-4 top-4 z-30">
          <Lightbox.Counter className="rounded-full bg-white/10 px-3 py-1.5 text-xs tabular-nums text-white backdrop-blur" />
        </div>
        <div className="lightbox-demo-chrome-hide absolute inset-y-0 start-4 z-30 hidden items-center md:flex">
          <Lightbox.Previous className={lightboxChromeButton} aria-label="Previous exhibit">
            <ChevronLeft aria-hidden className="h-5 w-5" strokeWidth={2.25} />
          </Lightbox.Previous>
        </div>
        <div className="lightbox-demo-chrome-hide absolute inset-y-0 end-4 z-30 hidden items-center md:flex">
          <Lightbox.Next className={lightboxChromeButton} aria-label="Next exhibit">
            <ChevronRight aria-hidden className="h-5 w-5" strokeWidth={2.25} />
          </Lightbox.Next>
        </div>
      </EggViewer>
    </Lightbox.Root>
  );
}

/* ------------------------------------------------------------------ */
/* V4 — the code that did it.                                          */
/* ------------------------------------------------------------------ */

const tag = 'text-[#7fdbca]';
const attr = 'text-[#addb67]';
const str = 'text-[#ecc48d]';
const dim = 'text-[#637777]';

function CodeEgg() {
  return (
    <Lightbox.Root>
      <CardTrigger crossfade="both" />
      <EggViewer ariaLabel="The code behind the morph">
        <SoloSlide>
          {({ morphRef }) => (
            <div className="flex max-h-full w-full max-w-xl flex-col items-center">
              <div
                ref={morphRef}
                className="w-full overflow-hidden rounded-xl border border-white/10 bg-[#0b1120] shadow-2xl"
              >
                <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
                  <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="size-2.5 rounded-full bg-[#febc2e]" />
                  <span className="size-2.5 rounded-full bg-[#28c840]" />
                  <span className="ml-3 text-[11px] text-neutral-400">gallery.tsx</span>
                </div>
                <pre className="overflow-x-auto p-5 text-[12.5px] leading-6 text-[#d6deeb] md:text-[13px]">
                  <code>
                    <span className={dim}>{'// the morph you just watched:'}</span>
                    {'\n'}
                    <span className={tag}>{'<Lightbox.Root>'}</span>
                    {'\n  '}
                    <span className={tag}>{'<Lightbox.Trigger'}</span> <span className={attr}>index</span>
                    {'={'}
                    <span className={str}>0</span>
                    {'}'}
                    <span className={tag}>{'>'}</span>
                    {'\n    {'}
                    {'({ '}
                    <span className={attr}>imageRef</span>
                    {' }) => '}
                    <span className={tag}>{'<img'}</span> <span className={attr}>ref</span>
                    {'={'}
                    <span className={str}>imageRef</span>
                    {'} '}
                    <span className={attr}>src</span>
                    {'={'}
                    <span className={str}>thumb</span>
                    {'} /'}
                    <span className={tag}>{'>'}</span>
                    {'}'}
                    {'\n  '}
                    <span className={tag}>{'</Lightbox.Trigger>'}</span>
                    {'\n  '}
                    <span className={dim}>{'/* portal, slides, media… */'}</span>
                    {'\n'}
                    <span className={tag}>{'</Lightbox.Root>'}</span>
                    {'\n\n'}
                    <span className={dim}>{'// that\u2019s it. viewTransition is the default.'}</span>
                  </code>
                </pre>
              </div>
              <p className="mt-5 text-center text-sm text-white/70">
                That&rsquo;s the whole trick. No keyframes, no FLIP math, no cloned DOM.
              </p>
            </div>
          )}
        </SoloSlide>
      </EggViewer>
    </Lightbox.Root>
  );
}

/* ------------------------------------------------------------------ */
/* V5 — darkroom print.                                                */
/* ------------------------------------------------------------------ */

function DarkroomEgg() {
  return (
    <Lightbox.Root>
      <CardTrigger crossfade="both" />
      <EggViewer ariaLabel="Darkroom print">
        {/* The develop animation restarts on every open because the portal
            subtree unmounts on close (keepMounted defaults to false). */}
        <style>{`
          @keyframes egg-develop {
            0% { filter: brightness(2.6) sepia(0.75) contrast(0.25) saturate(0.4); }
            55% { filter: brightness(1.5) sepia(0.45) contrast(0.6) saturate(0.65); }
            100% { filter: none; }
          }
          @keyframes egg-safelight {
            0%, 70% { opacity: 1; }
            100% { opacity: 0; }
          }
        `}</style>
        <SoloSlide>
          {({ morphRef }) => (
            <div className="flex max-h-full flex-col items-center">
              <div
                ref={morphRef}
                className="relative w-full max-w-md rotate-[-1.2deg] bg-[#f7f4ec] p-3 pb-14 shadow-[0_2px_6px_rgba(0,0,0,0.45),0_28px_56px_-16px_rgba(0,0,0,0.6)]"
              >
                <div className="relative overflow-hidden">
                  <Image
                    src={ramkaE}
                    alt="Fog rolling over dark hills, developing like a darkroom print"
                    sizes="28rem"
                    draggable={false}
                    className="block w-full select-none [animation:egg-develop_3s_ease-out_0.35s_both] motion-reduce:animate-none"
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_0%,rgba(211,47,47,0.5),rgba(211,47,47,0.15)_55%,transparent_80%)] mix-blend-screen [animation:egg-safelight_3s_ease-out_0.35s_both] motion-reduce:hidden"
                  />
                </div>
                <p className="absolute inset-x-0 bottom-4 text-center font-serif text-sm italic text-neutral-500">
                  every open is a fresh print
                </p>
              </div>
              <p className="mt-6 text-center text-sm text-white/70">
                Straight out of the darkroom. Close it and print another.
              </p>
            </div>
          )}
        </SoloSlide>
      </EggViewer>
    </Lightbox.Root>
  );
}

/* ------------------------------------------------------------------ */
/* V6 — buy me.                                                        */
/* ------------------------------------------------------------------ */

/** One column of the App Store info strip: tiny label, big value, caption. */
function StoreStat({ label, value, caption }: { label: string; value: ReactNode; caption: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2 py-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#8e8e93]">{label}</p>
      <div className="text-[19px] font-bold leading-6 text-[#8e8e93]">{value}</div>
      <p className="text-[11px] text-[#8e8e93]">{caption}</p>
    </div>
  );
}

const BUY_PERKS = [
  'One-time purchase. No subscription.',
  'Covers your whole team, forever.',
  'Free for open source under the GPL.',
];

function BuyMeEgg() {
  return (
    <Lightbox.Root>
      <CardTrigger crossfade="both" />
      <EggViewer ariaLabel="Get a ramka license">
        <SoloSlide>
          {({ morphRef }) => (
            /* Fixed light colors on purpose — an iOS sheet looks the same on
               any wall, like the gilded frame upstairs. */
            <div
              ref={morphRef}
              className="w-full max-w-sm rounded-[28px] bg-[#f9f9fb] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.3),0_36px_80px_-20px_rgba(0,0,0,0.6)]"
            >
              {/* App Store header row: squircle icon, name, price pill. */}
              <div className="flex items-center gap-4">
                <div className="grid size-16 shrink-0 place-items-center rounded-[16px] bg-linear-to-br from-[#5e5ce6] to-[#bf5af2] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_12px_rgba(94,92,230,0.35)]">
                  <Sparkles aria-hidden className="size-8 text-white" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] font-semibold leading-tight tracking-tight text-neutral-900">ramka</p>
                  <p className="mt-0.5 truncate text-[13px] text-[#8e8e93]">The lightbox for React</p>
                </div>
                <Link
                  href="/license"
                  className="rounded-full bg-[#007aff] px-4 py-1.5 text-[15px] font-bold text-white transition hover:bg-[#0071eb] active:scale-95"
                >
                  $129
                </Link>
              </div>

              {/* The ratings / age / size strip. All numbers are real. */}
              <div className="mt-5 grid grid-cols-3 divide-x divide-[#e5e5ea] border-y border-[#e5e5ea] py-2.5">
                <StoreStat
                  label="1 rating"
                  value={
                    <span className="flex items-center gap-0.5" aria-label="5 out of 5 stars">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star key={i} aria-hidden className="size-3.5 fill-[#8e8e93] text-[#8e8e93]" />
                      ))}
                    </span>
                  }
                  caption={'the author\u2019s'}
                />
                <StoreStat label="Age" value="4+" caption="years old" />
                <StoreStat label="Size" value="~19" caption="KB gzipped" />
              </div>

              {/* iOS grouped inset list. */}
              <ul className="mt-5 overflow-hidden rounded-2xl bg-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.06)]">
                {BUY_PERKS.map((perk, i) => (
                  <li
                    key={perk}
                    className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-[#e5e5ea]' : ''}`}
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#34c759]">
                      <Check aria-hidden className="size-3.5 text-white" strokeWidth={3} />
                    </span>
                    <span className="text-[14px] leading-5 text-neutral-800">{perk}</span>
                  </li>
                ))}
              </ul>

              {/* The big friendly buy button. */}
              <Link
                href="/license"
                className="mt-5 flex h-12 w-full items-center justify-center rounded-2xl bg-[#007aff] text-[16px] font-semibold text-white transition hover:bg-[#0071eb] active:scale-[0.98]"
              >
                Get the Business License
              </Link>
              <p className="mt-3 text-center text-[11px] text-[#8e8e93]">
                In-app purchases: none. Loot boxes: also none.
              </p>
            </div>
          )}
        </SoloSlide>
      </EggViewer>
    </Lightbox.Root>
  );
}

/* ------------------------------------------------------------------ */
/* The comparison page.                                                */
/* ------------------------------------------------------------------ */

const VARIANTS: { id: string; name: string; pitch: string; node: ReactNode }[] = [
  {
    id: 'v1',
    name: 'V1 · The card gets framed',
    pitch: 'The card morphs into a gilded museum frame with a placard. ramka is Polish for frame; the feature literally gets framed.',
    node: <FramedExhibitEgg />,
  },
  {
    id: 'v2',
    name: 'V2 · Lightboxes all the way down',
    pitch: 'The card opens a circular photo, which contains a rectangular lightbox, which contains a square one. Every level morphs into a different shape, until the management objects.',
    node: <RecursionLevel depth={1} />,
  },
  {
    id: 'v3',
    name: 'V3 · A tiny museum wing',
    pitch: 'Three framed exhibits of ramka lore: the FLIP diagram, the rejected scroll emulation, the broken glass. Swipe between them, then close from slide three and watch it morph back to the card.',
    node: <MuseumWingEgg />,
  },
  {
    id: 'v4',
    name: 'V4 · The code that did it',
    pitch: 'The card morphs into the ten lines of code powering the morph you just experienced.',
    node: <CodeEgg />,
  },
  {
    id: 'v5',
    name: 'V5 · Darkroom print',
    pitch: 'The card morphs into a photographic print that develops under a red safelight on every open.',
    node: <DarkroomEgg />,
  },
  {
    id: 'v6',
    name: 'V6 · Buy me',
    pitch: 'The card morphs into an App Store style purchase sheet for the commercial license. Five stars, one rating (the author\u2019s), and a big blue button.',
    node: <BuyMeEgg />,
  },
];

export default function MorphEasterEggsDebugPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-6 py-12">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400">
          Debug · development only
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Morph card easter eggs
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
          Six candidates for what the &ldquo;Morph view transitions&rdquo; bento card opens. Same card, six different
          lightboxes. Click each Try me and pick a winner.
        </p>
      </header>

      {VARIANTS.map((variant) => (
        <section key={variant.id}>
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">{variant.name}</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-neutral-500 dark:text-neutral-400">{variant.pitch}</p>
          <div className="mt-4">{variant.node}</div>
        </section>
      ))}
    </div>
  );
}
