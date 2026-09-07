import { notFound } from 'next/navigation';

import { PhotoModal } from '../../../photo-modal';
import { interceptedPhotos } from '../../../photos';

/**
 * The intercepting route: `(.)` matches `photos/[id]` at the same segment
 * level, so a soft navigation from the grid renders THIS page into the
 * layout's `@modal` slot instead of navigating to the standalone photo page —
 * the grid stays mounted underneath. Hard loads never come here (interception
 * is client-navigation-only); they get `photos/[id]/page.tsx`.
 */
export default async function InterceptedPhotoRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const index = interceptedPhotos.findIndex((photo) => photo.id === id);
  if (index === -1) notFound();
  return <PhotoModal initialIndex={index} />;
}
