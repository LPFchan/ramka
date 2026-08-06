'use client';

import * as React from 'react';
import { Lightbox } from 'ramka';
import { Heart, MessageCircle, Share } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ExampleShell } from '../../../../_components/example-shell';
import {
  imgDims,
  LightboxGallery,
  triggerFocusClass,
} from '../../../../_components/lightbox-chrome';

/**
 * The canonical, real-world lightbox — deliberately self-contained (no
 * shared docs helpers, inline data) so the whole composition can be read
 * top-to-bottom and iterated on in one place.
 *
 * The entry surface is a social feed: each post is an independent
 * `Lightbox.Root` whose attachments render in a Facebook-style image grid.
 * Posts with more than four images collapse the extras behind a `+N`
 * overlay tile that uses `crossfade="both"` (rather than a shared morph), and
 * `morphTo="closest"` so navigating past the visible thumbnails still
 * closes sensibly.
 *
 * Opening a post reveals the production media viewer: swipe navigation via
 * a `Lightbox.Slides` viewport, thumbnails on desktop only, a View Transition
 * morph from the tapped tile, per-item pinch/scroll/keyboard zoom, and
 * pull-to-dismiss. Zoom buttons are desktop-only; close stays visible.
 * Caption + thumbnails hide while zoomed via `[[data-zoomed]_&]` (Zoom
 * sets `data-zoomed` on Content).
 */

interface GalleryImage {
  src: string;
  thumb: string;
  alt: string;
  caption: string;
}

interface FeedPost {
  id: string;
  user: { name: string; handle: string; avatar: string; initials: string };
  text: string;
  time: string;
  images: GalleryImage[];
  stats: { replies: number; likes: number; shares: number };
}

