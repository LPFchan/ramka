'use client';

import * as React from 'react';
import Image from 'next/image';
import * as Lightbox from '@ramka/react/lightbox';

import { Separator } from '@/components/ui/separator';
import {
  LightboxGallery,
  triggerFocusClass,
} from '../../../_components/lightbox-chrome';
import { morph1, morph2, morph3, morph4, morph5 } from './images.generated';

const morphImages = [
  { src: morph1, thumb: morph1, alt: 'Alpine meadow', caption: 'Alpine meadow' },
  { src: morph2, thumb: morph2, alt: 'Rocky coastline', caption: 'Rocky coastline' },
  { src: morph3, thumb: morph3, alt: 'Autumn vineyard', caption: 'Autumn vineyard' },
  { src: morph4, thumb: morph4, alt: 'Desert canyon', caption: 'Desert canyon' },
  { src: morph5, thumb: morph5, alt: 'Northern lake', caption: 'Northern lake' },
];

function MorphDemo({
  morphTo,
  triggerCount = morphImages.length,
  crossfadeTriggers,
  ariaLabel,
}: {
  morphTo: 'active' | 'origin' | 'closest';
  triggerCount?: number;
  crossfadeTriggers?: 'all' | 'last';
  ariaLabel: string;
}) {
  const [activeIndex, setActiveIndex] = React.useState(0);

  // Destination blur only for indexes with no trigger imageRef (Next.js Image guide).
  const items = morphImages.map((img, i) => ({
    ...img,
    destinationBlur: i >= triggerCount,
  }));

  return (
    <Lightbox.Root
      morphTo={morphTo}
      value={activeIndex}
      onValueChange={setActiveIndex}
      awaitImageDecode={false}
    >
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${triggerCount}, minmax(0, 1fr))` }}
      >
        {morphImages.slice(0, triggerCount).map((img, i) => {
          const isCrossfade =
            crossfadeTriggers === 'all' || (crossfadeTriggers === 'last' && i === triggerCount - 1);
          return (
            <Lightbox.Trigger
              key={img.alt}
              index={i}
              crossfade={isCrossfade ? 'both' : undefined}
              className={`block cursor-pointer rounded-lg border-none bg-transparent p-0 ${triggerFocusClass}`}
            >
              {({ imageRef }) => (
                <Image
                  ref={imageRef}
                  src={img.thumb}
                  alt={img.alt}
                  placeholder="blur"
                  sizes={`${Math.round(100 / triggerCount)}vw`}
                  className="block aspect-[3/2] w-full rounded-lg object-cover"
                  loading="lazy"
                />
              )}
            </Lightbox.Trigger>
          );
        })}
      </div>

      <LightboxGallery items={items} ariaLabel={ariaLabel} />
    </Lightbox.Root>
  );
}

/** Live morphTo strategy demos for the View transitions guide. */
export function LightboxMorphToDemos() {
  return (
    <div className="flex flex-col gap-10">
      <section className="space-y-3">
        <h4 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          morphTo=&quot;active&quot;
        </h4>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Default. Close morphs to the trigger matching the active index. All five images have triggers.
        </p>
        <MorphDemo morphTo="active" ariaLabel='morphTo="active" demo' />
      </section>

      <Separator />

      <section className="space-y-3">
        <h4 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          morphTo=&quot;origin&quot;
        </h4>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Always morph back to the trigger that opened the lightbox (one tile, many items).
        </p>
        <MorphDemo morphTo="origin" triggerCount={1} crossfadeTriggers="all" ariaLabel='morphTo="origin" demo' />
      </section>

      <Separator />

      <section className="space-y-3">
        <h4 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          morphTo=&quot;closest&quot;
        </h4>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Active trigger if registered, otherwise the nearest one — useful for +N grids (only first 3 have
          triggers below).
        </p>
        <MorphDemo
          morphTo="closest"
          triggerCount={3}
          crossfadeTriggers="last"
          ariaLabel='morphTo="closest" demo'
        />
      </section>
    </div>
  );
}
