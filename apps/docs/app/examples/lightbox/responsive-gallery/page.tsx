'use client';

import * as React from 'react';
import { Lightbox, ScrollGallery, useLightboxScrollSync } from 'ramka';
import { Heart, MessageCircle, Share, X, ZoomIn, ZoomOut } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ExampleShell } from '../../../_components/example-shell';

/**
 * The canonical, real-world lightbox — deliberately self-contained (no
 * shared docs helpers, inline data) so the whole composition can be read
 * top-to-bottom and iterated on in one place.
 *
 * The entry surface is a social feed: each post is an independent
 * `Lightbox.Root` whose attachments render in a Facebook-style image grid.
 * Posts with more than four images collapse the extras behind a `+N`
 * overlay tile that uses `crossfade` (rather than a shared morph), and
 * `morphTo="closest"` so navigating past the visible thumbnails still
 * closes sensibly.
 *
 * Opening a post reveals the production media viewer: swipe navigation via
 * a `ScrollGallery` viewport, thumbnails on desktop only, a View Transition
 * morph from the tapped tile, per-item pinch/scroll/keyboard zoom, and
 * pull-to-dismiss. Chrome (top controls + thumbnails) hides while zoomed
 * purely through CSS: `Lightbox.Zoom` sets `data-zoomed` on the Content
 * element, and the chrome targets an ancestor with `[[data-zoomed]_&]`.
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

const iconButton =
  'inline-flex h-9 w-9 items-center justify-center rounded-full text-black/70 transition hover:bg-black/10 hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black/40 disabled:cursor-not-allowed disabled:opacity-30 pointer-events-auto dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-white/70';

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
 * index. The overlay tile uses `crossfade` — there is no single full-size
 * image behind it, so a morph would look wrong.
 */
