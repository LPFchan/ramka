import Link from 'next/link';
import { exampleGroups } from './examples';

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-neutral-200 bg-white px-4 py-6 dark:border-neutral-800 dark:bg-neutral-950 md:block">
      <Link
        href="/"
        className="block px-2 text-sm font-semibold tracking-tight text-neutral-900 hover:text-neutral-600 dark:text-neutral-50 dark:hover:text-neutral-300"
      >
        react-image-gallery
      </Link>
      <p className="mt-1 px-2 text-xs text-neutral-500 dark:text-neutral-500">Unstyled gallery & lightbox primitives</p>

      <nav className="mt-6 space-y-6">
        {exampleGroups.map((group) => (
          <div key={group.group}>
            <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
              {group.group}
            </div>
            <ul className="flex flex-col gap-px">
              {group.links.map((ex) => (
                <li key={ex.slug}>
                  <Link
                    href={`${group.basePath}/${ex.slug}`}
                    className="block rounded-md px-2 py-1.5 text-sm text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-neutral-50"
                  >
                    {ex.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
