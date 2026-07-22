/**
 * Extracts docs code excerpts and writes
 * apps/docs/app/_content/lightbox/excerpts/generated.ts.
 *
 * TSX sources (app/_content/lightbox/excerpts/sources/):
 *   - Functions tagged `@docsExcerpt <id>` — return JSX (+ Lightbox import)
 *   - Line regions `// @docs-excerpt-start <id>` … `// @docs-excerpt-end`
 *
 * CSS sources (app/lightbox-demo/):
 *   - File header `@docsExcerpt` / `@docsExcerptTitle` — whole file body
 *   - Regions `/* @docs-excerpt-start <id> *\/` … `/* @docs-excerpt-end *\/`
 *
 *   pnpm --filter docs docs:excerpts          # write
 *   pnpm --filter docs docs:excerpts:check    # fail if stale
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  Node,
  Project,
  SyntaxKind,
  type FunctionDeclaration,
  type FunctionExpression,
  type JSDoc,
  type ArrowFunction,
} from 'ts-morph';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(__dirname, '..');
const sourcesDir = path.join(docsRoot, 'app/_content/lightbox/excerpts/sources');
const cssDemoDir = path.join(docsRoot, 'app/lightbox-demo');
const outFile = path.join(docsRoot, 'app/_content/lightbox/excerpts/generated.ts');

const TS_START_RE = /^\s*\/\/\s*@docs-excerpt-start\s+(\S+)\s*$/;
const TS_END_RE = /^\s*\/\/\s*@docs-excerpt-end\s*$/;
const TS_TITLE_RE = /^\s*\/\/\s*@docs-excerpt-title\s+(.+?)\s*$/;

const CSS_START_RE = /^\s*\/\*\s*@docs-excerpt-start\s+(\S+)\s*\*\/\s*$/;
const CSS_END_RE = /^\s*\/\*\s*@docs-excerpt-end\s*\*\/\s*$/;
const CSS_TITLE_RE = /^\s*\/\*\s*@docs-excerpt-title\s+(.+?)\s*\*\/\s*$/;

type Excerpt = {
  id: string;
  title: string;
  code: string;
  source: string;
};

/**
 * Dedent extracted source. ts-morph's `JsxElement#getText()` often omits leading
 * whitespace on the first line while keeping absolute indents on later lines —
 * so we compute the min indent from non-empty lines after the first when needed.
 */
function dedent(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, '').split('\n');
  if (lines.length === 0) return '\n';

  const firstHasIndent = /^\s/.test(lines[0] ?? '');
  const indentLines = lines.filter((l, i) => {
    if (!l.trim()) return false;
    if (!firstHasIndent && i === 0) return false;
    return true;
  });
  const indents = indentLines.map((l) => l.match(/^\s*/)?.[0].length ?? 0);
  const min = indents.length ? Math.min(...indents) : 0;

  return (
    lines
      .map((l, i) => {
        if (!l.trim()) return '';
        if (!firstHasIndent && i === 0) return l.trimStart();
        return l.slice(min);
      })
      .join('\n')
      .trim() + '\n'
  );
}

function jsDocTag(docs: JSDoc[], name: string): string | undefined {
  for (const doc of docs) {
    for (const tag of doc.getTags()) {
      if (tag.getTagName() === name) {
        return tag.getCommentText()?.trim();
      }
    }
  }
  return undefined;
}

