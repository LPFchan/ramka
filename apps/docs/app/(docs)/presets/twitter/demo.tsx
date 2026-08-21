'use client';

import * as React from 'react';
import * as RamkaLightbox from 'ramka/lightbox';
import { Heart, MessageCircle, Repeat2, Share } from 'lucide-react';

import { Lightbox, type LightboxItem, type ThreadPost } from './lightbox';

/**
 * App-level demo — not part of the copy-paste package.
 *
 * A small social feed: each post is an independent `Lightbox.Root` whose
 * attachments render in a Facebook-style grid (single image, three-up, and a
 * 2×2 with a `+N` overlay tile). Tapping a tile morphs into the split viewer
 * from `./lightbox`; the `+N` tile uses `crossfade="both"` (there is no
 * single full-size image behind it, so a morph would look wrong) and
 * `morphTo="closest"` so closing from a hidden extra lands on a visible tile.
 *
 * The reply action opens the viewer too (thread sidebar / comment sheet) via
 * an imperative `Lightbox.createHandle()` — there is no trigger element to
 * click, so the open is programmatic.
 */

type FeedPost = {
  id: string;
  /** Short relative time on the feed card; `thread.time` is the full stamp. */
  time: string;
  thread: ThreadPost;
  images: LightboxItem[];
};

const feed: FeedPost[] = [
  {
    id: 'post-road-trip',
    time: '2d',
    thread: {
      author: {
        name: 'Tomás Rivera',
        handle: 'tomasrivera',
        avatar: 'https://i.pravatar.cc/96?u=tomas',
        verified: true,
      },
      text: 'Week-long road trip along the coast is done. Seven stops, seven completely different landscapes.',
      time: 'Aug 9, 2026 · 6:41 PM',
      stats: { replies: 97, reposts: 514, likes: 3842, views: '212K' },
      replies: [
        {
          id: 'r1',
          author: { name: 'Sofia Lindgren', handle: 'sofialind', avatar: 'https://i.pravatar.cc/96?u=sofia' },
          text: 'The lighthouse shot is unreal. What time of day was that?',
          time: '1d',
        },
        {
          id: 'r2',
          author: { name: 'James Okafor', handle: 'jamesokafor', avatar: 'https://i.pravatar.cc/96?u=james' },
          text: 'Route details please — planning the same trip for October.',
          time: '20h',
        },
      ],
    },
    images: [
      { src: 'https://picsum.photos/seed/rg-6a/1600/1000', thumb: 'https://picsum.photos/seed/rg-6a/800/500', alt: 'Dramatic cliffside road at sunset', width: 1600, height: 1000 },
      { src: 'https://picsum.photos/seed/rg-6b/1600/1000', thumb: 'https://picsum.photos/seed/rg-6b/800/500', alt: 'Turquoise cove with fishing boats', width: 1600, height: 1000 },
      { src: 'https://picsum.photos/seed/rg-6c/1600/1000', thumb: 'https://picsum.photos/seed/rg-6c/800/500', alt: 'Terraced vineyards in morning mist', width: 1600, height: 1000 },
      { src: 'https://picsum.photos/seed/rg-6d/900/1400', thumb: 'https://picsum.photos/seed/rg-6d/450/700', alt: 'Old lighthouse on a rocky headland', width: 900, height: 1400 },
      { src: 'https://picsum.photos/seed/rg-6e/1600/1000', thumb: 'https://picsum.photos/seed/rg-6e/800/500', alt: 'Wild horses grazing on a dune', width: 1600, height: 1000 },
      { src: 'https://picsum.photos/seed/rg-6f/1200/1200', thumb: 'https://picsum.photos/seed/rg-6f/600/600', alt: 'Street musicians in a coastal town square', width: 1200, height: 1200 },
      { src: 'https://picsum.photos/seed/rg-6g/1600/1000', thumb: 'https://picsum.photos/seed/rg-6g/800/500', alt: 'Milky Way over a deserted beach', width: 1600, height: 1000 },
    ],
  },
  {
    id: 'post-good-light',
    time: '8h',
    thread: {
      author: {
        name: 'Aisha Patel',
        handle: 'aishapatel',
        avatar: 'https://i.pravatar.cc/96?u=aisha',
      },
      text: 'Golden hour across the valley, the canopy from below, and still water at dusk. A good day for light.',
      time: 'Aug 11, 2026 · 4:05 AM',
      stats: { replies: 28, reposts: 67, likes: 892, views: '31K' },
      replies: [
        {
          id: 'r1',
          author: { name: 'Marcus Chen', handle: 'marcusc', avatar: 'https://i.pravatar.cc/96?u=marcus' },
          text: 'That canopy frame is a wallpaper. Straight out of camera?',
          time: '6h',
        },
      ],
    },
    images: [
      { src: 'https://picsum.photos/seed/rg-3a/1600/900', thumb: 'https://picsum.photos/seed/rg-3a/800/450', alt: 'Rolling fields at golden hour', width: 1600, height: 900 },
      { src: 'https://picsum.photos/seed/rg-3b/1000/1400', thumb: 'https://picsum.photos/seed/rg-3b/500/700', alt: 'Dense forest canopy from below', width: 1000, height: 1400 },
      { src: 'https://picsum.photos/seed/rg-3c/1500/1000', thumb: 'https://picsum.photos/seed/rg-3c/750/500', alt: 'Quiet lake reflecting the hills', width: 1500, height: 1000 },
    ],
  },
  {
    id: 'post-first-light',
    time: '2h',
    thread: {
      author: {
        name: 'Elena Vasquez',
        handle: 'elenavsq',
        avatar: 'https://i.pravatar.cc/96?u=elena',
      },
      text: 'First light over the ridgeline this morning — worth every minute of the 4am alarm.',
      time: 'Aug 11, 2026 · 10:12 AM',
      stats: { replies: 12, reposts: 31, likes: 284, views: '9.4K' },
      replies: [
        {
          id: 'r1',
          author: { name: 'Priya Nair', handle: 'priyanair', avatar: 'https://i.pravatar.cc/96?u=priya' },
          text: 'The 4am alarm gang eats again. Gorgeous.',
          time: '1h',
        },
      ],
    },
    images: [
      { src: 'https://picsum.photos/seed/rg-1/1600/1000', thumb: 'https://picsum.photos/seed/rg-1/800/500', alt: 'Mountain range under a wide morning sky', width: 1600, height: 1000 },
    ],
  },
];

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

