'use client';

import type { ReactNode } from 'react';

import Link from 'next/link';
import * as Lightbox from '@ramka/react/lightbox';
import { track } from '@vercel/analytics';
import { Check, Star, X } from 'lucide-react';

import { startingPrice } from '../_content/pricing';
import { setGlassShinePaused } from './broken-glass-shine';

/**
 * The "Morph view transitions" bento card's easter egg: clicking the card
 * morphs it into an App Store style purchase sheet for the commercial
 * license. The demo IS the feature — the open you just watched is the morph
 * the card describes — and the destination happens to be a buy button.
 *
 * The card itself is the Trigger, so the trigger root owns the morph
 * geometry and gets hidden while the viewer is open, no extra wiring.
 * `crossfade="both"` dissolves between the card and the sheet instead of
 * stretching mismatched pixels.
 */

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
  'Tiers for solo devs and whole teams.',
  'No license keys. Nothing phones home.',
];

/** The iOS-style purchase sheet. System-light and system-dark palettes. */
function BuySheet({ morphRef }: { morphRef: (node: HTMLElement | null) => void }) {
  return (
    <div
      ref={morphRef}
      // Its own scroll (for short viewports) can't clip the pull gesture:
      // the pull transform moves this very box, scrollport and all.
      className="max-h-[calc(100dvh-2rem)] w-full overflow-y-auto overscroll-contain rounded-[28px] border border-[#d6d6db] bg-[#f2f2f7] p-6 dark:border-[#3a3a3c] dark:bg-[#1c1c1e]"
    >
      {/* App Store header row: the real ramka app icon, name, and — where
          the GET button would be — the sheet's own close control, iOS-gray. */}
      <div className="flex items-center gap-4">
        <img
          src="/icon.svg"
          alt=""
          width={64}
          height={64}
          draggable={false}
          className="size-16 shrink-0 select-none rounded-[16px] shadow-[0_4px_12px_rgba(0,0,0,0.22)]"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold leading-tight tracking-tight text-neutral-900 dark:text-neutral-50">
            ramka
          </p>
          <p className="mt-0.5 truncate text-[13px] text-[#8e8e93]">The lightbox for React</p>
        </div>
        <Lightbox.Close
          aria-label="Close"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e9e9eb] text-[#818187] transition hover:bg-[#dededf] active:scale-95 dark:bg-[#3a3a3c] dark:text-[#a1a1a6] dark:hover:bg-[#48484a]"
        >
          <X aria-hidden className="size-4.5" strokeWidth={2.5} />
        </Lightbox.Close>
      </div>

      {/* The ratings / age / size strip. All numbers are real. */}
      <div className="mt-5 grid grid-cols-3 divide-x divide-[#e5e5ea] border-y border-[#e5e5ea] py-2.5 dark:divide-[#38383a] dark:border-[#38383a]">
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
      <ul className="mt-5 overflow-hidden rounded-2xl bg-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.06)] dark:bg-[#2c2c2e] dark:shadow-[0_0_0_0.5px_rgba(255,255,255,0.08)]">
        {BUY_PERKS.map((perk, i) => (
          <li
            key={perk}
            className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-[#e5e5ea] dark:border-[#38383a]' : ''}`}
          >
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#34c759] dark:bg-[#30d158]">
              <Check aria-hidden className="size-3.5 text-white" strokeWidth={3} />
            </span>
            <span className="text-[14px] leading-5 text-neutral-800 dark:text-neutral-100">{perk}</span>
          </li>
        ))}
      </ul>

      {/* The big friendly buy button. */}
      <Link
        href="/license"
        onClick={() => track('get_license_click', { location: 'buy_sheet' })}
        className="mt-5 flex h-12 w-full items-center justify-center rounded-2xl bg-[#007aff] text-[16px] font-semibold text-white transition hover:bg-[#0071eb] active:scale-[0.98] dark:bg-[#0a84ff] dark:hover:bg-[#2492ff]"
      >
        Buy from {startingPrice}. Once.
      </Link>
      <p className="mt-3 text-center text-[11px] text-[#8e8e93]">In-app purchases: none. Loot boxes: also none.</p>
    </div>
  );
}

/**
 * The whole feature card, rendered as the Trigger itself — the trigger root
 * is the default morph source, so the library hides and measures the card
 * with zero extra wiring. Drop into the bento grid in place of a card div.
 */
export function MorphCardEgg({
  className,
  icon,
  title,
  description,
}: {
  className?: string;
  /** Pre-rendered element (component types can't cross the RSC boundary). */
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Lightbox.Root
      // Same jank guard as the landing gallery: the testimonial frame's
      // glass lighting redraws its canvas on cursor move, forcing fresh
      // layer snapshots during a View Transition. Pause it while open.
      onOpenChange={(open: boolean) => {
        if (open) setGlassShinePaused(true);
      }}
      onOpenChangeComplete={(open: boolean) => {
        if (!open) setGlassShinePaused(false);
      }}
      viewTransition="relaxed"
    >
      <Lightbox.Trigger
        index={0}
        crossfade="both"
        className={`group block cursor-pointer text-left transition-colors hover:border-neutral-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:hover:border-neutral-700 ${className ?? ''}`}
      >
        {icon}
        {/* Buttons only allow phrasing content, so the title is a styled
            span rather than the h3 its sibling cards use. */}
        <span className="mt-4 block text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          {title}
        </span>
        <span className="mt-2 block text-pretty text-[14px] leading-6 text-neutral-500 dark:text-neutral-400">
          {description}
        </span>
        <span className="mt-5 inline-flex h-8 items-center rounded-full bg-neutral-900 px-3.5 text-xs font-medium text-white transition group-hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900 dark:group-hover:bg-neutral-300">
          Try me
        </span>
      </Lightbox.Trigger>
      <Lightbox.Portal>
        {/* `lightbox-demo-backdrop-light`: white/90 scrim in light mode,
            black/90 in dark — same theme-aware scrim as the docs galleries. */}
        <Lightbox.Backdrop className="lightbox-demo-backdrop lightbox-demo-backdrop-light fixed inset-0" />
        {/* Stories-preset layout: Content is the fullscreen dialog surface
            (flex-centered, no overflow anywhere, so the pull-to-dismiss
            translation of the sheet never clips), and Stage fits snugly
            around the single Item. Clicking the empty area around the sheet
            lands on Content itself, which closes like a native dialog
            backdrop click. Stage's `morphRef` designates the sheet as the
            morph destination, same as the stories 9:16 frame. */}
        <Lightbox.Content
          aria-label="Get a ramka license"
          className="lightbox-demo-content fixed inset-0 flex items-center justify-center overscroll-contain p-4 outline-none"
        >
          {/* No Lightbox.Item: with Stage's `morphRef` owning the capture
              destination, the morph resolves without one (and its other
              duties — destination-image placeholder, carousel slide ARIA,
              preload gating — don't apply to a single HTML sheet). */}
          <Lightbox.Stage className="w-full max-w-sm">
            {({ morphRef }) => <BuySheet morphRef={morphRef} />}
          </Lightbox.Stage>
        </Lightbox.Content>
      </Lightbox.Portal>
    </Lightbox.Root>
  );
}
