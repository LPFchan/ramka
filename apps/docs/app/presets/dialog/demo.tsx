'use client';

import * as React from 'react';

import { Lightbox } from './lightbox';

/**
 * App-level demos only — not part of the copy-paste package.
 * Import the styled Lightbox from `./lightbox`, then compose triggers like this.
 *
 * 1. Share dialog — a Share button morphs into a link + members dialog
 * 2. Confirmation alert — a destructive action morphs into a macOS-style alert
 *
 * Triggers use `crossfade="both"`: button and dialog never share pixels, so
 * the morph dissolves between the two snapshots.
 */
export function DialogPresetDemo() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      <ShareDialogDemo />
      <ConfirmAlertDemo />
    </div>
  );
}

/* ── Icons (inline, demo-only) ──────────────────────────────────────────── */

function IconDocument() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 3v5h5M9 13h6M9 17h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path
        d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Shared demo card chrome ────────────────────────────────────────────── */

const cardClass =
  'flex items-center justify-between gap-3 rounded-2xl border border-neutral-300 bg-white p-4 shadow-[0_1px_2px_rgb(0_0_0/0.06),0_4px_12px_rgb(0_0_0/0.06)] dark:border-neutral-600 dark:bg-neutral-800 dark:shadow-[0_1px_2px_rgb(0_0_0/0.4),0_4px_16px_rgb(0_0_0/0.35)]';

const triggerButtonClass =
  'shrink-0 rounded-[7px] bg-white px-3.5 py-1.5 text-[13px] font-medium text-neutral-900 shadow-[0_0_0_0.5px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.08)] dark:bg-neutral-700 dark:text-neutral-50 dark:shadow-[inset_0_0.5px_0_rgb(255_255_255/0.16),0_0_0_0.5px_rgb(0_0_0/0.5)]';

/* ── 1. Share dialog ────────────────────────────────────────────────────── */

const members = [
  { name: 'Maya Chen', role: 'Owner', tint: 'bg-indigo-500' },
  { name: 'Jonas Weber', role: 'Can edit', tint: 'bg-emerald-500' },
  { name: 'Priya Natarajan', role: 'Can view', tint: 'bg-amber-500' },
];

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('');
}

function ShareDialogDemo() {
  return (
    <Lightbox.Root>
      <p className="mb-2 text-xs font-medium tracking-wide text-neutral-500 uppercase">
        Share dialog
      </p>
      <div className={cardClass}>
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-b from-sky-400 to-blue-500 text-white shadow-sm [&>svg]:size-5">
            <IconDocument />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-neutral-900 dark:text-neutral-50">
              Q3 Roadmap
            </span>
            <span className="block text-xs text-neutral-500">Edited 2 hours ago</span>
          </span>
        </span>
        <Lightbox.Trigger index={0} crossfade="both" className={triggerButtonClass}>
          Share…
        </Lightbox.Trigger>
      </div>
      <Lightbox.Dialog ariaLabel="Share Q3 Roadmap">
        <ShareDialogContent />
      </Lightbox.Dialog>
    </Lightbox.Root>
  );
}

function ShareDialogContent() {
  const [copied, setCopied] = React.useState(false);
  const resetRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => () => window.clearTimeout(resetRef.current), []);

  const copyLink = () => {
    navigator.clipboard?.writeText('https://droplet.app/d/q3-roadmap').catch(() => {});
    setCopied(true);
    window.clearTimeout(resetRef.current);
    resetRef.current = window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="p-5">
      <Lightbox.DialogTitle>Share “Q3 Roadmap”</Lightbox.DialogTitle>
      <Lightbox.DialogDescription className="mt-1">
        Anyone with the link can view. Members can edit.
      </Lightbox.DialogDescription>

      <div className="mt-4 flex items-center gap-2 rounded-lg bg-black/[0.04] py-1.5 pr-1.5 pl-3 shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.08)] dark:bg-white/[0.06] dark:shadow-[inset_0_0_0_0.5px_rgb(255_255_255/0.1)]">
        <span className="min-w-0 truncate font-mono text-xs text-neutral-500 dark:text-neutral-400">
          droplet.app/d/q3-roadmap
        </span>
        <Lightbox.Button className="ml-auto" onClick={copyLink}>
          {copied ? 'Copied' : 'Copy'}
        </Lightbox.Button>
      </div>

      <ul className="mt-4 flex flex-col gap-3">
        {members.map((member) => (
          <li key={member.name} className="flex items-center gap-2.5">
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ${member.tint}`}
              aria-hidden
            >
              {initials(member.name)}
            </span>
            <span className="min-w-0 truncate text-[13px] font-medium">{member.name}</span>
            <span className="ml-auto shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
              {member.role}
            </span>
          </li>
        ))}
      </ul>

      <Lightbox.DialogActions className="mt-5">
        <Lightbox.Close variant="primary">Done</Lightbox.Close>
      </Lightbox.DialogActions>
    </div>
  );
}

/* ── 2. Confirmation alert ──────────────────────────────────────────────── */

function ConfirmAlertDemo() {
  return (
    <Lightbox.Root>
      <p className="mb-2 text-xs font-medium tracking-wide text-neutral-500 uppercase">
        Confirmation alert
      </p>
      <div className={cardClass}>
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-b from-neutral-400 to-neutral-500 text-white shadow-sm [&>svg]:size-5">
            <IconTrash />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-neutral-900 dark:text-neutral-50">
              Trash
            </span>
            <span className="block text-xs text-neutral-500">128 items · 4.2 GB</span>
          </span>
        </span>
        <Lightbox.Trigger
          index={0}
          crossfade="both"
          className={`${triggerButtonClass} text-red-600 dark:text-red-400`}
        >
          Empty…
        </Lightbox.Trigger>
      </div>
      <Lightbox.Dialog size="sm" ariaLabel="Empty the Trash">
        <div className="flex flex-col items-center p-5 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-red-500/10 text-red-500 dark:bg-red-400/15 dark:text-red-400 [&>svg]:size-5">
            <IconTrash />
          </span>
          <Lightbox.DialogTitle className="mt-3">Empty the Trash?</Lightbox.DialogTitle>
          <Lightbox.DialogDescription className="mt-1">
            All 128 items will be permanently erased. You can’t undo this action.
          </Lightbox.DialogDescription>
          <Lightbox.DialogActions stack className="mt-4 w-full">
            <Lightbox.Close variant="destructive">Empty Trash</Lightbox.Close>
            <Lightbox.Close>Cancel</Lightbox.Close>
          </Lightbox.DialogActions>
        </div>
      </Lightbox.Dialog>
    </Lightbox.Root>
  );
}
