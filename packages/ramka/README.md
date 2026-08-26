# @ramka/react

Unstyled, accessible lightbox primitives for React — in the style of [Radix UI](https://www.radix-ui.com/) and [Base UI](https://base-ui.com/).

> _ramka_ (РАмка) is Polish for "frame".

## Installation

```bash
npm install @ramka/react
# or
pnpm add @ramka/react
# or
yarn add @ramka/react
```

`react` and `react-dom` (>= 18) are peer dependencies, and they are the only
dependencies: nothing else is installed, so nothing else can pull in a
transitive tree, break under a version bump, or need auditing. CI runs the full
suite, the typecheck and the build against React 18.3 as well as React 19, so
the floor is a tested claim rather than an aspiration.

## Usage

```tsx
import * as Lightbox from '@ramka/react/lightbox';
```

The parts ship as a flat module and you name the namespace yourself, so your bundler can drop every part your gallery does not render. Importing a pre-built namespace out of a package defeats tree-shaking in esbuild-based bundlers (Vite dev, Remix), which is why `@ramka/react` itself exports no `Lightbox` object.

That only holds while the accesses stay statically visible, so reach for `Lightbox.Root` directly rather than pulling names off the namespace:

```tsx
// Shakeable: esbuild rewrites each access into a direct reference.
<Lightbox.Root>…</Lightbox.Root>;

// Not shakeable: destructuring needs a real object, so every part is retained.
const { Root, Trigger } = Lightbox;
```

Spreading the namespace or passing it to a function costs the same. If you prefer bare local names, take them as named imports — `import { Root, Trigger } from '@ramka/react/lightbox'` — which shakes exactly like the namespace form.

Composition hooks (`useLightboxContext`, `useLightboxItemContext`, …) and shared types come from the package root:

```tsx
import { useLightboxContext } from '@ramka/react';
```

`Lightbox.*` is a fullscreen modal image viewer composed of headless parts:

- `Lightbox.Trigger` / `Lightbox.Portal` / `Lightbox.Content` / `Lightbox.Backdrop` — the modal shell with an optional View Transition morph from the trigger.
- `Lightbox.Slides` / `Lightbox.Slide` — a swipeable, snapping carousel wired directly to the lightbox's active index. Snap alignment is built in; slide width (full-bleed, aspect cards, …) is consumer CSS.
- `Lightbox.Zoom`, `Lightbox.Caption`, `Lightbox.ThumbnailGroup`, `Lightbox.Previous` / `Lightbox.Next` — zoom, captions, thumbnails, and navigation, plus built-in pull-to-dismiss.

### Labels and localization

The library ships no user-facing copy: `Lightbox.Close`, `Previous`, `Next`, `ZoomIn`
and `ZoomOut` render without an `aria-label`, so nothing English lands in your UI and
there is no default wording to override. Give each control visible text or your own
localized `aria-label` / `aria-labelledby`. In development a nameless control logs a
warning, the same way `Lightbox.Content` does for a dialog with no accessible name.

```tsx
<Lightbox.Close aria-label={t('gallery.close')}>
  <XIcon aria-hidden />
</Lightbox.Close>
```

### Content Security Policy

Works under a strict style policy — `style-src 'self'; style-src-attr 'none'`, no
`unsafe-inline` and no nonce to configure. The library's own CSS (view-transition
rules, morph keyframes, media fill) is delivered as constructed stylesheets, and
element styling goes through CSSOM, so nothing ramka writes reaches the document as
markup. Note that constructed stylesheets are adopted, so they cascade after your
stylesheets; tune them through the documented `--lightbox-*` custom properties
rather than by relying on source order.

### Supply chain

Every version is published from a GitHub Actions workflow using npm trusted
publishing, so the tarball carries a signed provenance attestation naming the
commit and the run that built it. Nobody can publish `@ramka/react` from a
laptop, with or without a stolen token:

```bash
npm audit signatures
```

A CycloneDX SBOM ships inside the package as `sbom.cdx.json` and is attached to
each GitHub release. It records the zero installed dependencies, the peer
dependencies your app supplies, and the Base UI code adapted into `src/render/` —
which a lockfile-reading scanner cannot see, because it was vendored precisely so
it would not be a dependency. See [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).

Docs: run the [docs site](../../apps/docs) and open `/docs/lightbox` (overview → composition → view transitions → gestures → API). Live demos live under `/examples/lightbox/*`.

API tables (props, data attributes, CSS variables) are generated from this package’s TypeScript + JSDoc — including the `*DataAttributes` / `*CssVars` enums. Usage code excerpts are extracted from typechecked sources under `apps/docs/app/_content/lightbox/excerpts/sources/`. After changing public APIs or excerpt sources, run `pnpm docs:api` and `pnpm docs:excerpts` from the repo root (CI fails if generated files are stale).

LLM-oriented copies of the docs (`/llms.txt`, `/llms-full.txt`, and a `.md` twin of each docs page) are generated from those same sources — `pnpm docs:llms`. The docs `dev`/`build` scripts regenerate them automatically.

## License

Dual-licensed.

**Commercial license** — for a proprietary project whose own source you keep
closed: a commercial product, a client site, a paid theme or template. Your code
stays yours, and none of the copyleft terms below apply to it.
[Read more about the commercial license](https://ramka.dev/license)

**GPL-3.0-only** — free otherwise, including in something you sell; the GPL does
not restrict commercial use. It requires reciprocity instead: anything you
distribute that includes ramka must also be GPL, with source available to the
people you distribute it to. For a library that ships to the browser, that covers
the application you build with it.

The full text is in [LICENSE](./LICENSE), which ships inside this package. The
vendored Base UI code noted in [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md)
is MIT, which both options accommodate.
