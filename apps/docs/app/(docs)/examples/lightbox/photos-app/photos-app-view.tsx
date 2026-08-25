'use client';

import * as React from 'react';
import { flushSync } from 'react-dom';
import Image, { type StaticImageData } from 'next/image';
import * as Lightbox from '@ramka/react/lightbox';
import { Heart, Minus, Plus } from 'lucide-react';

import {
  LightboxGallery,
  triggerFocusClass,
} from '../../../../_components/lightbox-chrome';
import { photoImages } from './images.generated';

/**
 * A macOS Photos–style app surface: a dense grid of square thumbnails under a
 * sticky, blurred toolbar. The whole page *is* the app — no docs chrome. The
 * toolbar `−`/`+` buttons change the grid density (crossfaded via a View
 * Transition), and tapping any photo opens the shared docs fullscreen viewer
 * (`LightboxGallery`): swipe navigation, desktop thumbnails, a View
 * Transition morph, pinch / scroll / keyboard zoom, and pull-to-dismiss.
 *
 * Rendered at two routes: `photos-app` (LTR) and `photos-app-rtl`, which passes
 * `dir="rtl"` to show the same composition mirrored.
 */

interface Photo {
  id: string;
  /**
   * One local asset per photo (varied natural aspect ratios). The grid trigger
   * and the viewer share the same source image — next/image serves each at the
   * right resolution via `sizes`/srcset — so the trigger→viewer morph never
   * crossfades between differently-cropped images.
   */
  image: StaticImageData;
  alt: string;
  caption: string;
  favorite?: boolean;
}

const photos: Photo[] = photoImages.map((image, i) => ({
  id: `photo-${i}`,
  image,
  alt: `Photo ${i + 1}`,
  caption: `July ${(i % 28) + 1}, 2024`,
  favorite: i === 0 || i === 15 || i === 24,
}));

// Small toolbar buttons (grid density).
const toolbarButton =
  'inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-600 transition hover:bg-black/5 disabled:pointer-events-none disabled:opacity-30 dark:text-neutral-300 dark:hover:bg-white/10';

// Grid density (columns). Fewer columns = larger photos. The zoom buttons
// step between these bounds; `+` grows the photos, `−` shrinks them.
const MIN_COLUMNS = 2;
const MAX_COLUMNS = 10;
const DEFAULT_COLUMNS = 5;

const clampColumns = (c: number) => Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, c));

const supportsViewTransitions = () =>
  typeof document !== 'undefined' &&
  typeof (document as Document & { startViewTransition?: unknown }).startViewTransition === 'function';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Mirror the *document* while this page is mounted.
 *
 * `Lightbox.Portal` renders into `document.body`, so a `dir` on a wrapper here
 * would style the grid and leave the viewer LTR. `<html dir>` is the placement
 * that reaches both, and it is what a real RTL app does. Restored on unmount so
 * navigating to another example doesn't inherit it.
 */
function useDocumentDirection(dir: 'ltr' | 'rtl') {
  React.useLayoutEffect(() => {
    if (dir === 'ltr') return;
    const html = document.documentElement;
    const previous = html.getAttribute('dir');
    html.setAttribute('dir', 'rtl');
    return () => {
      if (previous === null) html.removeAttribute('dir');
      else html.setAttribute('dir', previous);
    };
  }, [dir]);
}

