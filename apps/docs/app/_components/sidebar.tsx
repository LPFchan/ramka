import Link from 'next/link';

import { SidebarNav } from './sidebar-nav';
import { ThemeToggle } from './theme-toggle';

const GITHUB_URL = 'https://github.com/arturbien/ramka';

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[17rem] shrink-0 p-2.5 md:block">
      {/* macOS-style floating panel: solid gray material (no backdrop-filter
          on this site), hairline border with a specular top highlight, soft
          ambient shadow. */}
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-black/[0.07] bg-neutral-100 shadow-[inset_0_0.5px_0_rgba(255,255,255,0.6),0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(0,0,0,0.12)] dark:border-white/[0.08] dark:bg-neutral-900 dark:shadow-[inset_0_0.5px_0_rgba(255,255,255,0.07),0_1px_2px_rgba(0,0,0,0.4),0_12px_32px_-16px_rgba(0,0,0,0.6)]">
        <div className="px-[18px] pb-3 pt-4">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              className="text-[15px] font-semibold tracking-tight text-neutral-900 transition-colors hover:text-neutral-600 dark:text-neutral-50 dark:hover:text-neutral-300"
            >
              ramka
            </Link>
            <div className="flex items-center gap-0.5">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="ramka on GitHub"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 transition hover:bg-black/[0.05] hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/[0.08] dark:hover:text-neutral-100"
              >
                <GitHubIcon className="h-4 w-4" />
              </a>
              <ThemeToggle variant="ghost" />
            </div>
          </div>
          <p className="mt-1.5 text-pretty text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">
            The lightbox for React.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-5 pt-1 scrollbar-thin">
          <SidebarNav />
        </div>

        {/* Pinned below the scrolling nav: the one buy entry point in the
            docs, always in view while reading. */}
        <div className="border-t border-black/[0.06] px-4 pb-4 pt-3.5 dark:border-white/[0.08]">
          <Link
            href="/license"
            className="inline-flex h-9 w-full items-center justify-center rounded-full bg-neutral-900 text-[13px] font-medium text-white transition hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            Get a license
          </Link>
        </div>
      </div>
    </aside>
  );
}
