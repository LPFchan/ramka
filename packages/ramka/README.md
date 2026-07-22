# ramka

Unstyled, accessible lightbox primitives for React — in the style of [Radix UI](https://www.radix-ui.com/) and [Base UI](https://base-ui.com/).

> _ramka_ (РАмка) is Polish for "frame".

## Installation

```bash
npm install ramka
# or
pnpm add ramka
# or
yarn add ramka
```

`react` and `react-dom` (>= 18) are peer dependencies.

## Usage

```tsx
import { Lightbox } from 'ramka';
```

`Lightbox.*` is a fullscreen modal image viewer composed of headless parts:

- `Lightbox.Trigger` / `Lightbox.Content` / `Lightbox.Backdrop` — the modal shell with an optional View Transition morph from the trigger.
- `Lightbox.Slides` / `Lightbox.Slide` — a swipeable, snapping carousel wired directly to the lightbox's active index.
- `Lightbox.Zoom`, `Lightbox.Caption`, `Lightbox.ThumbnailGroup`, `Lightbox.Previous` / `Lightbox.Next` — zoom, captions, thumbnails, and navigation, plus built-in pull-to-dismiss.

Docs: run the [docs site](../../apps/docs) and open `/docs/lightbox` (overview → composition → view transitions → gestures → API). Live demos live under `/examples/lightbox/*`.

API tables (props, data attributes, CSS variables) are generated from this package’s TypeScript + JSDoc — including the `*DataAttributes` / `*CssVars` enums. Usage code excerpts are extracted from typechecked sources under `apps/docs/app/_content/lightbox/excerpts/sources/`. After changing public APIs or excerpt sources, run `pnpm docs:api` and `pnpm docs:excerpts` from the repo root (CI fails if generated files are stale).

## License

MIT
