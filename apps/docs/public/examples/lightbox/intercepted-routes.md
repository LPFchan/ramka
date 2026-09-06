# Intercepted routes

The nextgram pattern: grid of plain Links, a @modal parallel-route slot, and an (.)photos/[id] intercepting route mounting an already-open controlled lightbox — Back closes it, hard loads get a standalone photo page (one URL, two presentations).

## Source

```tsx examples/lightbox/intercepted-routes/page.tsx
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
```

```tsx examples/lightbox/intercepted-routes/layout.tsx
/**
 * The layout is what makes the parallel-route slot exist: `@modal` renders as
 * the `modal` prop NEXT TO the page, not inside it. During soft navigation to
 * `photos/[id]` the interception route fills this slot with the lightbox while
 * `children` keeps showing the grid the user was on; on hard loads the slot
 * renders `@modal/default.tsx` (null) and `children` is the standalone photo
 * page.
 */
export default function InterceptedRoutesLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
```

```tsx examples/lightbox/intercepted-routes/photo-modal.tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import * as Lightbox from '@ramka/react/lightbox';

import { LightboxGallery } from '../../../../_components/lightbox-chrome';
import {
  EXAMPLE_BASE_PATH,
  EXAMPLE_PAGE_TITLE,
  interceptedPhotos,
  interceptedPhotoTitle,
} from './photos';

const items = interceptedPhotos.map((photo) => ({
  ...photo,
  src: photo.image,
  thumb: photo.image,
}));

/**
 * The viewer the intercepting route mounts: a self-contained, ALREADY-OPEN
 * controlled lightbox. There are no `Lightbox.Trigger`s here — the router
 * opened this, not a gesture, which is the pattern's defining tradeoff: the
 * open never flows through the library's gesture path, so it fades in rather
 * than morphing from the clicked tile.
 *
 * The default body portal is fine here (unlike the URL-synced state example's
 * `container={null}`): interception only happens during client-side
 * navigation, where `document.body` exists. Nothing about this component is
 * ever server-painted into the page.
 */
export function PhotoModal({ initialIndex }: { initialIndex: number }) {
  const router = useRouter();

  // Local `open` so a close gesture (Escape, ✕, pull-to-dismiss) can play the
  // skin's fade BEFORE the route unmounts this component: flipping the route
  // first (router.back() in onOpenChange) would yank the viewer out of the
  // DOM mid-frame. Browser Back does exactly that — popstate unmounts the
  // slot with no exit animation — which is unavoidable in this pattern.
  const [open, setOpen] = React.useState(true);
  const [index, setIndex] = React.useState(initialIndex);

  // Swipes REPLACE the current history entry with the new photo URL — no
  // history spam, and the grid entry underneath stays intact so one Back
  // always closes the viewer. replaceState is a shallow write: Next.js keeps
  // rendering this same mounted route (usePathname-style readers update, but
  // no navigation happens), so the viewer never remounts mid-swipe.
  const handleValueChange = (nextIndex: number) => {
    setIndex(nextIndex);
    window.history.replaceState(
      null,
      '',
      `${EXAMPLE_BASE_PATH}/photos/${interceptedPhotos[nextIndex]!.id}`,
    );
  };

  // Close = leave the photo route. router.back() (not push) pops the entry
  // the grid's <Link> pushed, so the history stack ends the session exactly
  // where it started. Deferred to onOpenChangeComplete so the fade finishes
  // first; the popstate then unmounts the @modal slot.
  const handleOpenChangeComplete = (isOpen: boolean) => {
    if (!isOpen) router.back();
  };

  // Shallow replaceState never re-runs route metadata, so swiping would
  // strand the tab title on the photo the modal opened with — same lesson as
  // the URL-synced state example: own the URL writes, own the title. The
  // ` — ramka` suffix mirrors the root layout's title template, which only
  // applies server-side.
  React.useEffect(() => {
    document.title = `${interceptedPhotoTitle(interceptedPhotos[index]!)} — ramka`;
  }, [index]);

  // Closing needs the same care: router.back() pops to the grid URL, but the
  // grid page in the `children` slot never changed, so Next.js has no
  // metadata update to apply — the photo title would stick to the grid.
  // Restore it when the slot unmounts (close and browser Back both land on
  // the grid, the only places this modal can exit to).
  React.useEffect(() => {
    return () => {
      document.title = `${EXAMPLE_PAGE_TITLE} — ramka`;
    };
  }, []);

  return (
    <Lightbox.Root
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={handleOpenChangeComplete}
      value={index}
      onValueChange={handleValueChange}
      loop
    >
      <LightboxGallery items={items} ariaLabel="Gallery photos" backdrop="solid" />
    </Lightbox.Root>
  );
}
```

