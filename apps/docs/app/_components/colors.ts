import type { PersonColor } from '../_data/people';

interface ColorClasses {
  avatarBg: string;
  badgeBg: string;
  badgeText: string;
  buttonSolid: string;
  buttonSoft: string;
}

// Tailwind v4 only includes class names that appear literally in source files,
// so we have to enumerate every combination here rather than interpolating.
export const COLOR_CLASSES: Record<PersonColor, ColorClasses> = {
  rose: {
    avatarBg: 'bg-rose-500',
    badgeBg: 'bg-rose-100 dark:bg-rose-950',
    badgeText: 'text-rose-800 dark:text-rose-200',
    buttonSolid: 'bg-rose-500 text-white hover:bg-rose-600',
    buttonSoft: 'bg-rose-100 text-rose-800 hover:bg-rose-200 dark:bg-rose-950 dark:text-rose-200',
  },
  indigo: {
    avatarBg: 'bg-indigo-500',
    badgeBg: 'bg-indigo-100 dark:bg-indigo-950',
    badgeText: 'text-indigo-800 dark:text-indigo-200',
    buttonSolid: 'bg-indigo-500 text-white hover:bg-indigo-600',
    buttonSoft: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200 dark:bg-indigo-950 dark:text-indigo-200',
  },
  cyan: {
    avatarBg: 'bg-cyan-500',
    badgeBg: 'bg-cyan-100 dark:bg-cyan-950',
    badgeText: 'text-cyan-800 dark:text-cyan-200',
    buttonSolid: 'bg-cyan-500 text-white hover:bg-cyan-600',
    buttonSoft: 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200 dark:bg-cyan-950 dark:text-cyan-200',
  },
  orange: {
    avatarBg: 'bg-orange-500',
    badgeBg: 'bg-orange-100 dark:bg-orange-950',
    badgeText: 'text-orange-800 dark:text-orange-200',
    buttonSolid: 'bg-orange-500 text-white hover:bg-orange-600',
    buttonSoft: 'bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-950 dark:text-orange-200',
  },
  fuchsia: {
    avatarBg: 'bg-fuchsia-500',
    badgeBg: 'bg-fuchsia-100 dark:bg-fuchsia-950',
    badgeText: 'text-fuchsia-800 dark:text-fuchsia-200',
    buttonSolid: 'bg-fuchsia-500 text-white hover:bg-fuchsia-600',
    buttonSoft: 'bg-fuchsia-100 text-fuchsia-800 hover:bg-fuchsia-200 dark:bg-fuchsia-950 dark:text-fuchsia-200',
  },
  teal: {
    avatarBg: 'bg-teal-500',
    badgeBg: 'bg-teal-100 dark:bg-teal-950',
    badgeText: 'text-teal-800 dark:text-teal-200',
    buttonSolid: 'bg-teal-500 text-white hover:bg-teal-600',
    buttonSoft: 'bg-teal-100 text-teal-800 hover:bg-teal-200 dark:bg-teal-950 dark:text-teal-200',
  },
  violet: {
    avatarBg: 'bg-violet-500',
    badgeBg: 'bg-violet-100 dark:bg-violet-950',
    badgeText: 'text-violet-800 dark:text-violet-200',
    buttonSolid: 'bg-violet-500 text-white hover:bg-violet-600',
    buttonSoft: 'bg-violet-100 text-violet-800 hover:bg-violet-200 dark:bg-violet-950 dark:text-violet-200',
  },
  emerald: {
    avatarBg: 'bg-emerald-500',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-950',
    badgeText: 'text-emerald-800 dark:text-emerald-200',
    buttonSolid: 'bg-emerald-500 text-white hover:bg-emerald-600',
    buttonSoft: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-200',
  },
};
