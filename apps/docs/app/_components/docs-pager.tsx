import Link from 'next/link';

import { cn } from '@/lib/utils';

type PagerLink = { href: string; title: string };

export function DocsPager({
  prev,
  next,
}: {
  prev?: PagerLink;
  next?: PagerLink;
}) {
  if (!prev && !next) return null;

  return (
    <nav
      className={cn(
        'mt-16 grid gap-3 border-t border-neutral-200 pt-8 dark:border-neutral-800',
        prev && next ? 'sm:grid-cols-2' : 'grid-cols-1',
      )}
      aria-label="Docs pagination"
    >
      {prev ? (
        <Link
          href={prev.href}
          className="rounded-xl border border-neutral-200 px-4 py-3 transition hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:border-neutral-700 dark:hover:bg-neutral-900"
        >
          <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">Previous</div>
          <div className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-50">{prev.title}</div>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={next.href}
          className={cn(
            'rounded-xl border border-neutral-200 px-4 py-3 transition hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:border-neutral-700 dark:hover:bg-neutral-900',
            prev ? 'sm:text-right' : undefined,
          )}
        >
          <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">Next</div>
          <div className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-50">{next.title}</div>
        </Link>
      ) : null}
    </nav>
  );
}
