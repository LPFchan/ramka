'use client';

import * as React from 'react';
import { Lightbox } from 'ramka';

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
  triggerFocusClass,
  triggerMorphHideClass,
} from '../../../_components/lightbox-chrome';

/**
 * Intrinsic pixel dimensions encoded in a picsum URL (`…/{width}/{height}`).
 * Spread onto `<img>` as `width`/`height` so the box (and aspect ratio) is
 * reserved before the pixels load — which keeps the morph target sized on slow
 * connections and prevents layout shift.
 */
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

export default function MorphToSettingPage() {
  return (
    <ExampleShell
      title="morphTo strategies"
      description={
        <>
          The <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">morphTo</code> prop
          decides which trigger the close animation flies back to. The three strategies handle the common cases of
          {' '}<em>&quot;every item has a trigger&quot;</em>, <em>&quot;only one trigger opens many items&quot;</em>, and{' '}
          <em>&quot;some items have triggers, the rest fall back to the nearest one&quot;</em>.
        </>
      }
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-10">
        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">morphTo=&quot;active&quot;</h2>
          <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            Default behavior. On close the lightbox morphs back to the trigger that matches the current active index.
            All five images have triggers, so every item has a target. Navigate to any image and close — the morph
            always lands on the matching trigger.
          </p>
          <MorphDemo morphTo="active" ariaLabel='morphTo="active" demo' />
        </section>

        <Separator />

        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">morphTo=&quot;origin&quot;</h2>
          <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            Always morph back to the trigger that originally opened the lightbox, regardless of which item is active
            when closing. Useful when there is only one trigger (e.g. a message attachment stack) — no matter how far
            you navigate, the close animation always returns to the opening trigger.
          </p>
          <MorphDemo morphTo="origin" triggerCount={1} crossfadeTriggers="all" ariaLabel='morphTo="origin" demo' />
        </section>

        <Separator />

        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">morphTo=&quot;closest&quot;</h2>
          <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            Morph to the trigger at the active index if it exists; otherwise fall back to the nearest registered
            trigger. Below, only the first 3 of 5 images have visible triggers. Navigate to image 4 or 5 and close — the
            morph falls back to trigger 3 (the closest). Great for grids with a &quot;+N more&quot; overlay.
          </p>
          <MorphDemo
            morphTo="closest"
            triggerCount={3}
            crossfadeTriggers="last"
            ariaLabel='morphTo="closest" demo'
          />
        </section>
      </div>
    </ExampleShell>
  );
}
