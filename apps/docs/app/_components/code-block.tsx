import { cn } from '@/lib/utils';

import { CodeBlockCopy } from './code-block-copy';
import { highlightCode, type CodeLang } from './highlight-code';

export async function CodeBlock({
  code,
  title,
  lang = 'tsx',
  className,
  embedded = false,
}: {
  code: string;
  title?: string;
  lang?: CodeLang;
  className?: string;
  /** Flatten border/radius when nested inside DocsDemo. */
  embedded?: boolean;
}) {
  const html = await highlightCode(code, lang);

  return (
    <div
      className={cn(
        'code-block overflow-hidden',
        embedded
          ? 'rounded-none border-0'
          : 'rounded-lg border border-neutral-200 dark:border-neutral-800',
        className,
      )}
    >
      {title ? (
        <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-3 py-1.5 dark:border-neutral-800 dark:bg-neutral-900">
          <span className="text-xs font-medium text-neutral-500">{title}</span>
          <CodeBlockCopy code={code} />
        </div>
      ) : (
        <div className="flex justify-end border-b border-neutral-200 bg-neutral-50 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
          <CodeBlockCopy code={code} />
        </div>
      )}
      <div
        className="code-block-pre overflow-x-auto bg-neutral-50 dark:bg-neutral-950"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
