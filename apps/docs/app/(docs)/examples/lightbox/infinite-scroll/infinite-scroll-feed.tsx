'use client';

import * as React from 'react';
import Image, { type StaticImageData } from 'next/image';
import * as Lightbox from '@ramka/react/lightbox';
import { ChevronLeft, ChevronRight, LoaderCircle, X, ZoomIn, ZoomOut } from 'lucide-react';

import {
  lightboxChromeButton,
  lightboxChromeButtonGroup,
  lightboxChromeButtonMd,
  lightboxChromeButtonSegment,
  lightboxChromeSegmentDivider,
  triggerFocusClass,
} from '../../../../_components/lightbox-chrome';
import { feedImages } from './images.generated';

/**
 * Infinite scroll — one paginated photo list feeding both surfaces:
 *
 * - The **page feed** loads the next page when a sentinel below the grid
 *   enters the viewport (a hand-rolled IntersectionObserver — no library).
 * - The **open viewer** loads the next page when the active slide gets within
 *   `LOAD_AHEAD` slides of the end, via Root's `onValueChange` — which fires
 *   for swipes, arrow keys, and the Previous/Next buttons alike.
 *
 * The viewer uses `Lightbox.VirtualSlides` — the windowed variant of Slides —
 * because an endless feed grows unbounded: with plain Slides every loaded
 * photo mounts a slide box, and past a few hundred items that mount/unmount
 * cost lands inside the open/close transition's synchronous commit as a
 * visible stutter. VirtualSlides mounts only a window around the active index
 * (CSS spacers keep the native scroll-snap track's extent and offsets exact),
 * so the viewer costs the same at 12 photos or 12 000. Appending pages just
 * grows `count`; existing snap offsets never move, and the Next button /
 * arrow keys / counter pick up the new total on their own. The track's
 * responsive `gap` is mirrored into `--lightbox-slide-gap` so the spacers
 * account for the gaps the unmounted slides would have contributed.
 *
 * The viewer is deliberately minimal — slides, Previous/Next, the zoom
 * capsule, and Close. No thumbnail strip: without one, each `Lightbox.Item`
 * takes the standalone carousel-slide semantics, so it carries the
 * `aria-roledescription="slide"` + positional `aria-label` below.
 */

interface FeedPhoto {
  id: string;
  image: StaticImageData;
  alt: string;
  caption: string;
}

/** Photos per simulated API page. */
const PAGE_SIZE = 12;
/**
 * How close to the end (in slides) the viewer may get before the next page is
 * requested. Keep it larger than Slides' `preload` so new slides exist before
 * their media would be needed — the user should never swipe into the edge
 * rubber-band while the network is still working.
 */
const LOAD_AHEAD = 4;
/** Simulated network latency. */
const FETCH_DELAY_MS = 800;

/**
 * Deterministic page contents: the demo cycles a fixed pool of local assets,
 * so the feed is endless without runtime image generation. In a real app this
 * is whatever your API returns for `?page=n`.
 */
function buildPage(page: number): FeedPhoto[] {
  return Array.from({ length: PAGE_SIZE }, (_, i) => {
    const serial = page * PAGE_SIZE + i;
    const image = feedImages[serial % feedImages.length]!;
    return {
      id: `feed-${serial}`,
      image,
      alt: `Feed photo ${serial + 1}`,
      caption: `Photo #${serial + 1}`,
    };
  });
}

/** Simulated paginated API — swap for your real `fetch('/api/photos?page=n')`. */
function fetchPhotosPage(page: number): Promise<FeedPhoto[]> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(buildPage(page)), FETCH_DELAY_MS);
  });
}

