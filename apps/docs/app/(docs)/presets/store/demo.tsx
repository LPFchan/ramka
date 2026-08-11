'use client';

import * as React from 'react';

import { Lightbox, type LightboxItem, type ProductInfo } from './lightbox';

/**
 * App-level demo — not part of the copy-paste package.
 *
 * A product card: small thumbs swap the main image (plain app state, not
 * lightbox triggers), and the main image is the single `Lightbox.Trigger` for
 * whatever is selected. `onValueChange` syncs viewer navigation back into
 * that selection, so the close morph always lands on the image the user is
 * looking at. Add-to-cart state is shared between the card and the viewer's
 * buy panel via `ctaLabel` / `onAddToCart`.
 */

const product: ProductInfo = {
  name: 'Terra 27L Backpack',
  price: '$149',
  compareAtPrice: '$189',
  badge: 'New colour',
  description:
    'Waxed canvas, full-grain leather straps, and a padded 16″ laptop sleeve. Weather-ready for the daily commute or a weekend on the trail.',
  highlights: [
    'Water-resistant waxed canvas shell',
    'Padded 16″ laptop compartment',
    'Magnetic quick-access top pocket',
    'Lifetime repair guarantee',
  ],
  stockNote: 'In stock — ships in 2 days',
};

const images: LightboxItem[] = [
  {
    src: 'https://picsum.photos/seed/store-pack-a/1200/1500',
    thumb: 'https://picsum.photos/seed/store-pack-a/480/600',
    alt: 'Terra 27L backpack, front view',
    width: 1200,
    height: 1500,
  },
  {
    src: 'https://picsum.photos/seed/store-pack-b/1200/1500',
    thumb: 'https://picsum.photos/seed/store-pack-b/480/600',
    alt: 'Terra 27L backpack, side profile',
    width: 1200,
    height: 1500,
  },
  {
    src: 'https://picsum.photos/seed/store-pack-c/1200/1200',
    thumb: 'https://picsum.photos/seed/store-pack-c/480/480',
    alt: 'Detail of the waxed canvas and zippers',
    width: 1200,
    height: 1200,
  },
  {
    src: 'https://picsum.photos/seed/store-pack-d/1600/1000',
    thumb: 'https://picsum.photos/seed/store-pack-d/800/500',
    alt: 'The backpack on a trail at golden hour',
    width: 1600,
    height: 1000,
  },
  {
    src: 'https://picsum.photos/seed/store-pack-e/1200/1500',
    thumb: 'https://picsum.photos/seed/store-pack-e/480/600',
    alt: 'Interior compartments, laptop sleeve visible',
    width: 1200,
    height: 1500,
  },
];

export function StorePresetDemo() {
  const [selected, setSelected] = React.useState(0);
  const [added, setAdded] = React.useState(false);
  const current = images[selected]!;

  return (
    <div className="w-full max-w-2xl">
      <Lightbox.Root
        loop
        onValueChange={(value) => setSelected(value)}
        // Thumbs are the same product shots at lower res (same seed + aspect),
        // so the placeholder bridge is seamless — skip the decode wait and
        // start the morph immediately.
        awaitImageDecode={false}
      >
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
          {/* Gallery column */}
          <div className="min-w-0 flex-1">
            <Lightbox.Trigger
              index={selected}
              className="block w-full overflow-hidden bg-neutral-100 p-0 dark:bg-neutral-800"
            >
              {({ imageRef }) => (
                <img
                  ref={imageRef}
                  key={current.src}
                  src={current.thumb}
                  alt={current.alt}
                  width={current.width}
                  height={current.height}
                  className="block aspect-4/5 w-full object-cover"
                  draggable={false}
                />
              )}
            </Lightbox.Trigger>

            <div className="mt-3 flex gap-2" role="listbox" aria-label="Select product image">
              {images.map((img, i) => (
                <button
                  key={img.src}
                  type="button"
                  role="option"
                  aria-selected={i === selected}
                  aria-label={img.alt}
                  onClick={() => setSelected(i)}
                  className={`block size-14 shrink-0 overflow-hidden border p-0 transition ${
                    i === selected
                      ? 'border-neutral-900 dark:border-neutral-100'
                      : 'border-neutral-200 opacity-70 hover:opacity-100 dark:border-neutral-700'
                  }`}
                >
                  <img src={img.thumb} alt="" className="block size-full object-cover" draggable={false} />
                </button>
              ))}
            </div>
          </div>

          {/* Info column */}
          <div className="w-full md:w-56 md:shrink-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-400">
              {product.badge}
            </p>
            <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              {product.name}
            </h3>
            <p className="mt-1 flex items-baseline gap-2 text-[15px]">
              <span className="text-neutral-900 dark:text-neutral-100">{product.price}</span>
              <s className="text-[13px] text-neutral-400">{product.compareAtPrice}</s>
            </p>
            <p className="mt-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{product.description}</p>
            <button
              type="button"
              onClick={() => setAdded(true)}
              className="mt-6 w-full rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
            >
              {added ? 'Added to bag ✓' : 'Add to bag'}
            </button>
          </div>
        </div>

        <Lightbox.Gallery
          items={images}
          product={product}
          ariaLabel={`${product.name} gallery`}
          ctaLabel={added ? 'Added to bag ✓' : 'Add to bag'}
          onAddToCart={() => setAdded(true)}
        />
      </Lightbox.Root>
    </div>
  );
}
