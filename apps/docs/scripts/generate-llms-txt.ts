/**
 * Builds LLM-oriented markdown from the same sources as the HTML docs:
 *   - guide pages under app/(docs)/docs/**
 *   - generated API tables + part meta
 *   - generated code excerpts
 *   - nav / examples / presets registries
 *
 * Writes public/llms.txt (index), public/llms-full.txt (corpus), and a
 * `.md` twin for every catalogued page so /docs/lightbox.md stays in sync
 * with /docs/lightbox.
 *
 *   pnpm --filter docs docs:llms          # write
 *   pnpm --filter docs docs:llms:check    # fail if stale
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Node, Project, SyntaxKind, type CallExpression, type Expression, type SourceFile } from 'ts-morph';

import { lightboxExamples } from '../app/_components/examples';
import { lightboxPresets } from '../app/(docs)/presets/presets';
import {
  generatedAttributes,
  generatedCssVariables,
  generatedProps,
} from '../app/_content/lightbox/api/generated';
import {
  documentViewTransitionMeta,
  hooksApiMeta,
  imperativeApiMeta,
  lightboxApiMeta,
  type ApiPartMeta,
} from '../app/_content/lightbox/api/meta';
import type { AttrRow, CssVarRow, PropRow } from '../app/_content/lightbox/api/types';
import { lightboxApiHref, lightboxDocsPages, lightboxDocsPagerOrder } from '../app/_content/lightbox/docs-pages';
import { lightboxExcerpts } from '../app/_content/lightbox/excerpts/generated';
import { siteUrl } from '../app/_content/site';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(__dirname, '..');
const publicDir = path.join(docsRoot, 'public');
const docsPagesDir = path.join(docsRoot, 'app/(docs)/docs');

const GENERATED_NOTE =
  'Generated from the HTML docs sources. Do not edit by hand — run `pnpm docs:llms`.';

const SKIP_COMPONENTS = new Set([
  'DocsPager',
  'LightboxHeroDemo',
  'LightboxCrossfadeDemos',
  'LightboxMorphToDemos',
]);

type MdValue = string | number | boolean | null | MdValue[] | { [key: string]: MdValue };

type PageDoc = {
  href: string;
  title: string;
  description?: string;
  markdown: string;
};

type Ctx = {
  sourceFile: SourceFile;
  bindings: Map<string, MdValue>;
};

function unwrap(node: Node): Node {
  let current = node;
  while (
    Node.isAsExpression(current) ||
    Node.isParenthesizedExpression(current) ||
    Node.isSatisfiesExpression(current) ||
    Node.isNonNullExpression(current)
  ) {
    current = current.getExpression();
  }
  return current;
}

function decodeJsxText(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rdquo;/g, '\u201D')
    .replace(/&ldquo;/g, '\u201C')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&ndash;/g, '\u2013');
}

function collapseInline(text: string): string {
  return text.replace(/[ \t\n\r]+/g, ' ');
}

function cell(text: string): string {
  return collapseInline(text).replace(/\|/g, '\\|').trim();
}

function fence(code: string, lang = 'tsx', title?: string): string {
  const body = code.replace(/\n+$/, '');
  let ticks = '```';
  while (body.includes(ticks)) ticks += '`';
  const info = title ? `${lang} ${title}` : lang;
  return `${ticks}${info}\n${body}\n${ticks}`;
}

/**
 * Only these route trees get `.md` twins (see `hrefToPublicFile`). Pages outside
 * them — the licensing pages, for instance — have no Markdown mirror, so they
 * are linked absolutely rather than pointed at a file that does not exist.
 */
const mirroredRoutes = ['/docs', '/examples', '/presets'];

