'use client';

import type { ReactNode } from 'react';
import { Accordion as AccordionPrimitive } from '@base-ui/react/accordion';
import { ChevronDownIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { PropRow } from '../../_content/lightbox/api/types';

import { DocDescription } from './doc-description';
import {
  API_TABLE_STYLE,
  apiPropsGridClass,
  apiTableHeaderClass,
  apiTableShellClass,
} from './table-layout';
import { TypeHighlight } from './type-highlight';

/** Collapsed Type column — match Base UI short forms. */
function shortType(type: string): string {
  const t = type.trim();
  if (!t) return '—';
  if (t.includes('=>') || /^\(\s*\)/.test(t) || t.startsWith('function')) return 'function';
  if (t.length > 40) return `${t.slice(0, 37)}…`;
  return t;
}

function DetailRow({
  label,
  children,
  align = 'center',
}: {
  label: string;
  children: ReactNode;
  align?: 'start' | 'center';
}) {
  return (
    <div className={cn(apiPropsGridClass, align === 'center' ? 'items-center' : 'items-start')}>
      <dt
        className={cn(
          'text-[13px] leading-6 text-neutral-500 dark:text-neutral-400',
          align === 'start' && 'pt-0.5',
        )}
      >
        {label}
      </dt>
      <dd className="col-span-3 min-w-0 text-[13px] leading-6 text-neutral-800 dark:text-neutral-100">
        {children}
      </dd>
    </div>
  );
}

export function PropsTable({
  props,
  partId,
}: {
  props: PropRow[];
  partId?: string;
}) {
  if (props.length === 0) {
    return <p className="text-sm text-neutral-500">This part has no custom props.</p>;
  }

  return (
    <div className={apiTableShellClass} style={API_TABLE_STYLE} role="table" aria-label="Props">
      <div role="row" className={cn(apiPropsGridClass, apiTableHeaderClass)}>
        <div role="columnheader">Prop</div>
        <div role="columnheader">Type</div>
        <div role="columnheader">Default</div>
        <div role="columnheader" className="sr-only">
          Expand
        </div>
      </div>

      <AccordionPrimitive.Root className="w-full">
        {props.map((prop) => {
          const anchor = partId ? `${partId}-${prop.name}` : prop.name;
          const displayType = shortType(prop.type);

          return (
            <AccordionPrimitive.Item
              key={prop.name}
              value={prop.name}
              className="border-b border-neutral-200 last:border-b-0 dark:border-neutral-800"
            >
              <AccordionPrimitive.Header className="m-0">
                <AccordionPrimitive.Trigger
                  id={anchor}
                  className={cn(
                    apiPropsGridClass,
                    'group items-center py-3 text-left outline-none transition-colors',
                    'hover:bg-neutral-50 dark:hover:bg-neutral-900/60',
                    'focus-visible:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-400/40 dark:focus-visible:bg-neutral-900/60',
                  )}
                  aria-label={`Prop: ${prop.name}${prop.required ? ', required' : ''}, type: ${displayType}${prop.default != null ? `, default: ${prop.default}` : ''}`}
                >
                  <div className="min-w-0 truncate font-mono text-[13px] font-medium text-neutral-900 dark:text-neutral-50">
                    {prop.name}
                    {prop.required ? (
                      <span className="ml-0.5 font-normal text-red-500" title="Required" aria-hidden>
                        *
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0 truncate">
                    <TypeHighlight code={displayType} />
                  </div>
                  <div className="min-w-0 truncate">
                    {prop.required || prop.default == null ? (
                      <span className="text-neutral-400">—</span>
                    ) : (
                      <TypeHighlight code={prop.default} />
                    )}
                  </div>
                  <ChevronDownIcon
                    aria-hidden
                    className="size-4 shrink-0 justify-self-end text-neutral-400 transition-transform duration-200 group-aria-expanded:rotate-180"
                  />
                </AccordionPrimitive.Trigger>
              </AccordionPrimitive.Header>

              <AccordionPrimitive.Panel className="overflow-hidden data-open:animate-accordion-down data-closed:animate-accordion-up">
                <div className="border-t border-neutral-200 bg-neutral-50 pb-5 pt-4 dark:border-neutral-800 dark:bg-neutral-900/80">
                  <dl className="space-y-3.5">
                    <DetailRow label="Name">
                      <a
                        href={`#${anchor}`}
                        className="font-mono text-[13px] font-medium text-blue-600 underline decoration-blue-600/40 underline-offset-[3px] hover:decoration-blue-600 dark:text-blue-400 dark:decoration-blue-400/40 dark:hover:decoration-blue-400"
                      >
                        {prop.name}
                      </a>
                    </DetailRow>

                    {prop.description && prop.description !== '—' ? (
                      <DetailRow label="Description" align="start">
                        <div className="text-[13px] leading-6 text-neutral-700 dark:text-neutral-200">
                          <DocDescription text={prop.description} />
                        </div>
                      </DetailRow>
                    ) : null}

                    <DetailRow label="Type">
                      <div className="inline-block max-w-full overflow-x-auto rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 dark:border-neutral-700 dark:bg-neutral-900">
                        <TypeHighlight
                          code={prop.type}
                          className="whitespace-pre-wrap break-words"
                        />
                      </div>
                    </DetailRow>

                    {prop.default != null ? (
                      <DetailRow label="Default">
                        <TypeHighlight code={prop.default} />
                      </DetailRow>
                    ) : null}
                  </dl>
                </div>
              </AccordionPrimitive.Panel>
            </AccordionPrimitive.Item>
          );
        })}
      </AccordionPrimitive.Root>
    </div>
  );
}
