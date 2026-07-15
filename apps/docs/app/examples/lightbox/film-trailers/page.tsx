'use client';

import * as React from 'react';
import { Lightbox } from 'ramka';
import { ChevronLeft, ChevronRight, Play, X } from 'lucide-react';

import { ExampleShell } from '../../../_components/example-shell';
import {
  LightboxFrame,
  LightboxOverlay,
  StackedItemGroup,
  stackedItemClass,
} from '../../../_components/lightbox-chrome';

const films = [
  {
    id: 'bbb',
    title: 'Big Buck Bunny',
    year: 2008,
    genre: 'Animation',
    poster: 'https://picsum.photos/seed/film-bbb/400/600',
    video: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    synopsis: 'A giant rabbit deals with three bullying rodents in this landmark open-source animated short.',
  },
  {
    id: 'ed',
    title: 'Elephant Dream',
    year: 2006,
    genre: 'Sci-Fi',
    poster: 'https://picsum.photos/seed/film-ed/400/600',
    video: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    synopsis: 'Two characters explore a strange mechanical world, questioning reality and their relationship.',
  },
  {
    id: 'sintel',
    title: 'Sintel',
    year: 2010,
    genre: 'Fantasy',
    poster: 'https://picsum.photos/seed/film-sin/400/600',
    video: 'https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    synopsis: 'A lone warrior searches for a baby dragon she befriended, facing dangerous adversaries along the way.',
  },
  {
    id: 'tos',
    title: 'Tears of Steel',
    year: 2012,
    genre: 'Sci-Fi',
    poster: 'https://picsum.photos/seed/film-tos/400/600',
    video: 'https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    synopsis: 'In a dystopian future, a group of warriors and scientists attempt to reverse an apocalyptic event.',
  },
  {
    id: 'subaru',
    title: 'On Street & Dirt',
    year: 2020,
    genre: 'Documentary',
    poster: 'https://picsum.photos/seed/film-sub/400/600',
    video: 'https://storage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
    synopsis: 'A short film showcasing the versatility of driving through diverse landscapes and terrain.',
  },
  {
    id: 'fbj',
    title: 'For Bigger Joyrides',
    year: 2014,
    genre: 'Action',
    poster: 'https://picsum.photos/seed/film-fbj/400/600',
    video: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    synopsis: 'A high-octane teaser that puts you behind the wheel for an adrenaline-pumping ride.',
  },
];

const iconButton =
  'inline-flex h-10 w-10 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-30';

/**
 * Intrinsic pixel dimensions encoded in a picsum URL (`…/{width}/{height}`).
 * Spread onto `<img>` as `width`/`height` so the box (and aspect ratio) is
 * reserved before the pixels load — which keeps the morph target sized on slow
 * connections and prevents layout shift.
 */
function imgDims(url: string) {
  const m = url.match(/\/(\d+)\/(\d+)$/);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : undefined;
}

function FilmCard({ film, index }: { film: (typeof films)[number]; index: number }) {
  return (
    <Lightbox.Trigger
      index={index}
      className="group block cursor-pointer rounded-xl border-none bg-transparent p-0 text-left"
    >
      {({ morphElementRef }) => (
        <>
          <div className="relative overflow-hidden rounded-xl">
            <img
              ref={morphElementRef}
              {...imgDims(film.poster)}
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
  );
}

function LightboxVideo({ src, poster, active }: { src: string; poster: string; active: boolean }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (active) {
      el.play().catch(() => {});
    } else {
      el.pause();
      el.currentTime = 0;
    }
  }, [active]);

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      controls
      playsInline
      preload="metadata"
      className="block w-full max-h-[80vh] rounded-lg bg-black object-contain"
    />
  );
}

export default function FilmTrailersPage() {
  return (
    <ExampleShell
      title="Film trailers"
      description={
        <>
          Lightbox items don&apos;t have to be images. Each poster morphs into a fullscreen{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">&lt;video&gt;</code> that
          auto-plays when its slide becomes active and pauses/resets when you navigate away. The{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">Lightbox.Item</code> render
          prop receives <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">active</code>{' '}
          to wire up the play/pause behavior.
        </>
      }
    >
      <div className="mx-auto max-w-3xl">
        <div className="py-5">
          <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Now Streaming
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Short Film Festival</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            A curated collection of award-winning open-source short films. Click any poster to watch the trailer.
          </p>
        </div>

        <Lightbox.Root viewTransition>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            {films.map((film, i) => (
              <FilmCard key={film.id} film={film} index={i} />
            ))}
          </div>

          <LightboxOverlay />
          <LightboxFrame ariaLabel="Film trailers">
            <div className="absolute right-4 top-4 z-10">
              <Lightbox.Close className={iconButton} aria-label="Close">
                <X aria-hidden className="h-5 w-5" />
              </Lightbox.Close>
            </div>

            <div className="absolute left-4 top-1/2 z-10 -translate-y-1/2">
              <Lightbox.Previous className={iconButton} aria-label="Previous">
                <ChevronLeft aria-hidden className="h-5 w-5" />
              </Lightbox.Previous>
            </div>

            <div className="absolute right-4 top-1/2 z-10 -translate-y-1/2">
              <Lightbox.Next className={iconButton} aria-label="Next">
                <ChevronRight aria-hidden className="h-5 w-5" />
              </Lightbox.Next>
            </div>

            <StackedItemGroup className="px-16">
              {films.map((film, i) => (
                <Lightbox.Item
                  key={film.id}
                  index={i}
                  caption={`${film.title} (${film.year}) — ${film.synopsis}`}
                  className={stackedItemClass}
                >
                  {({ active }) => (
                    <LightboxVideo src={film.video} poster={film.poster} active={active} />
                  )}
                </Lightbox.Item>
              ))}
            </StackedItemGroup>

            <Lightbox.Caption className="block px-8 pb-2 text-center text-sm text-white/80" />
            <Lightbox.Counter className="pb-4 text-xs tabular-nums text-white/60" />
          </LightboxFrame>
        </Lightbox.Root>
      </div>
    </ExampleShell>
  );
}