const feedPosts: FeedPost[] = [
  {
    id: 'rg-post-6',
    user: { name: 'Tomás Rivera', handle: '@tomasrivera', avatar: 'https://i.pravatar.cc/150?u=tomas', initials: 'TR' },
    text: 'Week-long road trip along the coast is done. Seven stops, seven completely different landscapes.',
    time: '2d',
    images: [
      {
        src: 'https://picsum.photos/seed/rg-6a/1600/1000',
        thumb: 'https://picsum.photos/seed/rg-6a/800/500',
        alt: 'Dramatic cliffside road at sunset',
        caption: 'The cliffside road at sunset',
      },
      {
        src: 'https://picsum.photos/seed/rg-6b/1600/1000',
        thumb: 'https://picsum.photos/seed/rg-6b/800/500',
        alt: 'Turquoise cove with fishing boats',
        caption: 'A turquoise cove and its boats',
      },
      {
        src: 'https://picsum.photos/seed/rg-6c/1600/1000',
        thumb: 'https://picsum.photos/seed/rg-6c/800/500',
        alt: 'Terraced vineyards in morning mist',
        caption: 'Terraced vineyards in the mist',
      },
      {
        src: 'https://picsum.photos/seed/rg-6d/900/1400',
        thumb: 'https://picsum.photos/seed/rg-6d/450/700',
        alt: 'Old lighthouse on a rocky headland',
        caption: 'The lighthouse on the headland',
      },
      {
        src: 'https://picsum.photos/seed/rg-6e/1600/1000',
        thumb: 'https://picsum.photos/seed/rg-6e/800/500',
        alt: 'Wild horses grazing on a dune',
        caption: 'Wild horses on the dunes',
      },
      {
        src: 'https://picsum.photos/seed/rg-6f/1200/1200',
        thumb: 'https://picsum.photos/seed/rg-6f/600/600',
        alt: 'Street musicians in a coastal town square',
        caption: 'Musicians in the town square',
      },
      {
        src: 'https://picsum.photos/seed/rg-6g/1600/1000',
        thumb: 'https://picsum.photos/seed/rg-6g/800/500',
        alt: 'Milky Way over a deserted beach',
        caption: 'The Milky Way over an empty beach',
      },
    ],
    stats: { replies: 97, likes: 3842, shares: 514 },
  },
  {
    id: 'rg-post-1',
    user: { name: 'Elena Vasquez', handle: '@elenavsq', avatar: 'https://i.pravatar.cc/150?u=elena', initials: 'EV' },
    text: 'First light over the ridgeline this morning — worth every minute of the 4am alarm.',
    time: '2h',
    images: [
      {
        src: 'https://picsum.photos/seed/rg-1/1600/1000',
        thumb: 'https://picsum.photos/seed/rg-1/800/500',
        alt: 'Mountain range under a wide morning sky',
        caption: 'First light over the ridgeline',
      },
    ],
    stats: { replies: 12, likes: 284, shares: 31 },
  },
  {
    id: 'rg-post-2',
    user: { name: 'Marcus Chen', handle: '@marcusc', avatar: 'https://i.pravatar.cc/150?u=marcus', initials: 'MC' },
    text: 'A vertical drop through the gorge, then the coastline from above. Two very different kinds of quiet.',
    time: '5h',
    images: [
      {
        src: 'https://picsum.photos/seed/rg-2a/900/1400',
        thumb: 'https://picsum.photos/seed/rg-2a/450/700',
        alt: 'Tall waterfall in a narrow gorge',
        caption: 'A vertical drop through the gorge',
      },
      {
        src: 'https://picsum.photos/seed/rg-2b/1200/1200',
        thumb: 'https://picsum.photos/seed/rg-2b/600/600',
        alt: 'Overhead shot of a coastline',
        caption: 'Where the tide meets the rocks',
      },
    ],
    stats: { replies: 45, likes: 1203, shares: 89 },
  },
  {
    id: 'rg-post-3',
    user: { name: 'Aisha Patel', handle: '@aishapatel', avatar: 'https://i.pravatar.cc/150?u=aisha', initials: 'AP' },
    text: 'Golden hour across the valley, the canopy from below, and still water at dusk. A good day for light.',
    time: '8h',
    images: [
      {
        src: 'https://picsum.photos/seed/rg-3a/1600/900',
        thumb: 'https://picsum.photos/seed/rg-3a/800/450',
        alt: 'Rolling fields at golden hour',
        caption: 'Golden hour across the valley',
      },
      {
        src: 'https://picsum.photos/seed/rg-3b/1000/1400',
        thumb: 'https://picsum.photos/seed/rg-3b/500/700',
        alt: 'Dense forest canopy from below',
        caption: 'Looking up through the canopy',
      },
      {
        src: 'https://picsum.photos/seed/rg-3c/1500/1000',
        thumb: 'https://picsum.photos/seed/rg-3c/750/500',
        alt: 'Quiet lake reflecting the hills',
        caption: 'Still water at dusk',
      },
    ],
    stats: { replies: 28, likes: 892, shares: 67 },
  },
  {
    id: 'rg-post-4',
    user: { name: 'James Okafor', handle: '@jamesokafor', avatar: 'https://i.pravatar.cc/150?u=james', initials: 'JO' },
    text: 'Four frames from the brutalist district. Say what you will about the aesthetic — the geometry is unreal.',
    time: '12h',
    images: [
      {
        src: 'https://picsum.photos/seed/rg-4a/1600/1000',
        thumb: 'https://picsum.photos/seed/rg-4a/800/500',
        alt: 'Concrete building with geometric shadows',
        caption: 'Geometry in concrete and shadow',
      },
      {
        src: 'https://picsum.photos/seed/rg-4b/900/1400',
        thumb: 'https://picsum.photos/seed/rg-4b/450/700',
        alt: 'Spiral staircase viewed from below',
        caption: 'Looking up the spiral',
      },
      {
        src: 'https://picsum.photos/seed/rg-4c/1600/1000',
        thumb: 'https://picsum.photos/seed/rg-4c/800/500',
        alt: 'Repeating balcony pattern on a tower block',
        caption: 'A wall of repeating balconies',
      },
      {
        src: 'https://picsum.photos/seed/rg-4d/900/1400',
        thumb: 'https://picsum.photos/seed/rg-4d/450/700',
        alt: 'Sunlight cutting through a concrete overhang',
        caption: 'Light through the overhang',
      },
    ],
    stats: { replies: 63, likes: 2147, shares: 312 },
  },
  {
    id: 'rg-post-5',
    user: { name: 'Sofia Lindgren', handle: '@sofialind', avatar: 'https://i.pravatar.cc/150?u=sofia', initials: 'SL' },
    text: 'First snowfall of the season. Five favourites — swipe through, the last two are my pick of the set.',
    time: '1d',
    images: [
      {
        src: 'https://picsum.photos/seed/rg-5a/1600/1000',
        thumb: 'https://picsum.photos/seed/rg-5a/800/500',
        alt: 'Snow-covered pine forest at sunset',
        caption: 'Snow on the pines at sunset',
      },
      {
        src: 'https://picsum.photos/seed/rg-5b/1600/1000',
        thumb: 'https://picsum.photos/seed/rg-5b/800/500',
        alt: 'Footprints in fresh snow leading to a cabin',
        caption: 'Footprints to the cabin',
      },
      {
        src: 'https://picsum.photos/seed/rg-5c/1000/1400',
        thumb: 'https://picsum.photos/seed/rg-5c/500/700',
        alt: 'Frosted branches against a pale sky',
        caption: 'Frost on bare branches',
      },
      {
        src: 'https://picsum.photos/seed/rg-5d/1600/1000',
        thumb: 'https://picsum.photos/seed/rg-5d/800/500',
        alt: 'Frozen lake at blue hour',
        caption: 'Blue hour on the frozen lake',
      },
      {
        src: 'https://picsum.photos/seed/rg-5e/1200/1200',
        thumb: 'https://picsum.photos/seed/rg-5e/600/600',
        alt: 'Close-up of a single snowflake on wool',
        caption: 'One flake, close up',
      },
    ],
    stats: { replies: 34, likes: 1567, shares: 201 },
  },
];

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}


