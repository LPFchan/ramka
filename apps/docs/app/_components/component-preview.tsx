'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import type { SourceFile } from './read-source-files';

/**
 * Live example card + separate multi-file source card below (file tabs + copy).
 */
export function ComponentPreview({
  children,
  files,
  className,
  align = 'center',
}: {
  children: React.ReactNode;
  files: SourceFile[];
  className?: string;
  align?: 'center' | 'start' | 'end';
}) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
        <div
          className={cn(
            'flex min-h-70 bg-white p-6 sm:p-10 dark:bg-neutral-950',
            align === 'center' && 'items-center justify-center',
            align === 'start' && 'items-start justify-start',
            align === 'end' && 'items-end justify-end',
          )}
        >
          {children}
        </div>
      </div>

      <ComponentSource files={files} />
    </div>
  );
}

/** Standalone source card — segmented file switcher + copy for the active file. */
export function ComponentSource({
  files,
  className,
}: {
  files: SourceFile[];
  className?: string;
}) {
  const [activeFile, setActiveFile] = React.useState(files[0]?.name ?? '');
  const [copied, setCopied] = React.useState(false);
  const current = files.find((f) => f.name === activeFile) ?? files[0];

  async function copy() {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800',
        className,
      )}
    >
      <Tabs
        value={activeFile}
        onValueChange={(next) => {
          setActiveFile(String(next));
          setCopied(false);
        }}
        className="gap-0"
      >
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
          {files.length > 1 ? (
            <TabsList className="h-8">
              {files.map((file) => (
                <TabsTrigger key={file.name} value={file.name} className="px-2.5 text-xs">
                  {file.name}
                </TabsTrigger>
              ))}
            </TabsList>
          ) : (
            <span className="text-xs font-medium text-neutral-500">{current?.name}</span>
          )}

          <button
            type="button"
            onClick={copy}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-neutral-500 transition hover:bg-neutral-200/70 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            aria-label={current ? `Copy ${current.name}` : 'Copy code'}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        {files.map((file) => (
          <TabsContent key={file.name} value={file.name} className="mt-0">
            <div
              className="code-block-pre max-h-[min(32rem,70vh)] overflow-auto bg-neutral-50 dark:bg-neutral-950"
              dangerouslySetInnerHTML={{ __html: file.html }}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
