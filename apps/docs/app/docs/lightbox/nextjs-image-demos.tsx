'use client';

import Image, { type StaticImageData } from 'next/image';
import * as React from 'react';
import { Lightbox } from 'ramka';

import {
  LightboxGallery,
  morphHideClass,
  triggerFocusClass,
  triggerMorphHideClass,
} from '../../_components/lightbox-chrome';
/** Unsplash — 1200×800. */
import photoA from './_assets/nextjs-image-do.jpg';
import photoB from './_assets/nextjs-image-dont.jpg';
import photoC from './_assets/nextjs-image-c.jpg';
import photoD from './_assets/nextjs-image-d.jpg';

const LOAD_DELAY_MS = 500;

/** Static GitHub Pages export has no route handlers — skip the delay proxy there. */
const USE_SLOW_PROXY = process.env.NEXT_PUBLIC_GITHUB_PAGES !== 'true';

const ZOOM_PAD =
  'px-0 pt-[calc(env(safe-area-inset-top,0px)+3.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+3.5rem)] md:px-8 md:pt-[calc(env(safe-area-inset-top,0px)+3.5rem)] md:pb-[calc(env(safe-area-inset-bottom,0px)+7.5rem)]';

type DemoKind = 'do' | 'dont';

function demoPhoto(kind: DemoKind): StaticImageData {
  return kind === 'do' ? photoA : photoB;
}

function slowSrc(photo: StaticImageData, nonce: string) {
  if (!USE_SLOW_PROXY) return photo.src;
  return `/api/slow-image?ms=${LOAD_DELAY_MS}&url=${encodeURIComponent(photo.src)}&n=${encodeURIComponent(nonce)}`;
}

/** Destination Image. `destinationBlur` only when that index has no trigger image. */
function DestinationImage({
  photo,
  alt,
  destinationBlur,
  priority = false,
}: {
  photo: StaticImageData;
  alt: string;
  destinationBlur: boolean;
  /** Eager for the open slide; lazy keeps preload neighbors from fetching early. */
  priority?: boolean;
}) {
  const nonce = React.useId();

  return (
    <Image
      src={slowSrc(photo, nonce)}
      alt={alt}
      width={photo.width}
      height={photo.height}
      sizes="100vw"
      priority={priority}
      loading={priority ? undefined : 'lazy'}
      unoptimized
      draggable={false}
      className="select-none"
      {...(destinationBlur
        ? { placeholder: 'blur' as const, blurDataURL: photo.blurDataURL }
        : null)}
    />
  );
}

function NextImageDemo({ kind }: { kind: DemoKind }) {
  const photo = demoPhoto(kind);
  const alt = kind === 'do' ? 'Do — blur on trigger only' : 'Don’t — blur on lightbox Image';

  return (
    <Lightbox.Root awaitImageDecode={false}>
      <Lightbox.Trigger
        index={0}
        className={`block aspect-square w-40 cursor-pointer overflow-hidden rounded-xl bg-transparent p-0 ${triggerMorphHideClass} ${triggerFocusClass}`}
      >
        {({ imageRef }) => (
          <Image
            ref={imageRef}
            src={photo}
            alt={alt}
            unoptimized
            className="size-full object-cover"
            {...(kind === 'do' ? { placeholder: 'blur' as const } : null)}
          />
        )}
      </Lightbox.Trigger>

      <LightboxGallery
        items={[{ id: kind, src: photo.src, thumb: photo.src, alt }]}
        ariaLabel={alt}
        thumbnails="never"
        zoomControls={false}
        renderItem={(item) => (
          <Lightbox.Zoom className={ZOOM_PAD}>
            <Lightbox.Media
              width={photo.width}
              height={photo.height}
              className="overflow-hidden rounded-none md:rounded-lg"
            >
              <DestinationImage
                photo={photo}
                alt={item.alt}
                destinationBlur={kind === 'dont'}
                priority
              />
            </Lightbox.Media>
          </Lightbox.Zoom>
        )}
      />
    </Lightbox.Root>
  );
}

const plusNAlbum: { photo: StaticImageData; alt: string; id: string }[] = [
  { id: 'a', photo: photoA, alt: 'Mountain ridge' },
  { id: 'b', photo: photoB, alt: 'Sunlit valley' },
  { id: 'c', photo: photoC, alt: 'Green hills' },
  { id: 'd', photo: photoD, alt: 'Forest path' },
];