```ts examples/lightbox/intercepted-routes/photos.ts
import type { StaticImageData } from 'next/image';

// Static imports (not the download-images generator) — this example reuses the
// photo assets downloaded for the URL-synced state example, so there is no
// per-example image set to generate.
import p1 from '../../../../_assets/photos/mb-01.jpg';
import p2 from '../../../../_assets/photos/mb-02.jpg';
import p4 from '../../../../_assets/photos/mb-04.jpg';
import p5 from '../../../../_assets/photos/mb-05.jpg';
import p7 from '../../../../_assets/photos/mb-07.jpg';
import p8 from '../../../../_assets/photos/mb-08.jpg';
import p10 from '../../../../_assets/photos/mb-10.jpg';
import p11 from '../../../../_assets/photos/mb-11.jpg';

/**
 * Shared photo catalogue for the intercepted-routes example. One list serves
 * the grid page, the intercepted modal route, and the standalone photo page
 * (`photos/[id]/page.tsx`), so a photo's URL can never drift from its slide.
 */
export interface InterceptedPhoto {
  /**
   * URL segment for the photo route (`…/intercepted-routes/photos/5`). A
   * stable id looked up by value — never by array position — so reordering
   * or removing photos can't repoint existing links.
   */
  id: string;
  alt: string;
  caption: string;
  image: StaticImageData;
}

export const EXAMPLE_BASE_PATH = '/examples/lightbox/intercepted-routes';

export const EXAMPLE_PAGE_TITLE = 'Intercepted routes example';

export function interceptedPhotoTitle(photo: InterceptedPhoto): string {
  return `${photo.caption} — ${EXAMPLE_PAGE_TITLE}`;
}

export const interceptedPhotos: InterceptedPhoto[] = (
  [
    { id: '1', alt: 'Foggy pine ridge at dawn', caption: 'Dawn ridge' },
    { id: '2', alt: 'Empty coastal highway', caption: 'Open road' },
    { id: '3', alt: 'Narrow sunlit alley', caption: 'Warm alley' },
    { id: '4', alt: 'Wide desert dunes', caption: 'Dunes' },
    { id: '5', alt: 'Calm lake reflection', caption: 'Still water' },
    { id: '6', alt: 'Tall concrete staircase', caption: 'Ascent' },
    { id: '7', alt: 'Panoramic city skyline at dusk', caption: 'Dusk skyline' },
    { id: '8', alt: 'Single tree in a green field', caption: 'Lone tree' },
  ] as const
).map((photo, i) => ({ ...photo, image: [p1, p2, p4, p5, p7, p8, p10, p11][i]! }));
```

```tsx examples/lightbox/intercepted-routes/@modal/default.tsx
/**
 * Required for every parallel-route slot: rendered whenever the current URL
 * has no match inside `@modal` — the grid page, the standalone photo page on
 * a hard load, and any unmatched sibling route. Without it those URLs 404.
 */
export default function ModalDefault() {
  return null;
}
```

```tsx examples/lightbox/intercepted-routes/@modal/(.)photos/[id]/page.tsx
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
```

```tsx examples/lightbox/intercepted-routes/photos/[id]/page.tsx
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
```
