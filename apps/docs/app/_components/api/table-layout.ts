import type { CSSProperties } from 'react';

/**
 * Shared column tracks for every API reference table on the page.
 * Fixed rem widths keep name columns aligned across separate table
 * instances (Root props → Trigger props → attributes → css vars).
 */
export const API_TABLE_STYLE = {
  '--api-col-name': '13rem',
  '--api-col-type': 'minmax(0, 1.25fr)',
  '--api-col-default': '8rem',
  '--api-col-icon': '1.5rem',
} as CSSProperties;

/** Outer chrome shared by all API tables. */
export const apiTableShellClass =
  'w-full overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800';

export const apiTableHeaderClass =
  'items-center border-b border-neutral-200 bg-neutral-50 py-2.5 text-xs font-medium text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-400';

/** First-column identifier cells — wrap long names instead of truncating. */
export const apiNameCellClass =
  'min-w-0 break-all font-mono text-[13px] font-medium text-neutral-900 dark:text-neutral-50';

const rowPad = 'gap-x-4 px-4';

/** Props accordion: Name | Type | Default | icon */
export const apiPropsGridClass = `${rowPad} grid w-full grid-cols-[var(--api-col-name)_var(--api-col-type)_var(--api-col-default)_var(--api-col-icon)]`;

/** Data attributes: Name | Description */
export const apiAttrsGridClass = `${rowPad} grid w-full grid-cols-[var(--api-col-name)_minmax(0,1fr)]`;

/** CSS variables: Name | Type | Description — Type uses the Default track */
export const apiCssVarsGridClass = `${rowPad} grid w-full grid-cols-[var(--api-col-name)_var(--api-col-default)_minmax(0,1fr)]`;
