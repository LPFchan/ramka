import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { UrlSyncedStateDemo } from '../url-synced-state-demo';
import { galleryPhotos } from '../photos';

/**
 * Optional catch-all: `/examples/lightbox/url-synced-state` renders the grid,
 * and `/examples/lightbox/url-synced-state/mb-05` is the same page deep-linked
 * into the lightbox — the client demo reads the photo id from the pathname and
 * opens on that slide. One route (one page component) for both URL shapes
 * means client-side URL changes reconcile into the same mounted tree, so the
 * viewer never remounts while it rewrites the URL.
 */
interface UrlSyncedStateRouteProps {
  params: Promise<{ id?: string[] }>;
}

/** Prerender the grid plus every photo permalink. */
export function generateStaticParams() {
  return [{ id: [] }, ...galleryPhotos.map((photo) => ({ id: [photo.id] }))];
}

export async function generateMetadata({ params }: UrlSyncedStateRouteProps): Promise<Metadata> {
  const { id } = await params;
  const photo = id?.length ? galleryPhotos.find((p) => p.id === id[0]) : undefined;
  if (photo) {
    const title = `${photo.caption} — URL-synced state example`;
    const description = `${photo.alt} — a deep link straight into the lightbox, driven by a Next.js dynamic route and ramka's controlled open/value props.`;
    return {
      title,
      description,
      // `title`/`description` alone don't cascade into the OpenGraph object
      // inherited from the root layout — without an explicit `openGraph` here,
      // a shared photo URL unfurls as the generic site card. This is the
      // "shareable URL with per-photo metadata" half of the demo's pitch, so
      // give crawlers the actual photo. `StaticImageData` supplies a
      // site-relative `src` plus intrinsic dimensions; the root layout's
      // `metadataBase` resolves it to an absolute URL. (Per-photo canonicals
      // come free — the root layout's `canonical: './'` resolves per page.)
      openGraph: {
        title,
        description: photo.alt,
        images: [
          {
            url: photo.image.src,
            width: photo.image.width,
            height: photo.image.height,
            alt: photo.alt,
          },
        ],
      },
      twitter: { card: 'summary_large_image' },
    };
  }
  return {
    title: 'URL-synced state example',
    description:
      'A masonry lightbox wired to Next.js dynamic routes: every photo is a shareable URL — deep links open the viewer, swipes rewrite the URL, browser Back closes it. Built with ramka.',
  };
}

export default async function UrlSyncedStateRoute({ params }: UrlSyncedStateRouteProps) {
  const { id } = await params;
  // Unknown photo ids 404 like any other dynamic route. `id?.length` (not
  // `id &&`): the grid's static param is literally `{ id: [] }`, and an empty
  // array is truthy — Next currently normalizes it to `undefined` at prerender
  // time, but the guard shouldn't lean on that.
  if (id?.length && (id.length > 1 || !galleryPhotos.some((photo) => photo.id === id[0]))) {
    notFound();
  }
  return <UrlSyncedStateDemo />;
}
