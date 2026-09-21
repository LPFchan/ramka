'use client';

import {
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  Minus,
  Plus,
  Repeat2,
  X,
} from 'lucide-react';
import Image, { type StaticImageData } from 'next/image';
import { notFound } from 'next/navigation';
import * as React from 'react';
import * as Lightbox from '@ramka/react/lightbox';

import { lightboxImageFiles } from '../../../_data/images.generated';

/**
 * Dev-only: a real-world stress page — a social feed with hundreds of posts,
 * for profiling open/close morphs against a huge live DOM (the Mintlify-class
 * scenario, but shaped like an app feed rather than docs).
 *
 * Realistic structure: every post is its own independent `Lightbox.Root`
 * (like the Twitter preset demo), carrying 1–10 images in a Facebook-style
 * grid — one image full-width, 2–4 tiled, 5+ collapsed behind a `+N` overlay
 * tile (`crossfade="both"`, since no single image sits behind the overlay).
 * `morphTo="closest"` so closing from a hidden extra lands on a visible tile.
 *
 * Everything is driven from the URL so a profiling setup survives reloads:
 *
 *   /debug/heavy-feed?elements=16000&load=medium&live=1
 *
 * - `elements` — target DOM size (the bar shows the actual measured count)
 * - `load` — synthetic main-thread load: an interval that blocks the thread
 *   for a slice of every period, approximating a busy app (analytics,
 *   rendering work, third-party scripts). This simulates *contention*; for
 *   true slow-device simulation stack it with DevTools CPU throttling.
 * - `live` — a "live activity" widget re-rendering every 300ms (viewer count
 *   + fake websocket messages), so morphs run against ongoing React commits.
 */

const TARGET_SIZES = [500, 1000, 4000, 8000, 16000, 20000] as const;
const DEFAULT_TARGET = 4000;

/** Rough DOM elements per rendered post (checked against the measured bar). */
const ELEMENTS_PER_POST = 30;

type LoadLevel = 'off' | 'light' | 'medium' | 'heavy';

/** Block `blockMs` of every `periodMs` — approximate main-thread utilization. */
const LOAD_LEVELS: Record<Exclude<LoadLevel, 'off'>, { blockMs: number; periodMs: number }> = {
  light: { blockMs: 5, periodMs: 50 }, // ~10% busy
  medium: { blockMs: 20, periodMs: 100 }, // ~20% busy, 20ms stalls
  heavy: { blockMs: 50, periodMs: 100 }, // ~50% busy, 50ms stalls
};

interface FeedConfig {
  elements: number;
  load: LoadLevel;
  live: boolean;
}

const DEFAULT_CONFIG: FeedConfig = { elements: DEFAULT_TARGET, load: 'off', live: false };

function parseConfig(search: string): FeedConfig {
  const params = new URLSearchParams(search);
  const elements = Number(params.get('elements'));
  const load = params.get('load') as LoadLevel | null;
  return {
    elements: (TARGET_SIZES as readonly number[]).includes(elements) ? elements : DEFAULT_TARGET,
    load: load && (load === 'off' || load in LOAD_LEVELS) ? load : 'off',
    live: params.get('live') === '1',
  };
}

function writeConfigToUrl(config: FeedConfig) {
  const url = new URL(window.location.href);
  url.searchParams.set('elements', String(config.elements));
  if (config.load === 'off') url.searchParams.delete('load');
  else url.searchParams.set('load', config.load);
  if (config.live) url.searchParams.set('live', '1');
  else url.searchParams.delete('live');
  window.history.replaceState(null, '', url);
}

// ---------------------------------------------------------------------------
// Deterministic feed content (no Math.random — stable across re-renders)
// ---------------------------------------------------------------------------

const NAMES = [
  'Maya Lindqvist',
  'Jonas Weber',
  'Aisha Okafor',
  'Tom Brennan',
  'Yuki Tanaka',
  'Carla Mendes',
  'Piotr Nowak',
  'Sofia Ricci',
  'Dev Sharma',
  'Elena Petrova',
  'Marcus Hale',
  'Ines Laurent',
];

const TEXTS = [
  'Morning light at the harbor was unreal today. Straight off the sensor, no edits.',
  'Testing the new 35mm — the falloff on this lens is something else.',
  'Three hours of hiking for this one frame. Worth every step.',
  'Street market chaos, one quiet corner. Sometimes the photo finds you.',
  'Revisited an old spot with new eyes. Same pier, completely different picture.',
  'Long exposure experiments continue. The water turns to glass at 30 seconds.',
  'Caught the last ferry and the last light within the same minute.',
  'Backlog cleanup: found this from last winter and cannot believe I sat on it.',
];

