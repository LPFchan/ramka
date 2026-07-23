/**
 * Extracts Lightbox API tables from package TypeScript + JSDoc and writes
 * apps/docs/app/_content/lightbox/api/generated.ts:
 *
 *   - props / members / hook returns from interfaces & functions
 *   - data attributes from `*DataAttributes` enums
 *   - CSS variables from `*CssVars` enums (`@type` → Type column)
 *
 *   pnpm --filter docs docs:api          # write
 *   pnpm --filter docs docs:api:check    # fail if stale
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  Node,
  Project,
  TypeFormatFlags,
  type InterfaceDeclaration,
  type JSDoc,
  type PropertySignature,
  type Symbol as MorphSymbol,
  type Type,
} from 'ts-morph';

import {
  documentViewTransitionMeta,
  hooksApiMeta,
  imperativeApiMeta,
  lightboxApiMeta,
  type ApiPartMeta,
  type EnumExtract,
  type ExtractSpec,
} from '../app/_content/lightbox/api/meta';
import type { AttrRow, CssVarRow, PropRow } from '../app/_content/lightbox/api/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(docsRoot, '../..');
const lightboxSrc = path.join(repoRoot, 'packages/ramka/src/lightbox');
const ramkaTsconfig = path.join(repoRoot, 'packages/ramka/tsconfig.json');
const outFile = path.join(docsRoot, 'app/_content/lightbox/api/generated.ts');

const TYPE_FORMAT =
  TypeFormatFlags.NoTruncation | TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;

const project = new Project({
  tsConfigFilePath: ramkaTsconfig,
  skipAddingFilesFromTsConfig: false,
});

function cleanTypeText(text: string): string {
  return text
    .replace(/import\("[^"]+"\)\./g, '')
    .replace(/\bReact\.(ReactNode|ReactElement|ElementType|ComponentPropsWithRef|Ref)/g, '$1')
    .replace(/\s*\|\s*undefined\b/g, '')
    .replace(/\bundefined\s*\|\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Prefer the author-written type node (keeps `React.ReactNode`, `LightboxCrossfade`,
 * etc. readable). Fall back to the checker only when there is no type node
 * (inherited props like Base UI `render`).
 */
function expandStringLiteralAliasDecl(aliasDecl: Node | undefined): string | undefined {
  if (!aliasDecl || !Node.isTypeAliasDeclaration(aliasDecl)) return undefined;
  const aliasType = aliasDecl.getType().getNonNullableType();
  if (!aliasType.isUnion() || !aliasType.getUnionTypes().every((u) => u.isStringLiteral())) {
    return undefined;
  }
  // Prefer the alias's type node text — checker getText() often reprints the alias name.
  const typeNode = aliasDecl.getTypeNode();
  if (typeNode) return cleanTypeText(typeNode.getText());
  return cleanTypeText(
    aliasType
      .getUnionTypes()
      .map((u) => u.getText())
      .join(' | '),
  );
}

function typeTextForDeclaration(
  decl: Node | undefined,
  type: Type,
  propName?: string,
): string {
  // Inherited Base UI `render` prints as a huge generic — keep a stable short form.
  if (propName === 'render') {
    return 'ReactElement | ComponentRenderFn';
  }

  if (decl && (Node.isPropertySignature(decl) || Node.isMethodSignature(decl))) {
    const typeNode = decl.getTypeNode();
    if (typeNode) {
      // Resolve `LightboxCrossfade`-style aliases from the same source file.
      // (TS often eagerly resolves literal aliases, so getAliasSymbol is unreliable.)
      const refName = typeNode.getText().trim();
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(refName)) {
        const localAlias = decl.getSourceFile().getTypeAlias(refName);
        const expanded = expandStringLiteralAliasDecl(localAlias);
        if (expanded) return expanded;
      }
      return cleanTypeText(typeNode.getText());
    }
  }

  const alias = type.getNonNullableType().getAliasSymbol()?.getDeclarations()[0];
  const expanded = expandStringLiteralAliasDecl(alias);
  if (expanded) return expanded;

  return cleanTypeText(type.getNonNullableType().getText(decl, TYPE_FORMAT));
}

/**
 * Preserve JSDoc structure for the docs renderer: paragraphs (blank lines),
 * bullet lists (`- …`), and soft-wrapped prose lines joined with spaces.
 */
