'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';

import { copyText } from '@/lib/copy-text';

export function CodeBlockCopy({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false);

  function copy() {
    if (!copyText(code)) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-neutral-500 transition hover:bg-neutral-200/70 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
      aria-label="Copy code"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
