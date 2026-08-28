import * as React from 'react';

import { TypeHighlight } from './type-highlight';
import { docsLinkClassName } from '../docs-link';

/**
 * Renders JSDoc / docs prose with light formatting:
 * paragraphs, `-` bullet lists, and `inline code`.
 */
export function DocDescription({ text }: { text: string }) {
  if (!text || text === '—') {
    return <span className="text-neutral-400">—</span>;
  }

  const blocks = text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <div className="space-y-3 text-inherit">
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        const isList = lines.every((l) => /^\s*-\s+/.test(l) || (l.startsWith('  ') && lines[0]?.startsWith('-')));

        if (isList || lines.some((l) => /^\s*-\s+/.test(l))) {
          const items = parseListItems(lines);
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-4 marker:text-neutral-400">
              {items.map((item, j) => (
                <li key={j} className="leading-6">
                  <InlineMarkdown text={item} />
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={i} className="leading-6">
            <InlineMarkdown text={lines.map((l) => l.trim()).join(' ')} />
          </p>
        );
      })}
    </div>
  );
}

function parseListItems(lines: string[]): string[] {
  const items: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\s*-\s+(.*)$/);
    if (m?.[1] != null) {
      items.push(m[1].trim());
      continue;
    }
    const last = items[items.length - 1];
    if (last != null && /^\s+/.test(line)) {
      items[items.length - 1] = `${last} ${line.trim()}`;
    }
  }
  return items;
}

function looksLikeTypeOrValue(code: string): boolean {
  // Highlight TS-ish snippets; leave prose-y identifiers as neutral chips.
  return (
    /['"`]|=>|\||&|<|>|\(|\)|\{|\}|\[|\]|:/.test(code) ||
    /^(true|false|null|undefined|boolean|string|number|function|void|never|any|unknown)$/.test(code) ||
    /^[A-Z][A-Za-z0-9.]*$/.test(code)
  );
}

function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|https?:\/\/[^\s]+)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          const code = part.slice(1, -1);
          if (looksLikeTypeOrValue(code)) {
            return (
              <code
                key={i}
                className="mx-0.5 inline-block rounded-md border border-neutral-200 bg-neutral-100/80 px-1.5 py-0.5 align-baseline dark:border-neutral-700 dark:bg-neutral-900"
              >
                <TypeHighlight code={code} className="text-[0.9em]" />
              </code>
            );
          }
          return (
            <code
              key={i}
              className="mx-0.5 rounded-md bg-violet-50 px-1.5 py-0.5 font-mono text-[0.9em] text-violet-800 dark:bg-violet-950/60 dark:text-violet-200"
            >
              {code}
            </code>
          );
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-semibold text-neutral-900 dark:text-neutral-50">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (/^https?:\/\//.test(part)) {
          return (
            <a key={i} href={part} className={docsLinkClassName}>
              {part}
            </a>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}
