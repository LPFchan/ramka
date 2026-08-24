# Film trailers

Movie posters morph into a fullscreen <video> that auto-plays on becoming active.

## Source

```tsx examples/lightbox/film-trailers/page.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import * as Lightbox from '@ramka/react/lightbox';
import { Play } from 'lucide-react';

import { ExampleShell } from '../../../../_components/example-shell';
import {
  LightboxGallery,
  triggerFocusClass,
} from '../../../../_components/lightbox-chrome';
import { bbbPoster, edPoster, sintelPoster, tosPoster } from './images.generated';

/**
 * Blender Open Movies — real trailers/shorts with their official posters
 * (local copies of the Wikimedia Commons art, CC-BY Blender Foundation) so the
 * trigger thumbnail matches the video poster 1:1. Trailers are preferred where
 * available so the demo stays snappy to load.
 *
 * Each film is its own `Lightbox.Root` (no shared gallery) so opening one is a
 * single poster → fullscreen video morph.
 *
 * Media is sized to the *video* aspect (landscape), not the poster — so the
 * playing frame fills the fit-box without letterboxing. The open morph still
 * starts from the portrait poster (`crossfade="close"` hard-cuts into video).
 */
const films = [
  {
    id: 'bbb',
    title: 'Big Buck Bunny',
    year: 2008,
    genre: 'Animation',
    poster: bbbPoster,
    video: 'https://download.blender.org/peach/trailer/trailer_iphone.m4v',
    videoWidth: 480,
    videoHeight: 270,
  },
  {
    id: 'ed',
    title: "Elephant's Dream",
    year: 2006,
    genre: 'Sci-Fi',
    poster: edPoster,
    video: 'https://archive.org/download/ElephantsDream/ed_1024_512kb.mp4',
    videoWidth: 426,
    videoHeight: 240,
  },
  {
    id: 'sintel',
    title: 'Sintel',
    year: 2010,
    genre: 'Fantasy',
    poster: sintelPoster,
    video: 'https://download.blender.org/durian/trailer/sintel_trailer-720p.mp4',
    videoWidth: 1280,
    videoHeight: 720,
  },
  {
    id: 'tos',
    title: 'Tears of Steel',
    year: 2012,
    genre: 'Sci-Fi',
    poster: tosPoster,
    video: 'https://archive.org/download/Tears-of-Steel/tears_of_steel_720p.mp4',
    // Scope encode from the file (~2.39:1), not 16:9.
    videoWidth: 862,
    videoHeight: 360,
  },
];

function LightboxVideo({
  src,
  poster,
  readyToPlay,
  width,
  height,
}: {
  src: string;
  poster: string;
  /** True only after `onOpenChangeComplete(true)` — keeps playback off during the open morph. */
  readyToPlay: boolean;
  width: number;
  height: number;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Autoplay only after the open transition finishes. While closed / mid-open /
  // closing, stay paused at 0 so the poster frame stays stable for the morph.
  React.useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (readyToPlay) {
      el.play().catch(() => {});
    } else {
      el.pause();
      el.currentTime = 0;
    }
  }, [readyToPlay]);

  return (
    <Lightbox.Zoom>
      {/* Media morphs + bridges the poster; video fills the sized host. */}
      <Lightbox.Media width={width} height={height} className="overflow-hidden rounded-xl">
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          width={width}
          height={height}
          controls
          playsInline
          muted
          preload="metadata"
          className="object-cover"
        />
      </Lightbox.Media>
    </Lightbox.Zoom>
  );
}

function FilmLightbox({ film }: { film: (typeof films)[number] }) {
  const [readyToPlay, setReadyToPlay] = React.useState(false);

  return (
    <Lightbox.Root
      onOpenChange={(open) => {
        if (!open) setReadyToPlay(false);
      }}
      onOpenChangeComplete={(open) => {
        setReadyToPlay(open);
      }}
    >
      <Lightbox.Trigger
        index={0}
        // Hard-cut open (poster → video poster), dissolve on close (live frame → trigger).
        crossfade="close"
        className={`group block w-full cursor-pointer rounded-xl border-none bg-transparent p-0 text-left ${triggerFocusClass}`}
      >
        {({ morphRef }) => (
          <>
            {/* morphRef on the wrapper so poster + play affordance morph together. */}
            <div
              ref={morphRef}
              className={`relative overflow-hidden rounded-xl`}
            >
              <Image
                src={film.poster}
                alt={film.title}
                placeholder="blur"
                sizes="(min-width: 640px) 230px, 50vw"
                className="block aspect-[2/3] w-full rounded-xl object-cover"
                loading="lazy"
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/25 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-black">
                  <Play aria-hidden className="h-5 w-5 fill-current" />
                </div>
              </div>
            </div>
            <div className="px-0.5 pt-2.5">
              <div className="text-sm font-medium leading-snug">{film.title}</div>
              <div className="text-xs text-muted-foreground">
                {film.year} · {film.genre}
              </div>
            </div>
          </>
        )}
      </Lightbox.Trigger>

      <LightboxGallery
        items={[
          {
            id: film.id,
            src: film.poster,
            thumb: film.poster,
            alt: film.title,
            caption: film.title,
            width: film.videoWidth,
            height: film.videoHeight,
          },
        ]}
        ariaLabel={film.title}
        thumbnails="never"
        zoomControls={false}
        renderItem={() => (
          <LightboxVideo
            src={film.video}
            poster={film.poster.src}
            readyToPlay={readyToPlay}
            width={film.videoWidth}
            height={film.videoHeight}
          />
        )}
      />
    </Lightbox.Root>
  );
}

export default function FilmTrailersPage() {
  return (
    <ExampleShell
      title="Film trailers"
      description={
        <>
          Each poster is its own{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">Lightbox.Root</code> with a
          single-item gallery and{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">renderItem</code> for the
          video.{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">crossfade=&quot;close&quot;</code>{' '}
          hard-cuts the open morph into the video and dissolves the live frame back into the poster on close. Video
          autoplays (muted) only after{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">onOpenChangeComplete</code>.
        </>
      }
    >
      <div className="max-w-3xl">
        <div className="py-5">
          <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Now Streaming
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Blender Open Movies</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Four Creative Commons shorts from the Blender Foundation. Click any poster to watch fullscreen.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
          {films.map((film) => (
            <FilmLightbox key={film.id} film={film} />
          ))}
        </div>
      </div>
    </ExampleShell>
  );
}
```
