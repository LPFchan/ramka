import Link from 'next/link';
import { SidebarNav } from './sidebar-nav';
import { ThemeToggle } from './theme-toggle';

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[17rem] shrink-0 flex-col border-r border-neutral-200/80 bg-neutral-50/60 dark:border-neutral-800/80 dark:bg-neutral-950/60 md:flex">
      <div className="flex items-start justify-between gap-2 px-7 pb-2 pt-7">
        <div className="min-w-0">
          <Link
            href="/"
            className="block text-[15px] font-semibold tracking-tight text-neutral-900 transition-colors hover:text-neutral-600 dark:text-neutral-50 dark:hover:text-neutral-300"
          >
            ramka
          </Link>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
            Unstyled gallery &amp; lightbox primitives
          </p>
        </div>
        <ThemeToggle />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-5 [scrollbar-width:thin]">
        <SidebarNav />
      </div>
    </aside>
  );
}
