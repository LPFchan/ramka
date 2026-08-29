'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

import { ramkaA, ramkaB, ramkaD, ramkaE } from '../../_components/images.generated';

/**
 * Demo 2: a working mini lightbox next to a transcript of what a screen
 * reader would say for each interaction. The announcements are scripted from
 * a table, not captured from a real AT, and the figcaption says so; the point
 * is the shape of the difference, which matches what VoiceOver and NVDA do.
 *
 * The mock itself always uses real, labeled buttons. The "plain divs" toggle
 * changes the simulated transcript, never the actual markup, so the demo
 * stays accessible while demonstrating inaccessibility.
 */

const PHOTOS = [
  { src: ramkaA, alt: 'Person standing in a sunlit meadow at golden hour', caption: 'Golden hour in the meadow' },
  { src: ramkaB, alt: 'Seashells scattered along the shoreline', caption: 'Seashells on the shore' },
  { src: ramkaD, alt: 'Airplane crossing a purple sky above the clouds', caption: 'Above the clouds' },
  { src: ramkaE, alt: 'Fog rolling over dark hills', caption: 'Fog over the hills' },
];

type LineInput =
  | { kind: 'announce'; source: string; text: string }
  | { kind: 'silence' }
  | { kind: 'note'; text: string };

type Line = LineInput & { id: number };

const modeButtonClassName = (active: boolean) =>
  `h-8 rounded-full px-3.5 text-[13px] font-medium transition ${
    active
      ? 'bg-neutral-900 text-white dark:bg-neutral-50 dark:text-neutral-900'
      : 'border border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900'
  }`;

const chromeButtonClassName =
  'flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-[15px] text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800';