/** +N grid: indexes 0–1 have trigger images (no destination blur); 2+ use LQIP. */
export function NextjsImagePlusNDemo() {
  const visible = 2;
  const extras = plusNAlbum.length - visible;

  return (
    <div className="space-y-3">
      <div className="inline-flex items-center rounded-md bg-sky-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-sky-900 dark:bg-sky-950 dark:text-sky-200">
        +N extras
      </div>
      <Lightbox.Root morphTo="closest" awaitImageDecode={false}>
        <div className="grid max-w-sm grid-cols-2 gap-0.5">
          {plusNAlbum.slice(0, visible).map((item, i) => {
            const isOverlay = i === visible - 1 && extras > 0;
            const corner = i === 0 ? 'rounded-l-xl' : 'rounded-r-xl';
            return (
              <Lightbox.Trigger
                key={item.id}
                index={i}
                crossfade={isOverlay ? 'both' : undefined}
                className={`block cursor-pointer overflow-hidden bg-transparent p-0 ${triggerMorphHideClass} ${triggerFocusClass} ${corner}`}
              >
                {({ imageRef }) => (
                  <div className="relative">
                    <Image
                      ref={imageRef}
                      src={item.photo}
                      alt={item.alt}
                      unoptimized
                      placeholder="blur"
                      className="aspect-square size-full object-cover"
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

        <LightboxGallery
          items={plusNAlbum.map((item) => ({
            id: item.id,
            src: item.photo.src,
            thumb: item.photo.src,
            alt: item.alt,
          }))}
          ariaLabel="Plus-N Next.js Image demo"
          zoomControls={false}
          renderItem={(item, index) => {
            const photo = plusNAlbum[index]!.photo;
            // Only overflow indexes lack a trigger imageRef.
            const destinationBlur = index >= visible;
            return (
              <Lightbox.Zoom className={ZOOM_PAD}>
                <Lightbox.Media
                  width={photo.width}
                  height={photo.height}
                  className="overflow-hidden rounded-none md:rounded-lg"
                >
              <DestinationImage
                photo={photo}
                alt={item.alt}
                destinationBlur={destinationBlur}
                // Eager only for overflow slides (the ones that show LQIP).
                priority={destinationBlur}
              />
                </Lightbox.Media>
              </Lightbox.Zoom>
            );
          }}
        />
      </Lightbox.Root>
    </div>
  );
}

const team = [
  { name: 'Ava Chen', initials: 'AC', color: '#2a7ab5', photo: photoA },
  { name: 'Jules Okonkwo', initials: 'JO', color: '#c93c20', photo: photoB },
] as const;

/** Non-image triggers: no Ramka thumb bridge — destination blur is the placeholder. */
export function NextjsImageNonImageTriggerDemo() {
  return (
    <div className="space-y-3">
      <div className="inline-flex items-center rounded-md bg-violet-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-violet-900 dark:bg-violet-950 dark:text-violet-200">
        Non-image trigger
      </div>
      <Lightbox.Root>
        <ul className="flex flex-wrap gap-6">
          {team.map((person, i) => (
            <li key={person.name} className="flex w-20 flex-col items-center gap-2">
              <Lightbox.Trigger
                index={i}
                crossfade="both"
                className={`size-16 cursor-pointer overflow-hidden rounded-full bg-transparent p-0 ${triggerFocusClass}`}
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

        <LightboxGallery
          items={team.map((person, i) => ({
            id: String(i),
            src: person.photo.src,
            thumb: person.photo.src,
            alt: `Portrait of ${person.name}`,
            caption: person.name,
          }))}
          ariaLabel="Non-image trigger Next.js Image demo"
          zoomControls={false}
          renderItem={(item, index) => {
            const photo = team[index]!.photo;
            return (
              <Lightbox.Zoom className={ZOOM_PAD}>
                <Lightbox.Media
                  width={photo.width}
                  height={photo.height}
                  className="overflow-hidden rounded-none md:rounded-lg"
                >
                  <DestinationImage
                    photo={photo}
                    alt={item.alt}
                    destinationBlur
                  />
                </Lightbox.Media>
              </Lightbox.Zoom>
            );
          }}
        />
      </Lightbox.Root>
    </div>
  );
}

export function NextjsImageDoDemo() {
  return (
    <div className="space-y-3">
      <div className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
        Do
      </div>
      <NextImageDemo kind="do" />
    </div>
  );
}

export function NextjsImageDontDemo() {
  return (
    <div className="space-y-3">
      <div className="inline-flex items-center rounded-md bg-red-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-red-900 dark:bg-red-950 dark:text-red-200">
        Don’t
      </div>
      <NextImageDemo kind="dont" />
    </div>
  );
}
