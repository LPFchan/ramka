'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { navSections } from '../_content/nav';
import { cn } from '@/lib/utils';

function NavItem({
  href,
  title,
  onNavigate,
  pathname,
}: {
  href: string;
  title: string;
  onNavigate?: () => void;
  pathname: string;
}) {
  const active = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        'block rounded-md px-2 py-1.5 text-sm transition',
        active
          ? 'bg-neutral-100 font-medium text-neutral-900 dark:bg-neutral-900 dark:text-neutral-50'
          : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-neutral-50',
      )}
      aria-current={active ? 'page' : undefined}
    >
      {title}
    </Link>
  );
}

/**
 * Shared between the desktop `Sidebar` and the mobile navigation drawer.
 * `onNavigate` lets the drawer close itself when a link is tapped.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-6">
      {navSections.map((section) => (
        <div key={section.title}>
          <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
            {section.title}
          </div>
          {section.links.length > 0 ? (
            <ul className="flex flex-col gap-px">
              {section.links.map((link) => (
                <li key={link.href}>
                  <NavItem
                    href={link.href}
                    title={link.title}
                    onNavigate={onNavigate}
                    pathname={pathname}
                  />
                </li>
              ))}
            </ul>
          ) : null}
          {section.groups?.map((group) => (
            <div key={group.title} className="mt-3 first:mt-0">
              <div className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                {group.title}
              </div>
              <ul className="flex flex-col gap-px">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <NavItem
                      href={link.href}
                      title={link.title}
                      onNavigate={onNavigate}
                      pathname={pathname}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </nav>
  );
}