export function SrSimulator() {
  const [ariaOn, setAriaOn] = useState(true);
  const [liveOn, setLiveOn] = useState(true);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const nextId = useRef(0);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const push = (...entries: LineInput[]) => {
    setLines((prev) => [...prev, ...entries.map((entry) => ({ ...entry, id: nextId.current++ }))].slice(-40));
  };

  // Keep the newest announcement visible, like a real caption feed.
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const setMarkup = (next: boolean) => {
    if (next === ariaOn) return;
    setAriaOn(next);
    push({ kind: 'note', text: next ? 'markup: dialog + ARIA' : 'markup: plain divs' });
  };

  const toggleLive = () => {
    setLiveOn((v) => !v);
    push({ kind: 'note', text: liveOn ? 'Counter and Caption unmounted' : 'Counter and Caption mounted' });
  };

  const openLightbox = () => {
    setOpen(true);
    setIndex(0);
    if (ariaOn) push({ kind: 'announce', source: 'dialog', text: 'Photos, dialog' });
    else push({ kind: 'silence' });
  };

  const navigate = (delta: 1 | -1) => {
    const next = (index + delta + PHOTOS.length) % PHOTOS.length;
    setIndex(next);
    if (ariaOn && liveOn) {
      push(
        { kind: 'announce', source: 'counter', text: `${next + 1} of ${PHOTOS.length}` },
        { kind: 'announce', source: 'caption', text: PHOTOS[next]!.caption },
      );
    } else {
      push({ kind: 'silence' });
    }
  };

  const close = () => {
    setOpen(false);
    if (ariaOn) push({ kind: 'announce', source: 'focus', text: 'View photos, button' });
    else push({ kind: 'silence' });
  };

  const photo = PHOTOS[index]!;

  return (
    <figure className="my-8 rounded-2xl border border-neutral-200 p-4 md:p-5 dark:border-neutral-800">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex items-center gap-2" role="group" aria-label="Simulated markup">
          <button type="button" onClick={() => setMarkup(false)} aria-pressed={!ariaOn} className={modeButtonClassName(!ariaOn)}>
            Plain divs
          </button>
          <button type="button" onClick={() => setMarkup(true)} aria-pressed={ariaOn} className={modeButtonClassName(ariaOn)}>
            dialog + ARIA
          </button>
        </div>

        <button
          type="button"
          onClick={toggleLive}
          disabled={!ariaOn}
          aria-pressed={liveOn}
          className={`h-8 rounded-full border px-3.5 text-[13px] font-medium transition disabled:opacity-40 ${
            liveOn && ariaOn
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-400'
              : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900'
          }`}
        >
          Live regions {liveOn ? 'on' : 'off'}
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {/* The mock lightbox */}
        <div className="relative flex h-72 items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
          {open ? (
            <div className="flex h-full w-full flex-col p-3">
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg">
                <Image src={photo.src} alt={photo.alt} fill sizes="400px" className="select-none object-cover" draggable={false} />
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => navigate(-1)} aria-label="Previous" className={chromeButtonClassName}>
                    ‹
                  </button>
                  <button type="button" onClick={() => navigate(1)} aria-label="Next" className={chromeButtonClassName}>
                    ›
                  </button>
                </div>
                <div className="min-w-0 text-center">
                  <div className="truncate text-[13px] font-medium text-neutral-800 dark:text-neutral-200">{photo.caption}</div>
                  <div className="text-[11px] tabular-nums text-neutral-400">
                    {index + 1} of {PHOTOS.length}
                  </div>
                </div>
                <button type="button" onClick={close} aria-label="Close" className={chromeButtonClassName}>
                  ×
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={openLightbox}
              className="h-9 rounded-full bg-neutral-900 px-4 text-[13px] font-medium text-white transition hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-300"
            >
              View photos
            </button>
          )}
        </div>

        {/* The transcript */}
        <div className="flex h-72 flex-col overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
          <div className="border-b border-neutral-200 px-3 py-2 text-[11px] font-medium tracking-wide text-neutral-400 uppercase dark:border-neutral-800 dark:text-neutral-500">
            Screen reader output, simulated
          </div>
          {/* Focusable so keyboard users can scroll it (axe:
              scrollable-region-focusable). Deliberately not role="log" — a
              live role would make real screen readers announce the *simulated*
              transcript, which is exactly the confusion the figcaption
              disclaims. */}
          <div
            ref={transcriptRef}
            tabIndex={0}
            role="region"
            aria-label="Simulated screen reader transcript"
            className="scrollbar-thin flex-1 space-y-2 overflow-y-auto p-3"
          >
            {lines.length === 0 ? (
              <p className="text-[13px] text-neutral-400 italic dark:text-neutral-500">
                Press &ldquo;View photos&rdquo; and browse. Announcements appear here.
              </p>
            ) : (
              lines.map((line) =>
                line.kind === 'note' ? (
                  <div key={line.id} className="py-0.5 text-center text-[11px] text-neutral-400 dark:text-neutral-500">
                    — {line.text} —
                  </div>
                ) : line.kind === 'silence' ? (
                  <div key={line.id} className="text-[13px] text-neutral-400 italic dark:text-neutral-500">
                    nothing announced
                  </div>
                ) : (
                  <div key={line.id} className="flex items-baseline gap-2">
                    <span className="w-14 shrink-0 text-[10px] tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
                      {line.source}
                    </span>
                    <span className="text-[13px] leading-5 font-medium text-neutral-800 dark:text-neutral-200">
                      &ldquo;{line.text}&rdquo;
                    </span>
                  </div>
                ),
              )
            )}
          </div>
        </div>
      </div>

      <figcaption className="mt-4 text-[13px] leading-6 text-neutral-500 dark:text-neutral-400">
        Browse a few photos, then switch to plain divs and browse again. Note that the visible counter never
        changes: what changes is whether it is also a live region. The transcript is scripted to match typical
        VoiceOver phrasing, not captured from a real screen reader, and the mock stays keyboard-accessible in both
        modes.
      </figcaption>
    </figure>
  );
}
