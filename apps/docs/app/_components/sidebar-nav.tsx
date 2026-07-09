import Link from 'next/link';
import { exampleGroups } from './examples';

/**
 * The list of example groups + links shared between the desktop `Sidebar`
 * and the mobile navigation drawer. `onNavigate` lets the drawer close
 * itself when a link is tapped.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-6">
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
                  onClick={onNavigate}
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
  );
}