function ImageGrid({ imgs }: { imgs: GalleryImage[] }) {
  const count = imgs.length;

  if (count === 1) {
    const only = imgs[0]!;
    return (
      <Lightbox.Trigger index={0} className="block w-full overflow-hidden rounded-xl bg-transparent p-0">
        <img src={only.thumb} alt={only.alt} className="block  w-full object-cover" />
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
            className={`block overflow-hidden bg-transparent p-0 ${cornerClass(i, 2)}`}
          >
            <img
              src={img.thumb}
              alt={img.alt}
              className="block aspect-[4/5] w-full object-cover"
            />
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
          className={`row-span-2 block overflow-hidden bg-transparent p-0 ${cornerClass(0, 3)}`}
        >
          <img src={first.thumb} alt={first.alt} className="block h-full w-full object-cover" />
        </Lightbox.Trigger>
        {imgs.slice(1, 3).map((img, idx) => {
          const i = idx + 1;
          return (
            <Lightbox.Trigger
              key={i}
              index={i}
              className={`block overflow-hidden bg-transparent p-0 ${cornerClass(i, 3)}`}
            >
              <img src={img.thumb} alt={img.alt} className="block h-full w-full object-cover" />
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
            crossfade={showOverlay}
            className={`block overflow-hidden bg-transparent p-0 ${cornerClass(i, 4)}`}
          >
            <div
              className={`relative h-full w-full overflow-hidden ${cornerClass(i, 4)}`}
            >
              <img src={img.thumb} alt={img.alt} className="block h-full w-full object-cover" />
              {showOverlay && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50">
                  <span className="text-2xl font-bold text-white">+{extra}</span>
                </div>
              )}
            </div>
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
 * grid, actions) wired to the full-screen media viewer. `useLightboxScrollSync`
 * owns the single shared active index and returns ready-to-spread props for
 * both `Lightbox.Root` and the inner `ScrollGallery.Root`, so swiping,
 * thumbnail clicks, and keyboard navigation all stay in sync.
 */
function FeedPostGallery({ post }: { post: FeedPost }) {
  // A single source of truth for the active index, shared between
  // `Lightbox.Root` and the inner `ScrollGallery.Root`. The hook dedupes
  // updates from either root and keeps `loop`/`scrollBehavior` consistent so
  // swiping, thumbnails, and keyboard all stay in sync.
  const sync = useLightboxScrollSync({ loop: true, scrollBehavior: 'instant' });
  // Posts with hidden extras (behind the `+N` tile) have no trigger for
  // those indexes — close to the nearest one instead of flashing.
  const morphTo = post.images.length > 4 ? 'closest' : undefined;

  return (
    <Lightbox.Root viewTransition morphTo={morphTo} {...sync.lightboxRootProps}>
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

      {/* Scrim. `data-pulling:transition-none` hands the fade to the
          pull-to-dismiss gesture, which drives it 1:1 with the finger via
          the `--lightbox-pull-progress` variable. */}
      <Lightbox.Backdrop className="fixed inset-0 z-40 bg-white/90 opacity-0 transition-opacity duration-300 data-[open]:[opacity:calc(1_-_var(--lightbox-pull-progress,0)_*_0.6)] data-pulling:transition-none starting:data-[open]:opacity-0 dark:bg-black/90" />

      {/* Fullscreen viewer */}
      <Lightbox.Content
        aria-label={`Photos by ${post.user.name}`}
        className="fixed inset-0 z-50 flex flex-col overscroll-contain opacity-0 outline-none transition-opacity duration-200 data-[open]:opacity-100 starting:data-[open]:opacity-0"
      >
        <ScrollGallery.Root {...sync.scrollGalleryRootProps}>
          {/* Swipeable, snapping viewport of full-size images */}
          <Lightbox.ItemGroup
            render={<ScrollGallery.Viewport aria-label="Full-size images" />}
            preload={post.images.length}
            className="flex flex-1 overflow-x-auto overscroll-x-contain [scroll-snap-type:x_mandatory] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden gap-5 md:gap-0"
          >
            {post.images.map((img, i) => (
              // The scroll-snap box (ScrollGallery.Item) and the drag target
              // (Lightbox.Item) are deliberately SEPARATE elements. The pull-
              // to-dismiss gesture transforms the Lightbox.Item; keeping that
              // transform OFF the snap box stops the mandatory scroll-snap
              // container from re-aligning (and scrolling) in response to the
              // transformed item during a vertical pull.
              <ScrollGallery.Item key={i} className="relative h-full w-screen shrink-0 snap-center">
                <Lightbox.Item
                  index={i}
                  caption={img.caption}
                  className="relative flex h-full w-full items-center justify-center"
                >
                  <Lightbox.Zoom maxZoom={6} className="flex h-full w-full items-center justify-center">
                    <img
                      src={img.src}
                      alt={img.alt}
                      loading="eager"
                      draggable={false}
                      className="max-h-[calc(100%-6rem)]  max-w-full select-none rounded-none object-contain md:max-h-[calc(100%-11rem)]  md:max-w-[calc(100%-4rem)] md:rounded-lg"
                    />
                  </Lightbox.Zoom>
                </Lightbox.Item>
              </ScrollGallery.Item>
            ))}
          </Lightbox.ItemGroup>

          {/* Top-right controls — hidden while zoomed or while pulling to
              dismiss (fades back in as the item snaps back, same as zoom). */}
          <div className="absolute right-3 top-3 z-10 flex gap-2 transition-[opacity,filter] duration-200 [[data-zoomed]_&]:pointer-events-none [[data-zoomed]_&]:opacity-0 [[data-zoomed]_&]:blur-[6px] [[data-pulling]_&]:pointer-events-none [[data-pulling]_&]:opacity-0 [[data-pulling]_&]:blur-[6px] [[data-pull-dismissing]_&]:pointer-events-none [[data-pull-dismissing]_&]:opacity-0 [[data-pull-dismissing]_&]:blur-[6px]">
            <Lightbox.ZoomOut className={iconButton} aria-label="Zoom out">
              <ZoomOut aria-hidden className="h-4 w-4" />
            </Lightbox.ZoomOut>
            <Lightbox.ZoomIn className={iconButton} aria-label="Zoom in">
              <ZoomIn aria-hidden className="h-4 w-4" />
            </Lightbox.ZoomIn>
            <Lightbox.Close className={iconButton} aria-label="Close">
              <X aria-hidden className="h-5 w-5" />
            </Lightbox.Close>
          </div>

          {/* Caption + thumbnails — thumbnails only render on desktop.
              Hidden while zoomed or pulling to dismiss. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 px-3 pb-4 transition-[opacity,filter] duration-200 [[data-zoomed]_&]:opacity-0 [[data-zoomed]_&]:blur-[6px] [[data-pulling]_&]:opacity-0 [[data-pulling]_&]:blur-[6px] [[data-pull-dismissing]_&]:opacity-0 [[data-pull-dismissing]_&]:blur-[6px]">
            <Lightbox.Caption className="pointer-events-auto block min-h-[1.25rem] max-w-full truncate px-6 text-center text-sm text-black/70 dark:text-white/80" />

            <ScrollGallery.ScrollMarkerGroup
              aria-label="Photo thumbnails"
              className="pointer-events-auto hidden justify-center gap-2 md:flex"
            >
              {post.images.map((img, i) => (
                <ScrollGallery.ScrollMarker
                  key={i}
                  index={i}
                  className="h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 border-transparent p-0 opacity-50 transition data-[active]:border-black data-[active]:opacity-100 dark:data-[active]:border-white"
                >
                  <img src={img.thumb} alt={img.alt} className="h-full w-full object-cover" />
                </ScrollGallery.ScrollMarker>
              ))}
            </ScrollGallery.ScrollMarkerGroup>
          </div>
        </ScrollGallery.Root>
      </Lightbox.Content>
    </Lightbox.Root>
  );
}

export default function ResponsiveGalleryPage() {
  return (
    <ExampleShell
      title="Responsive gallery"
      description={
        <>
          The canonical real-world lightbox, shown inside a social feed. Each post is an independent{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">Lightbox.Root</code> whose
          attachments render in a Facebook-style grid; posts with more than four images collapse the extras behind a{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">crossfade</code> overlay tile.
          Opening a post reveals the full viewer: swipe navigation, desktop-only thumbnails, a View Transition morph,
          pinch / scroll / keyboard zoom, and pull-to-dismiss.
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
