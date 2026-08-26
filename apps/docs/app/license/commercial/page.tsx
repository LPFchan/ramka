import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Markdown from 'react-markdown';

import { SiteFooter } from '../../_components/site-footer';
import { SiteHeader } from '../../_components/site-header';
import { anchorId, readAgreement } from './agreement';

export const metadata: Metadata = {
  title: 'Commercial License Agreement — ramka',
  description: 'The Ramka Commercial License Agreement.',
};

// Clause headings carry the spacing that used to sit on hand-written section
// wrappers, so the rhythm survives the flat structure Markdown produces.
const clauseHeadingClassName =
  'mt-12 scroll-mt-8 text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50';

// A step larger than the body copy, so the tier a clause belongs to is legible
// at a glance rather than by weight alone.
const subheadingClassName =
  'mt-8 scroll-mt-8 text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100';

const bodyClassName = 'mt-4 text-[15px] leading-7 text-neutral-600 dark:text-neutral-400';

// Defined terms carry the body colour's darker sibling, so the word being
// defined is findable when skimming without turning the list into headings.
const definedTermClassName = 'font-semibold text-neutral-900 dark:text-neutral-100';

export default async function CommercialLicensePage() {
  const { title, version, body } = await readAgreement();

  return (
    <div className="isolate flex min-h-screen flex-col">
      <SiteHeader home />

      <main className="flex-1">
        <section className="mx-auto w-full max-w-2xl px-6 pt-16 pb-20 md:pt-20 md:pb-24">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-neutral-950 md:text-4xl dark:text-neutral-50">
            {title}
          </h1>
          <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">{version}</p>

          <Markdown
            components={{
              h2: ({ children }) => (
                <h2 id={anchorId(textOf(children))} className={clauseHeadingClassName}>
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 id={anchorId(textOf(children))} className={subheadingClassName}>
                  {children}
                </h3>
              ),
              p: ({ children }) => <p className={bodyClassName}>{children}</p>,
              strong: ({ children }) => <strong className={definedTermClassName}>{children}</strong>,
              // A step above the docs' text-xs: monospace at 12px reads
              // undersized beside 15px Inter, and this is the package a buyer is
              // licensing.
              code: ({ children }) => <code className="text-[13px]">{children}</code>,
            }}
          >
            {body}
          </Markdown>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

/** Flatten a heading's rendered children back to text, for anchor ids. */
function textOf(children: ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(textOf).join('');
  return '';
}