/**
 * Image counts per post, cycled by index — 1–10 like real feeds (with some
 * text-only posts mixed in). Average ≈ 3 images per post.
 */
const IMAGE_COUNTS = [1, 3, 0, 2, 4, 1, 7, 2, 0, 10, 1, 5] as const;

interface FeedPost {
  id: number;
  name: string;
  handle: string;
  minutesAgo: number;
  text: string;
  /** 0–10 photos; empty for text-only posts. */
  photos: StaticImageData[];
  likes: number;
  replies: number;
  reposts: number;
}

function buildPosts(count: number): FeedPost[] {
  const posts: FeedPost[] = [];
  for (let i = 0; i < count; i++) {
    const name = NAMES[i % NAMES.length]!;
    const imageCount = IMAGE_COUNTS[i % IMAGE_COUNTS.length]!;
    posts.push({
      id: i,
      name,
      handle: `@${name.split(' ')[0]!.toLowerCase()}${(i % 97) + 1}`,
      minutesAgo: (i * 7) % 1440,
      text: TEXTS[(i * 5 + Math.floor(i / TEXTS.length)) % TEXTS.length]!,
      photos: Array.from(
        { length: imageCount },
        (_, j) => lightboxImageFiles[(i + j) % lightboxImageFiles.length]!,
      ),
      likes: (i * 37) % 900,
      replies: (i * 13) % 120,
      reposts: (i * 29) % 300,
    });
  }
  return posts;
}

const timestamp = (minutesAgo: number) =>
  minutesAgo < 60 ? `${Math.max(1, minutesAgo)}m` : `${Math.floor(minutesAgo / 60)}h`;

/** Deterministic avatar hue per author. */
const avatarHue = (id: number) => (id * 47) % 360;

// ---------------------------------------------------------------------------
// Synthetic load + live activity
// ---------------------------------------------------------------------------

/**
 * Periodically block the main thread. The sink is published on `window` so
 * the busy loop cannot be optimized away.
 */
function useSyntheticLoad(load: LoadLevel) {
  React.useEffect(() => {
    if (load === 'off') return;
    const { blockMs, periodMs } = LOAD_LEVELS[load];
    const id = window.setInterval(() => {
      const end = performance.now() + blockMs;
      let sink = 0;
      while (performance.now() < end) sink += Math.sqrt(sink + 1);
      (window as unknown as Record<string, unknown>).__feedLoadSink = sink;
    }, periodMs);
    return () => window.clearInterval(id);
  }, [load]);
}

const LIVE_MESSAGES = [
  'liked your photo',
  'started following you',
  'reposted your post',
  'replied: "where is this?"',
  'sent you a message',
  'mentioned you in a comment',
];

/**
 * Self-contained so its 300ms ticks re-render only this widget — a morph
 * still has to run against those commits, which is exactly the point.
 */
