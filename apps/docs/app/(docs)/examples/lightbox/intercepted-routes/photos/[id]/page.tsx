import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  EXAMPLE_BASE_PATH,
  interceptedPhotos,
  interceptedPhotoTitle,
} from '../../photos';

/**
 * The hard-load presentation. Interception is a client-side navigation concept
 * only: a refresh, bookmark, or shared link of `…/photos/5` never touches
 * `@modal/(.)photos/[id]` — Next.js serves THIS standalone page instead
 * (Instagram's dedicated photo page is the same move). That is the pattern's
 * defining tradeoff: one URL, two presentations. If the refresh should keep
 * the grid + open-viewer presentation instead, that's the URL-synced state
 * example (dynamic route + container={null} + ssrSlideShift).
 */
interface PhotoPageProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return interceptedPhotos.map((photo) => ({ id: photo.id }));
}

export async function generateMetadata({ params }: PhotoPageProps): Promise<Metadata> {
  const { id } = await params;
  const photo = interceptedPhotos.find((p) => p.id === id);
  if (!photo) return {};
  return {
    title: interceptedPhotoTitle(photo),
    description: `${photo.alt} — the standalone hard-load presentation of an intercepted photo route.`,
    openGraph: {
      title: interceptedPhotoTitle(photo),
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

export default async function StandalonePhotoPage({ params }: PhotoPageProps) {
  const { id } = await params;
  const photo = interceptedPhotos.find((p) => p.id === id);
  if (!photo) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-14 md:px-10 md:py-16">
      <Link
        href={EXAMPLE_BASE_PATH}
        className="mb-8 inline-block text-[13px] text-neutral-500 underline underline-offset-4 hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        ← Back to the gallery
      </Link>
      <figure>
        <Image
          src={photo.image}
          alt={photo.alt}
          placeholder="blur"
          sizes="(min-width: 896px) 832px, 100vw"
          priority
          className="block h-auto w-full rounded-2xl bg-neutral-100 dark:bg-neutral-800"
        />
        <figcaption className="mt-4 text-[15px] text-neutral-600 dark:text-neutral-300">
          {photo.caption}
        </figcaption>
      </figure>
      <p className="mt-8 max-w-2xl text-[13px] leading-6 text-neutral-500">
        You hard-loaded this photo URL, so route interception did not apply and you got this
        standalone page instead of the lightbox over the grid — one URL, two presentations. Navigate
        back to the gallery and click the same photo to see the intercepted modal presentation.
      </p>
    </div>
  );
}
