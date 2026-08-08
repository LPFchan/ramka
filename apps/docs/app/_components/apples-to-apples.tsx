import { Check } from 'lucide-react';

/**
 * Landing page comparison section: airy columns, hairline rules, checkmarks.
 * The rows are a legitimate feature list; the humor is confined to the
 * competing columns answering honestly. Static content, so this stays a
 * server component.
 */

type Row = {
  feature: string;
  /** `true` renders a checkmark; a string renders as muted text. */
  ramka: true | string;
  diy: true | string;
  plugin: true | string;
};

const ROWS: Row[] = [
  { feature: 'Built on native scrolling', ramka: true, diy: 'eventually', plugin: 'jQuery' },
  { feature: 'Morphs across aspect ratios', ramka: true, diy: 'after the rewrite', plugin: '\u2014' },
  { feature: 'Pinch to zoom', ramka: true, diy: 'sprint 14', plugin: 'double tap, sometimes' },
  { feature: 'Pull to dismiss', ramka: true, diy: 'in the backlog', plugin: 'Esc' },
  { feature: 'View transitions', ramka: true, diy: 'weekend project', plugin: 'fade()' },
  { feature: 'Respects reduced motion', ramka: true, diy: 'oops', plugin: '\u2014' },
  { feature: 'Accessible out of the box', ramka: true, diy: 'TODO', plugin: '\u2014' },
];

function Cell({ value }: { value: true | string }) {
  if (value === true) {
    return <Check aria-label="Yes" className="mx-auto h-4 w-4 text-neutral-900 dark:text-neutral-50" strokeWidth={2.5} />;
  }
  return <span className="text-neutral-400 dark:text-neutral-500">{value}</span>;
}

export function ApplesToApples() {
  return (
    <section className="mx-auto w-full max-w-3xl px-6 pb-24">
      <h2 className="text-balance text-center text-3xl font-semibold tracking-tight text-neutral-950 md:text-4xl dark:text-neutral-50">
        How it compares.
      </h2>
      <p className="mx-auto mt-4 max-w-md text-pretty text-center text-neutral-500 dark:text-neutral-400">
        Nobody chooses a lightbox. You inherit one from 2013, or you decide to
        build your own. Here is how that goes.
      </p>

      <table className="mt-12 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <th className="w-[34%]" aria-hidden />
            <th
              scope="col"
              className="pb-3 text-center font-semibold tracking-tight text-neutral-950 dark:text-neutral-50"
            >
              ramka
            </th>
            <th
              scope="col"
              className="pb-3 text-center font-normal text-neutral-400 dark:text-neutral-500"
            >
              the one you&rsquo;d build
            </th>
            <th
              scope="col"
              className="pb-3 text-center font-normal text-neutral-400 dark:text-neutral-500"
            >
              that 2013 plugin
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
          {ROWS.map((row) => (
            <tr key={row.feature}>
              <th
                scope="row"
                className="py-3.5 pr-4 text-left text-[13px] font-normal text-neutral-600 md:text-sm dark:text-neutral-300"
              >
                {row.feature}
              </th>
              <td className="px-2 py-3.5 text-center text-[13px] md:text-sm">
                <Cell value={row.ramka} />
              </td>
              <td className="px-2 py-3.5 text-center text-[13px] md:text-sm">
                <Cell value={row.diy} />
              </td>
              <td className="px-2 py-3.5 text-center text-[13px] md:text-sm">
                <Cell value={row.plugin} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

    </section>
  );
}
