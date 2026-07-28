import fs from 'node:fs/promises';
import path from 'node:path';

import { highlightCode, type CodeLang } from './highlight-code';

export type SourceFile = {
  /** Display name in the file tab (e.g. `lightbox.tsx`). */
  name: string;
  /** Raw source for clipboard. */
  code: string;
  /** Shiki-highlighted HTML. */
  html: string;
  lang: CodeLang;
};

/**
 * Read + highlight source files from the docs app (paths relative to `apps/docs`).
 * Use from Server Components only.
 */
export async function readSourceFiles(
  files: Array<{ path: string; name?: string; lang?: CodeLang }>,
): Promise<SourceFile[]> {
  return Promise.all(
    files.map(async (file) => {
      const code = await readText(file.path);
      const name = file.name ?? path.basename(file.path);
      const lang = file.lang ?? langFromName(name);
      const html = await highlightCode(code, lang);
      return { name, code, html, lang };
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
