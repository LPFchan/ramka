'use client';

import * as React from 'react';
import { TextMorph } from 'torph/react';

const RAMKA = 'ramka - Polish for \u201cframe\u201d.';

/** Anagrams of "ramka", cycled one per hover. */
const TEASES = [
  'kamra - almost a camera.',
  'marka - Polish for \u201cbrand\u201d.',
];

/**
 * Footer easter egg: hovering the credit line rearranges "ramka" into one of
 * its anagrams — "kamra" (almost a camera, fitting for a lightbox) or
 * "marka" (Polish for brand) — and back on leave. Each hover serves the next
 * anagram, so the line rewards a second look. Torph keeps the letters that
 * persist and FLIPs them to their new slots, so the anagram reads as a
 * physical reshuffle rather than a text swap. Click toggles it on touch
 * devices, where there is no hover.
 */
export function FooterWordplay() {
  const [tease, setTease] = React.useState<string | null>(null);
  const nextTeaseRef = React.useRef(0);

  const showNextTease = () => {
    setTease(TEASES[nextTeaseRef.current % TEASES.length] ?? null);
    nextTeaseRef.current += 1;
  };

  return (
    <p
      className="cursor-default select-none text-neutral-400 dark:text-neutral-600"
      onMouseEnter={showNextTease}
      onMouseLeave={() => setTease(null)}
      onClick={() => (tease === null ? showNextTease() : setTease(null))}
    >
      {/* Duration + overshoot curve lifted from the torph site's label demo —
          letters glide past their slot and settle back, which sells the
          reshuffle. */}
      <TextMorph duration={600} ease="cubic-bezier(0.41, 1.03, 0.6, 1.03)">
        {tease ?? RAMKA}
      </TextMorph>
    </p>
  );
}
