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
        'block rounded-lg px-2.5 py-[5px] text-[13px] leading-6 transition-colors',
        active
          ? // Raised chip, like a macOS segmented-control selection.
            'bg-white font-medium text-neutral-900 shadow-[0_0.5px_1px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)] dark:bg-neutral-800 dark:text-neutral-50 dark:shadow-[0_0.5px_1px_rgba(0,0,0,0.4),inset_0_0.5px_0_rgba(255,255,255,0.08)]'
          : 'text-neutral-600 hover:bg-black/[0.04] hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/[0.06] dark:hover:text-neutral-100',
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
          {/* Finder-style section header: sentence case, small, quiet. */}
          <div className="px-2.5 pb-1.5 text-[11px] font-semibold text-neutral-400 dark:text-neutral-500">
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
              <div className="px-2.5 pb-1.5 text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
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