function normalizeJsDocDescription(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').trim().split('\n');
  const out: string[] = [];
  let para: string[] = [];
  let list: string[] | null = null;

  const flushPara = () => {
    if (para.length === 0) return;
    out.push(para.join(' ').replace(/\s+/g, ' ').trim());
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    out.push(list.join('\n'));
    list = null;
  };

  for (const line of lines) {
    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch) {
      flushPara();
      if (!list) list = [];
      list.push(`- ${listMatch[1].trim()}`);
      continue;
    }
    if (list && /^\s+\S/.test(line)) {
      list[list.length - 1] = `${list[list.length - 1]} ${line.trim()}`;
      continue;
    }
    if (line.trim() === '') {
      flushPara();
      flushList();
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flushPara();
  flushList();
  return out.join('\n\n').trim();
}

function jsDocDescription(docs: JSDoc[]): string {
  const raw = docs
    .map((d) => d.getDescription().trim())
    .filter(Boolean)
    .join('\n\n');
  return normalizeJsDocDescription(raw);
}

function jsDocDefault(docs: JSDoc[]): string | undefined {
  for (const doc of docs) {
    for (const tag of doc.getTags()) {
      if (tag.getTagName() !== 'default') continue;
      const comment = tag.getCommentText()?.trim();
      if (comment) return comment.replace(/\s+/g, ' ');
    }
  }
  return undefined;
}

function jsDocsFromSymbol(symbol: MorphSymbol, override?: JSDoc[]): JSDoc[] {
  if (override && override.length > 0) return override;
  return symbol.getDeclarations().flatMap((d) => {
    if (Node.isPropertySignature(d) || Node.isMethodSignature(d)) return d.getJsDocs();
    return [];
  });
}

function propRowFromSymbol(
  symbol: MorphSymbol,
  type: Type,
  opts: { required?: boolean; docs?: JSDoc[] } = {},
): PropRow {
  const name = symbol.getName();
  const jsDocs = jsDocsFromSymbol(symbol, opts.docs);
  const description = jsDocDescription(jsDocs);
  const defaultValue = jsDocDefault(jsDocs);
  const decl =
    symbol.getDeclarations().find(Node.isPropertySignature) ??
    symbol.getDeclarations().find(Node.isMethodSignature);
  const typeText = typeTextForDeclaration(decl, type, name);
  const optional =
    opts.required === false ||
    (Node.isPropertySignature(decl) && decl.hasQuestionToken()) ||
    type.isNullable();

  const row: PropRow = {
    name,
    type: typeText,
    description: description || '—',
  };
  if (defaultValue) row.default = defaultValue;
  if (!optional && opts.required !== false) row.required = true;
  if (optional || defaultValue) delete row.required;
  return row;
}

function rowFromPropertySignature(prop: PropertySignature): PropRow {
  const type = prop.getType();
  const docs = prop.getJsDocs();
  const description = jsDocDescription(docs);
  const defaultValue = jsDocDefault(docs);
  const optional = prop.hasQuestionToken() || type.isNullable();
  const row: PropRow = {
    name: prop.getName(),
    type: typeTextForDeclaration(prop, type, prop.getName()),
    description: description || '—',
  };
  if (defaultValue) row.default = defaultValue;
  if (!optional) row.required = true;
  if (optional || defaultValue) delete row.required;
  return row;
}

function getInterface(file: string, typeName: string): InterfaceDeclaration {
  const sourcePath = path.join(lightboxSrc, file);
  const source = project.getSourceFile(sourcePath);
  if (!source) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }
  const iface = source.getInterface(typeName);
  if (!iface) {
    throw new Error(`Interface ${typeName} not found in ${file}`);
  }
  return iface;
}

