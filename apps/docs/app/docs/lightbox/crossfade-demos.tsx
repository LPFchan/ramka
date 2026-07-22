'use client';

import * as React from 'react';
import { Lightbox } from 'ramka';
import { Play, X } from 'lucide-react';

import { Separator } from '@/components/ui/separator';
import {
  LightboxCloseButton,
  LightboxFrame,
  LightboxFullImage,
  LightboxNavBar,
  LightboxOverlay,
  StackedItemGroup,
  lightboxChromeButton,
  morphHideClass,
  stackedItemClass,
  triggerFocusClass,
  triggerMorphHideClass,
} from '../../_components/lightbox-chrome';

function imgDims(url: string) {
  const m = url.match(/\/(\d+)\/(\d+)$/);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : undefined;
}

/** Matching 3∶2 sources — element boxes in the demos may still differ. */
const photos = [
  {
    src: 'https://picsum.photos/seed/xfade-a/1500/1000',
    thumb: 'https://picsum.photos/seed/xfade-a/600/400',
    alt: 'Coastal cliffs',
  },
  {
    src: 'https://picsum.photos/seed/xfade-b/1500/1000',
    thumb: 'https://picsum.photos/seed/xfade-b/600/400',
    alt: 'Mountain lake',
  },
  {
    src: 'https://picsum.photos/seed/xfade-c/1500/1000',
    thumb: 'https://picsum.photos/seed/xfade-c/600/400',
    alt: 'Desert road',
  },
];

/** Album with hidden extras behind a +N tile (only the first two get triggers). */
const album = [
  ...photos,
  {
    src: 'https://picsum.photos/seed/xfade-d/1500/1000',
    thumb: 'https://picsum.photos/seed/xfade-d/600/400',
    alt: 'Pine forest',
  },
  {
    src: 'https://picsum.photos/seed/xfade-e/1500/1000',
    thumb: 'https://picsum.photos/seed/xfade-e/600/400',
    alt: 'City night',
  },
  {
    src: 'https://picsum.photos/seed/xfade-f/1500/1000',
    thumb: 'https://picsum.photos/seed/xfade-f/600/400',
    alt: 'Snow peak',
  },
  {
    src: 'https://picsum.photos/seed/xfade-g/1500/1000',
    thumb: 'https://picsum.photos/seed/xfade-g/600/400',
    alt: 'River bend',
  },
];

const trailer = {
  title: 'Big Buck Bunny',
  poster:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Big_buck_bunny_poster_big.jpg/500px-Big_buck_bunny_poster_big.jpg',
  posterWidth: 500,
  posterHeight: 707,
  video: 'https://download.blender.org/peach/trailer/trailer_iphone.m4v',
};

/** Initials chips → portraits (non-image morph source). */
const team = [
  {
    name: 'Ava Chen',
    initials: 'AC',
    color: '#2a7ab5',
    src: 'https://picsum.photos/seed/xfade-ava/900/1200',
    alt: 'Portrait of Ava Chen',
  },
  {
    name: 'Jules Okonkwo',
    initials: 'JO',
    color: '#c93c20',
    src: 'https://picsum.photos/seed/xfade-jules/900/1200',
    alt: 'Portrait of Jules Okonkwo',
  },
  {
    name: 'Sam Rivera',
    initials: 'SR',
    color: '#7a9a6d',
    src: 'https://picsum.photos/seed/xfade-sam/900/1200',
    alt: 'Portrait of Sam Rivera',
  },
  {
    name: 'Mei Laurent',
    initials: 'ML',
    color: '#7b3f72',
    src: 'https://picsum.photos/seed/xfade-mei/900/1200',
    alt: 'Portrait of Mei Laurent',
  },
];

const code = 'rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800';

