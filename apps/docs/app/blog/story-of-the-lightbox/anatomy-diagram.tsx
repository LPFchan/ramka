'use client';

import { useState } from 'react';

/**
 * A labeled, explorable anatomy of the lightbox pattern. Selecting a part
 * highlights it in the mock viewer and explains what it does. The mock is
 * decorative (aria-hidden); the chips and the live readout carry the
 * accessible experience, same approach as the other blog demos.
 */

type PartId = 'backdrop' | 'dialog' | 'stage' | 'slides' | 'close' | 'arrows' | 'counter' | 'caption' | 'thumbnails';

type Part = { id: PartId; label: string; blurb: string };

const PARTS: Part[] = [
  {
    id: 'backdrop',
    label: 'Backdrop',
    blurb:
      'The dimmed layer between you and the page. Theater calls it a scrim; in 2005 it was a tiled PNG; CSS now ships one for every top-layer element as ::backdrop. Clicking it closes.',
  },
  {
    id: 'dialog',
    label: 'Dialog',
    blurb:
      'The modal container. It takes focus when it opens, holds it while open, and hands it back when it closes. role="dialog", aria-modal, and Escape all live here.',
  },
  {
    id: 'stage',
    label: 'Stage',
    blurb:
      'The gesture surface. Pinch, pan and pull-to-dismiss are scoped to it, so a caption or sidebar outside the stage never fights the photo for touches.',
  },
  {
    id: 'slides',
    label: 'Slides',
    blurb:
      'The strip of photos, one slide each. For most of the pattern\u2019s history this was a transform driven by JavaScript; increasingly it is a real scroller with CSS scroll snap.',
  },
  {
    id: 'close',
    label: 'Close',
    blurb: 'The one control every lightbox since 2005 has shipped. Esc is its keyboard twin.',
  },
  {
    id: 'arrows',
    label: 'Arrows',
    blurb:
      'Previous and next. In 2006 they materialized when you hovered the photo\u2019s left or right half; today they also serve everyone for whom dragging is the hardest input there is.',
  },
  {
    id: 'counter',
    label: 'Counter',
    blurb:
      '\u201C2 of 9\u201D. Visually a nicety. To a screen reader, when rendered as a live region, it is the announcement that navigation happened at all.',
  },
  {
    id: 'caption',
    label: 'Caption',
    blurb:
      'The words under the photo. It started life inside a title attribute in 2005 and has been fighting its way out of configuration strings ever since.',
  },
  {
    id: 'thumbnails',
    label: 'Thumbnails',
    blurb: 'The filmstrip: a tabs pattern wearing a camera strap. Selection follows the active slide, not focus.',
  },
];

const chipClassName = (active: boolean) =>
  `h-8 cursor-pointer rounded-full px-3 text-[13px] font-medium transition ${
    active
      ? 'bg-neutral-900 text-white dark:bg-neutral-50 dark:text-neutral-900'
      : 'border border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900'
  }`;

export function AnatomyDiagram() {
  const [active, setActive] = useState<PartId>('backdrop');

  const part = PARTS.find((p) => p.id === active)!;

  // Highlight ring for the selected region; everything else stays quiet.
  const ring = (id: PartId, base = '') =>
    `${base} transition ${active === id ? 'ring-2 ring-sky-500 ring-offset-1 ring-offset-black/60' : ''}`;

  return (
    <figure className="my-8 rounded-2xl border border-neutral-200 p-4 md:p-5 dark:border-neutral-800">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Lightbox parts">
        {PARTS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActive(p.id)}
            aria-pressed={active === p.id}
            className={chipClassName(active === p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* The mock viewer. Decorative; the readout below does the talking. */}
      <div
        aria-hidden="true"
        className={ring(
          'backdrop',
          'relative mt-4 select-none overflow-hidden rounded-xl bg-neutral-950/90 p-3 md:p-5 dark:bg-black/80',
        )}
      >
        <div
          className={ring('dialog', 'relative mx-auto flex max-w-md flex-col gap-2.5 rounded-lg bg-neutral-900 p-3')}
        >
          <div className="flex items-center justify-between">
            <span className={ring('counter', 'rounded px-1.5 py-0.5 text-[11px] tabular-nums text-neutral-400')}>
              2 of 9
            </span>
            <span
              className={ring(
                'close',
                'flex h-6 w-6 items-center justify-center rounded-full bg-neutral-800 text-[13px] text-neutral-300',
              )}
            >
              ×
            </span>
          </div>

          <div className={ring('stage', 'relative rounded-md bg-neutral-950 p-2')}>
            <div className="flex items-center justify-center gap-2 rounded-sm px-1 py-1">
              <div
                className={ring(
                  'slides',
                  'h-16 w-8 shrink-0 rounded-sm bg-gradient-to-br from-teal-700/50 to-sky-900/50 md:h-24 md:w-12',
                )}
              />
              <div
                className={ring(
                  'slides',
                  'h-20 w-36 shrink-0 rounded-sm bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 md:h-32 md:w-52',
                )}
              />
              <div
                className={ring(
                  'slides',
                  'h-16 w-8 shrink-0 rounded-sm bg-gradient-to-br from-indigo-700/50 to-purple-900/50 md:h-24 md:w-12',
                )}
              />
            </div>
            <div className="pointer-events-none absolute inset-y-0 inset-x-1 flex items-center justify-between">
              <span
                className={ring(
                  'arrows',
                  'flex h-6 w-6 items-center justify-center rounded-full bg-neutral-800/90 text-[13px] text-neutral-300',
                )}
              >
                ‹
              </span>
              <span
                className={ring(
                  'arrows',
                  'flex h-6 w-6 items-center justify-center rounded-full bg-neutral-800/90 text-[13px] text-neutral-300',
                )}
              >
                ›
              </span>
            </div>
          </div>

          <div className={ring('caption', 'self-center rounded px-1 text-center text-[11px] text-neutral-400')}>
            Dunes at Fort Funston
          </div>

          <div className={ring('thumbnails', 'flex items-center gap-1.5 self-center rounded p-1')}>
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`h-5 w-7 rounded-[3px] ${
                  i === 1 ? 'bg-gradient-to-br from-amber-300 to-rose-500' : 'bg-neutral-700/80'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <p
        aria-live="polite"
        className="mt-3 min-h-16 text-[13px] leading-6 text-neutral-600 md:min-h-12 dark:text-neutral-400"
      >
        <strong className="font-semibold text-neutral-800 dark:text-neutral-200">{part.label}.</strong> {part.blurb}
      </p>

      <figcaption className="mt-2 text-[13px] leading-6 text-neutral-500 dark:text-neutral-400">
        Most of these parts were in place by 2006; the stage and the filmstrip arrived with touch. All of them survived
        every rewrite since, which is why headless libraries name their primitives after them.
      </figcaption>
    </figure>
  );
}
