'use client';

import * as React from 'react';
import { Lightbox } from 'ramka';
import { Play } from 'lucide-react';

import { ExampleShell } from '../../../_components/example-shell';
import {
  LightboxGallery,
  morphHideClass,
  triggerFocusClass,
} from '../../../_components/lightbox-chrome';

/**
 * Blender Open Movies — real trailers/shorts with their official posters
 * (Wikimedia Commons) so the trigger thumbnail matches the video poster 1:1.
 * Trailers are preferred where available so the demo stays snappy to load.
 *
 * Each film is its own `Lightbox.Root` (no shared gallery) so opening one is a
 * single poster → fullscreen video morph.
 */
const films = [
  {
    id: 'bbb',
    title: 'Big Buck Bunny',
    year: 2008,
    genre: 'Animation',
    poster:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Big_buck_bunny_poster_big.jpg/500px-Big_buck_bunny_poster_big.jpg',
    posterWidth: 500,
    posterHeight: 707,
    video: 'https://download.blender.org/peach/trailer/trailer_iphone.m4v',
  },
  {
    id: 'ed',
    title: "Elephant's Dream",
    year: 2006,
    genre: 'Sci-Fi',
    poster:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/ElephantsDreamPoster.jpg/500px-ElephantsDreamPoster.jpg',
    posterWidth: 500,
    posterHeight: 707,
    video: 'https://archive.org/download/ElephantsDream/ed_1024_512kb.mp4',
  },
  {
    id: 'sintel',
    title: 'Sintel',
    year: 2010,
    genre: 'Fantasy',
    poster:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Sintel_poster.jpg/500px-Sintel_poster.jpg',
    posterWidth: 500,
    posterHeight: 707,
    video: 'https://download.blender.org/durian/trailer/sintel_trailer-720p.mp4',
  },
  {
    id: 'tos',
    title: 'Tears of Steel',
    year: 2012,
    genre: 'Sci-Fi',
    poster:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Tos-poster.png/500px-Tos-poster.png',
    posterWidth: 500,
    posterHeight: 741,
    video: 'https://archive.org/download/Tears-of-Steel/tears_of_steel_720p.mp4',
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
    <Lightbox.Zoom className="px-0 pt-[calc(env(safe-area-inset-top,0px)+3.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+3.5rem)] md:px-8">
      {/* Media morphs + bridges the poster; video fills the sized host. */}
      <Lightbox.Media
        width={width}
        height={height}
        className="overflow-hidden rounded-xl"
      >
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          controls
          playsInline
          muted
          preload="metadata"
          className="bg-black object-contain"
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
            {/* Only the poster morphs / hides — title + meta stay put. */}
            <div className={`relative overflow-hidden rounded-xl ${morphHideClass}`}>
              <img
                ref={morphRef}
                width={film.posterWidth}
                height={film.posterHeight}
                src={film.poster}
                alt={film.title}
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
          },
        ]}
        ariaLabel={film.title}
        thumbnails="never"
        zoomControls={false}
        renderItem={() => (
          <LightboxVideo
            src={film.video}
            poster={film.poster}
            readyToPlay={readyToPlay}
            width={film.posterWidth}
            height={film.posterHeight}
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
      <div className="mx-auto max-w-3xl">
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
