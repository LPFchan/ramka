'use client';

import { Lightbox } from 'ramka';
import { X } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ExampleShell } from '../../../_components/example-shell';
import { LightboxFrame, LightboxOverlay } from '../../../_components/lightbox-chrome';

const propertyPhotos = [
  { id: 'prop-hero', src: 'https://picsum.photos/seed/prop-hero/1400/900', thumb: 'https://picsum.photos/seed/prop-hero/700/450', alt: 'Living room with floor-to-ceiling windows', label: 'Living Room' },
  { id: 'prop-kitchen', src: 'https://picsum.photos/seed/prop-kitchen/1400/900', thumb: 'https://picsum.photos/seed/prop-kitchen/700/450', alt: 'Modern kitchen with marble island', label: 'Kitchen' },
  { id: 'prop-bedroom', src: 'https://picsum.photos/seed/prop-bed/900/1400', thumb: 'https://picsum.photos/seed/prop-bed/450/700', alt: 'Primary bedroom with en-suite balcony', label: 'Primary Bedroom' },
  { id: 'prop-bath', src: 'https://picsum.photos/seed/prop-bath/900/1400', thumb: 'https://picsum.photos/seed/prop-bath/450/700', alt: 'Spa-style bathroom with freestanding tub', label: 'Bathroom' },
  { id: 'prop-terrace', src: 'https://picsum.photos/seed/prop-terrace/1400/900', thumb: 'https://picsum.photos/seed/prop-terrace/700/450', alt: 'Rooftop terrace with city views', label: 'Terrace' },
  { id: 'prop-dining', src: 'https://picsum.photos/seed/prop-dining/1400/900', thumb: 'https://picsum.photos/seed/prop-dining/700/450', alt: 'Dining area with designer lighting', label: 'Dining' },
  { id: 'prop-office', src: 'https://picsum.photos/seed/prop-office/900/1200', thumb: 'https://picsum.photos/seed/prop-office/450/600', alt: 'Home office with built-in shelving', label: 'Office' },
  { id: 'prop-pool', src: 'https://picsum.photos/seed/prop-pool/1400/900', thumb: 'https://picsum.photos/seed/prop-pool/700/450', alt: 'Infinity pool overlooking the valley', label: 'Pool' },
  { id: 'prop-garden', src: 'https://picsum.photos/seed/prop-garden/1400/900', thumb: 'https://picsum.photos/seed/prop-garden/700/450', alt: 'Landscaped garden with mature olive trees', label: 'Garden' },
  { id: 'prop-exterior', src: 'https://picsum.photos/seed/prop-ext/900/1400', thumb: 'https://picsum.photos/seed/prop-ext/450/700', alt: 'Front elevation at dusk with warm lighting', label: 'Exterior' },
];

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

/** Intrinsic aspect ratio (w/h) from the URL, falling back to 16/9. */
function imgAspect(url: string): number {
  const d = imgDims(url);
  return d ? d.width / d.height : 16 / 9;
}

/**
 * Wrapper style for the "largest rectangle of the given aspect ratio that fits
 * inside the container" trick. The parent must set `container-type: size` so
 * `cqw`/`cqh` resolve to its box. Width is the smaller of the full container
 * width and the width that would make the height equal the container height;
 * `aspect-ratio` then derives a height that never exceeds it.
 * `--lb-inset-w`/`--lb-inset-h` leave room for the chrome.
 *
 * This keeps the box correctly sized *before the image loads* — unlike
 * `size: auto`, which collapses an unloaded `<img>` to 0×0 and would skip the
 * open morph on a slow connection.
 */
function fitBoxStyle(ratio: number): React.CSSProperties {
  return {
    width: `min(calc(100cqw - var(--lb-inset-w, 0px)), calc((100cqh - var(--lb-inset-h, 0px)) * ${ratio}))`,
    aspectRatio: `${ratio}`,
  };
}

const amenities = [
  'Central Air Conditioning',
  'Heated Floors',
  'Smart Home System',
  'Wine Cellar',
  'EV Charger',
  'Security System',
  'Elevator Access',
  'Guest Suite',
  'Outdoor Kitchen',
  'Fire Pit',
  'Sauna',
  'Fiber Internet',
];

const iconButton =
  'inline-flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-30';

