import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { ExampleShell } from '../../../../_components/example-shell';
import { EXAMPLE_BASE_PATH, EXAMPLE_PAGE_TITLE, interceptedPhotos } from './photos';

export const metadata: Metadata = {
  title: EXAMPLE_PAGE_TITLE,
  description:
    'A photo grid wired to Next.js intercepted + parallel routes: clicking a tile soft-navigates to the photo URL and the lightbox opens in a @modal slot over the grid; loading that URL cold renders a standalone photo page instead. Built with ramka.',
};

/**
 * The grid is plain `<Link>`s — NOT `Lightbox.Trigger`s. Opening is a router
 * navigation: Next.js intercepts it (`@modal/(.)photos/[id]`) and mounts an
 * already-open lightbox in the layout's modal slot while this page stays on
 * screen underneath. That's the defining tradeoff of this pattern versus the
 * URL-synced state example: the open never flows through the library's
 * gesture path, so there is no trigger morph (the viewer fades in), and a
 * refresh on a photo URL renders a different presentation (the standalone
 * page) rather than this grid with the viewer open.
 *
 * `scroll={false}` keeps the grid's scroll position while the modal is up —
 * without it, Next scrolls the page to the top on every navigation.
 */
export default function InterceptedRoutesGridPage() {
  return (
    <ExampleShell
      title="Intercepted routes"
      description="The nextgram pattern: a grid of plain Next.js Links, a @modal parallel-route slot, and an (.)photos/[id] intercepting route that mounts an already-open, controlled lightbox during soft navigation — browser Back closes it. Hard-loading the same photo URL skips interception entirely and renders a standalone photo page: one URL, two presentations. Compare with the URL-synced state example, which keeps one presentation (grid + viewer) on refresh and keeps trigger morphs, at the cost of owning the History API writes itself."
      docsHref="/docs/lightbox/state-lifecycle"
      docsLabel="State & lifecycle docs"
    >
      <div className="grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-3">
        {interceptedPhotos.map((photo) => (
          <Link
            key={photo.id}
            href={`${EXAMPLE_BASE_PATH}/photos/${photo.id}`}
            scroll={false}
            className="block overflow-hidden rounded-xl"
          >
            <Image
              src={photo.image}
              alt={photo.alt}
              placeholder="blur"
              sizes="(min-width: 640px) 224px, 50vw"
              loading="lazy"
              className="block aspect-square h-auto w-full rounded-xl bg-neutral-100 object-cover transition duration-200 hover:opacity-90 dark:bg-neutral-800"
            />
          </Link>
        ))}
      </div>
    </ExampleShell>
  );
}
