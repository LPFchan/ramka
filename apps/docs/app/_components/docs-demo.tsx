import { CodeBlock } from './code-block';
import type { CodeLang } from './highlight-code';

/**
 * Base UI–style preview: live demo on top, code excerpt below, one shared
 * border. Pass the interactive demo as `children`.
 */
export async function DocsDemo({
  children,
  code,
  title,
  lang = 'tsx',
}: {
  children: React.ReactNode;
  code: string;
  title?: string;
  lang?: CodeLang;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
      <div className="border-b border-neutral-200 bg-white p-4 sm:p-6 dark:border-neutral-800 dark:bg-neutral-950">
        {children}
      </div>
      <CodeBlock code={code} title={title} lang={lang} embedded />
    </div>
  );
}
