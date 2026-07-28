import fs from 'node:fs/promises';
import path from 'node:path';

import { highlightCode, type CodeLang } from './highlight-code';

export type SourceFileGroup = 'package' | 'example';

export type SourceFile = {
  /** Display name in the file tab (e.g. `lightbox.tsx`). */
  name: string;
  /** Raw source for clipboard. */
  code: string;
  /** Shiki-highlighted HTML. */
  html: string;
  lang: CodeLang;
  /**
   * Optional source bucket for the Code UI.
   * - `package` — copy-paste skin / design-system entry
   * - `example` — app composition (may use Tailwind, etc.)
   */
  group?: SourceFileGroup;
  /** Short note shown while this file is active (e.g. Tailwind disclaimer). */
  note?: string;
};

/**
 * Read + highlight source files from the docs app (paths relative to `apps/docs`).
 * Use from Server Components only.
 */
export async function readSourceFiles(
  files: Array<{
    path: string;
    name?: string;
    lang?: CodeLang;
    group?: SourceFileGroup;
    note?: string;
  }>,
): Promise<SourceFile[]> {
  return Promise.all(
    files.map(async (file) => {
      const code = await readText(file.path);
      const name = file.name ?? path.basename(file.path);
      const lang = file.lang ?? langFromName(name);
      const html = await highlightCode(code, lang);
      return { name, code, html, lang, group: file.group, note: file.note };
    }),
  );
}

/** Resolve paths whether Next cwd is `apps/docs` or the monorepo root. */
async function readText(relPath: string): Promise<string> {
  const candidates = [
    path.join(process.cwd(), relPath),
    path.join(process.cwd(), 'apps/docs', relPath),
  ];
  for (const abs of candidates) {
    try {
      return await fs.readFile(abs, 'utf8');
    } catch {
      // try next candidate
    }
  }
  throw new Error(`Source file not found: ${relPath} (cwd=${process.cwd()})`);
}

function langFromName(name: string): CodeLang {
  if (name.endsWith('.css')) return 'css';
  if (name.endsWith('.json')) return 'json';
  if (name.endsWith('.ts')) return 'typescript';
  if (name.endsWith('.js')) return 'javascript';
  if (name.endsWith('.jsx')) return 'jsx';
  return 'tsx';
}
