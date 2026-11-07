import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Legal documents are maintained next to the package, so the text on the site
 * and the text shipped with the library stay the same file.
 *
 * Server Components only.
 */
export const NOTICES_PATH = 'packages/ramka/THIRD-PARTY-NOTICES.md';
export const LICENSE_PATH = 'LICENSE';

export type MarkdownDoc = {
  /** The `# ` heading, rendered as the page title. */
  title: string;
  /** Everything after the title, still Markdown. */
  body: string;
};

export async function readRepoText(relPath: string): Promise<string> {
  const candidates = [path.join(process.cwd(), '../..', relPath), path.join(process.cwd(), relPath)];
  for (const abs of candidates) {
    try {
      return await fs.readFile(abs, 'utf8');
    } catch {
      // try next candidate
    }
  }
  throw new Error(`Document not found: ${relPath} (cwd=${process.cwd()})`);
}

export async function readMarkdownDoc(relPath: string): Promise<MarkdownDoc> {
  const source = await readRepoText(relPath);

  // The title is page chrome rather than body copy, so it is lifted out and
  // styled separately — but still sourced from the file.
  const title = /^#[ \t]+(.+)$/m.exec(source);
  if (!title?.[1]) {
    throw new Error(`${relPath} must open with a "# " title`);
  }

  return { title: title[1], body: source.slice(title.index + title[0].length) };
}

/** Clause ids are derived from headings so new sections get anchors for free. */
export function anchorId(heading: string): string {
  return heading
    .replace(/^\d+\.\s*/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