function SameImageDemo() {
  return (
    <Lightbox.Root viewTransition>
      {/* Square trigger boxes vs landscape item (LightboxFullImage) — same 3∶2 sources. */}
      <div className="grid max-w-md grid-cols-3 gap-2">
        {photos.map((img, i) => (
          <Lightbox.Trigger
            key={img.src}
            index={i}
            className={`block aspect-square overflow-hidden rounded-lg bg-transparent p-0 ${triggerMorphHideClass} ${triggerFocusClass}`}
          >
            {({ imageRef }) => (
              <img
                ref={imageRef}
                {...imgDims(img.thumb)}
                src={img.thumb}
                alt={img.alt}
                className="block size-full object-cover"
              />
            )}
          </Lightbox.Trigger>
        ))}
      </div>
      <LightboxOverlay />
      <LightboxFrame ariaLabel="Same-image morph">
        <LightboxCloseButton />
        <StackedItemGroup>
          {photos.map((img, i) => (
            <Lightbox.Item key={img.src} index={i} className={stackedItemClass}>
              <LightboxFullImage src={img.src} alt={img.alt} />
            </Lightbox.Item>
          ))}
        </StackedItemGroup>
        <LightboxNavBar />
      </LightboxFrame>
    </Lightbox.Root>
  );
}

function BothDemo() {
  const visible = 2;
  const extras = album.length - visible;
  return (
    // Indexes beyond the last trigger close to the nearest one.
    <Lightbox.Root viewTransition morphTo="closest">
      <div className="grid max-w-sm grid-cols-2 gap-0.5">
        {album.slice(0, visible).map((img, i) => {
          const isOverlay = i === visible - 1 && extras > 0;
          // Radius must live on the morph target (not only an outer clip), or the
          // VT can't interpolate it into the destination's rounded-lg.
          const corner = i === 0 ? 'rounded-l-xl' : 'rounded-r-xl';
          return (
            <Lightbox.Trigger
              key={img.src}
              index={i}
              crossfade={isOverlay ? 'both' : undefined}
              className={`block bg-transparent p-0 overflow-hidden ${triggerMorphHideClass} ${triggerFocusClass} ${corner}`}
            >
              {({ imageRef }) => (
                <div className="relative overflow-hidden">
                  <img
                    ref={imageRef}
                    {...imgDims(img.thumb)}
                    src={img.thumb}
                    alt={img.alt}
                    className="block aspect-square w-full object-cover"
                  />
                  {isOverlay ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50">
                      <span className="text-2xl font-bold text-white">+{extras}</span>
                    </div>
                  ) : null}
                </div>
              )}
            </Lightbox.Trigger>
          );
        })}
      </div>
      <LightboxOverlay />
      <LightboxFrame ariaLabel="Crossfade both demo">
        <LightboxCloseButton />
        <StackedItemGroup>
          {album.map((img, i) => (
            <Lightbox.Item key={img.src} index={i} className={stackedItemClass}>
              <LightboxFullImage src={img.src} alt={img.alt} />
            </Lightbox.Item>
          ))}
        </StackedItemGroup>
        <LightboxNavBar />
      </LightboxFrame>
    </Lightbox.Root>
  );
}

function AnyElementDemo() {
  return (
    <Lightbox.Root viewTransition>
      <ul className="flex flex-wrap gap-6">
        {team.map((person, i) => (
          <li key={person.name} className="flex w-20 flex-col items-center gap-2">
            <Lightbox.Trigger
              index={i}
              crossfade="both"
              className={`rounded-full size-16 overflow-hidden bg-transparent p-0 ${triggerFocusClass}`}
            >
              <div
                className={`flex size-full items-center justify-center text-sm font-semibold tracking-wide text-white ${morphHideClass}`}
                style={{ background: person.color }}
              >
                {person.initials}
              </div>
            </Lightbox.Trigger>
            <span className="text-center text-xs font-medium text-neutral-700 dark:text-neutral-300">
              {person.name}
            </span>
          </li>
        ))}
      </ul>
      <LightboxOverlay />
      <LightboxFrame ariaLabel="Team portraits">
        <LightboxCloseButton />
        <StackedItemGroup>
          {team.map((person, i) => (
            <Lightbox.Item
              key={person.name}
              index={i}
              caption={person.name}
              className={stackedItemClass}
            >
              <LightboxFullImage src={person.src} alt={person.alt} />
            </Lightbox.Item>
          ))}
        </StackedItemGroup>
        <LightboxNavBar />
      </LightboxFrame>
    </Lightbox.Root>
  );
}