export function InfiniteScrollFeed() {
  const [photos, setPhotos] = React.useState<FeedPhoto[]>(() => buildPage(0));
  const [loading, setLoading] = React.useState(false);

  // Refs so the stable callbacks below never go stale: the next page to
  // request, an in-flight guard, and the current list length (read by the
  // viewer's load-ahead check on every index change).
  const nextPageRef = React.useRef(1);
  const pendingRef = React.useRef(false);
  const countRef = React.useRef(photos.length);
  countRef.current = photos.length;

  const loadMore = React.useCallback(() => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setLoading(true);
    const page = nextPageRef.current;
    void fetchPhotosPage(page).then((nextPhotos) => {
      nextPageRef.current = page + 1;
      pendingRef.current = false;
      setLoading(false);
      // Append-only: existing indices (and existing snap offsets) never move.
      setPhotos((prev) => [...prev, ...nextPhotos]);
    });
  }, []);

  // Page-feed pagination: fetch when the sentinel under the grid comes within
  // 800px of the viewport. Re-created whenever the list grows — an observer
  // only reports intersection *changes*, so after an append that leaves the
  // sentinel still inside the margin it would otherwise stay silent.
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  const photoCount = photos.length;
  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: '800px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, photoCount]);

  // Viewer pagination: `onValueChange` fires for every navigation source —
  // swipe, arrow keys, the Previous/Next buttons, and the opening trigger —
  // so nearing the end by any route requests the next page.
  const handleValueChange = React.useCallback(
    (value: number) => {
      if (value >= countRef.current - LOAD_AHEAD) loadMore();
    },
    [loadMore],
  );

  return (
    <div className="min-h-screen select-none">
      <Lightbox.Root
        onValueChange={handleValueChange}
        // Keep the (possibly far-scrolled-to) trigger tile positioned for the
        // close morph; instant so the covered page never visibly scrolls.
        scrollTriggerIntoView={[
          { type: 'onChange', behavior: 'instant' },
          { type: 'onOpenComplete', behavior: 'instant' },
        ]}
        // Trigger thumb and slide share one source image, so the thumb bridge
        // covers the open — no reason to hold the morph for the decode.
        awaitImageDecode={false}
      >
        <div className="sticky top-14 z-30 flex shrink-0 items-center justify-between border-b border-black/[0.06] bg-background px-4 py-2.5 md:top-0 dark:border-white/[0.08]">
          <div className="flex flex-col">
            <span className="text-[19px] font-bold leading-6 tracking-tight text-neutral-900 dark:text-neutral-50">
              Feed
            </span>
            <span className="text-[11px] font-medium leading-4 text-neutral-500 dark:text-neutral-400">
              {photos.length} photos loaded · scrolls forever
            </span>
          </div>
        </div>

        {/* Every tile is a Trigger; new pages render new tiles AND new slides
            from the same array, so the viewer and the feed can never drift. */}
        <div className="grid grid-cols-3 gap-0.5 md:grid-cols-4 lg:grid-cols-5">
          {photos.map((photo, i) => (
            <Lightbox.Trigger
              key={photo.id}
              index={i}
              className={`relative block aspect-square cursor-pointer overflow-hidden bg-transparent p-0 md:scroll-mt-16 ${triggerFocusClass}`}
            >
              {({ imageRef }) => (
                <Image
                  ref={imageRef}
                  src={photo.image}
                  alt={photo.alt}
                  placeholder="blur"
                  sizes="(min-width: 1024px) 20vw, (min-width: 768px) 25vw, 33vw"
                  loading="lazy"
                  className="block size-full object-cover"
                />
              )}
            </Lightbox.Trigger>
          ))}
        </div>

        {/* Load-more sentinel + spinner. Observed with an 800px margin, so
            pages usually land before this scrolls into view. */}
        <div ref={sentinelRef} className="flex items-center justify-center py-10" aria-hidden>
          <LoaderCircle
            className={`h-5 w-5 animate-spin text-neutral-400 transition-opacity ${loading ? 'opacity-100' : 'opacity-0'}`}
          />
        </div>

        <Lightbox.Portal>
          <Lightbox.Backdrop className="lightbox-demo-backdrop fixed inset-0 bg-white dark:bg-black" />
          <Lightbox.Content
            aria-label="Feed photos"
            className="lightbox-demo-content lightbox-demo-content-solo fixed inset-0 flex flex-col overscroll-contain outline-none"
          >
            <Lightbox.VirtualSlides
              aria-roledescription="carousel"
              aria-label="Full-size photos"
              count={photos.length}
              preload={2}
              // Mirror the track's responsive gap so the virtual spacers size
              // exactly like the unmounted slides they stand in for.
              className="lightbox-demo-slides flex-1 gap-5 [--lightbox-slide-gap:1.25rem] [&::-webkit-scrollbar]:hidden md:gap-0 md:[--lightbox-slide-gap:0px]"
            >
              {(i) => {
                const photo = photos[i]!;
                return (
                  <Lightbox.Slide key={photo.id} className="lightbox-demo-slide-pad h-full">
                    <Lightbox.Item
                      index={i}
                      aria-roledescription="slide"
                      aria-label={`${i + 1} of ${photos.length}`}
                    >
                      <Lightbox.Zoom maxZoom={6}>
                        <Lightbox.Media
                          width={photo.image.width}
                          height={photo.image.height}
                          className="overflow-hidden rounded-none md:rounded-lg"
                        >
                          {/* Destination image: no blur placeholder — every index
                              has a trigger thumb, so Ramka bridges the open. */}
                          <Image
                            src={photo.image}
                            alt={photo.alt}
                            sizes="100vw"
                            loading="eager"
                            draggable={false}
                            className="select-none"
                          />
                        </Lightbox.Media>
                      </Lightbox.Zoom>
                    </Lightbox.Item>
                  </Lightbox.Slide>
                );
              }}
            </Lightbox.VirtualSlides>

            {/* Previous / Next — desktop only; mobile swipes. Both auto-disable
                at the loaded frontier and re-enable when the next page lands. */}
            <div className="lightbox-demo-chrome-hide absolute start-3 top-1/2 z-30 -translate-y-1/2">
              <Lightbox.Previous className={lightboxChromeButtonMd} aria-label="Previous photo">
                <ChevronLeft aria-hidden className="h-5 w-5" strokeWidth={2.25} />
              </Lightbox.Previous>
            </div>
            <div className="lightbox-demo-chrome-hide absolute end-3 top-1/2 z-30 -translate-y-1/2">
              <Lightbox.Next className={lightboxChromeButtonMd} aria-label="Next photo">
                <ChevronRight aria-hidden className="h-5 w-5" strokeWidth={2.25} />
              </Lightbox.Next>
            </div>

            <div className="lightbox-demo-chrome-top lightbox-demo-chrome-hide absolute end-3 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-30 flex gap-2">
              <div className={lightboxChromeButtonGroup}>
                <Lightbox.ZoomOut className={lightboxChromeButtonSegment} aria-label="Zoom out">
                  <ZoomOut aria-hidden className="h-4 w-4" strokeWidth={2.25} />
                </Lightbox.ZoomOut>
                <Lightbox.ZoomIn
                  className={`${lightboxChromeButtonSegment} ${lightboxChromeSegmentDivider}`}
                  aria-label="Zoom in"
                >
                  <ZoomIn aria-hidden className="h-4 w-4" strokeWidth={2.25} />
                </Lightbox.ZoomIn>
              </div>
              <Lightbox.Close className={lightboxChromeButton} aria-label="Close">
                <X aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </Lightbox.Close>
            </div>

            {/* Counter proves the append: the total grows while the viewer is
                open. The pill appears while a page is in flight. */}
            <div className="lightbox-demo-chrome-bottom lightbox-demo-chrome-hide pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 px-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
              <Lightbox.Counter className="text-[11px] leading-tight tabular-nums text-neutral-500 dark:text-neutral-400">
                {({ current, total }) => `${current} of ${total}`}
              </Lightbox.Counter>
              <div
                className={`flex items-center gap-1.5 rounded-full bg-black/[0.05] px-2.5 py-1 text-[11px] font-medium text-neutral-600 transition-opacity dark:bg-white/[0.09] dark:text-neutral-300 ${loading ? 'opacity-100' : 'opacity-0'}`}
                aria-hidden={!loading}
              >
                <LoaderCircle className="h-3 w-3 animate-spin" />
                Loading more photos
              </div>
            </div>
          </Lightbox.Content>
        </Lightbox.Portal>
      </Lightbox.Root>
    </div>
  );
}
