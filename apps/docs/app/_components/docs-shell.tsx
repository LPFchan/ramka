import * as React from 'react';

import { cn } from '@/lib/utils';

export interface DocsTocItem {
  id: string;
  title: string;
  children?: DocsTocItem[];
}

interface DocsShellProps {
  title: string;
  description?: React.ReactNode;
  toc?: DocsTocItem[];
  children: React.ReactNode;
}

export function DocsShell({ title, description, toc, children }: DocsShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-6xl gap-10 px-6 py-12">
      <div className="min-w-0 flex-1">
        <header className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            {title}
          </h1>
          {description ? (
            <div className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
              {description}
            </div>
          ) : null}
        </header>
        <div className="docs-prose space-y-12">{children}</div>
      </div>
      {toc && toc.length > 0 ? (
        <aside className="sticky top-8 hidden h-[calc(100vh-4rem)] w-52 shrink-0 overflow-y-auto xl:block">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
            On this page
          </div>
          <ul className="mt-3 space-y-1 border-l border-neutral-200 dark:border-neutral-800">
            {toc.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className={cn(
                    'block border-l-2 border-transparent py-1 pl-3 text-sm text-neutral-600 transition',
                    'hover:border-neutral-400 hover:text-neutral-900',
                    'dark:text-neutral-400 dark:hover:border-neutral-500 dark:hover:text-neutral-100',
                  )}
                >
                  {item.title}
                </a>
                {item.children?.length ? (
                  <ul className="mt-0.5 space-y-0.5 pb-1">
                    {item.children.map((child) => (
                      <li key={child.id}>
                        <a
                          href={`#${child.id}`}
                          className="block py-0.5 pl-5 text-xs text-neutral-500 transition hover:text-neutral-800 dark:text-neutral-500 dark:hover:text-neutral-200"
                        >
                          {child.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </div>
  );
}

export function DocsSection({
  id,
  title,
  children,
  level = 2,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  level?: 2 | 3;
}) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <section id={id} className="scroll-mt-20">
      <Heading
        className={
          level === 2
            ? 'text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50'
            : 'text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-50'
        }
      >
        <a href={`#${id}`} className="hover:underline">
          {title}
        </a>
      </Heading>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        {children}
      </div>
    </section>
  );
}
