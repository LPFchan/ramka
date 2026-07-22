# Lightbox docs excerpts

Typechecked teaching snippets for the docs site. The generator reads `sources/` and writes `generated.ts`.

```bash
pnpm docs:excerpts          # regenerate
pnpm docs:excerpts:check    # CI
```

## Adding an excerpt

1. Create `sources/my-snippet.tsx` that typechecks against `ramka`.
2. Tag the exported function:

```tsx
/**
 * @docsExcerpt my-snippet
 * @docsExcerptTitle Optional title
 */
export function MySnippet() {
  return <Lightbox.Root>{/* … */}</Lightbox.Root>;
}
```

3. Or mark an exact region with `// @docs-excerpt-start my-snippet` … `// @docs-excerpt-end`.
4. Run `pnpm docs:excerpts` and render `lightboxExcerpts['my-snippet']` in a page.