// Per-cell outer corners. The 5-cell grid: index 0 is the tall left
// column, then top-middle (1), top-right (2), bottom-middle (3),
// bottom-right (4). Only the outer corners get rounded so the
// composition reads as one rounded rectangle, but each <img> carries
// its own radius so the View Transition morph snapshot inherits the
// correct curve from the morph target.
const heroCornerClass: Record<number, string> = {
  0: 'rounded-l-xl',
  1: '',
  2: 'rounded-tr-xl',
  3: '',
  4: 'rounded-br-xl',
};

function HeroGrid() {
  const hero = propertyPhotos[0]!;
  return (
    <div className="grid aspect-[2.2/1] grid-cols-[2fr_1fr_1fr] grid-rows-2 gap-1">
      <Lightbox.Trigger
        index={0}
        className={`row-span-2 block cursor-pointer border-none bg-transparent p-0 transition-opacity duration-[200ms] ease-out-expo data-[morph-target]:opacity-0 ${heroCornerClass[0]}`}
      >
        <img
          {...imgDims(hero.thumb)}
          src={hero.thumb}
          alt={hero.alt}
          className={`block h-full w-full object-cover ${heroCornerClass[0]}`}
        />
      </Lightbox.Trigger>
      {propertyPhotos.slice(1, 5).map((photo, i) => (
        <Lightbox.Trigger
          key={photo.id}
          index={i + 1}
          className={`block cursor-pointer border-none bg-transparent p-0 transition-opacity duration-[200ms] ease-out-expo data-[morph-target]:opacity-0 ${heroCornerClass[i + 1] ?? ''}`}
        >
          <img
            {...imgDims(photo.thumb)}
            src={photo.thumb}
            alt={photo.alt}
            className={`block h-full w-full object-cover ${heroCornerClass[i + 1] ?? ''}`}
          />
        </Lightbox.Trigger>
      ))}
    </div>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-xl font-bold leading-none">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function RemainingPhotosGrid() {
  return (
    <div>
      <h3 className="mb-4 text-xl font-semibold tracking-tight">All Photos</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {propertyPhotos.slice(5).map((photo, i) => (
          <Lightbox.Trigger
            key={photo.id}
            index={i + 5}
            crossfade
            className="block rounded-lg bg-transparent p-0 transition-opacity duration-[200ms] ease-out-expo data-[morph-target]:opacity-0"
          >
            <div data-lightbox-morph className="relative overflow-hidden rounded-lg">
              <img
                {...imgDims(photo.thumb)}
                src={photo.thumb}
                alt={photo.alt}
                className="block aspect-[3/2] w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-4">
                <span className="text-xs font-medium text-white">{photo.label}</span>
              </div>
            </div>
          </Lightbox.Trigger>
        ))}
      </div>
    </div>
  );
}

export default function RealEstateListingPage() {
  return (
    <ExampleShell
      title="Real estate listing"
      description={
        <>
          A property page in the style of Airbnb or Zillow: a hero grid for the first five photos, then an &quot;all photos&quot;
          gallery below. The lightbox opens a horizontally-snapping{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">Lightbox.Slides</code> viewport over
          all 10 photos, with{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">scrollTriggerIntoView</code>{' '}
          set to instant on close so the morph target is always on screen.
        </>
      }
    >
      <Lightbox.Root
        viewTransition
        loop
        scrollTriggerIntoView={{ type: 'onClose', behavior: 'instant' }}
      >
        <div className="mx-auto max-w-5xl py-4 pb-12">
          <HeroGrid />

          <div className="mt-6 flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-[320px] flex-1">
              <div className="mb-1 flex items-baseline gap-2">
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">Active</Badge>
                <span className="text-xs text-muted-foreground">Listed 3 days ago</span>
              </div>

              <h1 className="mb-1 text-3xl font-semibold tracking-tight">The Olive Grove Residence</h1>
              <p className="mb-4 text-sm text-muted-foreground">
                742 Hillcrest Drive, Montecito, CA 93108
              </p>

              <div className="flex gap-6 border-y border-border py-4">
                <StatItem value="5" label="Bedrooms" />
                <StatItem value="4.5" label="Bathrooms" />
                <StatItem value="4,850" label="Sq Ft" />
                <StatItem value="0.8" label="Acres" />
              </div>
            </div>

            <div className="flex w-[280px] shrink-0 flex-col gap-3 rounded-xl border border-border p-4">
              <div className="text-3xl font-bold leading-none">$4,250,000</div>
              <div className="text-xs text-muted-foreground">Est. $18,420/mo with 20% down</div>
              <Separator />
              <div className="flex items-center gap-3">
                <Avatar size="lg">
                  <AvatarImage src="https://i.pravatar.cc/150?u=agent-claire" alt="Claire Rousseau" />
                  <AvatarFallback>CR</AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-sm font-semibold">Claire Rousseau</div>
                  <div className="text-xs text-muted-foreground">Montecito Luxury Realty</div>
                </div>
              </div>
              <Button size="default">Contact Agent</Button>
              <Button variant="outline" size="default">
                Schedule Tour
              </Button>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="mb-3 text-xl font-semibold tracking-tight">About This Property</h3>
            <p className="mb-3 text-sm leading-relaxed">
              Perched on a sun-drenched hillside with unobstructed ocean and mountain views, The Olive Grove Residence
              is a masterful blend of contemporary architecture and Mediterranean warmth. Designed by acclaimed
              architect Rafael Mendes, the home flows seamlessly between indoor and outdoor living through walls of
              retractable glass that frame the Santa Ynez Mountains to the north and the Pacific to the south.
            </p>
            <p className="mb-3 text-sm leading-relaxed">
              The open-plan living and dining area features 12-foot ceilings, white oak floors, and a sculptural
              fireplace that anchors the space. The chef&apos;s kitchen is outfitted with Gaggenau appliances, a waterfall
              marble island, and a butler&apos;s pantry with wine refrigeration. Five bedroom suites are spread across two
              levels, with the primary occupying the entire upper wing.
            </p>
          </div>

          <div className="mt-8">
            <h3 className="mb-3 text-xl font-semibold tracking-tight">Features &amp; Amenities</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {amenities.map((a) => (
                <div key={a} className="flex items-center gap-2 text-sm">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {a}
                </div>
              ))}
            </div>
          </div>

          <Separator className="my-8" />

          <RemainingPhotosGrid />

          <div className="mt-8 text-center text-xs text-muted-foreground">
            {propertyPhotos.length} photos · Listing courtesy of Montecito Luxury Realty
          </div>
        </div>

        <LightboxOverlay />
        <LightboxFrame ariaLabel="Property photos" className="flex flex-col items-stretch">
          <div className="absolute right-4 top-4 z-10">
            <Lightbox.Close className={iconButton} aria-label="Close">
              <X aria-hidden className="h-5 w-5" />
            </Lightbox.Close>
          </div>
          <div className="absolute left-4 top-4 z-10">
            <Lightbox.Counter className="font-mono text-sm tabular-nums text-white/70" />
          </div>

          <Lightbox.Slides
            aria-label="Property photos"
            preload={2}
            className="flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {propertyPhotos.map((photo, i) => (
              <Lightbox.Slide key={photo.id} className="relative h-full">
                <Lightbox.Item
                  index={i}
                  caption={`${photo.label} — The Olive Grove Residence`}
                  className="flex h-full w-full items-center justify-center [container-type:size] [--lb-inset-h:4rem] [--lb-inset-w:2rem]"
                >
                  {/* Reserve the largest correctly-shaped box up front (see
                      fitBoxStyle) so the morph target has a real size even
                      before the image loads. */}
                  <div className="relative shrink-0" style={fitBoxStyle(imgAspect(photo.src))}>
                    <img
                      {...imgDims(photo.src)}
                      src={photo.src}
                      alt={photo.alt}
                      className="h-full w-full rounded-lg object-contain"
                    />
                  </div>
                </Lightbox.Item>
              </Lightbox.Slide>
            ))}
          </Lightbox.Slides>

          <Lightbox.Caption className="block min-h-[1.5rem] px-6 pb-3 text-center text-sm text-white/80" />

          <Lightbox.ThumbnailGroup
            aria-label="Property photo thumbnails"
            className="flex max-w-full justify-center gap-2 overflow-x-auto px-3 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {propertyPhotos.map((photo, i) => (
              <Lightbox.Thumbnail
                key={photo.id}
                index={i}
                className="h-[38px] w-14 shrink-0 overflow-hidden rounded-sm border-2 border-transparent p-0 opacity-40 transition data-[active]:border-white data-[active]:opacity-100"
              >
                <img {...imgDims(photo.thumb)} src={photo.thumb} alt={photo.alt} className="h-full w-full object-cover" />
              </Lightbox.Thumbnail>
            ))}
          </Lightbox.ThumbnailGroup>
        </LightboxFrame>
      </Lightbox.Root>
    </ExampleShell>
  );
}
