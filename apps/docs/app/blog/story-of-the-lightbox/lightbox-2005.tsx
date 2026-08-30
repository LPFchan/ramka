'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * An era-accurate recreation of the 2005–2006 Lightbox experience: dimmed
 * overlay, white photo frame, a loading spinner standing in for loading.gif,
 * Verdana captions, hover-half prev/next zones, and the famous animated
 * resize between photos of different sizes.
 *
 * The photos are CSS gradients so the demo ships no image assets and the
 * resize wobble is visible immediately. The overlay is scoped to the figure
 * (absolute, not fixed) so the demo never takes over the reader's page.
 */

type Photo = {
  id: string;
  title: string;
  /** Frame size at the demo's scale — deliberately mismatched aspect ratios. */
  w: number;
  h: number;
  gradient: string;
};

const PHOTOS: Photo[] = [
  {
    id: 'dunes',
    title: 'Dunes at Fort Funston',
    w: 236,
    h: 158,
    gradient: 'linear-gradient(160deg, #fcd34d 0%, #fb923c 45%, #be456b 100%)',
  },
  {
    id: 'bridge',
    title: 'Bridge, fog coming in',
    w: 164,
    h: 210,
    gradient: 'linear-gradient(200deg, #bae6fd 0%, #7c9ff2 55%, #4c3d8f 100%)',
  },
  {
    id: 'tide',
    title: 'Ocean Beach, low tide',
    w: 252,
    h: 132,
    gradient: 'linear-gradient(120deg, #99f6e4 0%, #34b3a8 50%, #135e63 100%)',
  },
];

const FRAME_PADDING = 10;
const CAPTION_HEIGHT = 46;
/** Roughly the resizeDuration the original computed from its speed setting. */
const RESIZE_MS = 420;
const LOAD_MS = 650;

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-6 animate-spin rounded-full border-[3px] border-neutral-300 border-t-neutral-600"
    />
  );
}

/** Grey skeleton bar standing in for 2005 blog prose. */
function Bar({ className }: { className: string }) {
  return <div className={`rounded-sm bg-neutral-200/80 dark:bg-neutral-800 ${className}`} />;
}

export function Lightbox2005() {
  const [index, setIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const goTo = (next: number) => {
    setIndex(next);
    setLoading(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    // The original resized the frame first, then faded the photo in once
    // loading.gif's work was done. Same order here.
    timerRef.current = setTimeout(() => setLoading(false), LOAD_MS);
  };

  const close = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIndex(null);
    setLoading(false);
  };

  const photo = index === null ? null : PHOTOS[index]!;
  const frameWidth = (photo?.w ?? 0) + FRAME_PADDING * 2;
  const frameHeight = (photo?.h ?? 0) + FRAME_PADDING + CAPTION_HEIGHT;

  return (
    <figure className="my-8 rounded-2xl border border-neutral-200 p-4 md:p-5 dark:border-neutral-800">
      <div className="relative overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        {/* A 2005 blog post, at miniature scale. */}
        <div className="flex flex-col gap-4 p-4 md:p-5">
          <div>
            <div className="font-serif text-[17px] font-bold text-neutral-800 dark:text-neutral-200">
              Weekend photos
            </div>
            <div className="mt-1 text-[11px] text-neutral-400" style={{ fontFamily: 'Verdana, sans-serif' }}>
              Posted December 2005 · 3 comments
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Bar className="h-2.5 w-full" />
            <Bar className="h-2.5 w-11/12" />
            <Bar className="h-2.5 w-3/5" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {PHOTOS.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => goTo(i)}
                className="block cursor-pointer border border-neutral-300 bg-white p-1 transition hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-500"
                aria-label={`Open ${p.title} in the 2005 lightbox`}
              >
                <span className="block h-12 w-16" style={{ background: p.gradient }} />
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <Bar className="h-2.5 w-10/12" />
            <Bar className="h-2.5 w-2/3" />
          </div>
        </div>

        {/* The overlay. In 2005 this was a tiled translucent PNG, because
            rgba() backgrounds were still years from being dependable. */}
        {photo && (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-3">
            <button
              type="button"
              aria-label="Close by clicking the overlay"
              onClick={close}
              className="absolute inset-0 cursor-pointer bg-black/75"
            />
            <div
              className="relative bg-white shadow-2xl"
              style={{
                width: frameWidth,
                height: frameHeight,
                maxWidth: '100%',
                transition: `width ${RESIZE_MS}ms ease-in-out, height ${RESIZE_MS}ms ease-in-out`,
              }}
            >
              <div className="absolute" style={{ inset: FRAME_PADDING, bottom: CAPTION_HEIGHT - FRAME_PADDING }}>
                <div
                  className="absolute inset-0 transition-opacity duration-300"
                  style={{ background: photo.gradient, opacity: loading ? 0 : 1 }}
                />
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Spinner />
                  </div>
                )}

                {/* Hover-half navigation, the 2006 way: PREV lives on the left
                    50% of the photo, NEXT on the right, visible on hover. */}
                {!loading && (
                  <>
                    <button
                      type="button"
                      onClick={() => goTo((index! + PHOTOS.length - 1) % PHOTOS.length)}
                      className="group absolute inset-y-0 left-0 w-1/2 cursor-pointer"
                      aria-label="Previous image"
                    >
                      <span
                        className="absolute top-1/2 left-1.5 -translate-y-1/2 bg-black/45 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                        style={{ fontFamily: 'Verdana, sans-serif' }}
                      >
                        ‹ PREV
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => goTo((index! + 1) % PHOTOS.length)}
                      className="group absolute inset-y-0 right-0 w-1/2 cursor-pointer"
                      aria-label="Next image"
                    >
                      <span
                        className="absolute top-1/2 right-1.5 -translate-y-1/2 bg-black/45 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                        style={{ fontFamily: 'Verdana, sans-serif' }}
                      >
                        NEXT ›
                      </span>
                    </button>
                  </>
                )}
              </div>

              {/* The caption bar: Verdana, #666, and a CLOSE control, exactly
                  the furniture the original drew under every photo. */}
              <div
                className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 px-2.5 pb-2"
                style={{ height: CAPTION_HEIGHT, fontFamily: 'Verdana, sans-serif' }}
              >
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-bold text-neutral-700">{loading ? '' : photo.title}</div>
                  <div className="mt-0.5 text-[10px] text-neutral-400">
                    Image {index! + 1} of {PHOTOS.length}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="shrink-0 cursor-pointer text-[10px] font-bold tracking-wide text-neutral-500 transition hover:text-neutral-800"
                >
                  CLOSE ×
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <figcaption className="mt-4 text-[13px] leading-6 text-neutral-500 dark:text-neutral-400">
        Click a thumbnail. The dim, the white frame, the loading spinner, the caption in tiny Verdana, and the animated
        resize between differently sized photos are all faithful to 2005–2006 Lightbox, down to prev and next being
        invisible until you hover the photo&rsquo;s left or right half. One period detail is simulated: the
        original&rsquo;s dim was a tiled translucent PNG, not CSS opacity. And notice what your thumb already misses: no
        swiping, no pinch, no momentum. In 2005, you clicked.
      </figcaption>
    </figure>
  );
}