const actionClass =
  'flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100';

/** Reply / repost / like / share row. Reply opens the viewer (thread beside it). */
function ActionBar({
  stats,
  onReply,
}: {
  stats: ThreadPost['stats'];
  onReply: () => void;
}) {
  return (
    <div className="-mb-1.5 -ml-2 mt-1 flex items-center gap-1 text-neutral-500">
      <button type="button" className={actionClass} aria-label="View replies" onClick={onReply}>
        <MessageCircle className="size-4" aria-hidden />
        <span>{formatCount(stats?.replies ?? 0)}</span>
      </button>
      <button type="button" className={actionClass} aria-label="Repost">
        <Repeat2 className="size-4" aria-hidden />
        <span>{formatCount(stats?.reposts ?? 0)}</span>
      </button>
      <button type="button" className={actionClass} aria-label="Like">
        <Heart className="size-4" aria-hidden />
        <span>{formatCount(stats?.likes ?? 0)}</span>
      </button>
      <button type="button" className={actionClass} aria-label="Share">
        <Share className="size-4" aria-hidden />
      </button>
    </div>
  );
}

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
 * Facebook-style trigger grid: 1 image fills the width, 2–4 tile into a
 * grid, and 5+ collapse the extras behind a `+N` overlay tile. Every tile is
 * a `Lightbox.Trigger`, so tapping one morphs into the viewer at that index.
 */
