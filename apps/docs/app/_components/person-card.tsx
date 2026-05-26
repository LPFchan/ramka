import type { Person } from '../_data/people';
import { COLOR_CLASSES } from './colors';

export function PersonCard({ person }: { person: Person }) {
  const c = COLOR_CLASSES[person.color];
  return (
    <div className="w-[220px] rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-col items-center gap-3 py-2">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-full text-base font-semibold text-white ${c.avatarBg}`}
        >
          {person.initials}
        </div>
        <div className="text-center">
          <div className="text-sm font-bold text-neutral-900 dark:text-neutral-50">{person.name}</div>
          <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${c.badgeBg} ${c.badgeText}`}>
            {person.role}
          </span>
        </div>
      </div>
    </div>
  );
}

export function PersonRowCard({ person, size = 'md' }: { person: Person; size?: 'sm' | 'md' }) {
  const c = COLOR_CLASSES[person.color];
  const avatarSize = size === 'sm' ? 'h-9 w-9 text-xs' : 'h-10 w-10 text-sm';
  return (
    <div className="w-[260px] rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-3">
        <div
          className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${avatarSize} ${c.avatarBg}`}
        >
          {person.initials}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-neutral-900 dark:text-neutral-50">{person.name}</div>
          <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${c.badgeBg} ${c.badgeText}`}>
            {person.role}
          </span>
        </div>
      </div>
    </div>
  );
}
