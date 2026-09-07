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
  // No `Lightbox.Trigger`s exist anywhere in this pattern (the grid is plain
  // Links), so no index has a trigger image and Ramka has nothing to bridge —
  // per the Next.js Image guide, the destination LQIP is the only loading
  // placeholder and belongs on every item.
  destinationBlur: true,
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
      // The Root mounts already open; `count` covers the render before the
      // items' registration effects run so the counter never reads "n of 0".
      count={interceptedPhotos.length}
      loop
    >
      <LightboxGallery
        items={items}
        ariaLabel="Gallery photos"
        backdrop="solid"
        // The Root mounts already open and captions register in effects (after
        // the first paint) — the fallback covers that first-paint window.
        captionFallback={interceptedPhotos[index]?.caption}
      />
    </Lightbox.Root>
  );
}
