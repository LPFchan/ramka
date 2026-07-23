# Lightbox docs excerpts

Teaching snippets for the docs site. The generator writes `generated.ts`.

```bash
pnpm docs:excerpts          # regenerate
pnpm docs:excerpts:check    # CI
```

## JSX / TS sources

Create `sources/my-snippet.tsx` that typechecks against `ramka`, then tag:

```tsx
/**
 * @docsExcerpt my-snippet
 * @docsExcerptTitle Optional title
 */
export function MySnippet() {
  return <Lightbox.Root>{/* … */}</Lightbox.Root>;
}
```

Or mark a region with `// @docs-excerpt-start my-snippet` … `// @docs-excerpt-end`.

## CSS sources (preferred for styles)

Demo CSS lives under [`app/lightbox-demo/`](../../../lightbox-demo/) and is imported by the site. Excerpts are sliced from those files so docs stay in sync with what demos actually load.

**Whole file** — put this at the top of e.g. `pull-progress.css`:

```css
/**
 * @docsExcerpt pull-progress-css
 * @docsExcerptTitle Pull progress CSS
 */

.lightbox-demo-backdrop[data-open] { … }
```

**Region** — inside any `lightbox-demo/*.css` file:

```css
/* @docs-excerpt-start morph-border-radius */
/* @docs-excerpt-title Morph border-radius */
::view-transition-group(lightbox-morph) { … }
/* @docs-excerpt-end */
```

Then run `pnpm docs:excerpts` and render `lightboxExcerpts['…']` with `lang="css"`.
