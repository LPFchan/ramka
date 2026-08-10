'use client';

import { Lightbox } from 'ramka';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ExampleShell } from '../../../_components/example-shell';
import {
  imgDims,
  LightboxGallery,
  triggerFocusClass,
} from '../../../_components/lightbox-chrome';

const propertyPhotos = [
  { id: 'prop-hero', src: 'https://picsum.photos/seed/prop-hero/1400/900', thumb: 'https://picsum.photos/seed/prop-hero/700/450', alt: 'Living room with floor-to-ceiling windows', label: 'Living Room', caption: 'Living Room — The Olive Grove Residence' },
  { id: 'prop-kitchen', src: 'https://picsum.photos/seed/prop-kitchen/1400/900', thumb: 'https://picsum.photos/seed/prop-kitchen/700/450', alt: 'Modern kitchen with marble island', label: 'Kitchen', caption: 'Kitchen — The Olive Grove Residence' },
  { id: 'prop-bedroom', src: 'https://picsum.photos/seed/prop-bed/900/1400', thumb: 'https://picsum.photos/seed/prop-bed/450/700', alt: 'Primary bedroom with en-suite balcony', label: 'Primary Bedroom', caption: 'Primary Bedroom — The Olive Grove Residence' },
  { id: 'prop-bath', src: 'https://picsum.photos/seed/prop-bath/900/1400', thumb: 'https://picsum.photos/seed/prop-bath/450/700', alt: 'Spa-style bathroom with freestanding tub', label: 'Bathroom', caption: 'Bathroom — The Olive Grove Residence' },
  { id: 'prop-terrace', src: 'https://picsum.photos/seed/prop-terrace/1400/900', thumb: 'https://picsum.photos/seed/prop-terrace/700/450', alt: 'Rooftop terrace with city views', label: 'Terrace', caption: 'Terrace — The Olive Grove Residence' },
  { id: 'prop-dining', src: 'https://picsum.photos/seed/prop-dining/1400/900', thumb: 'https://picsum.photos/seed/prop-dining/700/450', alt: 'Dining area with designer lighting', label: 'Dining', caption: 'Dining — The Olive Grove Residence' },
  { id: 'prop-office', src: 'https://picsum.photos/seed/prop-office/900/1200', thumb: 'https://picsum.photos/seed/prop-office/450/600', alt: 'Home office with built-in shelving', label: 'Office', caption: 'Office — The Olive Grove Residence' },
  { id: 'prop-pool', src: 'https://picsum.photos/seed/prop-pool/1400/900', thumb: 'https://picsum.photos/seed/prop-pool/700/450', alt: 'Infinity pool overlooking the valley', label: 'Pool', caption: 'Pool — The Olive Grove Residence' },
  { id: 'prop-garden', src: 'https://picsum.photos/seed/prop-garden/1400/900', thumb: 'https://picsum.photos/seed/prop-garden/700/450', alt: 'Landscaped garden with mature olive trees', label: 'Garden', caption: 'Garden — The Olive Grove Residence' },
  { id: 'prop-exterior', src: 'https://picsum.photos/seed/prop-ext/900/1400', thumb: 'https://picsum.photos/seed/prop-ext/450/700', alt: 'Front elevation at dusk with warm lighting', label: 'Exterior', caption: 'Exterior — The Olive Grove Residence' },
];

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
        className={`row-span-2 block cursor-pointer border-none bg-transparent p-0 ${triggerFocusClass} ${heroCornerClass[0]}`}
      >
        {({ imageRef }) => (
          <img
            ref={imageRef}
            {...imgDims(hero.thumb)}
            src={hero.thumb}
            alt={hero.alt}
            className={`block size-full object-cover ${heroCornerClass[0]}`}
          />
        )}
      </Lightbox.Trigger>
      {propertyPhotos.slice(1, 5).map((photo, i) => (
        <Lightbox.Trigger
          key={photo.id}
          index={i + 1}
          className={`block cursor-pointer border-none bg-transparent p-0 ${triggerFocusClass} ${heroCornerClass[i + 1] ?? ''}`}
        >
          {({ imageRef }) => (
            <img
              ref={imageRef}
              {...imgDims(photo.thumb)}
              src={photo.thumb}
              alt={photo.alt}
              className={`block size-full object-cover ${heroCornerClass[i + 1] ?? ''}`}
            />
          )}
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
            crossfade="both"
            className={`block rounded-lg bg-transparent p-0 ${triggerFocusClass}`}
          >
            {({ imageRef, morphRef }) => (
              <div ref={morphRef} className="relative overflow-hidden rounded-lg">
                <img
                  ref={imageRef}
                  {...imgDims(photo.thumb)}
                  src={photo.thumb}
                  alt={photo.alt}
                  className="block aspect-[3/2] w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-4">
                  <span className="text-xs font-medium text-white">{photo.label}</span>
                </div>
              </div>
            )}
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

        <LightboxGallery
          items={propertyPhotos}
          ariaLabel="Property photos"
          backdrop="solid"
        />
      </Lightbox.Root>
    </ExampleShell>
  );
}
