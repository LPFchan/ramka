import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * The commercial agreement is maintained as Markdown inside the package, so the
 * text a buyer reads on the site and the text shipped alongside the library can
 * never drift. This module is the only reader of that file.
 *
 * Server Components only.
 */
const AGREEMENT_PATH = 'packages/ramka/COMMERCIAL-LICENSE.md';

export type Agreement = {
  /** The `# ` heading, rendered as the page title. */
  title: string;
  /** The `Version x.y` line that follows the title. */
  version: string;
  /** Everything from the first `## ` clause onward, still Markdown. */
  body: string;
};

export async function readAgreement(): Promise<Agreement> {
  const source = await readAgreementSource();

  // The title and version are page chrome rather than clauses, so they are
  // lifted out and styled separately — but still sourced from the file, so the
  // version on the site cannot fall behind the agreement.
  const bodyStart = source.indexOf('\n## ');
  if (bodyStart === -1) {
    throw new Error(`${AGREEMENT_PATH} has no clauses: expected at least one "## " heading`);
  }

  const preamble = source.slice(0, bodyStart);
  const title = /^#[ \t]+(.+)$/m.exec(preamble)?.[1];
  const version = /^(Version[ \t]+.+)$/m.exec(preamble)?.[1];

  if (!title || !version) {
    throw new Error(`${AGREEMENT_PATH} must open with a "# " title followed by a "Version x.y" line`);
  }

  return { title, version, body: source.slice(bodyStart + 1) };
}

/** Resolve the path whether Next's cwd is `apps/docs` or the monorepo root. */
async function readAgreementSource(): Promise<string> {
  const candidates = [path.join(process.cwd(), '../..', AGREEMENT_PATH), path.join(process.cwd(), AGREEMENT_PATH)];
  for (const abs of candidates) {
    try {
      return await fs.readFile(abs, 'utf8');
    } catch {
      // try next candidate
    }
  }
  throw new Error(`Agreement not found: ${AGREEMENT_PATH} (cwd=${process.cwd()})`);
}

/**
 * Clause ids are derived from headings so new clauses get anchors for free.
 * The overrides keep the shorter anchors that were published by hand before the
 * text moved into Markdown, since links to a legal clause should not rot.
 */
const ANCHOR_OVERRIDES: Record<string, string> = {
  'source-code-and-modifications': 'source-code',
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