export function PhotosAppView({ dir = 'ltr' }: { dir?: 'ltr' | 'rtl' }) {
  const [columns, setColumns] = React.useState(DEFAULT_COLUMNS);
  useDocumentDirection(dir);

  const zoomTo = (next: number) => {
    const target = clampColumns(next);
    if (target === columns) return;

    if (!supportsViewTransitions() || prefersReducedMotion()) {
      setColumns(target);
      return;
    }

    // The grid carries a single `view-transition-name`, so the browser
    // captures it as one unit and simply crossfades the old layout into the
    // new one. `flushSync` commits the column change inside the transition.
    (document as Document & { startViewTransition: (cb: () => void) => unknown }).startViewTransition(() =>
      flushSync(() => setColumns(target)),
    );
  };

  const zoomIn = () => zoomTo(columns - 1);
  const zoomOut = () => zoomTo(columns + 1);

  return (
    <div className="min-h-screen select-none">
      <Lightbox.Root
        loop
        dir={dir}
        scrollTriggerIntoView={[
          { type: 'onChange', behavior: 'instant' },
          { type: 'onOpenComplete', behavior: 'instant' },
        ]}
        awaitImageDecode={false}
      >
        {/* The toolbar and the grid get *separate* `view-transition-name`s.
            Sharing one group would stretch the snapshot when the grid height
            changes with the column count, visibly dragging the stuck header;
            naming the toolbar separately keeps it static (its box doesn't
            change) and — since it paints above the grid — its group also
            layers above the grid's crossfade. */}
        <div>
          {/* Apple Photos-style large-title toolbar: solid surface (no
              backdrop-filter on this site), hairline bottom edge, title +
              count on the left, density capsule on the right. Sticky below
              the mobile docs nav (top-14) and at the viewport top on md+. */}
          <div
            style={{ viewTransitionName: 'photos-toolbar' }}
            className="pointer-events-auto sticky top-14 z-30 flex shrink-0 items-center gap-3 border-b border-black/[0.06] bg-background px-4 py-2.5 md:top-0 dark:border-white/[0.08]"
          >
            <div className="flex flex-col">
              <span className="text-[19px] font-bold leading-6 tracking-tight text-neutral-900 dark:text-neutral-50">
                Library
              </span>
              <span className="text-[11px] font-medium leading-4 text-neutral-500 dark:text-neutral-400">
                {photos.length} Photos · July 2024
              </span>
            </div>

            <div className="flex flex-1 items-center justify-end">
              <div className="flex items-center gap-0.5 rounded-full bg-black/[0.05] p-0.5 dark:bg-white/[0.09]">
                <button
                  type="button"
                  aria-label="Smaller photos"
                  onClick={zoomOut}
                  disabled={columns >= MAX_COLUMNS}
                  className={toolbarButton}
                >
                  <Minus aria-hidden className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Larger photos"
                  onClick={zoomIn}
                  disabled={columns <= MIN_COLUMNS}
                  className={toolbarButton}
                >
                  <Plus aria-hidden className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Every tile is a `Lightbox.Trigger`, so tapping one morphs into
              the viewer. The grid carries its own VT name for the density
              crossfade. */}
          <div
            className="grid gap-0.5"
            style={{
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              viewTransitionName: 'photos-grid',
            }}
          >
            {photos.map((photo, i) => (
              <Lightbox.Trigger
                key={photo.id}
                index={i}
                // scroll-margin clears the sticky toolbar so scrollTriggerIntoView
                // doesn't leave a tile tucked under it. On mobile the docs
                // MobileNav overlaps the toolbar and is handled by the document's
                // scroll-pt-14, so this only needs to kick in at md+.
                className={`relative block aspect-square cursor-pointer overflow-hidden bg-transparent p-0 md:scroll-mt-16 ${triggerFocusClass}`}
              >
                {({ imageRef }) => (
                  <>
                    <Image
                      ref={imageRef}
                      src={photo.image}
                      alt={photo.alt}
                      placeholder="blur"
                      sizes={`${Math.round(100 / columns)}vw`}
                      loading="lazy"
                      className="block size-full object-cover"
                    />
                    {photo.favorite ? (
                      <Heart
                        aria-hidden
                        className="pointer-events-none absolute bottom-1.5 start-1.5 h-4 w-4 fill-white text-white drop-shadow"
                      />
                    ) : null}
                  </>
                )}
              </Lightbox.Trigger>
            ))}
          </div>
        </div>

        <LightboxGallery
          items={photos.map((photo) => ({
            id: photo.id,
            src: photo.image,
            thumb: photo.image,
            alt: photo.alt,
            caption: photo.caption,
          }))}
          ariaLabel="Library photos"
          backdrop="solid"
          renderItem={(_item, i) => {
            const photo = photos[i]!;
            return (
              <Lightbox.Zoom maxZoom={6}>
                <Lightbox.Media
                  width={photo.image.width}
                  height={photo.image.height}
                  className="overflow-hidden rounded-none md:rounded-lg"
                >
                  {/* Destination Image: no placeholder — every index has a
                      trigger thumb, so Ramka owns the open bridge. */}
                  <Image
                    src={photo.image}
                    alt={photo.alt}
                    sizes="100vw"
                    priority
                    draggable={false}
                    className="select-none"
                  />
                </Lightbox.Media>
              </Lightbox.Zoom>
            );
          }}
        />
      </Lightbox.Root>
    </div>
  );
}
