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
 * most carrying a lightbox image, for profiling open/close morphs against a
 * huge live DOM (the Mintlify-class scenario, but shaped like an app feed
 * rather than docs).
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
const ELEMENTS_PER_POST = 25;

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

interface FeedPost {
  id: number;
  name: string;
  handle: string;
  minutesAgo: number;
  text: string;
  /** Lightbox item index — null for text-only posts (every 4th). */
  imageIndex: number | null;
  photo: StaticImageData;
  likes: number;
  replies: number;
  reposts: number;
}

function buildPosts(count: number): FeedPost[] {
  const posts: FeedPost[] = [];
  let imageIndex = 0;
  for (let i = 0; i < count; i++) {
    const name = NAMES[i % NAMES.length]!;
    const hasImage = i % 4 !== 3; // 3 of 4 posts carry a lightbox image
    posts.push({
      id: i,
      name,
      handle: `@${name.split(' ')[0]!.toLowerCase()}${(i % 97) + 1}`,
      minutesAgo: (i * 7) % 1440,
      text: TEXTS[(i * 5 + Math.floor(i / TEXTS.length)) % TEXTS.length]!,
      imageIndex: hasImage ? imageIndex++ : null,
      photo: lightboxImageFiles[i % lightboxImageFiles.length]!,
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
// Page
// ---------------------------------------------------------------------------

const CONTROL_BUTTON =
  'rounded-full px-3 py-1 text-xs font-medium tabular-nums transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500';
const CONTROL_ACTIVE = 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900';
const CONTROL_IDLE =
  'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700';

const VIEWER_BUTTON =
  'grid size-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white data-disabled:pointer-events-none data-disabled:opacity-30';

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
  const imagePosts = React.useMemo(() => posts.filter((p) => p.imageIndex != null), [posts]);

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
          A feed-shaped stress page for the open/close morph: pick a DOM size, add synthetic
          main-thread load, and keep a live widget committing during the transition. Settings
          persist in the URL. For true slow-device runs, stack DevTools CPU throttling on top.
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
            ? `${posts.length.toLocaleString()} posts · ${imagePosts.length.toLocaleString()} images · ${
                measured == null ? 'measuring…' : `${measured.toLocaleString()} DOM elements`
              }${config.load !== 'off' ? ` · blocking ${LOAD_LEVELS[config.load].blockMs}ms every ${LOAD_LEVELS[config.load].periodMs}ms` : ''}`
            : 'reading URL config…'}
        </p>
      </div>

      <Lightbox.Root>
        <main className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
          {posts.map((post) => (
            <article key={post.id} className="flex gap-3 py-4">
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
                  <span className="truncate text-neutral-500 dark:text-neutral-400">
                    {post.handle}
                  </span>
                  <time className="ml-auto shrink-0 text-xs text-neutral-400 dark:text-neutral-500">
                    {timestamp(post.minutesAgo)}
                  </time>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                  {post.text}
                </p>
                {post.imageIndex != null ? (
                  <Lightbox.Trigger
                    index={post.imageIndex}
                    aria-label={`Open photo by ${post.name}`}
                    className="mt-2 block w-full cursor-pointer overflow-hidden rounded-xl border border-neutral-200 outline-offset-2 focus-visible:outline-2 focus-visible:outline-sky-500 dark:border-neutral-800"
                  >
                    {({ imageRef }) => (
                      <Image
                        ref={imageRef}
                        src={post.photo}
                        alt={`Photo by ${post.name}`}
                        sizes="(min-width: 640px) 560px, 100vw"
                        placeholder="blur"
                        className="aspect-3/2 w-full object-cover"
                      />
                    )}
                  </Lightbox.Trigger>
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
          ))}
        </main>

        <Lightbox.Portal>
          <Lightbox.Content
            aria-label="Feed photo viewer"
            className="fixed inset-0 flex flex-col bg-neutral-950/95 outline-none"
          >
            <Lightbox.Slides
              preload={1}
              aria-label="Photos"
              className="flex-1 scrollbar-none [&::-webkit-scrollbar]:hidden"
            >
              {imagePosts.map((post) => (
                <Lightbox.Slide
                  key={post.id}
                  className="h-full min-w-full flex-[0_0_100%] px-4 pb-24 pt-16 sm:px-20 sm:pt-20"
                >
                  <Lightbox.Item index={post.imageIndex!}>
                    <Lightbox.Zoom>
                      <Lightbox.Media width={post.photo.width} height={post.photo.height}>
                        <Image
                          src={post.photo}
                          alt={`Photo by ${post.name}`}
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
            <Lightbox.Close aria-label="Close" className={`${VIEWER_BUTTON} absolute right-4 top-4 z-10`}>
              <X className="size-5" aria-hidden />
            </Lightbox.Close>
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

      {ready && config.live ? <LiveActivityWidget /> : null}
    </div>
  );
}
