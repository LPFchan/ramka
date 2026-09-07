# Infinite scroll

An endless feed where the lightbox paginates too — one photo array drives grid tiles and slides; the grid loads pages via an IntersectionObserver sentinel, and onValueChange fetches ahead inside the open viewer, appending slides to the native scroll-snap track with a minimal Previous/Next chrome (no thumbnails).

## Source

```tsx examples/lightbox/infinite-scroll/page.tsx
import type { Metadata } from 'next';

import { InfiniteScrollFeed } from './infinite-scroll-feed';

export const metadata: Metadata = {
  title: 'Infinite scroll example',
  description:
    'An endless photo feed whose lightbox paginates too: swiping near the end fetches the next page and appends slides to the native scroll-snap track while the viewer stays open, built with ramka.',
};

export default function InfiniteScrollPage() {
  return <InfiniteScrollFeed />;
}
```
