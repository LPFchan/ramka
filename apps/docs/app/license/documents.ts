import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Legal documents are maintained as Markdown inside the package, so the text a
 * buyer reads on the site and the text kept with the library can never drift.
 * This module is the only reader of those files.
 *
 * Server Components only.
 */
export const AGREEMENT_PATH = 'packages/ramka/COMMERCIAL-LICENSE.md';
export const NOTICES_PATH = 'packages/ramka/THIRD-PARTY-NOTICES.md';
export const PRIVACY_PATH = 'packages/ramka/PRIVACY.md';
export const RETURN_POLICY_PATH = 'packages/ramka/RETURN-POLICY.md';
export const TERMS_PATH = 'packages/ramka/TERMS.md';

export type MarkdownDoc = {
  /** The `# ` heading, rendered as the page title. */
  title: string;
  /** Everything after the title, still Markdown. */
  body: string;
};

export async function readMarkdownDoc(relPath: string): Promise<MarkdownDoc> {
  const source = await readFromRepo(relPath);

  // The title is page chrome rather than body copy, so it is lifted out and
  // styled separately — but still sourced from the file.
  const title = /^#[ \t]+(.+)$/m.exec(source);
  if (!title?.[1]) {
    throw new Error(`${relPath} must open with a "# " title`);
  }

  return { title: title[1], body: source.slice(title.index + title[0].length) };
}

export type Agreement = MarkdownDoc & {
  /** The `Version x.y` line that follows the title. */
  version: string;
};

export async function readAgreement(): Promise<Agreement> {
  const { title, body } = await readMarkdownDoc(AGREEMENT_PATH);

  // Pulled out of the body so the version can be styled as a subtitle and
  // recorded against an order, rather than read as the first clause.
  const version = /^(Version[ \t]+.+)$/m.exec(body);
  if (!version?.[1]) {
    throw new Error(`${AGREEMENT_PATH} must state a "Version x.y" line below the title`);
  }

  return { title, version: version[1], body: body.slice(version.index + version[0].length) };
}

/** Resolve the path whether Next's cwd is `apps/docs` or the monorepo root. */
async function readFromRepo(relPath: string): Promise<string> {
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

/**
 * Clause ids are derived from headings so new clauses get anchors for free.
 * The overrides keep the shorter anchors that were published by hand before the
 * text moved into Markdown, since links to a legal clause should not rot.
 */
const ANCHOR_OVERRIDES: Record<string, string> = {
  'source-code-and-modifications': 'source-code',
  indie: 'tier-indie',
  commercial: 'tier-commercial',
  agency: 'tier-agency',
  'embedded-oem': 'tier-embedded',
};

export function anchorId(heading: string): string {
  const slug = heading
    // Clause numbers are for citation, not for URLs.
    .replace(/^\d+\.\s*/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return ANCHOR_OVERRIDES[slug] ?? slug;
}
