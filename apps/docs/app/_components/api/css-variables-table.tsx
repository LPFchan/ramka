import type { CssVarRow } from '../../_content/lightbox/api/types';

export function CssVariablesTable({ variables }: { variables: CssVarRow[] }) {
  if (variables.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full min-w-[28rem] text-left text-sm">
        <thead className="bg-neutral-50 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
          <tr>
            <th className="px-3 py-2 font-medium">Variable</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {variables.map((v) => (
            <tr key={v.name} className="align-top">
              <td className="px-3 py-2.5 font-mono text-xs text-neutral-900 dark:text-neutral-100">
                <code>{v.name}</code>
              </td>
              <td className="px-3 py-2.5 font-mono text-xs text-neutral-500">
                {v.type ? <code>{v.type}</code> : '—'}
              </td>
              <td className="px-3 py-2.5 text-neutral-600 dark:text-neutral-400">
                {v.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