/**
 * Per-cell rounded-corner classes for the 1- to 4-cell grids. Inner edges
 * stay sharp; outer corners get the same rounding as the parent grid.
 */
function cornerClass(index: number, count: number): string {
  if (count === 2) {
    return index === 0 ? 'rounded-l-xl rounded-r-none' : 'rounded-l-none rounded-r-xl';
  }
  if (count === 3) {
    if (index === 0) return 'rounded-l-xl rounded-r-none';
    if (index === 1) return 'rounded-tl-none rounded-tr-xl rounded-bl-none rounded-br-none';
    return 'rounded-tl-none rounded-tr-none rounded-bl-none rounded-br-xl';
  }
  if (count === 4) {
    return [
      'rounded-tl-xl rounded-tr-none rounded-bl-none rounded-br-none',
      'rounded-tl-none rounded-tr-xl rounded-bl-none rounded-br-none',
      'rounded-tl-none rounded-tr-none rounded-bl-xl rounded-br-none',
      'rounded-tl-none rounded-tr-none rounded-bl-none rounded-br-xl',
    ][index]!;
  }
  return 'rounded-xl';
}

/**
 * Facebook-style trigger grid: 1 image fills the width, 2–4 tile into a
 * grid, and 5+ collapse the extras behind a `+N` overlay tile. Every tile
 * is a `Lightbox.Trigger`, so tapping one morphs into the viewer at that
 * index. The overlay tile uses `crossfade="both"` — there is no single full-size
 * image behind it, so a morph would look wrong.
 */
