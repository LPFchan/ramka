# ramka

Unstyled, accessible image gallery primitives for React — in the style of [Radix UI](https://www.radix-ui.com/) and [Base UI](https://base-ui.com/).

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
import { ScrollGallery, Lightbox } from 'ramka';
```

Two primitive families are shipped today:

- `ScrollGallery.*` — a horizontally / vertically snapping scroll gallery with scroll markers, keyboard navigation, and an imperative API.
- `Lightbox.*` — a fullscreen modal image viewer with optional View Transition morph, zoom, captions, thumbnails, and pull-to-dismiss.

See the [docs site](../../apps/docs) for live examples.

## License

MIT
