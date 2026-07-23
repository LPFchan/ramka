import type { ReactNode } from 'react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

/** Shared inline-link look for docs body + section titles. */
export const docsLinkClassName =
  'font-medium text-blue-600 underline decoration-blue-600/30 underline-offset-2 transition-colors hover:text-blue-700 hover:decoration-blue-700/50 dark:text-blue-400 dark:decoration-blue-400/40 dark:hover:text-blue-300 dark:hover:decoration-blue-300/60';

export function DocsLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={cn(docsLinkClassName, className)}>
      {children}
    </Link>
  );
}