function toMdHref(href: string): string {
  if (!href) return href;
  if (/^https?:\/\//.test(href) || href.startsWith('mailto:')) return href;
  if (href.startsWith('#')) return href;
  const [pathname, hash] = href.split('#');
  const isMirrored = mirroredRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  if (!isMirrored) return `${siteUrl}${href}`;
  const trimmed = pathname.replace(/^\//, '').replace(/\/$/, '');
  const mdPath = trimmed.endsWith('.md') || trimmed.endsWith('.txt') ? trimmed : `${trimmed}.md`;
  return hash ? `${mdPath}#${hash}` : mdPath;
}

function normalizeMarkdown(text: string): string {
  return `${text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()}\n`;
}

function joinBlocks(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join('\n\n');
}

function joinInline(parts: Array<string | null | undefined>): string {
  let out = '';
  for (const part of parts) {
    if (!part) continue;
    const prev = out.slice(-1);
    const next = part[0] ?? '';
    const alreadySpaced = /\s$/.test(out) || /^\s/.test(part);
    const nextIsPunct = /[.,;:!?]/.test(next);
    const shouldSpace =
      !alreadySpaced &&
      !nextIsPunct &&
      /[\w*`)]$/.test(prev) &&
      (/[\w*\u2014\u2013/]/.test(next) || part.startsWith('['));
    if (shouldSpace) out += ' ';
    out += part;
  }
  return out.replace(/[ \t]{2,}/g, ' ').trim();
}

function jsxTextToInline(node: Node): string {
  if (!Node.isJsxText(node)) return '';
  const raw = decodeJsxText(node.getLiteralText());
  const mid = raw.trim().replace(/\s+/g, ' ');
  if (!mid) {
    return raw.includes(' ') && !raw.includes('\n') ? ' ' : '';
  }
  const punctOnly = /^[.,;:!?)]+$/.test(mid);
  const leading = !punctOnly && /^\s/.test(raw) ? ' ' : '';
  const trailing = /\s$/.test(raw) ? ' ' : '';
  return `${leading}${mid}${trailing}`;
}

function isSkippedName(name: string): boolean {
  if (name === 'DocsDemo') return false;
  return SKIP_COMPONENTS.has(name) || /Demo$/.test(name) || /Demos$/.test(name);
}

function elementName(node: Node): string | null {
  if (Node.isJsxElement(node)) return node.getOpeningElement().getTagNameNode().getText();
  if (Node.isJsxSelfClosingElement(node)) return node.getTagNameNode().getText();
  return null;
}

function getAttr(node: Node, name: string): Expression | undefined {
  const attrs = Node.isJsxElement(node)
    ? node.getOpeningElement().getAttributes()
    : Node.isJsxSelfClosingElement(node)
      ? node.getAttributes()
      : [];
  for (const attr of attrs) {
    if (!Node.isJsxAttribute(attr) || attr.getNameNode().getText() !== name) continue;
    const init = attr.getInitializer();
    if (!init) return undefined;
    if (Node.isStringLiteral(init) || Node.isNoSubstitutionTemplateLiteral(init)) return init;
    if (Node.isJsxExpression(init)) return init.getExpression();
  }
  return undefined;
}

function seedBindings(): Map<string, MdValue> {
  const bindings = new Map<string, MdValue>();
  const excerpts: Record<string, MdValue> = {};
  for (const [id, excerpt] of Object.entries(lightboxExcerpts)) {
    excerpts[id] = { title: excerpt.title, code: excerpt.code, source: excerpt.source };
  }
  bindings.set('lightboxExcerpts', excerpts);

  const pages: Record<string, MdValue> = {};
  for (const [key, page] of Object.entries(lightboxDocsPages)) {
    pages[key] = { href: page.href, title: page.title };
  }
  bindings.set('lightboxDocsPages', pages);
  bindings.set('lightboxApiHref', { ...lightboxApiHref });

  bindings.set('lightboxApiParts', lightboxApiMeta.map(partToValue));
  bindings.set('documentViewTransitionApi', partToValue(documentViewTransitionMeta));
  bindings.set('hooksApi', hooksApiMeta.map(partToValue));
  bindings.set('imperativeApi', imperativeApiMeta.map(partToValue));
  return bindings;
}

function partToValue(part: ApiPartMeta): MdValue {
  return {
    id: part.id,
    name: part.name,
    description: part.description,
    props: (generatedProps[part.id] ?? []) as unknown as MdValue,
    attributes: (generatedAttributes[part.id] ?? []) as unknown as MdValue,
    cssVariables: (generatedCssVariables[part.id] ?? []) as unknown as MdValue,
  };
}

function collectFileBindings(sourceFile: SourceFile, seeded: Map<string, MdValue>): Map<string, MdValue> {
  const bindings = new Map(seeded);
  const ctx: Ctx = { sourceFile, bindings };

  for (const statement of sourceFile.getVariableStatements()) {
    for (const decl of statement.getDeclarations()) {
      const name = decl.getName();
      const init = decl.getInitializer();
      if (!init) continue;
      try {
        bindings.set(name, evalExpr(init, ctx));
      } catch {
        // Skip locals we cannot evaluate (typed React nodes we handle later via JSX).
      }
    }
  }
  return bindings;
}

function evalExpr(node: Node | undefined, ctx: Ctx): MdValue {
  if (!node) return null;
  const inner = unwrap(node);

  if (Node.isStringLiteral(inner) || Node.isNoSubstitutionTemplateLiteral(inner)) {
    return inner.getLiteralValue();
  }
  if (Node.isNumericLiteral(inner)) return inner.getLiteralValue();
  if (Node.isTrueLiteral(inner)) return true;
  if (Node.isFalseLiteral(inner)) return false;
  if (Node.isNullLiteral(inner)) return null;
  if (Node.isIdentifier(inner)) {
    const name = inner.getText();
    if (ctx.bindings.has(name)) return ctx.bindings.get(name) ?? null;
    return null;
  }
  if (Node.isTemplateExpression(inner)) {
    let out = inner.getHead().getLiteralText();
    for (const span of inner.getTemplateSpans()) {
      const value = evalExpr(span.getExpression(), ctx);
      out += value == null ? '' : String(value);
      out += span.getLiteral().getLiteralText();
    }
    return out;
  }
  if (Node.isPropertyAccessExpression(inner)) {
    const obj = evalExpr(inner.getExpression(), ctx);
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      return obj[inner.getName()] ?? null;
    }
    return null;
  }
  if (Node.isElementAccessExpression(inner)) {
    const obj = evalExpr(inner.getExpression(), ctx);
    const key = evalExpr(inner.getArgumentExpression(), ctx);
    if (obj && typeof obj === 'object' && !Array.isArray(obj) && (typeof key === 'string' || typeof key === 'number')) {
      return obj[key] ?? null;
    }
    return null;
  }
  if (Node.isArrayLiteralExpression(inner)) {
    return inner.getElements().map((el) => evalExpr(el, ctx));
  }
  if (Node.isObjectLiteralExpression(inner)) {
    const obj: Record<string, MdValue> = {};
    for (const prop of inner.getProperties()) {
      if (Node.isPropertyAssignment(prop)) {
        const name = prop.getName();
        obj[name] = evalExpr(prop.getInitializer(), ctx);
      } else if (Node.isShorthandPropertyAssignment(prop)) {
        obj[prop.getName()] = evalExpr(prop.getNameNode(), ctx);
      }
    }
    return obj;
  }
  if (Node.isJsxElement(inner) || Node.isJsxSelfClosingElement(inner) || Node.isJsxFragment(inner)) {
    return jsxToMarkdown(inner, ctx);
  }
  if (Node.isPrefixUnaryExpression(inner) && inner.getOperatorToken() === SyntaxKind.MinusToken) {
    const value = evalExpr(inner.getOperand(), ctx);
    return typeof value === 'number' ? -value : null;
  }
  return null;
}

function evalAttr(node: Node, name: string, ctx: Ctx): MdValue {
  return evalExpr(getAttr(node, name), ctx);
}

function childrenOf(node: Node): Node[] {
  if (Node.isJsxElement(node)) return node.getJsxChildren();
  if (Node.isJsxFragment(node)) return node.getJsxChildren();
  return [];
}

function jsxChildrenToInline(nodes: Node[], ctx: Ctx): string {
  return joinInline(nodes.map((child) => jsxToInline(child, ctx)));
}

function jsxChildrenToBlocks(nodes: Node[], ctx: Ctx): string {
  return joinBlocks(nodes.map((child) => jsxToMarkdown(child, ctx)));
}

function jsxToInline(node: Node, ctx: Ctx): string {
  if (Node.isJsxText(node)) return jsxTextToInline(node);
  if (Node.isJsxExpression(node)) {
    const expr = node.getExpression();
    if (!expr) return '';
    if (Node.isJsxElement(expr) || Node.isJsxSelfClosingElement(expr) || Node.isJsxFragment(expr)) {
      return jsxToInline(expr, ctx);
    }
    if (Node.isCallExpression(expr) && isMapCall(expr)) {
      return eachMapItem(expr, ctx, (item) => jsxToInline(item, ctx))
        .filter(Boolean)
        .join(', ');
    }
    const value = evalExpr(expr, ctx);
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return '';
  }
  if (Node.isJsxFragment(node)) return jsxChildrenToInline(childrenOf(node), ctx);

  const name = elementName(node);
  if (!name || isSkippedName(name)) return '';

  if (name === 'code') {
    const text = jsxChildrenToInline(childrenOf(node), ctx);
    return text ? `\`${text.replace(/`/g, '\\`')}\`` : '';
  }
  if (name === 'strong' || name === 'b') {
    const text = jsxChildrenToInline(childrenOf(node), ctx);
    return text ? `**${text}**` : '';
  }
  if (name === 'em' || name === 'i') {
    const text = jsxChildrenToInline(childrenOf(node), ctx);
    return text ? `*${text}*` : '';
  }
  if (name === 'br') return ' ';
  if (name === 'DocsLink' || name === 'Link' || name === 'a' || name === 'ExternalLink') {
    const href = String(evalAttr(node, 'href', ctx) ?? '');
    const kids = childrenOf(node);
    const blocks = kids.filter((child) => {
      const childName = elementName(child);
      return childName === 'div' || childName === 'p';
    });
    if (blocks.length >= 2) {
      const title = jsxToInline(blocks[0]!, ctx);
      const description = jsxToInline(blocks[1]!, ctx);
      const link = href ? `[${title}](${toMdHref(href)})` : title;
      return description ? `${link}: ${description}` : link;
    }
    const text = jsxChildrenToInline(kids, ctx) || href;
    return href ? `[${text}](${toMdHref(href)})` : text;
  }
  if (name === 'PropSectionTitle') {
    const part = String(evalAttr(node, 'part', ctx) ?? '');
    const prop = String(evalAttr(node, 'prop', ctx) ?? '');
    return [part, prop].filter(Boolean).join(' ');
  }
  if (name === 'span' || name === 'div') return jsxChildrenToInline(childrenOf(node), ctx);
  return jsxChildrenToInline(childrenOf(node), ctx);
}

function renderListItem(item: Node, marker: string, ctx: Ctx): string {
  const kids = childrenOf(item);
  const divs = kids.filter((child) => elementName(child) === 'div');
  if (divs.length >= 2) {
    const label = jsxToInline(divs[0]!, ctx);
    const rest = jsxToInline(divs[1]!, ctx);
    return `${marker} **${label}**: ${rest}`;
  }
  const inline = jsxChildrenToInline(kids, ctx);
  return `${marker} ${inline.replace(/\n/g, '\n  ')}`;
}

function renderList(node: Node, ordered: boolean, ctx: Ctx): string {
  const lines: string[] = [];
  let index = 0;
  const pushItem = (item: Node) => {
    const marker = ordered ? `${++index}.` : '-';
    lines.push(renderListItem(item, marker, ctx));
  };
  for (const child of childrenOf(node)) {
    if (elementName(child) === 'li') {
      pushItem(child);
      continue;
    }
    if (Node.isJsxExpression(child)) {
      const expr = child.getExpression();
      if (expr && Node.isCallExpression(expr) && isMapCall(expr)) {
        eachMapItem(expr, ctx, (item) => {
          if (elementName(item) === 'li') pushItem(item);
        });
      }
    }
  }
  return lines.join('\n');
}

function renderTable(node: Node, ctx: Ctx): string {
  const mappedRows = collectMappedRows(node, ctx);
  if (mappedRows.length) {
    const header = collectHeaderRow(node, ctx);
    return formatTable(header ? [header, ...mappedRows] : mappedRows);
  }

  const rows: string[][] = [];
  const walk = (current: Node) => {
    if (elementName(current) === 'tr') {
      const cells = childrenOf(current)
        .filter((child) => elementName(child) === 'th' || elementName(child) === 'td')
        .map((child) => cell(jsxToInline(child, ctx) || jsxToMarkdown(child, ctx)));
      if (cells.length) rows.push(cells);
      return;
    }
    for (const child of childrenOf(current)) walk(child);
  };
  walk(node);
  return formatTable(rows);
}

function collectHeaderRow(node: Node, ctx: Ctx): string[] | null {
  const thead = findElement(node, 'thead');
  if (!thead) return null;
  const tr = findElement(thead, 'tr');
  if (!tr) return null;
  const cells = childrenOf(tr)
    .filter((child) => elementName(child) === 'th' || elementName(child) === 'td')
    .map((child) => cell(jsxToInline(child, ctx)));
  return cells.length ? cells : null;
}

function collectMappedRows(node: Node, ctx: Ctx): string[][] {
  const rows: string[][] = [];
  const visit = (current: Node) => {
    if (Node.isJsxExpression(current)) {
      const expr = current.getExpression();
      if (expr && Node.isCallExpression(expr) && isMapCall(expr)) {
        rows.push(
          ...eachMapItem(expr, ctx, (item) => {
            if (!Node.isJsxElement(item) && !Node.isJsxSelfClosingElement(item) && !Node.isJsxFragment(item)) {
              return [];
            }
            const tr = elementName(item) === 'tr' ? item : findElement(item, 'tr') ?? item;
            const cells = childrenOf(tr)
              .filter((child) => elementName(child) === 'th' || elementName(child) === 'td')
              .map((child) => cell(jsxToInline(child, ctx) || jsxToMarkdown(child, ctx)));
            return cells.length ? [cells] : [];
          }).flat(),
        );
        return;
      }
    }
    for (const child of childrenOf(current)) visit(child);
  };
  visit(node);
  return rows;
}

function findElement(node: Node, tag: string): Node | undefined {
  if (elementName(node) === tag) return node;
  for (const child of childrenOf(node)) {
    const found = findElement(child, tag);
    if (found) return found;
  }
  return undefined;
}

function formatTable(rows: string[][]): string {
  if (rows.length === 0) return '';
  const width = Math.max(...rows.map((row) => row.length));
  const padded = rows.map((row) => [...row, ...Array.from({ length: width - row.length }, () => '')]);
  const header = padded[0];
  const body = padded.slice(1);
  if (body.length > 0 && body.every((row) => row.every((value) => value.trim() === ''))) {
    throw new Error(`Table "${header.join(' | ')}" has ${body.length} empty body row(s)`);
  }
  const sep = header.map(() => '---');
  return [header, sep, ...body].map((row) => `| ${row.join(' | ')} |`).join('\n');
}

function isMapCall(expr: CallExpression): boolean {
  const callee = expr.getExpression();
  return Node.isPropertyAccessExpression(callee) && callee.getName() === 'map';
}

function mapBodyNode(fn: Node): Node | undefined {
  const body = Node.isArrowFunction(fn) || Node.isFunctionExpression(fn) ? fn.getBody() : undefined;
  if (!body) return undefined;
  if (Node.isBlock(body)) {
    const ret = body.getStatements().find((s) => Node.isReturnStatement(s));
    return ret && Node.isReturnStatement(ret) ? ret.getExpression() : undefined;
  }
  return body;
}

function eachMapItem<T>(expr: CallExpression, ctx: Ctx, fn: (body: Node) => T): T[] {
  if (!isMapCall(expr)) return [];
  const callee = expr.getExpression();
  if (!Node.isPropertyAccessExpression(callee)) return [];
  const listExpr = callee.getExpression();
  const list = evalExpr(listExpr, ctx);
  const mapper = expr.getArguments()[0];
  const body = mapper ? mapBodyNode(mapper) : undefined;
  if (!Array.isArray(list)) {
    throw new Error(
      `Could not evaluate ${listExpr.getText()}.map(...) in ${ctx.sourceFile.getFilePath()}`,
    );
  }
  if (!mapper || !body) return [];

  const params = Node.isArrowFunction(mapper) || Node.isFunctionExpression(mapper) ? mapper.getParameters() : [];
  const itemParam = params[0]?.getName();
  const indexParam = params[1]?.getName();
  const results: T[] = [];
  list.forEach((item, index) => {
    if (itemParam) ctx.bindings.set(itemParam, item);
    if (indexParam) ctx.bindings.set(indexParam, index);
    results.push(fn(unwrap(body)));
  });
  if (itemParam) ctx.bindings.delete(itemParam);
  if (indexParam) ctx.bindings.delete(indexParam);
  return results;
}

function renderApiPart(part: MdValue): string {
  if (!part || typeof part !== 'object' || Array.isArray(part)) return '';
  const name = String(part.name ?? '');
  const description = String(part.description ?? '');
  const props = Array.isArray(part.props) ? (part.props as unknown as PropRow[]) : [];
  const attributes = Array.isArray(part.attributes) ? (part.attributes as unknown as AttrRow[]) : [];
  const cssVariables = Array.isArray(part.cssVariables)
    ? (part.cssVariables as unknown as CssVarRow[])
    : [];

  const blocks = [`### ${name}`, description];
  if (props.length) {
    blocks.push(
      '#### Props',
      formatTable([
        ['Name', 'Type', 'Default', 'Description'],
        ...props.map((row) => [
          cell(row.name),
          cell(row.type ? `\`${row.type}\`` : ''),
          cell(row.default ? `\`${row.default}\`` : ''),
          cell(row.description),
        ]),
      ]),
    );
  }
  if (attributes.length) {
    blocks.push(
      '#### Data attributes',
      formatTable([
        ['Name', 'Description'],
        ...attributes.map((row) => [cell(`\`${row.name}\``), cell(row.description)]),
      ]),
    );
  }
  if (cssVariables.length) {
    blocks.push(
      '#### CSS variables',
      formatTable([
        ['Name', 'Type', 'Description'],
        ...cssVariables.map((row) => [
          cell(`\`${row.name}\``),
          cell(row.type ? `\`${row.type}\`` : ''),
          cell(row.description),
        ]),
      ]),
    );
  }
  return joinBlocks(blocks);
}

function jsxToMarkdown(node: Node, ctx: Ctx): string {
  if (Node.isJsxText(node)) {
    const text = collapseInline(decodeJsxText(node.getText())).trim();
    return text;
  }
  if (Node.isJsxExpression(node)) {
    const expr = node.getExpression();
    if (!expr) return '';
    if (Node.isJsxElement(expr) || Node.isJsxSelfClosingElement(expr) || Node.isJsxFragment(expr)) {
      return jsxToMarkdown(expr, ctx);
    }
    if (Node.isCallExpression(expr) && isMapCall(expr)) {
      return joinBlocks(eachMapItem(expr, ctx, (item) => jsxToMarkdown(item, ctx)));
    }
    if (Node.isConditionalExpression(expr)) {
      const condition = expr.getCondition().getText();
      if (condition.includes('process.env')) return '';
      return jsxToMarkdown(expr.getWhenTrue(), ctx) || String(evalExpr(expr.getWhenTrue(), ctx) ?? '');
    }
    const value = evalExpr(expr, ctx);
    if (typeof value === 'string') return value;
    return '';
  }
  if (Node.isJsxFragment(node)) return jsxChildrenToBlocks(childrenOf(node), ctx);

  const name = elementName(node);
  if (!name) return '';
  if (isSkippedName(name)) return '';

  if (name === 'DocsShell' || name === 'ExampleShell') {
    const title = String(evalAttr(node, 'title', ctx) ?? '');
    const descriptionExpr = getAttr(node, 'description');
    const description = descriptionExpr
      ? Node.isJsxElement(descriptionExpr) ||
        Node.isJsxSelfClosingElement(descriptionExpr) ||
        Node.isJsxFragment(descriptionExpr)
        ? jsxToInline(descriptionExpr, ctx)
        : String(evalExpr(descriptionExpr, ctx) ?? jsxExprToInline(descriptionExpr, ctx))
      : '';
    return joinBlocks([
      title ? `# ${title}` : '',
      description,
      name === 'DocsShell' ? jsxChildrenToBlocks(childrenOf(node), ctx) : '',
    ]);
  }

  if (name === 'DocsSection') {
    const level = Number(evalAttr(node, 'level', ctx) ?? 2);
    const titleExpr = getAttr(node, 'title');
    const title = titleExpr
      ? Node.isJsxElement(titleExpr) ||
        Node.isJsxSelfClosingElement(titleExpr) ||
        Node.isJsxFragment(titleExpr)
        ? jsxToInline(titleExpr, ctx)
        : String(evalExpr(titleExpr, ctx) ?? jsxExprToInline(titleExpr, ctx))
      : '';
    const heading = title ? `${'#'.repeat(Math.min(Math.max(level, 2), 6))} ${title}` : '';
    return joinBlocks([heading, jsxChildrenToBlocks(childrenOf(node), ctx)]);
  }

  if (name === 'ApiPartSection') {
    const part = evalAttr(node, 'part', ctx);
    return renderApiPart(part);
  }

  if (name === 'CodeBlock' || name === 'DocsDemo') {
    const code = String(evalAttr(node, 'code', ctx) ?? '');
    const title = String(evalAttr(node, 'title', ctx) ?? '');
    const lang = String(evalAttr(node, 'lang', ctx) ?? 'tsx');
    return code ? fence(code, lang, title || undefined) : '';
  }

  if (name === 'p') {
    const text = jsxChildrenToInline(childrenOf(node), ctx);
    if (text === 'Getting started') return '';
    return text;
  }
  if (name === 'ul') return renderList(node, false, ctx);
  if (name === 'ol') return renderList(node, true, ctx);
  if (name === 'li') return jsxChildrenToInline(childrenOf(node), ctx);
  if (name === 'h1' || name === 'h2' || name === 'h3' || name === 'h4') {
    const level = Number(name[1]);
    const text = jsxChildrenToInline(childrenOf(node), ctx);
    return text ? `${'#'.repeat(level)} ${text}` : '';
  }
  if (name === 'pre') {
    const codeChild = findElement(node, 'code');
    const raw = codeChild
      ? childrenOf(codeChild)
          .map((child) => {
            if (Node.isJsxText(child)) return decodeJsxText(child.getText());
            if (Node.isJsxExpression(child)) {
              const value = evalExpr(child.getExpression(), ctx);
              return value == null ? '' : String(value);
            }
            return '';
          })
          .join('')
      : jsxChildrenToInline(childrenOf(node), ctx);
    return raw ? fence(raw, 'css') : '';
  }
  if (name === 'table') return renderTable(node, ctx);
  if (name === 'code' || name === 'strong' || name === 'em' || name === 'b' || name === 'i') {
    return jsxToInline(node, ctx);
  }
  if (name === 'DocsLink' || name === 'Link' || name === 'a' || name === 'ExternalLink') {
    return jsxToInline(node, ctx);
  }

  // Wrappers (div, section, aside, header, …) — keep block children.
  return jsxChildrenToBlocks(childrenOf(node), ctx);
}

function jsxExprToInline(expr: Expression, ctx: Ctx): string {
  if (Node.isJsxElement(expr) || Node.isJsxSelfClosingElement(expr) || Node.isJsxFragment(expr)) {
    return jsxToInline(expr, ctx);
  }
  const value = evalExpr(expr, ctx);
  return value == null ? '' : String(value);
}

function findDefaultReturn(sourceFile: SourceFile): Node | undefined {
  const fn = sourceFile.getFunctions().find((f) => f.isDefaultExport());
  if (fn) {
    const ret = fn.getDescendantsOfKind(SyntaxKind.ReturnStatement)[0];
    return ret?.getExpression();
  }
  const decl = sourceFile.getVariableDeclarations().find((d) => {
    const stmt = d.getVariableStatement();
    return stmt?.isDefaultExport();
  });
  const init = decl?.getInitializer();
  if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
    const body = init.getBody();
    if (Node.isBlock(body)) {
      const ret = body.getDescendantsOfKind(SyntaxKind.ReturnStatement)[0];
      return ret?.getExpression();
    }
    return body;
  }
  return undefined;
}

