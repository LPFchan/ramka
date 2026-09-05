import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { MoodboardDemo } from '../moodboard-demo';
import { moodboardPhotos } from '../photos';

/**
 * Optional catch-all: `/examples/lightbox/moodboard` renders the grid, and
 * `/examples/lightbox/moodboard/mb-05` is the same page deep-linked into the
 * lightbox — the client demo reads the photo id from the pathname and opens on
 * that slide. One route (one page component) for both URL shapes means
 * client-side URL changes reconcile into the same mounted tree, so the viewer
 * never remounts while it rewrites the URL.
 */
interface MoodboardRouteProps {
  params: Promise<{ id?: string[] }>;
}

/** Prerender the grid plus every photo permalink. */
export function generateStaticParams() {
  return [{ id: [] }, ...moodboardPhotos.map((photo) => ({ id: [photo.id] }))];
}

export async function generateMetadata({ params }: MoodboardRouteProps): Promise<Metadata> {
  const { id } = await params;
  const photo = id ? moodboardPhotos.find((p) => p.id === id[0]) : undefined;
  if (photo) {
    return {
      title: `${photo.caption} — Moodboard example`,
      description: `${photo.alt} — a deep link straight into the moodboard lightbox, driven by a Next.js dynamic route and ramka's controlled open/value props.`,
    };
  }
  return {
    title: 'Moodboard example',
    description:
      'A masonry lightbox wired to Next.js dynamic routes: every photo is a shareable URL — deep links open the viewer, swipes rewrite the URL, browser Back closes it. Built with ramka.',
  };
}

export default async function MoodboardRoute({ params }: MoodboardRouteProps) {
  const { id } = await params;
  // Unknown photo ids 404 like any other dynamic route.
  if (id && (id.length > 1 || !moodboardPhotos.some((photo) => photo.id === id[0]))) {
    notFound();
  }
  return <MoodboardDemo />;
}
