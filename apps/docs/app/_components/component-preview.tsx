'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { copyText } from '@/lib/copy-text';
import { cn } from '@/lib/utils';

import type { SourceFile, SourceFileGroup } from './read-source-files';

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

const GROUP_LABEL: Record<SourceFileGroup, string> = {
  package: 'Package',
  example: 'Example',
};

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

  const grouped = React.useMemo(() => {
    const hasGroups = files.some((f) => f.group);
    if (!hasGroups) return [{ group: undefined as SourceFileGroup | undefined, files }];

    const order: SourceFileGroup[] = ['package', 'example'];
    const buckets = new Map<SourceFileGroup | 'other', SourceFile[]>();
    for (const file of files) {
      const key = file.group ?? 'other';
      const list = buckets.get(key) ?? [];
      list.push(file);
      buckets.set(key, list);
    }

    const sections: Array<{ group: SourceFileGroup | undefined; files: SourceFile[] }> = [];
    for (const group of order) {
      const list = buckets.get(group);
      if (list?.length) sections.push({ group, files: list });
    }
    const other = buckets.get('other');
    if (other?.length) sections.push({ group: undefined, files: other });
    return sections;
  }, [files]);

  function copy() {
    if (!current) return;
    if (!copyText(current.code)) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
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
        <div className="flex flex-col gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between gap-3">
            {files.length > 1 ? (
              <TabsList className="h-8 max-w-full flex-wrap justify-start">
                {grouped.map((section, index) => (
                  <React.Fragment key={section.group ?? `ungrouped-${index}`}>
                    {index > 0 ? (
                      <span
                        aria-hidden
                        className="mx-1 h-4 w-px shrink-0 self-center bg-neutral-300 dark:bg-neutral-600"
                      />
                    ) : null}
                    {section.group ? (
                      <span className="shrink-0 self-center px-1 text-[10px] font-semibold tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
                        {GROUP_LABEL[section.group]}
                      </span>
                    ) : null}
                    {section.files.map((file) => (
                      <TabsTrigger key={file.name} value={file.name} className="px-2.5 text-xs">
                        {file.name}
                      </TabsTrigger>
                    ))}
                  </React.Fragment>
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

          {current?.note ? (
            <p className="text-[11px] leading-snug text-neutral-500 dark:text-neutral-400">
              {current.note}
            </p>
          ) : null}
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
