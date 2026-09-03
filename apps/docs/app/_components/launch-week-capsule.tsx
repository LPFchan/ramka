import { isLaunchWeek } from '../_content/pricing';

/**
 * The launch-week announcement, styled as a live-status capsule (hairline,
 * soft tint, pulsing dot) rather than a badge, so it reads "happening now".
 * Deliberately terse so it stays on one line on mobile; the future price
 * increase is carried by the tier cards ("$99 after launch week"), which is
 * also the legally safe framing — see `_content/pricing.ts`. Renders nothing
 * once the regular prices take over, so call sites need no cleanup to end
 * launch week.
 */
export function LaunchWeekCapsule() {
  if (!isLaunchWeek) return null;

  return (
    <p className="flex items-center gap-2.5 rounded-full border border-emerald-600/20 bg-emerald-50/60 py-1.5 pr-4 pl-3.5 text-[13px] font-medium text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-950/40 dark:text-emerald-200">
      <span aria-hidden className="relative flex size-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
      </span>
      Launch week: intro pricing
    </p>
  );
}
