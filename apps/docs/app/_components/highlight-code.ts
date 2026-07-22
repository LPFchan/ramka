import { createHighlighter, type BundledLanguage } from 'shiki';

const themes = ['github-light', 'github-dark'] as const;
const langs = ['tsx', 'typescript', 'jsx', 'javascript', 'bash', 'shellscript', 'json'] as const;

type Highlighter = Awaited<ReturnType<typeof createHighlighter>>;

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [...themes],
      langs: [...langs],
    });
  }
  return highlighterPromise;
}

export type CodeLang = (typeof langs)[number];

/** Server-side Shiki highlight with light/dark CSS variables for `html.dark`. */
export async function highlightCode(code: string, lang: CodeLang = 'tsx'): Promise<string> {
  const highlighter = await getHighlighter();
  const resolved = (langs as readonly string[]).includes(lang) ? lang : 'tsx';
  return highlighter.codeToHtml(code.replace(/\n$/, ''), {
    lang: resolved as BundledLanguage,
    themes: {
      light: 'github-light',
      dark: 'github-dark',
    },
    defaultColor: false,
  });
}
