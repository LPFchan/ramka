'use client';

import Image, { type StaticImageData } from 'next/image';
import * as React from 'react';
import * as Lightbox from 'ramka/lightbox';

import { LightboxGallery, triggerFocusClass } from '../../../_components/lightbox-chrome';
import { xfadeA, xfadeASquare } from './images.generated';

const LOAD_DELAY_MS = 500;
const USE_SLOW_PROXY = process.env.NEXT_PUBLIC_GITHUB_PAGES !== 'true';

function slowSrc(photo: StaticImageData, nonce: string) {
  if (!USE_SLOW_PROXY) return photo.src;
  return `/api/slow-image?ms=${LOAD_DELAY_MS}&url=${encodeURIComponent(photo.src)}&n=${encodeURIComponent(nonce)}`;
}

function DestinationImage({ photo, alt }: { photo: StaticImageData; alt: string }) {
  const nonce = React.useId();

  return (
    <Image
      src={slowSrc(photo, nonce)}
      alt={alt}
      width={photo.width}
      height={photo.height}
      sizes="100vw"
      priority
      unoptimized
      draggable={false}
      className="select-none"
    />
  );
}

function AspectDemo({
  kind,
  triggerSrc,
}: {
  kind: 'do' | 'dont';
  triggerSrc: StaticImageData;
}) {
  const alt = kind === 'do' ? 'Do — same source aspect' : 'Don’t — baked square crop';

  return (
    <Lightbox.Root awaitImageDecode={false}>
      <Lightbox.Trigger
        index={0}
        className={`block aspect-square w-40 cursor-pointer overflow-hidden rounded-xl bg-transparent p-0 ${triggerFocusClass}`}
      >
        {({ imageRef }) => (
          <Image
            ref={imageRef}
            src={triggerSrc}
            alt={alt}
            unoptimized
            placeholder="blur"
            className="size-full object-cover"
          />
        )}
      </Lightbox.Trigger>

      <LightboxGallery
        items={[{ id: kind, src: xfadeA.src, thumb: triggerSrc.src, alt }]}
        ariaLabel={alt}
        thumbnails="never"
        zoomControls={false}
        renderItem={(item) => (
          <Lightbox.Zoom>
            <Lightbox.Media
              width={xfadeA.width}
              height={xfadeA.height}
              className="overflow-hidden rounded-none md:rounded-lg"
            >
              <DestinationImage photo={xfadeA} alt={item.alt} />
            </Lightbox.Media>
          </Lightbox.Zoom>
        )}
      />
    </Lightbox.Root>
  );
}

export function MorphAspectDoDemo() {
  return (
    <div className="space-y-3">
      <div className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
        Do
      </div>
      <AspectDemo kind="do" triggerSrc={xfadeA} />
    </div>
  );
}

export function MorphAspectDontDemo() {
  return (
    <div className="space-y-3">
      <div className="inline-flex items-center rounded-md bg-red-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-red-900 dark:bg-red-950 dark:text-red-200">
        Don’t
      </div>
      <AspectDemo kind="dont" triggerSrc={xfadeASquare} />
    </div>
  );
}
