import { cn } from '@/lib/utils';
import type { AttrRow } from '../../_content/lightbox/api/types';

import { DocDescription } from './doc-description';
import {
  API_TABLE_STYLE,
  apiAttrsGridClass,
  apiNameCellClass,
  apiTableHeaderClass,
  apiTableShellClass,
} from './table-layout';

export function AttributesTable({ attributes }: { attributes: AttrRow[] }) {
  if (attributes.length === 0) return null;

  return (
    <div
      className={apiTableShellClass}
      style={API_TABLE_STYLE}
      role="table"
      aria-label="Data attributes"
    >
      <div role="row" className={cn(apiAttrsGridClass, apiTableHeaderClass)}>
        <div role="columnheader">Attribute</div>
        <div role="columnheader">Description</div>
      </div>
      <div role="rowgroup">
        {attributes.map((attr) => (
          <div
            key={attr.name}
            role="row"
            className={cn(
              apiAttrsGridClass,
              'items-start border-b border-neutral-200 py-3 last:border-b-0 dark:border-neutral-800',
            )}
          >
            <div role="cell" className={apiNameCellClass}>
              <code>{attr.name}</code>
            </div>
            <div role="cell" className="min-w-0 text-[13px] leading-6 text-neutral-700 dark:text-neutral-200">
              <DocDescription text={attr.description} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
