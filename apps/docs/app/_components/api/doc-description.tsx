import * as React from 'react';

/**
 * Renders JSDoc / docs prose with light formatting:
 * paragraphs, `-` bullet lists, and `inline code`.
 */
export function DocDescription({ text }: { text: string }) {
  if (!text || text === '—') {
    return <span className="text-neutral-400">—</span>;
  }

  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  return (
    <div className="space-y-2 text-neutral-600 dark:text-neutral-400">
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        const isList = lines.every((l) => /^\s*-\s+/.test(l) || (l.startsWith('  ') && lines[0]?.startsWith('-')));

        if (isList || lines.some((l) => /^\s*-\s+/.test(l))) {
          const items = parseListItems(lines);
          return (
            <ul key={i} className="list-disc space-y-1 pl-4">
              {items.map((item, j) => (
                <li key={j}>
                  <InlineMarkdown text={item} />
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={i} className="leading-relaxed">
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

function InlineMarkdown({ text }: { text: string }) {
  // Split on `code`, **bold**, leaving the rest as text.
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={i}
              className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[0.85em] text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-medium text-neutral-800 dark:text-neutral-200">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}
