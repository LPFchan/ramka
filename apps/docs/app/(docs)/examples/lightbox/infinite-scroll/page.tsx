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