function extractInterfaceProps(spec: ExtractSpec & { kind: 'interface-props' }): PropRow[] {
  const iface = getInterface(spec.file, spec.typeName);
  const exclude = new Set(spec.exclude ?? []);
  const rows: PropRow[] = [];
  const seen = new Set<string>();

  for (const prop of iface.getProperties()) {
    const name = prop.getName();
    if (exclude.has(name) || seen.has(name)) continue;
    seen.add(name);
    rows.push(rowFromPropertySignature(prop));
  }

  // Methods rarely appear on props interfaces; include for completeness.
  for (const method of iface.getMethods()) {
    const name = method.getName();
    if (exclude.has(name) || seen.has(name)) continue;
    seen.add(name);
    const docs = method.getJsDocs();
    rows.push({
      name,
      type: typeTextForDeclaration(method, method.getType(), name),
      description: jsDocDescription(docs) || '—',
      ...(jsDocDefault(docs) ? { default: jsDocDefault(docs) } : {}),
    });
  }

  for (const name of spec.includeInherited ?? []) {
    if (exclude.has(name) || seen.has(name)) continue;
    const symbol = iface.getType().getProperty(name);
    if (!symbol) {
      throw new Error(`${spec.typeName}: includeInherited "${name}" not found on type`);
    }
    seen.add(name);
    const type = project.getTypeChecker().getTypeOfSymbolAtLocation(symbol, iface);
    const decl = symbol.getDeclarations().find(Node.isPropertySignature);
    rows.push(
      propRowFromSymbol(symbol, type, {
        required: false,
        docs: decl?.getJsDocs(),
      }),
    );
    const last = rows[rows.length - 1]!;
    delete last.required;
  }

  return rows;
}

function extractInterfaceMembers(spec: ExtractSpec & { kind: 'interface-members' }): PropRow[] {
  const iface = getInterface(spec.file, spec.typeName);
  const exclude = new Set(spec.exclude ?? []);
  const rows: PropRow[] = [];

  for (const member of iface.getMembers()) {
    if (Node.isPropertySignature(member)) {
      const name = member.getName();
      if (exclude.has(name)) continue;
      const row = rowFromPropertySignature(member);
      // Imperative handles expose a fixed shape — "required" is noise in the table.
      delete row.required;
      rows.push(row);
      continue;
    }
    if (Node.isMethodSignature(member)) {
      const name = member.getName();
      if (exclude.has(name)) continue;
      const docs = member.getJsDocs();
      rows.push({
        name,
        type: typeTextForDeclaration(member, member.getType(), name),
        description: jsDocDescription(docs) || '—',
      });
    }
  }

  return rows;
}

function extractHookReturn(spec: ExtractSpec & { kind: 'hook-return' }): PropRow[] {
  const sourcePath = path.join(lightboxSrc, spec.file);
  const source = project.getSourceFile(sourcePath);
  if (!source) throw new Error(`Source file not found: ${sourcePath}`);

  const functionDecl = source.getFunction(spec.functionName);
  if (!functionDecl) {
    throw new Error(`Function ${spec.functionName} not found in ${spec.file}`);
  }

  const returnType = functionDecl.getReturnType();
  const docs = functionDecl.getJsDocs();
  const returnNode = functionDecl.getReturnTypeNode();

  return [
    {
      name: spec.rowName ?? '(return)',
      type: returnNode
        ? cleanTypeText(returnNode.getText())
        : cleanTypeText(returnType.getText(functionDecl, TYPE_FORMAT)),
      description: jsDocDescription(docs) || '—',
    },
  ];
}

function extractProps(spec: ExtractSpec): PropRow[] {
  switch (spec.kind) {
    case 'none':
      return [];
    case 'interface-props':
      return extractInterfaceProps(spec);
    case 'interface-members':
      return extractInterfaceMembers(spec);
    case 'hook-return':
      return extractHookReturn(spec);
    default: {
      const _exhaustive: never = spec;
      return _exhaustive;
    }
  }
}

function jsDocType(docs: JSDoc[]): string | undefined {
  for (const doc of docs) {
    for (const tag of doc.getTags()) {
      if (tag.getTagName() !== 'type') continue;
      const comment = tag.getCommentText()?.trim();
      if (comment) return comment.replace(/\s+/g, ' ');
    }
  }
  return undefined;
}