function extractPageMarkdown(filePath: string, seeded: Map<string, MdValue>): string {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { jsx: 4, target: 99, module: 99 },
  });
  const sourceFile = project.addSourceFileAtPath(filePath);
  const bindings = collectFileBindings(sourceFile, seeded);
  const ctx: Ctx = { sourceFile, bindings };
  const ret = findDefaultReturn(sourceFile);
  if (!ret) {
    throw new Error(`No default-export return JSX in ${filePath}`);
  }
  const markdown = jsxToMarkdown(unwrap(ret), ctx);
  if (markdown.trim().length < 40) {
    throw new Error(`Extracted markdown too short from ${filePath}`);
  }
  return normalizeMarkdown(markdown);
}

function hrefToPublicFile(href: string): string {
  const trimmed = href.replace(/^\//, '').replace(/\/$/, '');
  return path.join(publicDir, `${trimmed}.md`);
}

function langFromName(name: string): string {
  if (name.endsWith('.css')) return 'css';
  if (name.endsWith('.json')) return 'json';
  if (name.endsWith('.ts')) return 'ts';
  return 'tsx';
}

function collectReferencedSources(pageFile: string): string[] {
  const text = fs.readFileSync(pageFile, 'utf8');
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const match of text.matchAll(/path:\s*'([^']+)'/g)) {
    const rel = match[1];
    if (seen.has(rel)) continue;
    seen.add(rel);
    paths.push(rel);
  }
  return paths;
}