function ImageGrid({ imgs }: { imgs: LightboxItem[] }) {
  const count = imgs.length;

  if (count === 1) {
    const only = imgs[0]!;
    return (
      <Lightbox.Trigger index={0} className="block w-full overflow-hidden rounded-xl bg-transparent p-0">
        {({ imageRef }) => (
          <img
            ref={imageRef}
            src={only.thumb}
            alt={only.alt}
            width={only.width}
            height={only.height}
            className="block w-full object-cover"
            draggable={false}
          />
        )}
      </Lightbox.Trigger>
    );
  }

  if (count === 2) {
    return (
      <div className="grid grid-cols-2 gap-0.5 overflow-hidden rounded-xl">
        {imgs.map((img, i) => (
          <Lightbox.Trigger
            key={img.src}
            index={i}
            className={`block overflow-hidden bg-transparent p-0 ${cornerClass(i, 2)}`}
          >
            {({ imageRef }) => (
              <img
                ref={imageRef}
                src={img.thumb}
                alt={img.alt}
                width={img.width}
                height={img.height}
                className="block aspect-4/5 w-full object-cover"
                draggable={false}
              />
            )}
          </Lightbox.Trigger>
        ))}
      </div>
    );
  }

  if (count === 3) {
    const first = imgs[0]!;
    return (
      <div className="grid aspect-3/2 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-xl">
        <Lightbox.Trigger
          index={0}
          className={`row-span-2 block overflow-hidden bg-transparent p-0 ${cornerClass(0, 3)}`}
        >
          {({ imageRef }) => (
            <img
              ref={imageRef}
              src={first.thumb}
              alt={first.alt}
              width={first.width}
              height={first.height}
              className="block size-full object-cover"
              draggable={false}
            />
          )}
        </Lightbox.Trigger>
        {imgs.slice(1, 3).map((img, idx) => {
          const i = idx + 1;
          return (
            <Lightbox.Trigger
              key={img.src}
              index={i}
              className={`block overflow-hidden bg-transparent p-0 ${cornerClass(i, 3)}`}
            >
              {({ imageRef }) => (
                <img
                  ref={imageRef}
                  src={img.thumb}
                  alt={img.alt}
                  width={img.width}
                  height={img.height}
                  className="block size-full object-cover"
                  draggable={false}
                />
              )}
            </Lightbox.Trigger>
          );
        })}
      </div>
    );
  }

  const extra = count - 4;
  return (
    <div className="grid aspect-3/2 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-xl">
      {imgs.slice(0, 4).map((img, i) => {
        const showOverlay = i === 3 && extra > 0;
        return (
          <Lightbox.Trigger
            key={img.src}
            index={i}
            crossfade={showOverlay ? 'both' : undefined}
            className={`block overflow-hidden bg-transparent p-0 ${cornerClass(i, 4)}`}
          >
            {({ imageRef }) => (
              // The whole tile crossfades (overlay included), but the
              // destination placeholder is sourced from `imageRef` only — so
              // the "+N" overlay never bleeds into the viewer image.
              <span className={`relative block size-full overflow-hidden ${cornerClass(i, 4)}`}>
                <img
                  ref={imageRef}
                  src={img.thumb}
                  alt={img.alt}
                  width={img.width}
                  height={img.height}
                  className="block size-full object-cover"
                  draggable={false}
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

/** One feed post wired to the split viewer. */
function FeedPostGallery({ post }: { post: FeedPost }) {
  const { author } = post.thread;
  const stats = post.thread.stats;
  // Imperative handle so the reply action (not a Trigger) can open the viewer.
  const [handle] = React.useState(() => RamkaLightbox.createHandle());

  return (
    <Lightbox.Root
      handle={handle}
      loop
      // Extras hidden behind the `+N` tile have no trigger of their own —
      // close to the nearest visible one instead of flashing.
      morphTo={post.images.length > 4 ? 'closest' : undefined}
      // Thumbs are the same photos at lower res (same seed + aspect), so the
      // placeholder bridge is seamless — skip the decode wait and start the
      // morph immediately.
      awaitImageDecode={false}
    >
      <article className="flex gap-3 px-4 py-3 text-left">
        <img src={author.avatar} alt="" className="size-10 shrink-0 rounded-full object-cover" draggable={false} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1 text-sm">
            <span className="font-bold text-neutral-900 dark:text-neutral-50">{author.name}</span>
            <span className="text-neutral-500">@{author.handle}</span>
            <span className="text-neutral-500">· {post.time}</span>
          </div>

          <p className="mb-3 mt-1 whitespace-pre-wrap text-[15px] leading-snug text-neutral-900 dark:text-neutral-100">
            {post.thread.text}
          </p>

          <ImageGrid imgs={post.images} />

          <ActionBar stats={stats} onReply={() => handle.open(0)} />
        </div>
      </article>

      <Lightbox.Gallery
        items={post.images}
        thread={post.thread}
        ariaLabel={`Photos by ${author.name}`}
      />
    </Lightbox.Root>
  );
}

export function TwitterPresetDemo() {
  return (
    <div className="w-full max-w-xl divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:divide-neutral-800 dark:border-neutral-700 dark:bg-neutral-900">
      {feed.map((post) => (
        <FeedPostGallery key={post.id} post={post} />
      ))}
    </div>
  );
}
