import type { ReactNode } from 'react';
import Markdown from 'react-markdown';

import { anchorId } from './documents';

// Headings carry the spacing that would otherwise sit on hand-written section
// wrappers, so the rhythm survives the flat structure Markdown produces.
const headingClassName = 'mt-12 scroll-mt-8 text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50';

// A step larger than the body copy, so the section a passage belongs to is
// legible at a glance rather than by weight alone.
const subheadingClassName =
  'mt-8 scroll-mt-8 text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100';

const bodyClassName = 'mt-4 text-[15px] leading-7 text-neutral-600 dark:text-neutral-400';

// Defined terms carry the body colour's darker sibling, so the word being
// defined is findable when skimming without turning the list into headings.
const definedTermClassName = 'font-semibold text-neutral-900 dark:text-neutral-100';

const linkClassName =
  'underline decoration-neutral-300 underline-offset-2 transition hover:decoration-neutral-500 dark:decoration-neutral-700 dark:hover:decoration-neutral-500';

/** Renders a licensing document with the site's typography. */
export function LegalMarkdown({ children }: { children: string }) {
  return (
    <Markdown
      components={{
        h2: ({ children }) => (
          <h2 id={anchorId(textOf(children))} className={headingClassName}>
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 id={anchorId(textOf(children))} className={subheadingClassName}>
            {children}
          </h3>
        ),
        p: ({ children }) => <p className={bodyClassName}>{children}</p>,
        ul: ({ children }) => (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-[15px] leading-7 text-neutral-600 dark:text-neutral-400">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="mt-4 list-decimal space-y-1 pl-5 text-[15px] leading-7 text-neutral-600 dark:text-neutral-400">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="pl-0.5">{children}</li>,
        strong: ({ children }) => <strong className={definedTermClassName}>{children}</strong>,
        a: ({ href, children }) => (
          <a href={href} className={linkClassName}>
            {children}
          </a>
        ),
        // A step above the docs' text-xs: monospace at 12px reads undersized
        // beside 15px Inter, and this is the package a buyer is licensing.
        code: ({ children }) => <code className="text-[13px]">{children}</code>,
        // Verbatim blocks are quoted license text, not code to be read for
        // syntax, so they get a quiet frame. The child selector walks back the
        // inline `code` size above, which would otherwise apply in here too.
        pre: ({ children }) => (
          <pre className="mt-6 overflow-x-auto rounded-2xl border border-neutral-200 p-5 text-xs leading-6 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400 [&>code]:text-xs">
            {children}
          </pre>
        ),
      }}
    >
      {children}
    </Markdown>
  );
}

/** Flatten a heading's rendered children back to text, for anchor ids. */
function textOf(children: ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(textOf).join('');
  return '';
}
