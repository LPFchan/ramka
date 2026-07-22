'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';

export function CodeBlock({
  code,
  title,
  className,
}: {
  code: string;
  title?: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div
      className={`overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800 ${className ?? ''}`}
    >
      {title ? (
        <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-3 py-1.5 dark:border-neutral-800 dark:bg-neutral-900">
          <span className="text-xs font-medium text-neutral-500">{title}</span>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-neutral-500 transition hover:bg-neutral-200/70 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            aria-label="Copy code"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      ) : (
        <div className="flex justify-end border-b border-neutral-200 bg-neutral-50 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-neutral-500 transition hover:bg-neutral-200/70 dark:hover:bg-neutral-800"
            aria-label="Copy code"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </button>
        </div>
      )}
      <pre className="overflow-x-auto bg-neutral-50 p-4 font-mono text-[13px] leading-relaxed text-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}
