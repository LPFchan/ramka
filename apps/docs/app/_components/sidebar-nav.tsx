'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { navSections } from '../_content/nav';
import { cn } from '@/lib/utils';

function isActive(pathname: string, href: string, match: 'exact' | 'prefix' = 'exact') {
  if (href === '/') return pathname === '/';
  if (match === 'prefix') return pathname === href || pathname.startsWith(`${href}/`);
  return pathname === href;
}

function NavItem({
  href,
  title,
  onNavigate,
  pathname,
  match = 'exact',
}: {
  href: string;
  title: string;
  onNavigate?: () => void;
  pathname: string;
  match?: 'exact' | 'prefix';
}) {
  const active = isActive(pathname, href, match);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        'block rounded-lg px-3 py-1.5 text-[13px] leading-6 transition-colors',
        active
          ? 'bg-neutral-200/60 font-medium text-neutral-900 dark:bg-neutral-800/70 dark:text-neutral-50'
          : 'text-neutral-600 hover:bg-neutral-200/40 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100',
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
    <nav className="space-y-7">
      {navSections.map((section) => (
        <div key={section.title}>
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-400 dark:text-neutral-600">
            {section.title}
          </div>
          {section.links.length > 0 ? (
            <ul className="flex flex-col gap-0.5">
              {section.links.map((link) => (
                <li key={link.href}>
                  <NavItem
                    href={link.href}
                    title={link.title}
                    match={link.match}
                    onNavigate={onNavigate}
                    pathname={pathname}
                  />
                </li>
              ))}
            </ul>
          ) : null}
          {section.groups?.map((group) => (
            <div key={group.title} className="mt-3 first:mt-0">
              <div className="px-3 pb-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-400 dark:text-neutral-600">
                {group.title}
              </div>
              <ul className="flex flex-col gap-0.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <NavItem
                      href={link.href}
                      title={link.title}
                      match={link.match}
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