/** Base UI–style string enums: member value is the attr/var name, JSDoc is the description. */
function extractEnumRows(spec: EnumExtract): { name: string; description: string; type?: string }[] {
  const sourcePath = path.join(lightboxSrc, spec.file);
  const source = project.getSourceFile(sourcePath);
  if (!source) throw new Error(`Source file not found: ${sourcePath}`);
  const en = source.getEnum(spec.enumName);
  if (!en) throw new Error(`Enum ${spec.enumName} not found in ${spec.file}`);

  return en.getMembers().map((member) => {
    const docs = member.getJsDocs();
    const value = member.getValue();
    const name = typeof value === 'string' ? value : member.getName();
    const row: { name: string; description: string; type?: string } = {
      name,
      description: jsDocDescription(docs) || '—',
    };
    const type = jsDocType(docs);
    if (type) row.type = type;
    return row;
  });
}

function serializeObjectRow(row: Record<string, string | boolean | undefined>): string {
  const fields: string[] = [];
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined) continue;
    if (typeof value === 'boolean') {
      if (value) fields.push(`${key}: true`);
      continue;
    }
    fields.push(`${key}: ${JSON.stringify(value)}`);
  }
  return `    {\n      ${fields.join(',\n      ')},\n    }`;
}

function serializeMap(
  byId: Record<string, object[]>,
  serialize: (row: never) => string,
): string {
  return Object.entries(byId)
    .map(([id, rows]) => {
      if (rows.length === 0) return `  ${JSON.stringify(id)}: [],`;
      return `  ${JSON.stringify(id)}: [\n${rows.map((r) => serialize(r as never)).join(',\n')},\n  ],`;
    })
    .join('\n');
}

function buildGeneratedSource(data: {
  props: Record<string, PropRow[]>;
  attributes: Record<string, AttrRow[]>;
  cssVariables: Record<string, CssVarRow[]>;
}): string {
  const propsEntries = serializeMap(data.props, (row: PropRow) =>
    serializeObjectRow({
      name: row.name,
      type: row.type,
      default: row.default,
      required: row.required,
      description: row.description,
    }),
  );
  const attrEntries = serializeMap(data.attributes, (row: AttrRow) =>
    serializeObjectRow({ name: row.name, description: row.description }),
  );
  const cssEntries = serializeMap(data.cssVariables, (row: CssVarRow) =>
    serializeObjectRow({
      name: row.name,
      type: row.type,
      description: row.description,
    }),
  );

  return `/**
 * AUTO-GENERATED by apps/docs/scripts/generate-lightbox-api.ts
 * Do not edit by hand — update package JSDoc / props / *DataAttributes / *CssVars, then run:
 *   pnpm --filter docs docs:api
 */

import type { AttrRow, CssVarRow, PropRow } from './types';

export const generatedProps: Record<string, PropRow[]> = {
${propsEntries}
};

export const generatedAttributes: Record<string, AttrRow[]> = {
${attrEntries}
};

export const generatedCssVariables: Record<string, CssVarRow[]> = {
${cssEntries}
};
`;
}

function collectMeta(): ApiPartMeta[] {
  return [
    ...lightboxApiMeta,
    documentViewTransitionMeta,
    ...hooksApiMeta,
    ...imperativeApiMeta,
  ];
}

function main() {
  const check = process.argv.includes('--check');
  const props: Record<string, PropRow[]> = {};
  const attributes: Record<string, AttrRow[]> = {};
  const cssVariables: Record<string, CssVarRow[]> = {};

  for (const part of collectMeta()) {
    props[part.id] = extractProps(part.extract);
    attributes[part.id] = part.attributesFrom
      ? extractEnumRows(part.attributesFrom).map(({ name, description }) => ({ name, description }))
      : [];
    cssVariables[part.id] = part.cssVariablesFrom
      ? extractEnumRows(part.cssVariablesFrom).map(({ name, description, type }) => ({
          name,
          description,
          ...(type ? { type } : {}),
        }))
      : [];
  }

  const next = buildGeneratedSource({ props, attributes, cssVariables });

  if (check) {
    if (!fs.existsSync(outFile)) {
      console.error(`Missing ${outFile}. Run: pnpm --filter docs docs:api`);
      process.exit(1);
    }
    const prev = fs.readFileSync(outFile, 'utf8');
    if (prev !== next) {
      console.error('Lightbox API docs are out of date with package TypeScript.');
      console.error('Run: pnpm --filter docs docs:api');
      process.exit(1);
    }
    console.log('Lightbox API docs are up to date.');
    return;
  }

  fs.writeFileSync(outFile, next);
  console.log(`Wrote ${path.relative(repoRoot, outFile)}`);
}

main();
