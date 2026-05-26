'use client';

import * as React from 'react';
import { Lightbox } from 'react-image-gallery';
import { Heart, MessageCircle, Share } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ExampleShell } from '../../../_components/example-shell';
import {
  LightboxCloseButton,
  LightboxFrame,
  LightboxFullImage,
  LightboxNavBar,
  LightboxOverlay,
  StackedItemGroup,
  stackedItemClass,
} from '../../../_components/lightbox-chrome';

interface FeedPost {
  id: string;
  user: { name: string; handle: string; avatar: string; initials: string };
  text: string;
  time: string;
  images: { src: string; thumb: string; alt: string }[];
  stats: { replies: number; likes: number; shares: number };
}

const feedPosts: FeedPost[] = [
  {
    id: 'post-1',
    user: { name: 'Elena Vasquez', handle: '@elenavsq', avatar: 'https://i.pravatar.cc/150?u=elena', initials: 'EV' },
    text: 'Spent the weekend exploring the old quarter. Every alley has a story — and apparently, a very photogenic cat.',
    time: '2h',
    images: [
      { src: 'https://picsum.photos/seed/feed1a/1200/800', thumb: 'https://picsum.photos/seed/feed1a/600/400', alt: 'Narrow alley with hanging laundry' },
    ],
    stats: { replies: 12, likes: 284, shares: 31 },
  },
  {
    id: 'post-2',
    user: { name: 'Marcus Chen', handle: '@marcusc', avatar: 'https://i.pravatar.cc/150?u=marcus', initials: 'MC' },
    text: "New studio setup is finally complete. Natural light in the morning, controlled lighting at night. Couldn't be happier with how these turned out.",
    time: '5h',
    images: [
      { src: 'https://picsum.photos/seed/feed2a/1200/800', thumb: 'https://picsum.photos/seed/feed2a/600/400', alt: 'Bright studio with large windows' },
      { src: 'https://picsum.photos/seed/feed2b/1200/800', thumb: 'https://picsum.photos/seed/feed2b/600/400', alt: 'Studio setup with ring light at night' },
    ],
    stats: { replies: 45, likes: 1203, shares: 89 },
  },
  {
    id: 'post-3',
    user: { name: 'Aisha Patel', handle: '@aishapatel', avatar: 'https://i.pravatar.cc/150?u=aisha', initials: 'AP' },
    text: 'Food market finds from this morning. Everything was so fresh the vendors were still arranging displays when I arrived. Got there at 6am and it was worth every lost minute of sleep.',
    time: '8h',
    images: [
      { src: 'https://picsum.photos/seed/feed3a/1200/900', thumb: 'https://picsum.photos/seed/feed3a/600/450', alt: 'Colourful spice stall' },
      { src: 'https://picsum.photos/seed/feed3b/1200/900', thumb: 'https://picsum.photos/seed/feed3b/600/450', alt: 'Fresh fruit arranged in pyramids' },
      { src: 'https://picsum.photos/seed/feed3c/900/1200', thumb: 'https://picsum.photos/seed/feed3c/450/600', alt: 'Baker pulling bread from a clay oven' },
    ],
    stats: { replies: 28, likes: 892, shares: 67 },
  },
  {
    id: 'post-4',
    user: { name: 'James Okafor', handle: '@jamesokafor', avatar: 'https://i.pravatar.cc/150?u=james', initials: 'JO' },
    text: 'Architecture walk through the brutalist district. Say what you will about the aesthetic — the geometry is unreal in the right light.',
    time: '12h',
    images: [
      { src: 'https://picsum.photos/seed/feed4a/1200/800', thumb: 'https://picsum.photos/seed/feed4a/600/400', alt: 'Concrete building with geometric shadows' },
      { src: 'https://picsum.photos/seed/feed4b/800/1200', thumb: 'https://picsum.photos/seed/feed4b/400/600', alt: 'Spiral staircase viewed from below' },
      { src: 'https://picsum.photos/seed/feed4c/1200/800', thumb: 'https://picsum.photos/seed/feed4c/600/400', alt: 'Repeating balcony pattern on a tower block' },
      { src: 'https://picsum.photos/seed/feed4d/800/1200', thumb: 'https://picsum.photos/seed/feed4d/400/600', alt: 'Sunlight cutting through a concrete overhang' },
    ],
    stats: { replies: 63, likes: 2147, shares: 312 },
  },
  {
    id: 'post-5',
    user: { name: 'Sofia Lindgren', handle: '@sofialind', avatar: 'https://i.pravatar.cc/150?u=sofia', initials: 'SL' },
    text: 'First snowfall of the season, and naturally I had my camera. The way the light hits fresh powder at golden hour is something else entirely.',
    time: '1d',
    images: [
      { src: 'https://picsum.photos/seed/feed5a/1200/800', thumb: 'https://picsum.photos/seed/feed5a/600/400', alt: 'Snow-covered pine forest at sunset' },
      { src: 'https://picsum.photos/seed/feed5b/1200/800', thumb: 'https://picsum.photos/seed/feed5b/600/400', alt: 'Footprints in fresh snow leading to a cabin' },
    ],
    stats: { replies: 34, likes: 1567, shares: 201 },
  },
  {
    id: 'post-6',
    user: { name: 'Tomás Rivera', handle: '@tomasrivera', avatar: 'https://i.pravatar.cc/150?u=tomas', initials: 'TR' },
    text: 'Week-long road trip through the coast is done. Seven stops, seven completely different landscapes. This country never stops surprising me.',
    time: '2d',
    images: [
      { src: 'https://picsum.photos/seed/feed6a/1200/800', thumb: 'https://picsum.photos/seed/feed6a/600/400', alt: 'Dramatic cliffside road at sunset' },
      { src: 'https://picsum.photos/seed/feed6b/1200/900', thumb: 'https://picsum.photos/seed/feed6b/600/450', alt: 'Turquoise cove with fishing boats' },
      { src: 'https://picsum.photos/seed/feed6c/1200/800', thumb: 'https://picsum.photos/seed/feed6c/600/400', alt: 'Terraced vineyards in morning mist' },
      { src: 'https://picsum.photos/seed/feed6d/900/1200', thumb: 'https://picsum.photos/seed/feed6d/450/600', alt: 'Old lighthouse on a rocky headland' },
      { src: 'https://picsum.photos/seed/feed6e/1200/800', thumb: 'https://picsum.photos/seed/feed6e/600/400', alt: 'Wild horses grazing on a dune' },
      { src: 'https://picsum.photos/seed/feed6f/1200/900', thumb: 'https://picsum.photos/seed/feed6f/600/450', alt: 'Street musicians in a coastal town square' },
      { src: 'https://picsum.photos/seed/feed6g/1200/800', thumb: 'https://picsum.photos/seed/feed6g/600/400', alt: 'Milky Way over a deserted beach' },
    ],
    stats: { replies: 97, likes: 3842, shares: 514 },
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

function ImageGrid({ imgs }: { imgs: FeedPost['images'] }) {
  const count = imgs.length;

  if (count === 1) {
    const only = imgs[0]!;
    return (
      <Lightbox.Trigger index={0} className="block w-full overflow-hidden rounded-xl bg-transparent p-0">
        <img
          src={only.thumb}
          alt={only.alt}
          className="block aspect-[3/2] w-full rounded-xl object-cover"
        />
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
              className={`block aspect-[4/5] w-full object-cover ${cornerClass(i, 2)}`}
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
          <img
            src={first.thumb}
            alt={first.alt}
            className={`block h-full w-full object-cover ${cornerClass(0, 3)}`}
          />
        </Lightbox.Trigger>
        {imgs.slice(1, 3).map((img, idx) => {
          const i = idx + 1;
          return (
            <Lightbox.Trigger
              key={i}
              index={i}
              className={`block overflow-hidden bg-transparent p-0 ${cornerClass(i, 3)}`}
            >
              <img
                src={img.thumb}
                alt={img.alt}
                className={`block h-full w-full object-cover ${cornerClass(i, 3)}`}
              />
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
              {...(showOverlay ? { 'data-lightbox-morph': '' } : {})}
              className="relative h-full w-full"
            >
              <img
                src={img.thumb}
                alt={img.alt}
                className={`block h-full w-full object-cover ${cornerClass(i, 4)}`}
              />
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

function FeedPostCard({ post }: { post: FeedPost }) {
  const morphTo = post.images.length > 4 ? 'closest' : undefined;
  return (
    <Lightbox.Root viewTransition morphTo={morphTo}>
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

      <LightboxOverlay />
      <LightboxFrame ariaLabel={`Photos by ${post.user.name}`}>
        <LightboxCloseButton />
        <StackedItemGroup>
          {post.images.map((img, i) => (
            <Lightbox.Item key={i} index={i} className={stackedItemClass}>
              <LightboxFullImage src={img.src} alt={img.alt} />
            </Lightbox.Item>
          ))}
        </StackedItemGroup>
        <LightboxNavBar />
      </LightboxFrame>
    </Lightbox.Root>
  );
}

export default function SocialFeedPage() {
  return (
    <ExampleShell
      title="Social feed"
      description={
        <>
          Each post is an independent <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">Lightbox.Root</code>{' '}
          with 1–7 attachments rendered in a Facebook-style image grid. The 5–7 image grid uses{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">morphTo=&quot;closest&quot;</code>
          {' '}so navigating past the visible thumbnails still produces a sensible close animation.
        </>
      }
    >
      <div className="mx-auto max-w-xl">
        <div className="border-b border-border py-4 pb-2">
          <h2 className="text-xl font-semibold tracking-tight">Home</h2>
        </div>

        {feedPosts.map((post, i) => (
          <React.Fragment key={post.id}>
            <FeedPostCard post={post} />
            {i < feedPosts.length - 1 && <Separator />}
          </React.Fragment>
        ))}
      </div>
    </ExampleShell>
  );
}