function titleFromId(id: string): string {
  return id
    .split(/[-_]/)
    .map((w) => (w.length ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function unwrapReturnJsx(fn: FunctionDeclaration | FunctionExpression | ArrowFunction): string | undefined {
  const body = fn.getBody();
  if (!body) return undefined;

  if (Node.isBlock(body)) {
    const returns = body.getDescendantsOfKind(SyntaxKind.ReturnStatement);
    const topReturn = body.getStatements().find((s) => Node.isReturnStatement(s));
    const ret = topReturn && Node.isReturnStatement(topReturn) ? topReturn : returns[0];
    if (!ret || !Node.isReturnStatement(ret)) return undefined;
    const expr = ret.getExpression();
    if (!expr) return undefined;
    let text = expr.getText();
    if (Node.isParenthesizedExpression(expr)) {
      text = expr.getExpression().getText();
    }
    return dedent(text);
  }

  let text = body.getText();
  if (Node.isParenthesizedExpression(body)) {
    text = body.getExpression().getText();
  }
  return dedent(text);
}

function extractTaggedFunctions(filePath: string, sourceText: string): Excerpt[] {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { jsx: 4 /* ReactJSX */, target: 99, module: 99 },
  });
  const sf = project.createSourceFile(filePath, sourceText);
  const out: Excerpt[] = [];
  const rel = path.relative(docsRoot, filePath);

  const visitFn = (fn: FunctionDeclaration | FunctionExpression | ArrowFunction, docs: JSDoc[]) => {
    const id = jsDocTag(docs, 'docsExcerpt');
    if (!id) return;
    const jsx = unwrapReturnJsx(fn);
    if (!jsx) {
      throw new Error(`${rel}: @docsExcerpt ${id} — could not extract return JSX`);
    }
    const title = jsDocTag(docs, 'docsExcerptTitle') || titleFromId(id);
    const code = `import { Lightbox } from 'ramka';\n\n${jsx}`;
    out.push({ id, title, code: code.endsWith('\n') ? code : `${code}\n`, source: rel });
  };

  for (const fn of sf.getFunctions()) {
    visitFn(fn, fn.getJsDocs());
  }
  for (const decl of sf.getVariableDeclarations()) {
    const init = decl.getInitializer();
    if (!init) continue;
    const docs = decl.getVariableStatement()?.getJsDocs() ?? [];
    if (Node.isArrowFunction(init) || Node.isFunctionExpression(init)) {
      visitFn(init, docs);
    }
  }

  return out;
}

function extractLineRegions(
  filePath: string,
  sourceText: string,
  startRe: RegExp,
  endRe: RegExp,
  titleRe: RegExp,
): Excerpt[] {
  const lines = sourceText.replace(/\r\n/g, '\n').split('\n');
  const rel = path.relative(docsRoot, filePath);
  const out: Excerpt[] = [];
  let currentId: string | null = null;
  let buf: string[] = [];
  let titleOverride: string | null = null;

  for (const line of lines) {
    const start = line.match(startRe);
    if (start) {
      if (currentId) {
        throw new Error(`${rel}: nested @docs-excerpt-start (open: ${currentId})`);
      }
      currentId = start[1]!;
      buf = [];
      titleOverride = null;
      continue;
    }
    if (endRe.test(line)) {
      if (!currentId) {
        throw new Error(`${rel}: @docs-excerpt-end without start`);
      }
      const id = currentId;
      const code = dedent(buf.join('\n'));
      out.push({
        id,
        title: titleOverride || titleFromId(id),
        code: code.endsWith('\n') ? code : `${code}\n`,
        source: rel,
      });
      currentId = null;
      buf = [];
      continue;
    }
    if (currentId) {
      const titleMatch = line.match(titleRe);
      if (titleMatch) {
        titleOverride = titleMatch[1]!;
        continue;
      }
      buf.push(line);
    }
  }

  if (currentId) {
    throw new Error(`${rel}: unclosed @docs-excerpt-start ${currentId}`);
  }
  return out;
}

/** Whole-file CSS excerpt from a leading `/** … @docsExcerpt id … *\/` block. */
function extractCssFileExcerpt(filePath: string, sourceText: string): Excerpt | null {
  const rel = path.relative(docsRoot, filePath);
  const match = sourceText.match(/^\/\*\*([\s\S]*?)\*\//);
  if (!match) return null;
  const header = match[1] ?? '';
  const idMatch = header.match(/@docsExcerpt\s+(\S+)/);
  if (!idMatch) return null;
  const id = idMatch[1]!;
  const titleMatch = header.match(/@docsExcerptTitle\s+(.+)/);
  const title = titleMatch?.[1]?.trim() || titleFromId(id);
  const body = sourceText.slice(match[0].length);
  const code = dedent(body);
  return {
    id,
    title,
    code: code.endsWith('\n') ? code : `${code}\n`,
    source: rel,
  };
}

function collectFiles(dir: string, exts: string[]): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    if (name === 'index.css') continue; // barrel only
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...collectFiles(full, exts));
    else if (exts.some((ext) => name.endsWith(ext))) out.push(full);
  }
  return out.sort();
}