function sourceBlocks(relPaths: string[]): string {
  return joinBlocks(
    relPaths.map((rel) => {
      const abs = path.join(docsRoot, rel);
      if (!fs.existsSync(abs)) {
        throw new Error(`Missing source referenced by docs page: ${rel}`);
      }
      const name = path.basename(rel);
      const label = rel.replace(/^app\/\(docs\)\//, '');
      return fence(fs.readFileSync(abs, 'utf8'), langFromName(name), label);
    }),
  );
}

function compositionPage(
  title: string,
  description: string,
  href: string,
  pageFile: string,
  extraFiles: string[] = [],
  extractIntro = true,
): PageDoc {
  let intro = joinBlocks([`# ${title}`, description]);
  if (extractIntro) {
    try {
      intro = extractPageMarkdown(pageFile, seedBindings());
    } catch {
      // Fall back to the registry blurb when the page is a live demo, not docs prose.
    }
  }
  const referenced = collectReferencedSources(pageFile);
  const files = [...referenced, ...extraFiles.filter((file) => !referenced.includes(file))];
  const sources = files.length ? joinBlocks(['## Source', sourceBlocks(files)]) : '';
  return {
    href,
    title,
    description,
    markdown: normalizeMarkdown(joinBlocks([intro, sources])),
  };
}

function buildIndex(pages: PageDoc[]): string {
  const byHref = new Map(pages.map((page) => [page.href, page]));
  const link = (href: string, title: string, description?: string) => {
    const md = toMdHref(href);
    return description ? `- [${title}](${md}): ${description}` : `- [${title}](${md})`;
  };

  const gettingStarted = [link('/docs', 'Installation', 'Install ramka and a minimal Root + Slides setup.')];
  const lightbox = lightboxDocsPagerOrder.map((page) =>
    link(page.href, page.title, byHref.get(page.href)?.description),
  );
  const presets = lightboxPresets.map((page) => link(page.href, page.title, page.description));
  const examples = lightboxExamples.map((ex) =>
    link(`/examples/lightbox/${ex.slug}`, ex.title, ex.description),
  );

  return normalizeMarkdown(
    joinBlocks([
      '# ramka',
      '> Unstyled, accessible lightbox primitives for React — in the style of Radix UI and Base UI.',
      GENERATED_NOTE,
      'Compose a fullscreen media lightbox from headless parts: view-transition morph by default, swipe slides, zoom, and pull-to-dismiss. You own colors and chrome; ramka owns state, focus, gestures, and structural styles those mechanics need.',
      '## Docs',
      gettingStarted.join('\n'),
      '## Lightbox',
      lightbox.join('\n'),
      '## Presets',
      presets.join('\n'),
      '## Examples',
      examples.join('\n'),
      '## Optional',
      [
        '- [Full documentation](llms-full.txt): every guide, API table, and code excerpt in one file',
        '- [GitHub](https://github.com/arturbien/ramka)',
      ].join('\n'),
    ]),
  );
}

function buildFull(pages: PageDoc[]): string {
  const parts = [
    '# ramka',
    '> Unstyled, accessible lightbox primitives for React — in the style of Radix UI and Base UI.',
    GENERATED_NOTE,
    ...pages.map((page) => {
      const body = page.markdown.replace(/^# .+\n+/, '');
      return joinBlocks([`# ${page.title}`, body]);
    }),
  ];
  return normalizeMarkdown(joinBlocks(parts));
}

function collectOutputs(): Map<string, string> {
  const seeded = seedBindings();

  const guideFiles: { href: string; title: string; file: string }[] = [
    { href: '/docs', title: 'Installation', file: path.join(docsPagesDir, 'page.tsx') },
    { href: lightboxDocsPages.overview.href, title: 'Lightbox', file: path.join(docsPagesDir, 'lightbox/page.tsx') },
    {
      href: lightboxDocsPages.stateLifecycle.href,
      title: lightboxDocsPages.stateLifecycle.title,
      file: path.join(docsPagesDir, 'lightbox/state-lifecycle/page.tsx'),
    },
    {
      href: lightboxDocsPages.composition.href,
      title: lightboxDocsPages.composition.title,
      file: path.join(docsPagesDir, 'lightbox/composition/page.tsx'),
    },
    {
      href: lightboxDocsPages.nextjsImage.href,
      title: lightboxDocsPages.nextjsImage.title,
      file: path.join(docsPagesDir, 'lightbox/nextjs-image/page.tsx'),
    },
    {
      href: lightboxDocsPages.viewTransitions.href,
      title: lightboxDocsPages.viewTransitions.title,
      file: path.join(docsPagesDir, 'lightbox/view-transitions/page.tsx'),
    },
    {
      href: lightboxDocsPages.gestures.href,
      title: lightboxDocsPages.gestures.title,
      file: path.join(docsPagesDir, 'lightbox/gestures/page.tsx'),
    },
    {
      href: lightboxDocsPages.zoom.href,
      title: lightboxDocsPages.zoom.title,
      file: path.join(docsPagesDir, 'lightbox/zoom/page.tsx'),
    },
    {
      href: lightboxDocsPages.rtl.href,
      title: lightboxDocsPages.rtl.title,
      file: path.join(docsPagesDir, 'lightbox/rtl/page.tsx'),
    },
    {
      href: lightboxDocsPages.api.href,
      title: lightboxDocsPages.api.title,
      file: path.join(docsPagesDir, 'lightbox/api/page.tsx'),
    },
  ];

  const pages: PageDoc[] = guideFiles.map((guide) => {
    const markdown = extractPageMarkdown(guide.file, seeded);
    const description = markdown
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith('#') && !line.startsWith('>') && !line.startsWith('```'));
    return { href: guide.href, title: guide.title, description, markdown };
  });

  for (const preset of lightboxPresets) {
    const slug = preset.href.replace('/presets/', '');
    const pageFile = path.join(docsRoot, `app/(docs)/presets/${slug}/page.tsx`);
    pages.push(compositionPage(preset.title, preset.description, preset.href, pageFile));
  }
  for (const example of lightboxExamples) {
    const href = `/examples/lightbox/${example.slug}`;
    const baseDir = 'app/(docs)/examples/lightbox';
    const pageRel = `${baseDir}/${example.pagePath ?? `${example.slug}/page.tsx`}`;
    // `extraSources` are app-rooted (not examples-dir-rooted) so an example
    // can embed load-bearing files outside the (docs) tree — e.g. moodboard's
    // SSR CSS under app/lightbox-demo/.
    const extraFiles = [pageRel, ...(example.extraSources ?? []).map((rel) => `app/${rel}`)];
    pages.push(
      compositionPage(example.title, example.description, href, path.join(docsRoot, pageRel), extraFiles, false),
    );
  }

  const outputs = new Map<string, string>();
  outputs.set(path.join(publicDir, 'llms.txt'), buildIndex(pages));
  outputs.set(path.join(publicDir, 'llms-full.txt'), buildFull(pages));
  for (const page of pages) {
    outputs.set(hrefToPublicFile(page.href), page.markdown);
  }
  return outputs;
}

function main() {
  const check = process.argv.includes('--check');
  const outputs = collectOutputs();

  if (check) {
    let stale = false;
    for (const [file, next] of outputs) {
      if (!fs.existsSync(file)) {
        console.error(`Missing ${path.relative(docsRoot, file)}. Run: pnpm --filter docs docs:llms`);
        stale = true;
        continue;
      }
      const prev = fs.readFileSync(file, 'utf8');
      if (prev !== next) {
        console.error(`Stale ${path.relative(docsRoot, file)}`);
        stale = true;
      }
    }
    if (stale) {
      console.error('LLM docs are out of date with the HTML docs.');
      console.error('Run: pnpm --filter docs docs:llms');
      process.exit(1);
    }
    console.log(`OK — ${outputs.size} LLM doc file(s) up to date`);
    return;
  }

  for (const [file, next] of outputs) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, next);
    console.log(`Wrote ${path.relative(docsRoot, file)}`);
  }
}

main();
