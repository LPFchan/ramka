import Link from 'next/link';

import { GitHubIcon } from './github-icon';
import { ThemeToggle } from './theme-toggle';

const GITHUB_URL = 'https://github.com/arturbien/ramka';

const wordmarkClassName = 'text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-50';

/**
 * Header for the pages outside the docs shell, which have no sidebar to carry
 * the wordmark and theme toggle.
 *
 * `home` links the wordmark back to the landing page. Off by default, since on
 * the landing page itself the link would lead where the reader already is.
 */
export function SiteHeader({ home = false }: { home?: boolean }) {
  return (
    // Mobile vertical padding matches the docs mobile nav (56px row) so the
    // wordmark doesn't shift between pages.
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3 md:py-5">
      {home ? (
        <Link
          href="/"
          className={`${wordmarkClassName} transition-colors hover:text-neutral-600 dark:hover:text-neutral-300`}
        >
          ramka
        </Link>
      ) : (
        <span className={wordmarkClassName}>ramka</span>
      )}
      <div className="flex items-center gap-2">
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="ramka on GitHub"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <GitHubIcon className="h-4 w-4" />
        </a>
        <ThemeToggle />
      </div>
    </header>
  );
}
