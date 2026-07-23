import { cn } from '@/lib/utils';

type TokenKind =
  | 'keyword'
  | 'builtin'
  | 'string'
  | 'number'
  | 'function'
  | 'type'
  | 'punctuation'
  | 'plain';

const KEYWORDS = new Set([
  'boolean',
  'string',
  'number',
  'bigint',
  'symbol',
  'object',
  'void',
  'null',
  'undefined',
  'never',
  'any',
  'unknown',
  'true',
  'false',
  'readonly',
  'const',
  'keyof',
  'infer',
  'extends',
  'typeof',
  'in',
  'as',
  'is',
]);

const tokenClass: Record<TokenKind, string> = {
  keyword: 'text-blue-600 dark:text-blue-400',
  builtin: 'text-blue-600 dark:text-blue-400',
  string: 'text-emerald-700 dark:text-emerald-400',
  number: 'text-amber-700 dark:text-amber-400',
  function: 'text-rose-600 dark:text-rose-400',
  type: 'text-violet-700 dark:text-violet-300',
  punctuation: 'text-neutral-500 dark:text-neutral-400',
  plain: 'text-neutral-800 dark:text-neutral-200',
};

function classifyIdent(ident: string): TokenKind {
  if (ident === 'function') return 'function';
  if (KEYWORDS.has(ident)) return 'keyword';
  if (/^[A-Z]/.test(ident)) return 'type';
  return 'plain';
}

/** Lightweight TS-ish highlighter for prop type / default cells. */
export function TypeHighlight({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const tokens = tokenize(code);

  return (
    <code className={cn('font-mono text-[13px] leading-snug', className)}>
      {tokens.map((t, i) => (
        <span key={i} className={tokenClass[t.kind]}>
          {t.value}
        </span>
      ))}
    </code>
  );
}

function tokenize(input: string): { kind: TokenKind; value: string }[] {
  const out: { kind: TokenKind; value: string }[] = [];
  let i = 0;

  while (i < input.length) {
    const rest = input.slice(i);

    // string literals
    const str = rest.match(/^('(?:\\.|[^'])*'|"(?:\\.|[^"])*"|`(?:\\.|[^`])*`)/);
    if (str) {
      out.push({ kind: 'string', value: str[0] });
      i += str[0].length;
      continue;
    }

    // numbers
    const num = rest.match(/^\d+(\.\d+)?/);
    if (num) {
      out.push({ kind: 'number', value: num[0] });
      i += num[0].length;
      continue;
    }

    // arrow
    if (rest.startsWith('=>')) {
      out.push({ kind: 'punctuation', value: '=>' });
      i += 2;
      continue;
    }

    // identifiers
    const ident = rest.match(/^[A-Za-z_$][\w$]*/);
    if (ident) {
      out.push({ kind: classifyIdent(ident[0]), value: ident[0] });
      i += ident[0].length;
      continue;
    }

    // punctuation / operators
    const punct = rest.match(/^[{}()<>[\]|&?:,.;=+\-*/!~%]+/);
    if (punct) {
      out.push({ kind: 'punctuation', value: punct[0] });
      i += punct[0].length;
      continue;
    }

    // whitespace / other
    const ws = rest.match(/^\s+/);
    if (ws) {
      out.push({ kind: 'plain', value: ws[0] });
      i += ws[0].length;
      continue;
    }

    out.push({ kind: 'plain', value: rest[0]! });
    i += 1;
  }

  return out;
}
