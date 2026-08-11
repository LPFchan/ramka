'use client';

import { Lightbox, type LightboxItem } from './lightbox';

/**
 * App-level demo — not part of the copy-paste package.
 *
 * An article excerpt with inline figures: each `<figure>` is a
 * `Lightbox.Trigger`, and opening one morphs into the editorial viewer with
 * that figure's caption + credit under the media.
 */

const figures: LightboxItem[] = [
  {
    src: 'https://picsum.photos/seed/edit-harbor/1600/1000',
    thumb: 'https://picsum.photos/seed/edit-harbor/800/500',
    alt: 'The old harbor at dawn, boats resting in still water',
    caption: 'The old harbor at dawn. Most of the fleet has not left the quay in a decade.',
    credit: 'Photograph: Anna Beck',
    width: 1600,
    height: 1000,
  },
  {
    src: 'https://picsum.photos/seed/edit-nets/1000/1400',
    thumb: 'https://picsum.photos/seed/edit-nets/500/700',
    alt: 'Fishing nets stacked on the pier',
    caption: 'Nets stacked on the pier — mended each winter, used less each spring.',
    credit: 'Photograph: Anna Beck',
    width: 1000,
    height: 1400,
  },
  {
    src: 'https://picsum.photos/seed/edit-market/1600/1000',
    thumb: 'https://picsum.photos/seed/edit-market/800/500',
    alt: 'The near-empty fish market hall in the early morning',
    caption: 'The market hall opens at five. By seven, the day’s catch is gone.',
    credit: 'Photograph: Jonas Ravn',
    width: 1600,
    height: 1000,
  },
];

function Figure({ index, className }: { index: number; className?: string }) {
  const item = figures[index]!;
  return (
    <figure className={className}>
      <Lightbox.Trigger index={index} className="block w-full overflow-hidden rounded-lg bg-transparent p-0 scroll-my-5">
        {({ imageRef }) => (
          <img
            ref={imageRef}
            src={item.thumb}
            alt={item.alt}
            width={item.width}
            height={item.height}
            className="block w-full object-cover"
            draggable={false}
          />
        )}
      </Lightbox.Trigger>
      <figcaption className="mt-2 text-[13px] leading-5 text-neutral-500">
        {item.caption} <span className="text-neutral-400 dark:text-neutral-600">{item.credit}</span>
      </figcaption>
    </figure>
  );
}

export function EditorialPresetDemo() {
  return (
    <article className="w-full max-w-xl text-left">
      <Lightbox.Root
        loop
        // Figures are scattered through a scrolling article, so after swiping
        // to another photograph its trigger may be off-viewport. `onClose`
        // repositions it inside the close transition's update phase — between
        // snapshot captures — so the page jump is never painted as a live
        // frame. (Scrolling earlier, e.g. `onChange`, makes iOS Safari
        // re-rasterize the open viewer and flash black tiles over the media.)
        scrollTriggerIntoView={[
          { type: 'onOpenComplete', behavior: 'instant', block: 'nearest' },
          { type: 'onClose', behavior: 'instant', block: 'nearest' },
        ]}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Dispatch</p>
        <h3 className="mt-2 font-serif text-[26px] leading-snug tracking-tight text-neutral-900 dark:text-neutral-50">
          The last fishermen of the northern coast
        </h3>
        <p className="mt-2 text-[13px] text-neutral-500">By Anna Beck · 8 min read</p>

        <p className="mt-5 text-[15px] leading-7 text-neutral-700 dark:text-neutral-300">
          The village wakes before the light does. For sixty years the boats went out whatever the weather; now, on most
          mornings, only three engines cough to life along the whole quay.
        </p>

        <Figure index={0} className="mt-6" />

        <p className="mt-6 text-[15px] leading-7 text-neutral-700 dark:text-neutral-300">
          Ask anyone here when it changed and they will not name a year. The harbor emptied the way harbors do — one
          retirement at a time, one son who moved to the city, one quota that made a small boat pointless.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <Figure index={1} />
          <Figure index={2} />
        </div>

        <Lightbox.Gallery items={figures} ariaLabel="Article photographs" />
      </Lightbox.Root>
    </article>
  );
}
