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
    <div className="mx-auto flex w-full max-w-6xl gap-12 px-6 py-14 md:px-10 md:py-16">
      <div className="min-w-0 flex-1">
        <header className="mb-12">
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            {title}
          </h1>
          {description ? (
            <div className="mt-4 max-w-2xl text-pretty text-[17px] leading-7 text-neutral-500 dark:text-neutral-400">
              {description}
            </div>
          ) : null}
        </header>
        <div className="docs-prose space-y-14">{children}</div>
      </div>
      {toc && toc.length > 0 ? (
        <aside className="sticky top-12 hidden h-[calc(100vh-6rem)] w-56 shrink-0 overflow-y-auto xl:block">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-400 dark:text-neutral-600">
            On this page
          </div>
          <ul className="mt-4 space-y-0.5 border-l border-neutral-200 dark:border-neutral-800">
            {toc.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className={cn(
                    'block border-l-2 border-transparent py-1 pl-3.5 text-[13px] leading-6 text-neutral-500 transition-colors',
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
                          className="block py-0.5 pl-6 text-xs leading-5 text-neutral-400 transition-colors hover:text-neutral-800 dark:text-neutral-500 dark:hover:text-neutral-200"
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
  /** String titles get a `#id` self-link. Pass a node when the title includes other links (avoid nesting `<a>`). */
  title: React.ReactNode;
  children: React.ReactNode;
  level?: 2 | 3;
}) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <section id={id} className="scroll-mt-20">
      <Heading
        className={
          level === 2
            ? 'text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50'
            : 'text-[17px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-50'
        }
      >
        {typeof title === 'string' ? (
          <a href={`#${id}`} className="hover:underline">
            {title}
          </a>
        ) : (
          title
        )}
      </Heading>
      <div className="mt-4 space-y-4 text-[15px] leading-7 text-neutral-600 dark:text-neutral-400">
        {children}
      </div>
    </section>
  );
}