function serialize(excerpts: Excerpt[]): string {
  const sorted = [...excerpts].sort((a, b) => a.id.localeCompare(b.id));
  const ids = sorted.map((e) => e.id);
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) {
    const sources = sorted.filter((e) => e.id === dup).map((e) => e.source);
    throw new Error(`Duplicate excerpt id "${dup}" in: ${sources.join(', ')}`);
  }

  const entries = sorted
    .map((e) => {
      const codeLiteral = JSON.stringify(e.code);
      const titleLiteral = JSON.stringify(e.title);
      const sourceLiteral = JSON.stringify(e.source);
      return `  ${JSON.stringify(e.id)}: {\n    title: ${titleLiteral},\n    code: ${codeLiteral},\n    source: ${sourceLiteral},\n  }`;
    })
    .join(',\n');

  return `/**
 * AUTO-GENERATED by apps/docs/scripts/generate-excerpts.ts — do not edit.
 *   pnpm --filter docs docs:excerpts
 *   pnpm --filter docs docs:excerpts:check
 */

export type LightboxExcerpt = {
  title: string;
  code: string;
  /** Path relative to apps/docs/. */
  source: string;
};

export const lightboxExcerpts = {
${entries}
} as const satisfies Record<string, LightboxExcerpt>;

export type LightboxExcerptId = keyof typeof lightboxExcerpts;
`;
}

function main() {
  const check = process.argv.includes('--check');
  const tsFiles = collectFiles(sourcesDir, ['.ts', '.tsx']);
  const cssFiles = collectFiles(cssDemoDir, ['.css']);
  if (tsFiles.length === 0 && cssFiles.length === 0) {
    throw new Error(`No excerpt sources in ${sourcesDir} or ${cssDemoDir}`);
  }

  const excerpts: Excerpt[] = [];
  for (const file of tsFiles) {
    const text = fs.readFileSync(file, 'utf8');
    excerpts.push(...extractTaggedFunctions(file, text));
    excerpts.push(...extractLineRegions(file, text, TS_START_RE, TS_END_RE, TS_TITLE_RE));
  }
  for (const file of cssFiles) {
    const text = fs.readFileSync(file, 'utf8');
    const whole = extractCssFileExcerpt(file, text);
    if (whole) excerpts.push(whole);
    excerpts.push(...extractLineRegions(file, text, CSS_START_RE, CSS_END_RE, CSS_TITLE_RE));
  }

  if (excerpts.length === 0) {
    throw new Error('No @docsExcerpt tags or @docs-excerpt-start regions found');
  }

  const next = serialize(excerpts);
  if (check) {
    if (!fs.existsSync(outFile)) {
      console.error(`Missing ${outFile}. Run: pnpm --filter docs docs:excerpts`);
      process.exit(1);
    }
    const prev = fs.readFileSync(outFile, 'utf8');
    if (prev !== next) {
      console.error('Lightbox docs excerpts are stale.');
      console.error('Run: pnpm --filter docs docs:excerpts');
      process.exit(1);
    }
    console.log(`OK — ${excerpts.length} excerpt(s) up to date`);
    return;
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, next);
  console.log(`Wrote ${path.relative(docsRoot, outFile)} (${excerpts.length} excerpt(s))`);
}

main();