function CloseDemo() {
  const [readyToPlay, setReadyToPlay] = React.useState(false);

  return (
    <Lightbox.Root
      viewTransition
      onOpenChange={(open) => {
        if (!open) setReadyToPlay(false);
      }}
      onOpenChangeComplete={setReadyToPlay}
    >
      <Lightbox.Trigger
        index={0}
        crossfade="close"
        className={`group block w-40 bg-transparent p-0 ${triggerFocusClass}`}
      >
        {({ morphRef }) => (
          // Radius on the morph target itself — the VT reads getComputedStyle(morphRef).
          <div className={`relative overflow-hidden rounded-xl ${morphHideClass}`}>
            <img
              ref={morphRef}
              width={trailer.posterWidth}
              height={trailer.posterHeight}
              src={trailer.poster}
              alt={trailer.title}
              className="block aspect-[2/3] w-full rounded-xl object-cover"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-black">
                <Play aria-hidden className="h-4 w-4 fill-current" />
              </div>
            </div>
          </div>
        )}
      </Lightbox.Trigger>

      <Lightbox.Content
        aria-label={trailer.title}
        className="fixed inset-0 z-50 size-full overscroll-contain opacity-0 outline-none transition-opacity duration-[280ms] ease-out-expo data-[open]:opacity-100 starting:opacity-0"
      >
        <Lightbox.Close className={`absolute right-4 top-4 z-10 ${lightboxChromeButton}`} aria-label="Close">
          <X aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.25} />
        </Lightbox.Close>
        <Lightbox.ItemGroup className="size-full">
          <Lightbox.Item index={0} className="size-full">
            {({ morphRef }) => (
              <CloseDemoVideo src={trailer.video} poster={trailer.poster} ready={readyToPlay} morphRef={morphRef} />
            )}
          </Lightbox.Item>
        </Lightbox.ItemGroup>
      </Lightbox.Content>
    </Lightbox.Root>
  );
}

function CloseDemoVideo({
  src,
  poster,
  ready,
  morphRef,
}: {
  src: string;
  poster: string;
  ready: boolean;
  morphRef: (node: HTMLElement | null) => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const setRef = React.useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      morphRef(node);
    },
    [morphRef],
  );

  React.useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (ready) {
      el.play().catch(() => {});
    } else {
      el.pause();
      el.currentTime = 0;
    }
  }, [ready]);

  return (
    <video
      ref={setRef}
      src={src}
      poster={poster}
      controls
      playsInline
      muted
      preload="metadata"
      className="size-full bg-black object-contain"
    />
  );
}

/** Live crossfade cases for the View transitions guide (and the Examples alias page). */
export function LightboxCrossfadeDemos() {
  return (
    <div className="flex flex-col gap-10">
      <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
            <tr>
              <th className="px-3 py-2 font-medium">Value</th>
              <th className="px-3 py-2 font-medium">Use when</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            <tr>
              <td className="px-3 py-2 font-mono text-xs">undefined</td>
              <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">
                Same picture, same intrinsic aspect ratio — element boxes may differ
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">&quot;both&quot;</td>
              <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">
                Trigger ≠ item both ways — stacks, +N overlays, swatches
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">&quot;close&quot;</td>
              <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">
                Open frames match, close doesn&apos;t — poster → playing video
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">&quot;open&quot;</td>
              <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">
                Rare inverse of close
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <section className="space-y-3">
        <h4 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Omit — same picture
        </h4>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Same picture and intrinsic aspect ratio; element boxes may differ. Both sides use{' '}
          <code className={code}>object-fit: cover</code>. Below: square thumbs → landscape viewer from
          3∶2 sources.
        </p>
        <SameImageDemo />
      </section>

      <Separator />

      <section className="space-y-3">
        <h4 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          <code className={code}>crossfade=&quot;both&quot;</code> — +N tile
        </h4>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Open dissolves the overlay/+N tile into a clean photo. Close from a photo without a thumb uses{' '}
          <code className={code}>morphTo=&quot;closest&quot;</code>.
        </p>
        <BothDemo />
      </section>

      <Separator />

      <section className="space-y-3">
        <h4 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          <code className={code}>crossfade=&quot;both&quot;</code> — any element
        </h4>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Morph sources don&apos;t have to be images — dissolve initials chips into portraits so letters
          don&apos;t stretch.
        </p>
        <AnyElementDemo />
      </section>

      <Separator />

      <section className="space-y-3">
        <h4 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          <code className={code}>crossfade=&quot;close&quot;</code> — poster → video
        </h4>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Open hard-cuts into the matching poster frame; close dissolves the live video back to the poster.
        </p>
        <CloseDemo />
      </section>
    </div>
  );
}
