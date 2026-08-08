'use client';

import * as React from 'react';
import { Lightbox } from 'ramka';
import { Play } from 'lucide-react';

import { Separator } from '@/components/ui/separator';
import {
  imgDims,
  LightboxGallery,
  triggerFocusClass,
} from '../../_components/lightbox-chrome';

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
  videoWidth: 480,
  videoHeight: 270,
};

/** Initials chips → portraits (non-image morph source). */
const team = [
  {
    name: 'Ava Chen',
    initials: 'AC',
    color: '#2a7ab5',
    src: 'https://picsum.photos/seed/xfade-ava/900/1200',
    thumb: 'https://picsum.photos/seed/xfade-ava/300/400',
    alt: 'Portrait of Ava Chen',
    caption: 'Ava Chen',
  },
  {
    name: 'Jules Okonkwo',
    initials: 'JO',
    color: '#c93c20',
    src: 'https://picsum.photos/seed/xfade-jules/900/1200',
    thumb: 'https://picsum.photos/seed/xfade-jules/300/400',
    alt: 'Portrait of Jules Okonkwo',
    caption: 'Jules Okonkwo',
  },
  {
    name: 'Sam Rivera',
    initials: 'SR',
    color: '#7a9a6d',
    src: 'https://picsum.photos/seed/xfade-sam/900/1200',
    thumb: 'https://picsum.photos/seed/xfade-sam/300/400',
    alt: 'Portrait of Sam Rivera',
    caption: 'Sam Rivera',
  },
  {
    name: 'Mei Laurent',
    initials: 'ML',
    color: '#7b3f72',
    src: 'https://picsum.photos/seed/xfade-mei/900/1200',
    thumb: 'https://picsum.photos/seed/xfade-mei/300/400',
    alt: 'Portrait of Mei Laurent',
    caption: 'Mei Laurent',
  },
];

const code = 'rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800';

function SameImageDemo() {
  return (
    <Lightbox.Root>
      {/* Square trigger boxes vs landscape gallery items — same 3∶2 sources. */}
      <div className="grid max-w-md grid-cols-3 gap-2">
        {photos.map((img, i) => (
          <Lightbox.Trigger
            key={img.src}
            index={i}
            className={`block aspect-square overflow-hidden rounded-lg bg-transparent p-0 ${triggerFocusClass}`}
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
      <LightboxGallery items={photos} ariaLabel="Same-image morph" />
    </Lightbox.Root>
  );
}

function BothDemo() {
  const visible = 2;
  const extras = album.length - visible;
  return (
    // Indexes beyond the last trigger close to the nearest one.
    <Lightbox.Root morphTo="closest">
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
              className={`block bg-transparent p-0 overflow-hidden ${triggerFocusClass} ${corner}`}
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
      <LightboxGallery items={album} ariaLabel="Crossfade both demo" />
    </Lightbox.Root>
  );
}

function AnyElementDemo() {
  return (
    <Lightbox.Root>
      <ul className="flex flex-wrap gap-6">
        {team.map((person, i) => (
          <li key={person.name} className="flex w-20 flex-col items-center gap-2">
            <Lightbox.Trigger
              index={i}
              crossfade="both"
              className={`rounded-full size-16 overflow-hidden bg-transparent p-0 ${triggerFocusClass}`}
            >
              <div
                className={`flex size-full items-center justify-center text-sm font-semibold tracking-wide text-white`}
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
      <LightboxGallery items={team} ariaLabel="Team portraits" />
    </Lightbox.Root>
  );
}

function CloseDemo() {
  const [readyToPlay, setReadyToPlay] = React.useState(false);

  return (
    <Lightbox.Root
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
          // morphRef on the rounded node (radius for VT; library hides it during morphs).
          <div
            ref={morphRef}
            className={`relative overflow-hidden rounded-xl`}
          >
            <img
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

      <LightboxGallery
        items={[
          {
            src: trailer.poster,
            thumb: trailer.poster,
            alt: trailer.title,
            caption: trailer.title,
            width: trailer.videoWidth,
            height: trailer.videoHeight,
          },
        ]}
        ariaLabel={trailer.title}
        thumbnails="never"
        zoomControls={false}
        renderItem={() => (
          <CloseDemoVideo
            src={trailer.video}
            poster={trailer.poster}
            ready={readyToPlay}
            width={trailer.videoWidth}
            height={trailer.videoHeight}
          />
        )}
      />
    </Lightbox.Root>
  );
}

function CloseDemoVideo({
  src,
  poster,
  ready,
  width,
  height,
}: {
  src: string;
  poster: string;
  ready: boolean;
  width: number;
  height: number;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);

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
    <Lightbox.Zoom>
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

/** Live crossfade cases for the View transitions guide. */
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
