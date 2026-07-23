'use client';

import { Lightbox } from 'ramka';

import { ExampleShell } from '../../../_components/example-shell';
import {
  LightboxGallery,
  morphHideClass,
  triggerFocusClass,
} from '../../../_components/lightbox-chrome';

const colorPalette = [
  { id: 'cerulean', name: 'Cerulean', hex: '#2a7ab5', family: 'Blue', src: 'https://picsum.photos/seed/color-cerulean/1400/900', thumb: 'https://picsum.photos/seed/color-cerulean/400/257', alt: 'Clear blue sky over a calm ocean' },
  { id: 'ochre', name: 'Ochre', hex: '#c58b2c', family: 'Yellow', src: 'https://picsum.photos/seed/color-ochre/1400/900', thumb: 'https://picsum.photos/seed/color-ochre/400/257', alt: 'Golden wheat field at sunset' },
  { id: 'vermillion', name: 'Vermillion', hex: '#c93c20', family: 'Red', src: 'https://picsum.photos/seed/color-vermillion/1400/900', thumb: 'https://picsum.photos/seed/color-vermillion/400/257', alt: 'Red autumn leaves on dark branches' },
  { id: 'sage', name: 'Sage', hex: '#7a9a6d', family: 'Green', src: 'https://picsum.photos/seed/color-sage/1400/900', thumb: 'https://picsum.photos/seed/color-sage/400/257', alt: 'Morning mist in a dense forest' },
  { id: 'slate', name: 'Slate', hex: '#5e6b7a', family: 'Gray', src: 'https://picsum.photos/seed/color-slate/1400/900', thumb: 'https://picsum.photos/seed/color-slate/400/257', alt: 'Wet stone wall in the rain' },
  { id: 'plum', name: 'Plum', hex: '#7b3f72', family: 'Purple', src: 'https://picsum.photos/seed/color-plum/1400/900', thumb: 'https://picsum.photos/seed/color-plum/400/257', alt: 'Lavender field stretching to the horizon' },
  { id: 'coral', name: 'Coral', hex: '#e07555', family: 'Orange', src: 'https://picsum.photos/seed/color-coral/1400/900', thumb: 'https://picsum.photos/seed/color-coral/400/257', alt: 'Desert canyon glowing at golden hour' },
  { id: 'midnight', name: 'Midnight', hex: '#1e2a3a', family: 'Navy', src: 'https://picsum.photos/seed/color-midnight/1400/900', thumb: 'https://picsum.photos/seed/color-midnight/400/257', alt: 'Starry night sky over silhouetted mountains' },
  { id: 'blush', name: 'Blush', hex: '#d4918b', family: 'Pink', src: 'https://picsum.photos/seed/color-blush/1400/900', thumb: 'https://picsum.photos/seed/color-blush/400/257', alt: 'Cherry blossoms against a soft pink sky' },
  { id: 'sienna', name: 'Sienna', hex: '#8b5e3c', family: 'Brown', src: 'https://picsum.photos/seed/color-sienna/1400/900', thumb: 'https://picsum.photos/seed/color-sienna/400/257', alt: 'Rustic wooden dock on a still lake' },
  { id: 'teal', name: 'Teal', hex: '#2a8a8a', family: 'Teal', src: 'https://picsum.photos/seed/color-teal/1400/900', thumb: 'https://picsum.photos/seed/color-teal/400/257', alt: 'Tropical lagoon with turquoise water' },
  { id: 'ivory', name: 'Ivory', hex: '#d6cdb7', family: 'Cream', src: 'https://picsum.photos/seed/color-ivory/1400/900', thumb: 'https://picsum.photos/seed/color-ivory/400/257', alt: 'Soft morning light on white sand dunes' },
];

const galleryItems = colorPalette.map((color) => ({
  id: color.id,
  src: color.src,
  thumb: color.thumb,
  alt: color.alt,
  caption: `${color.name} — ${color.alt}`,
}));

export default function ColorPalettePage() {
  return (
    <ExampleShell
      title="Color palette"
      description={
        <>
          Triggers don&apos;t have to be images. Each swatch below is a plain coloured rectangle designated as the
          morph element via the trigger&apos;s{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">morphRef</code>;
          the View Transition cleanly morphs the solid block into a full photograph dominated by that hue.
        </>
      }
    >
      <Lightbox.Root loop>
        <div className="mx-auto max-w-3xl">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Chromatic</h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              A curated palette of colors found in nature. Click any swatch to reveal its photograph.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {colorPalette.map((color, i) => (
              <Lightbox.Trigger
                key={color.id}
                index={i}
                crossfade="both"
                className={`flex w-full flex-col gap-0 overflow-hidden rounded-xl bg-transparent text-left ${triggerFocusClass}`}
              >
                {({ morphRef }) => (
                  <>
                    {/* Only the swatch morphs / hides — name + hex stay put. */}
                    <div
                      ref={morphRef}
                      className={`aspect-[3/2] w-full rounded-xl ${morphHideClass}`}
                      style={{ background: color.hex }}
                    />
                    <div className="px-1 py-2">
                      <div className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{color.name}</div>
                      <div className="mt-0.5 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                        <span>{color.family}</span>
                        <span className="font-mono">{color.hex}</span>
                      </div>
                    </div>
                  </>
                )}
              </Lightbox.Trigger>
            ))}
          </div>
        </div>

        <LightboxGallery items={galleryItems} ariaLabel="Color photographs" />
      </Lightbox.Root>
    </ExampleShell>
  );
}
