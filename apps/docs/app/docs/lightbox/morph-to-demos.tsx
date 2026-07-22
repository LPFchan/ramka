'use client';

import * as React from 'react';
import { Lightbox } from 'ramka';

import { Separator } from '@/components/ui/separator';
import {
  LightboxCloseButton,
  LightboxFrame,
  LightboxFullImage,
  LightboxNavBar,
  LightboxOverlay,
  StackedItemGroup,
  stackedItemClass,
  triggerFocusClass,
  triggerMorphHideClass,
} from '../../_components/lightbox-chrome';

function imgDims(url: string) {
  const m = url.match(/\/(\d+)\/(\d+)$/);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : undefined;
}

const morphImages = [
  { src: 'https://picsum.photos/seed/morph1/1200/800', thumb: 'https://picsum.photos/seed/morph1/300/200', alt: 'Alpine meadow' },
  { src: 'https://picsum.photos/seed/morph2/1200/800', thumb: 'https://picsum.photos/seed/morph2/300/200', alt: 'Rocky coastline' },
  { src: 'https://picsum.photos/seed/morph3/1200/800', thumb: 'https://picsum.photos/seed/morph3/300/200', alt: 'Autumn vineyard' },
  { src: 'https://picsum.photos/seed/morph4/1200/800', thumb: 'https://picsum.photos/seed/morph4/300/200', alt: 'Desert canyon' },
  { src: 'https://picsum.photos/seed/morph5/1200/800', thumb: 'https://picsum.photos/seed/morph5/300/200', alt: 'Northern lake' },
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

  return (
    <Lightbox.Root viewTransition morphTo={morphTo} value={activeIndex} onValueChange={setActiveIndex}>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${triggerCount}, minmax(0, 1fr))` }}
      >
        {morphImages.slice(0, triggerCount).map((img, i) => {
          const isCrossfade =
            crossfadeTriggers === 'all' || (crossfadeTriggers === 'last' && i === triggerCount - 1);
          return (
            <Lightbox.Trigger
              key={img.src}
              index={i}
              crossfade={isCrossfade ? 'both' : undefined}
              className={`block cursor-pointer rounded-lg border-none bg-transparent p-0 ${triggerMorphHideClass} ${triggerFocusClass}`}
            >
              <img
                {...imgDims(img.thumb)}
                src={img.thumb}
                alt={img.alt}
                className="block aspect-[3/2] w-full rounded-lg object-cover"
                loading="lazy"
              />
            </Lightbox.Trigger>
          );
        })}
      </div>

      <LightboxOverlay />
      <LightboxFrame ariaLabel={ariaLabel}>
        <LightboxCloseButton />
        <StackedItemGroup>
          {morphImages.map((img, i) => (
            <Lightbox.Item key={img.src} index={i} caption={img.alt} className={stackedItemClass}>
              <LightboxFullImage src={img.src} alt={img.alt} />
            </Lightbox.Item>
          ))}
        </StackedItemGroup>
        <LightboxNavBar />
      </LightboxFrame>
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