function ImageGrid({ imgs }: { imgs: GalleryImage[] }) {
  const count = imgs.length;

  if (count === 1) {
    const only = imgs[0]!;
    return (
      <Lightbox.Trigger index={0} className={`block w-full overflow-hidden rounded-xl bg-transparent p-0 ${triggerFocusClass}`}>
        {({ imageRef }) => (
          <img ref={imageRef} {...imgDims(only.thumb)} src={only.thumb} alt={only.alt} className="block  w-full object-cover" />
        )}
      </Lightbox.Trigger>
    );
  }

  if (count === 2) {
    return (
      <div className="grid grid-cols-2 gap-[2px] overflow-hidden rounded-xl">
        {imgs.map((img, i) => (
          <Lightbox.Trigger
            key={i}
            index={i}
            className={`block overflow-hidden bg-transparent p-0 ${triggerFocusClass} ${cornerClass(i, 2)}`}
          >
            {({ imageRef }) => (
              <img
                ref={imageRef}
                {...imgDims(img.thumb)}
                src={img.thumb}
                alt={img.alt}
                className="block aspect-[4/5] w-full object-cover"
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
      <div className="grid aspect-[3/2] grid-cols-2 grid-rows-2 gap-[2px] overflow-hidden rounded-xl">
        <Lightbox.Trigger
          index={0}
          className={`row-span-2 block overflow-hidden bg-transparent p-0 ${triggerFocusClass} ${cornerClass(0, 3)}`}
        >
          {({ imageRef }) => (
            <img ref={imageRef} {...imgDims(first.thumb)} src={first.thumb} alt={first.alt} className="block size-full object-cover" />
          )}
        </Lightbox.Trigger>
        {imgs.slice(1, 3).map((img, idx) => {
          const i = idx + 1;
          return (
            <Lightbox.Trigger
              key={i}
              index={i}
              className={`block overflow-hidden bg-transparent p-0 ${triggerFocusClass} ${cornerClass(i, 3)}`}
            >
              {({ imageRef }) => (
                <img ref={imageRef} {...imgDims(img.thumb)} src={img.thumb} alt={img.alt} className="block size-full object-cover" />
              )}
            </Lightbox.Trigger>
          );
        })}
      </div>
    );
  }

  const extra = count - 4;
  return (
    <div className="grid aspect-[3/2] grid-cols-2 grid-rows-2 gap-[2px] overflow-hidden rounded-xl">
      {imgs.slice(0, 4).map((img, i) => {
        const showOverlay = i === 3 && extra > 0;
        return (
          <Lightbox.Trigger
            key={i}
            index={i}
            crossfade={showOverlay ? 'both' : undefined}
            className={`block overflow-hidden bg-transparent p-0 ${triggerFocusClass} ${cornerClass(i, 4)}`}
          >
            {({ imageRef }) => (
              // The whole tile morphs (overlay included) by default, but the
              // placeholder is sourced only from `imageRef` — so the
              // "+N" overlay is excluded from the destination bridge.
              <div className={`relative size-full overflow-hidden ${cornerClass(i, 4)}`}>
                <img
                  ref={imageRef}
                  {...imgDims(img.thumb)}
                  src={img.thumb}
                  alt={img.alt}
                  className="block size-full object-cover"
                />
                {showOverlay && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50">
                    <span className="text-2xl font-bold text-white">+{extra}</span>
                  </div>
                )}
              </div>
            )}
          </Lightbox.Trigger>
        );
      })}
    </div>
  );
}

function ActionBar({ stats }: { stats: FeedPost['stats'] }) {
  return (
    <div className="-ml-2 mt-3 flex gap-1">
      <Button variant="ghost" size="sm" className="text-muted-foreground">
        <MessageCircle aria-hidden />
        {formatCount(stats.replies)}
      </Button>
      <Button variant="ghost" size="sm" className="text-muted-foreground">
        <Heart aria-hidden />
        {formatCount(stats.likes)}
      </Button>
      <Button variant="ghost" size="sm" className="text-muted-foreground">
        <Share aria-hidden />
        {formatCount(stats.shares)}
      </Button>
    </div>
  );
}

/**
 * One self-contained gallery: a feed post (avatar, header, text, image
 * grid, actions) wired to the full-screen media viewer. Swipe navigation uses
 * `Lightbox.Slides` — a dedicated lightbox scroller that reads/writes the
 * lightbox's own active index directly, so swiping, thumbnail clicks, and
 * keyboard navigation all stay in sync without a bridge hook.
 */
function FeedPostGallery({ post }: { post: FeedPost }) {
  // Posts with hidden extras (behind the `+N` tile) have no trigger for
  // those indexes — close to the nearest one instead of flashing.
  const morphTo = post.images.length > 4 ? 'closest' : undefined;

  return (
    <Lightbox.Root loop morphTo={morphTo} awaitImageDecode={false}>
      <article className="flex gap-3 py-4">
        <div className="shrink-0 pt-0.5">
          <Avatar size="lg">
            <AvatarImage src={post.user.avatar} alt={post.user.name} />
            <AvatarFallback>{post.user.initials}</AvatarFallback>
          </Avatar>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-semibold">{post.user.name}</span>
            <span className="text-sm text-muted-foreground">{post.user.handle}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{post.time}</span>
          </div>

          <p className="mt-1 mb-3 text-sm leading-relaxed">{post.text}</p>

          <ImageGrid imgs={post.images} />
          <ActionBar stats={post.stats} />
        </div>
      </article>

      <LightboxGallery
        items={post.images}
        ariaLabel={`Photos by ${post.user.name}`}
        preload={post.images.length}
      />
    </Lightbox.Root>
  );
}

export default function ResponsiveGalleryPage() {
  return (
    <ExampleShell
      title="Responsive gallery"
      docsHref="/docs/lightbox/gestures"
      docsLabel="Gestures"
      description={
        <>
          The canonical real-world lightbox, shown inside a social feed. Each post is an independent{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">Lightbox.Root</code> whose
          attachments render in a Facebook-style grid; posts with more than four images collapse the extras behind a{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">crossfade=&quot;both&quot;</code> overlay tile.
          Opening a post reveals the full viewer: swipe navigation, desktop-only thumbnails, a View Transition morph,
          pinch / scroll / keyboard zoom, and pull-to-dismiss. Canonical gesture rules live in the docs.
        </>
      }
    >
      <div className="mx-auto max-w-xl">
        <div className="border-b border-border py-4 pb-2">
          <h2 className="text-xl font-semibold tracking-tight">Home</h2>
        </div>

        {feedPosts.map((post, i) => (
          <React.Fragment key={post.id}>
            <FeedPostGallery post={post} />
            {i < feedPosts.length - 1 && <Separator />}
          </React.Fragment>
        ))}
      </div>
    </ExampleShell>
  );
}
