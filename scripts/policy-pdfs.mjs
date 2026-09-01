/**
 * One-off: render the legal Markdown documents to PDF for upload to the
 * payment provider's "Policy documents" slots.
 *
 *   node scripts/policy-pdfs.mjs
 *
 * Output: policy-pdfs/*.pdf (not committed). Uses micromark (already in the
 * lockfile via react-markdown) for Markdown → HTML and Playwright Chromium
 * for HTML → PDF, so no new dependencies.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { micromark } = await import(
  require.resolve('micromark', { paths: [path.join(repoRoot, 'node_modules/.pnpm/micromark@4.0.2/node_modules/micromark')] })
);
const { chromium } = require('@playwright/test');

const DOCS = [
  { src: 'packages/ramka/TERMS.md', out: 'terms-of-service.pdf' },
  { src: 'packages/ramka/PRIVACY.md', out: 'privacy-policy.pdf' },
  { src: 'packages/ramka/RETURN-POLICY.md', out: 'return-policy.pdf' },
  { src: 'packages/ramka/COMMERCIAL-LICENSE.md', out: 'eula.pdf' },
];

const CSS = `
  :root { color-scheme: light; }
  body {
    font: 11pt/1.55 -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
    color: #111;
    max-width: 100%;
    margin: 0;
  }
  h1 { font-size: 20pt; line-height: 1.25; margin: 0 0 0.5em; }
  h2 { font-size: 14pt; margin: 1.6em 0 0.5em; }
  h3 { font-size: 12pt; margin: 1.4em 0 0.4em; }
  h2, h3 { break-after: avoid; }
  p, li { break-inside: avoid-page; }
  a { color: #111; text-decoration: underline; }
  code { font-family: ui-monospace, Menlo, monospace; font-size: 0.9em; }
  table { border-collapse: collapse; }
  th, td { border: 0.5pt solid #999; padding: 4pt 8pt; text-align: start; }
`;

const outDir = path.join(repoRoot, 'policy-pdfs');
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

for (const { src, out } of DOCS) {
  const markdown = await fs.readFile(path.join(repoRoot, src), 'utf8');
  const html = micromark(markdown);
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${html}</body></html>`,
    { waitUntil: 'load' },
  );
  await page.pdf({
    path: path.join(outDir, out),
    format: 'A4',
    margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' },
    printBackground: true,
  });
  console.log(`${src} -> policy-pdfs/${out}`);
}

await browser.close();
