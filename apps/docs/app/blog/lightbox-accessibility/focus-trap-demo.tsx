'use client';

import { useState } from 'react';
import { ArrowBigUp, ArrowRightToLine } from 'lucide-react';

import { Kbd } from '@/components/ui/kbd';

/**
 * Demo 1: a miniature page with a lightbox overlaid, and a simulated focus
 * ring stepped by Tab buttons. In "typical" mode the tab order walks straight
 * out of the dialog and onto the page behind it; in "trapped" mode it cycles.
 *
 * The focus is simulated (a styled ring, not document.activeElement) so the
 * demo can never hijack the reader's real keyboard, and so it works on touch.
 * The readout is a polite live region, which means the demo narrates itself
 * to actual screen reader users.
 */

type Stop = { id: string; label: string; zone: 'dialog' | 'page' };

const DIALOG_STOPS: Stop[] = [
  { id: 'close', label: 'the Close button', zone: 'dialog' },
  { id: 'prev', label: 'the Previous button', zone: 'dialog' },
  { id: 'next', label: 'the Next button', zone: 'dialog' },
];

const PAGE_STOPS: Stop[] = [
  { id: 'docs', label: 'the Docs link in the header', zone: 'page' },
  { id: 'blog', label: 'the Blog link in the header', zone: 'page' },
  { id: 'cart', label: 'the Add to cart button', zone: 'page' },
  { id: 'newsletter', label: 'the Newsletter link in the footer', zone: 'page' },
];

const modeButtonClassName = (active: boolean) =>
  `h-8 rounded-full px-3.5 text-[13px] font-medium transition ${
    active
      ? 'bg-neutral-900 text-white dark:bg-neutral-50 dark:text-neutral-900'
      : 'border border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900'
  }`;

const tabButtonClassName =
  'inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 font-mono text-[12px] font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900';

/** Fake control chip inside the aria-hidden stage. */
function Chip({ focused, escaped, children }: { focused: boolean; escaped: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex h-7 items-center rounded-full border border-neutral-200 bg-white px-2.5 text-[12px] font-medium text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 ${
        focused ? (escaped ? 'ring-2 ring-red-500' : 'ring-2 ring-blue-500') : ''
      }`}
    >
      {children}
    </span>
  );
}

/** Grey skeleton bar standing in for page text. */
function Bar({ className }: { className: string }) {
  return <div className={`rounded-full bg-neutral-200/80 dark:bg-neutral-800 ${className}`} />;
}

export function FocusTrapDemo() {
  const [trapped, setTrapped] = useState(false);
  const [index, setIndex] = useState(0);

  const order = trapped ? DIALOG_STOPS : [...DIALOG_STOPS, ...PAGE_STOPS];
  const focused = order[index % order.length] ?? DIALOG_STOPS[0]!;
  const escaped = focused.zone === 'page';

  const step = (dir: 1 | -1) => setIndex((i) => (i + dir + order.length) % order.length);
  const setMode = (next: boolean) => {
    setTrapped(next);
    setIndex(0);
  };

  const isOn = (id: string) => focused.id === id;

  return (
    <figure className="my-8 rounded-2xl border border-neutral-200 p-4 md:p-5 dark:border-neutral-800">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex items-center gap-2" role="group" aria-label="Focus handling">
          <button
            type="button"
            onClick={() => setMode(false)}
            aria-pressed={!trapped}
            className={modeButtonClassName(!trapped)}
          >
            Typical lightbox
          </button>
          <button
            type="button"
            onClick={() => setMode(true)}
            aria-pressed={trapped}
            className={modeButtonClassName(trapped)}
          >
            Focus trapped
          </button>
        </div>

        <div className="flex items-center gap-2" role="group" aria-label="Simulate keyboard">
          <button type="button" onClick={() => step(-1)} className={tabButtonClassName} aria-label="Shift Tab">
            <ArrowBigUp className="size-3.5" aria-hidden="true" />
            Tab
          </button>
          <button type="button" onClick={() => step(1)} className={tabButtonClassName} aria-label="Tab">
            Tab
            <ArrowRightToLine className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* The stage is decorative theatre; the live readout below narrates it. */}
      <div
        aria-hidden="true"
        className="relative mt-4 select-none overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
      >
        <div className="flex flex-col gap-4 p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-md bg-neutral-900 dark:bg-neutral-100" />
              <Bar className="h-2.5 w-14" />
            </div>
            <div className="flex items-center gap-2">
              <Chip focused={isOn('docs')} escaped={escaped}>
                Docs
              </Chip>
              <Chip focused={isOn('blog')} escaped={escaped}>
                Blog
              </Chip>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Bar className="h-2.5 w-3/4" />
            <Bar className="h-2.5 w-1/2" />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-gradient-to-br from-sky-200 to-indigo-400 dark:from-sky-800 dark:to-indigo-600" />
              <div className="flex flex-col gap-1.5">
                <Bar className="h-2 w-24" />
                <Bar className="h-2 w-16" />
              </div>
            </div>
            <Chip focused={isOn('cart')} escaped={escaped}>
              Add to cart
            </Chip>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Bar className="h-2 w-20" />
            <Chip focused={isOn('newsletter')} escaped={escaped}>
              Newsletter
            </Chip>
          </div>
        </div>

        {/* The lightbox overlay. It backs off when focus escapes so the reader
            can see exactly where focus went. */}
        <div
          className={`absolute inset-0 flex items-center justify-center bg-neutral-950/50 p-4 transition-opacity duration-300 dark:bg-neutral-950/70 ${
            escaped ? 'opacity-15' : 'opacity-100'
          }`}
        >
          <div className="relative w-52 rounded-2xl border border-neutral-200 bg-white p-2.5 shadow-xl md:w-60 dark:border-neutral-700 dark:bg-neutral-900">
            <div className="h-28 rounded-lg bg-gradient-to-br from-amber-200 via-orange-300 to-rose-400 md:h-32" />
            <div className="mt-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Chip focused={isOn('prev')} escaped={escaped}>
                  ‹
                </Chip>
                <Chip focused={isOn('next')} escaped={escaped}>
                  ›
                </Chip>
              </div>
              <span className="text-[11px] tabular-nums text-neutral-400">2 of 9</span>
            </div>
            <span
              className={`absolute -top-2.5 -right-2.5 flex h-7 w-7 items-center justify-center rounded-full border border-neutral-200 bg-white text-[13px] text-neutral-600 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 ${
                isOn('close') ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              ×
            </span>
          </div>
        </div>
      </div>

      <p aria-live="polite" className="mt-3 text-[13px] leading-6">
        <span className="text-neutral-500 dark:text-neutral-400">Focus is on </span>
        <strong
          className={
            escaped
              ? 'font-semibold text-red-600 dark:text-red-400'
              : 'font-semibold text-neutral-800 dark:text-neutral-200'
          }
        >
          {focused.label}
        </strong>
        <span className={escaped ? 'text-red-600 dark:text-red-400' : 'text-neutral-500 dark:text-neutral-400'}>
          {escaped ? ', behind the dialog.' : ', inside the dialog.'}
        </span>
      </p>

      <figcaption className="mt-4 text-[13px] leading-6 text-neutral-500 dark:text-neutral-400">
        Press <Kbd>Tab</Kbd> a few times in each mode. The typical lightbox lets focus walk off the last button and onto
        the page behind the overlay, where a keyboard or screen reader user is now operating controls they cannot see.
        The focus ring here is simulated so the demo can never capture your real keyboard.
      </figcaption>
    </figure>
  );
}
