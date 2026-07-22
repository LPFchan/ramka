import type { PropRow } from '../../_content/lightbox/api/types';

import { DocDescription } from './doc-description';

export function PropsTable({ props }: { props: PropRow[] }) {
  if (props.length === 0) {
    return <p className="text-sm text-neutral-500">This part has no custom props.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="bg-neutral-50 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
          <tr>
            <th className="px-3 py-2 font-medium">Prop</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Default</th>
            <th className="min-w-[16rem] px-3 py-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {props.map((prop) => (
            <tr key={prop.name} className="align-top">
              <td className="px-3 py-2.5 font-mono text-xs text-neutral-900 dark:text-neutral-100">
                {prop.name}
                {prop.required ? (
                  <span className="ml-1 text-neutral-400" title="Required">
                    *
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2.5 font-mono text-xs text-neutral-600 dark:text-neutral-300">
                <code className="whitespace-pre-wrap break-words">{prop.type}</code>
              </td>
              <td className="px-3 py-2.5 font-mono text-xs text-neutral-500">
                {prop.default != null ? <code>{prop.default}</code> : '—'}
              </td>
              <td className="px-3 py-2.5">
                <DocDescription text={prop.description} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
