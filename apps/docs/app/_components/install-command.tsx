'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';

import { copyText } from '@/lib/copy-text';

const COMMAND = 'pnpm add @ramka/react';

/** Minimal one-line install snippet with copy-to-clipboard. */
export function InstallCommand() {
  const [copied, setCopied] = React.useState(false);
  const resetTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  const copy = () => {
    if (!copyText(COMMAND)) return;
    setCopied(true);
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy install command: ${COMMAND}`}
      className="group inline-flex h-11 items-center gap-3 rounded-full border border-neutral-200 bg-neutral-50 px-4 font-mono text-sm text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:text-neutral-100"
    >
      <span aria-hidden className="select-none text-neutral-400 dark:text-neutral-600">
        $
      </span>
      {COMMAND}
      <span className="text-neutral-400 transition group-hover:text-neutral-600 dark:text-neutral-600 dark:group-hover:text-neutral-300">
        {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
      </span>
    </button>
  );
}