function LiveActivityWidget() {
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 300);
    return () => window.clearInterval(id);
  }, []);

  const viewers = 1240 + ((tick * 17) % 220) - 110;
  const messages = Array.from({ length: 4 }, (_, i) => {
    const n = tick - i;
    return {
      key: n,
      user: `@${NAMES[Math.abs(n * 31) % NAMES.length]!.split(' ')[0]!.toLowerCase()}${Math.abs(n) % 90}`,
      text: LIVE_MESSAGES[Math.abs(n * 7) % LIVE_MESSAGES.length]!,
    };
  });

  return (
    <aside
      aria-hidden
      className="fixed bottom-4 right-4 z-20 w-64 rounded-xl border border-neutral-200 bg-white/90 p-3 text-xs shadow-lg backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90"
    >
      <p className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-neutral-100">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        {viewers.toLocaleString()} viewing now
      </p>
      <ul className="mt-2 space-y-1 text-neutral-600 dark:text-neutral-400">
        {messages.map((m) => (
          <li key={m.key} className="truncate">
            <span className="font-medium text-neutral-800 dark:text-neutral-200">{m.user}</span> {m.text}
          </li>
        ))}
      </ul>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Post attachment grid (Facebook-style, 1–4 tiles + "+N" overlay)
// ---------------------------------------------------------------------------

const TILE_SIZES = '(min-width: 640px) 280px, 50vw';

/**
 * Per-cell rounded corners for the 1–4 cell grids. Inner edges stay sharp;
 * outer corners match the parent grid. The radius must live on the Trigger —
 * the morph reads it to animate corner rounding.
 */
function cornerClass(index: number, count: number): string {
  if (count === 2) {
    return index === 0 ? 'rounded-l-xl' : 'rounded-r-xl';
  }
  if (count === 3) {
    if (index === 0) return 'rounded-l-xl';
    return index === 1 ? 'rounded-tr-xl' : 'rounded-br-xl';
  }
  if (count === 4) {
    return ['rounded-tl-xl', 'rounded-tr-xl', 'rounded-bl-xl', 'rounded-br-xl'][index]!;
  }
  return 'rounded-xl';
}

/**
 * 1 image fills the width, 2–4 tile into a grid, and 5+ collapse the extras
 * behind a `+N` overlay tile. Every tile is a `Lightbox.Trigger`; the overlay
 * tile crossfades (there is no single full-size image behind "+N", so a
 * hard-cut morph would look wrong) while `imageRef` keeps the destination
 * placeholder sourced from the photo alone.
 */
function PostImageGrid({ post }: { post: FeedPost }) {
  const { photos } = post;
  const count = photos.length;

  if (count === 1) {
    const only = photos[0]!;
    return (
      <Lightbox.Trigger
        index={0}
        aria-label={`Open photo by ${post.name}`}
        className="mt-2 block w-full cursor-pointer overflow-hidden rounded-xl border border-neutral-200 p-0 outline-offset-2 focus-visible:outline-2 focus-visible:outline-sky-500 dark:border-neutral-800"
      >
        {({ imageRef }) => (
          <Image
            ref={imageRef}
            src={only}
            alt={`Photo by ${post.name}`}
            sizes="(min-width: 640px) 560px, 100vw"
            placeholder="blur"
            className="aspect-3/2 w-full object-cover"
          />
        )}
      </Lightbox.Trigger>
    );
  }

  if (count === 2 || count === 3) {
    return (
      <div
        className={`mt-2 grid gap-0.5 overflow-hidden rounded-xl ${
          count === 2 ? 'grid-cols-2' : 'aspect-3/2 grid-cols-2 grid-rows-2'
        }`}
      >
        {photos.map((photo, i) => (
          <Lightbox.Trigger
            key={i}
            index={i}
            aria-label={`Open photo ${i + 1} of ${count} by ${post.name}`}
            className={`block cursor-pointer overflow-hidden p-0 outline-offset-2 focus-visible:outline-2 focus-visible:outline-sky-500 ${
              count === 3 && i === 0 ? 'row-span-2' : ''
            } ${cornerClass(i, count)}`}
          >
            {({ imageRef }) => (
              <Image
                ref={imageRef}
                src={photo}
                alt={`Photo ${i + 1} by ${post.name}`}
                sizes={TILE_SIZES}
                placeholder="blur"
                className={`block w-full object-cover ${count === 2 ? 'aspect-4/5' : 'size-full'}`}
              />
            )}
          </Lightbox.Trigger>
        ))}
      </div>
    );
  }

  // 4+ images: 2×2 grid, extras behind a "+N" overlay on the last tile.
  const extra = count - 4;
  return (
    <div className="mt-2 grid aspect-3/2 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-xl">
      {photos.slice(0, 4).map((photo, i) => {
        const showOverlay = i === 3 && extra > 0;
        return (
          <Lightbox.Trigger
            key={i}
            index={i}
            crossfade={showOverlay ? 'both' : undefined}
            aria-label={
              showOverlay
                ? `Open all ${count} photos by ${post.name}`
                : `Open photo ${i + 1} of ${count} by ${post.name}`
            }
            className={`block cursor-pointer overflow-hidden p-0 outline-offset-2 focus-visible:outline-2 focus-visible:outline-sky-500 ${cornerClass(i, 4)}`}
          >
            {({ imageRef }) => (
              <span className={`relative block size-full overflow-hidden ${cornerClass(i, 4)}`}>
                <Image
                  ref={imageRef}
                  src={photo}
                  alt={`Photo ${i + 1} by ${post.name}`}
                  sizes={TILE_SIZES}
                  placeholder="blur"
                  className="block size-full object-cover"
                />
                {showOverlay && (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50">
                    <span className="text-2xl font-bold text-white">+{extra}</span>
                  </span>
                )}
              </span>
            )}
          </Lightbox.Trigger>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Post card — one independent Lightbox.Root per post
// ---------------------------------------------------------------------------

const VIEWER_BUTTON =
  'grid size-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white data-disabled:pointer-events-none data-disabled:opacity-30';

const FeedPostCard = React.memo(function FeedPostCard({ post }: { post: FeedPost }) {
  return (
    <article className="flex gap-3 py-4">
      <div
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: `hsl(${avatarHue(post.id)} 55% 45%)` }}
      >
        {post.name
          .split(' ')
          .map((part) => part[0])
          .join('')}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 text-sm">
          <span className="truncate font-semibold text-neutral-900 dark:text-neutral-100">
            {post.name}
          </span>
          <span className="truncate text-neutral-500 dark:text-neutral-400">{post.handle}</span>
          <time className="ml-auto shrink-0 text-xs text-neutral-400 dark:text-neutral-500">
            {timestamp(post.minutesAgo)}
          </time>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          {post.text}
        </p>

        {post.photos.length > 0 ? (
          // Every post owns an independent lightbox, like a real feed.
          // `morphTo="closest"` so closing from a "+N" extra (which has no
          // visible tile) morphs back to the nearest visible one.
          <Lightbox.Root morphTo="closest" loop>
            <PostImageGrid post={post} />

            <Lightbox.Portal>
              <Lightbox.Content
                aria-label={`Photos by ${post.name}`}
                className="fixed inset-0 flex flex-col bg-neutral-950/95 outline-none"
              >
                <Lightbox.Slides
                  preload={1}
                  aria-label="Photos"
                  className="flex-1 scrollbar-none [&::-webkit-scrollbar]:hidden"
                >
                  {post.photos.map((photo, i) => (
                    <Lightbox.Slide
                      key={i}
                      className="h-full min-w-full flex-[0_0_100%] px-4 pb-24 pt-16 sm:px-20 sm:pt-20"
                    >
                      <Lightbox.Item index={i}>
                        <Lightbox.Zoom>
                          <Lightbox.Media width={photo.width} height={photo.height}>
                            <Image
                              src={photo}
                              alt={`Photo ${i + 1} by ${post.name}`}
                              sizes="100vw"
                              draggable={false}
                            />
                          </Lightbox.Media>
                        </Lightbox.Zoom>
                      </Lightbox.Item>
                    </Lightbox.Slide>
                  ))}
                </Lightbox.Slides>

                <Lightbox.Counter className="absolute left-4 top-4 z-10 rounded-full bg-white/10 px-3 py-1.5 text-sm tabular-nums text-white backdrop-blur" />
                <Lightbox.Close
                  aria-label="Close"
                  className={`${VIEWER_BUTTON} absolute right-4 top-4 z-10`}
                >
                  <X className="size-5" aria-hidden />
                </Lightbox.Close>
                {post.photos.length > 1 ? (
                  <>
                    <Lightbox.Previous
                      aria-label="Previous"
                      className={`${VIEWER_BUTTON} absolute left-4 top-1/2 z-10 -translate-y-1/2`}
                    >
                      <ChevronLeft className="size-6" aria-hidden />
                    </Lightbox.Previous>
                    <Lightbox.Next
                      aria-label="Next"
                      className={`${VIEWER_BUTTON} absolute right-4 top-1/2 z-10 -translate-y-1/2`}
                    >
                      <ChevronRight className="size-6" aria-hidden />
                    </Lightbox.Next>
                  </>
                ) : null}

                <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2">
                  <Lightbox.ZoomOut aria-label="Zoom out" className={VIEWER_BUTTON}>
                    <Minus className="size-5" aria-hidden />
                  </Lightbox.ZoomOut>
                  <Lightbox.ZoomIn aria-label="Zoom in" className={VIEWER_BUTTON}>
                    <Plus className="size-5" aria-hidden />
                  </Lightbox.ZoomIn>
                </div>
              </Lightbox.Content>
            </Lightbox.Portal>
          </Lightbox.Root>
        ) : null}

        <div className="mt-2 flex items-center gap-6 text-xs text-neutral-500 dark:text-neutral-400">
          <button type="button" className="flex items-center gap-1.5 hover:text-rose-500">
            <Heart className="size-3.5" aria-hidden />
            <span className="tabular-nums">{post.likes}</span>
          </button>
          <button type="button" className="flex items-center gap-1.5 hover:text-sky-500">
            <MessageCircle className="size-3.5" aria-hidden />
            <span className="tabular-nums">{post.replies}</span>
          </button>
          <button type="button" className="flex items-center gap-1.5 hover:text-emerald-500">
            <Repeat2 className="size-3.5" aria-hidden />
            <span className="tabular-nums">{post.reposts}</span>
          </button>
        </div>
      </div>
    </article>
  );
});

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const CONTROL_BUTTON =
  'rounded-full px-3 py-1 text-xs font-medium tabular-nums transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500';
const CONTROL_ACTIVE = 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900';
const CONTROL_IDLE =
  'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700';

export default function HeavyFeedDebugPage() {
  // Config lives in React state and mirrors to the URL. The feed renders only
  // after the URL has been read (`ready`) so a reload lands directly on the
  // configured size instead of hydrating a default-sized feed first.
  const [config, setConfig] = React.useState<FeedConfig>(DEFAULT_CONFIG);
  const [ready, setReady] = React.useState(false);
  const [measured, setMeasured] = React.useState<number | null>(null);

  React.useEffect(() => {
    setConfig(parseConfig(window.location.search));
    setReady(true);
  }, []);

  const applyConfig = React.useCallback((partial: Partial<FeedConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...partial };
      writeConfigToUrl(next);
      return next;
    });
  }, []);

  useSyntheticLoad(ready ? config.load : 'off');

  const postCount = Math.max(1, Math.round(config.elements / ELEMENTS_PER_POST));
  const posts = React.useMemo(() => (ready ? buildPosts(postCount) : []), [ready, postCount]);
  const totalImages = React.useMemo(
    () => posts.reduce((sum, p) => sum + p.photos.length, 0),
    [posts],
  );

  // Measure the real element count once the feed is in the DOM.
  React.useEffect(() => {
    if (!ready) return;
    const frame = requestAnimationFrame(() =>
      setMeasured(document.getElementsByTagName('*').length),
    );
    return () => cancelAnimationFrame(frame);
  }, [ready, posts]);

  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6">
      <header className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400">
          Debug · development only
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Heavy feed
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          A feed-shaped stress page for the open/close morph: every post owns an independent
          lightbox with 1–10 images (Facebook-style grid, +N overlay). Pick a DOM size, add
          synthetic main-thread load, and keep a live widget committing during the transition.
          Settings persist in the URL. For true slow-device runs, stack DevTools CPU throttling on
          top.
        </p>
      </header>

      <div className="sticky top-0 z-30 -mx-4 mb-6 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5" role="group" aria-label="Target DOM size">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Elements
            </span>
            {TARGET_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => applyConfig({ elements: size })}
                aria-pressed={config.elements === size}
                className={`${CONTROL_BUTTON} ${config.elements === size ? CONTROL_ACTIVE : CONTROL_IDLE}`}
              >
                {size >= 1000 ? `${size / 1000}k` : size}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5" role="group" aria-label="Main-thread load">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Load</span>
            {(['off', 'light', 'medium', 'heavy'] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => applyConfig({ load: level })}
                aria-pressed={config.load === level}
                className={`${CONTROL_BUTTON} ${config.load === level ? CONTROL_ACTIVE : CONTROL_IDLE}`}
              >
                {level}
              </button>
            ))}
          </div>

          <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            <input
              type="checkbox"
              checked={config.live}
              onChange={(event) => applyConfig({ live: event.target.checked })}
              className="accent-sky-600"
            />
            Live updates
          </label>
        </div>
        <p className="mt-1.5 text-[11px] tabular-nums text-neutral-400 dark:text-neutral-500">
          {ready
            ? `${posts.length.toLocaleString()} posts · ${totalImages.toLocaleString()} images · ${
                measured == null ? 'measuring…' : `${measured.toLocaleString()} DOM elements`
              }${config.load !== 'off' ? ` · blocking ${LOAD_LEVELS[config.load].blockMs}ms every ${LOAD_LEVELS[config.load].periodMs}ms` : ''}`
            : 'reading URL config…'}
        </p>
      </div>

      <main className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
        {posts.map((post) => (
          <FeedPostCard key={post.id} post={post} />
        ))}
      </main>

      {ready && config.live ? <LiveActivityWidget /> : null}
    </div>
  );
}
