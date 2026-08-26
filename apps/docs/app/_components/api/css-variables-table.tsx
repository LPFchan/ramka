import { cn } from '@/lib/utils';
import type { CssVarRow } from '../../_content/lightbox/api/types';

import { DocDescription } from './doc-description';
import {
  API_TABLE_STYLE,
  apiCssVarsGridClass,
  apiNameCellClass,
  apiTableHeaderClass,
  apiTableShellClass,
} from './table-layout';
import { TypeHighlight } from './type-highlight';

export function CssVariablesTable({ variables }: { variables: CssVarRow[] }) {
  if (variables.length === 0) return null;

  return (
    <div
      className={apiTableShellClass}
      style={API_TABLE_STYLE}
      role="table"
      aria-label="CSS variables"
    >
      <div role="row" className={cn(apiCssVarsGridClass, apiTableHeaderClass)}>
        <div role="columnheader">Variable</div>
        <div role="columnheader">Type</div>
        <div role="columnheader">Description</div>
      </div>
      <div role="rowgroup">
        {variables.map((v) => (
          <div
            key={v.name}
            role="row"
            className={cn(
              apiCssVarsGridClass,
              'items-start border-b border-neutral-200 py-3 last:border-b-0 dark:border-neutral-800',
            )}
          >
            <div role="cell" className={apiNameCellClass}>
              <code>{v.name}</code>
            </div>
            <div role="cell" className="min-w-0 truncate">
              {v.type ? <TypeHighlight code={v.type} /> : <span className="text-neutral-400">—</span>}
            </div>
            <div role="cell" className="min-w-0 text-[13px] leading-6 text-neutral-700 dark:text-neutral-200">
              <DocDescription text={v.description} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}