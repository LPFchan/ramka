'use client';

import * as React from 'react';
import { Lightbox } from 'ramka';

import { Separator } from '@/components/ui/separator';
import { ExampleShell } from '../../../_components/example-shell';
import {
  LightboxCaptionLine,
  LightboxCloseButton,
  LightboxFrame,
  LightboxFullImage,
  LightboxNavBar,
  LightboxOverlay,
  StackedItemGroup,
  stackedItemClass,
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

const articleImages = [
  {
    id: 'hero',
    src: 'https://picsum.photos/seed/art-hero/1400/700',
    inline: 'https://picsum.photos/seed/art-hero/800/400',
    alt: 'Aerial view of the Lofoten coastline',
    caption: 'The rugged coastline of Lofoten stretches into the Norwegian Sea',
  },
  {
    id: 'village',
    src: 'https://picsum.photos/seed/art-village/1400/900',
    inline: 'https://picsum.photos/seed/art-village/800/500',
    alt: 'Red fishing huts along the waterfront',
    caption: 'Traditional rorbuer (fishing cabins) in Hamnøy, dating back centuries',
  },
  {
    id: 'mountain',
    src: 'https://picsum.photos/seed/art-mountain/1400/900',
    inline: 'https://picsum.photos/seed/art-mountain/800/500',
    alt: 'Snow-capped peak reflected in still water',
    caption: 'Olstinden peak mirrored in Reinefjorden at dawn',
  },
  {
    id: 'beach',
    src: 'https://picsum.photos/seed/art-beach/1400/700',
    inline: 'https://picsum.photos/seed/art-beach/800/400',
    alt: 'Turquoise water on a white sand beach',
    caption: 'Haukland Beach — often called the most beautiful beach above the Arctic Circle',
  },
  {
    id: 'aurora',
    src: 'https://picsum.photos/seed/art-aurora/1400/900',
    inline: 'https://picsum.photos/seed/art-aurora/800/500',
    alt: 'Green northern lights dancing over the sea',
    caption: 'Aurora borealis over Uttakleiv Beach, visible from September to March',
  },
  {
    id: 'boats',
    src: 'https://picsum.photos/seed/art-boats/1400/700',
    inline: 'https://picsum.photos/seed/art-boats/800/400',
    alt: 'Fishing boats moored in a calm harbour',
    caption: "The harbour at Reine — the heart of Lofoten's fishing heritage",
  },
];

function ArticleFigure({
  index,
  image,
  float,
}: {
  index: number;
  image: (typeof articleImages)[number];
  float?: 'left' | 'right';
}) {
  const floatClass =
    float === 'left'
      ? 'float-left mr-6 w-[55%] my-2'
      : float === 'right'
        ? 'float-right ml-6 w-[55%] my-2'
        : 'my-6';
  return (
    <figure className={floatClass}>
      <Lightbox.Trigger
        index={index}
        className={`block w-full cursor-pointer rounded-xl border-none bg-transparent p-0 ${triggerMorphHideClass}`}
      >
        <img {...imgDims(image.inline)} src={image.inline} alt={image.alt} className="block w-full rounded-xl" loading="lazy" />
      </Lightbox.Trigger>
      <figcaption className="mt-2 text-xs italic text-neutral-500 dark:text-neutral-400">
        {image.caption}
      </figcaption>
    </figure>
  );
}

export default function WithinArticlePage() {
  const [hero, village, mountain, beach, aurora, boats] = articleImages as [
    (typeof articleImages)[number],
    (typeof articleImages)[number],
    (typeof articleImages)[number],
    (typeof articleImages)[number],
    (typeof articleImages)[number],
    (typeof articleImages)[number],
  ];
  return (
    <ExampleShell
      title="Within article"
      description={
        <>
          Triggers don&apos;t have to live in a grid. With{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">scrollTriggerIntoView</code>
          {' '}set to <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">onChange</code>,
          the article scrolls in the background so the current trigger is always visible — keeping the morph animation
          consistent even when navigating from the keyboard.
        </>
      }
    >
      <Lightbox.Root viewTransition scrollTriggerIntoView={{ type: 'onChange', behavior: 'smooth' }}>
        <article className="mx-auto max-w-2xl leading-relaxed text-neutral-700 dark:text-neutral-300">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            Lofoten: Where the Mountains Meet the Sea
          </h1>
          <p className="mt-2 mb-6 text-sm text-neutral-500 dark:text-neutral-400">
            A photographic journey through Norway&apos;s most dramatic archipelago
          </p>

          <Separator className="mb-6" />

          <p className="mb-4">
            Rising abruptly from the Norwegian Sea, the Lofoten Islands are a study in contrasts. Jagged granite peaks
            soar above sheltered fishing villages, while white-sand beaches sit beneath Arctic skies. Despite lying well
            above the Arctic Circle, Lofoten enjoys a remarkably mild climate thanks to the Gulf Stream — winter
            temperatures rarely drop below -5°C, and summer brings the midnight sun for weeks on end.
          </p>

          <ArticleFigure index={0} image={hero} />
          <ArticleFigure index={1} image={village} float="right" />

          <p className="mb-4">
            The archipelago stretches roughly 200 kilometres from the mainland, connected by a series of bridges and
            tunnels that make it possible to drive the entire chain. Along the way, every bend in the road reveals
            another postcard vista — a red rorbuer reflected in glassy water, a dramatic headland catching the last
            light.
          </p>

          <p className="mb-4">
            Fishing has shaped these islands for over a thousand years. The annual cod migration — the skrei — brought
            wealth and culture to even the most remote settlements. Today, wooden drying racks (hjell) still dominate
            the landscape from February to June, their skeletal frames hung with thousands of split cod destined to
            become stockfish, Norway&apos;s oldest export.
          </p>

          <h2 className="mt-8 mb-3 clear-both text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            The Mountains
          </h2>

          <ArticleFigure index={2} image={mountain} float="left" />

          <p className="mb-4">
            Lofoten&apos;s peaks are modest by Alpine standards — the highest, Higravstinden, reaches just 1,161 metres — but
            their proximity to the sea makes them feel immense. Ridgelines launch almost vertically from the shoreline,
            and many of the most rewarding hikes start at sea level. Reinebringen, perhaps the most famous, climbs 448
            metres via a recently built Sherpa staircase and rewards hikers with a panorama that frequently appears on
            &quot;best views in the world&quot; lists.
          </p>

          <p className="mb-4">
            In winter, the mountains take on an entirely different character. Snow softens the granite, avalanche paths
            stripe the slopes, and the low-angle Arctic light paints everything in shades of pink and blue. Ski touring
            is increasingly popular, with descents that end at the water&apos;s edge — you can literally ski from summit to
            sea.
          </p>

          <h2 className="mt-8 mb-3 clear-both text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            The Beaches
          </h2>

          <p className="mb-4">
            It seems improbable, but some of the world&apos;s most beautiful beaches lie above 68°N. Haukland, Uttakleiv, and
            Kvalvika could be mistaken for the Caribbean if it weren&apos;t for the snow-dusted mountains framing them. The
            water&apos;s turquoise tint is real — caused by the white sand bottom and the clarity of the Arctic Sea — though
            a swim will quickly remind you that this is not, in fact, the tropics.
          </p>

          <ArticleFigure index={3} image={beach} />

          <p className="mb-4">
            Surfers have discovered these beaches too. Unstad, on the northern coast, has become one of the world&apos;s most
            northerly surf spots, offering consistent swells and a backdrop that no other break on the planet can match.
            In winter, hardy surfers ride waves under the northern lights.
          </p>

          <h2 className="mt-8 mb-3 text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            The Light
          </h2>

          <ArticleFigure index={4} image={aurora} float="right" />

          <p className="mb-4">
            Photographers flock to Lofoten for the light. From late May to mid-July, the sun never sets, casting a warm
            golden glow that rolls around the horizon through the night. In the polar night of December and January, the
            sun never rises, but the twilight hours produce extraordinary pastel skies that last for hours. And then
            there&apos;s the aurora.
          </p>

          <p className="mb-4">
            From September through March, the northern lights dance across Lofoten&apos;s skies with remarkable frequency.
            The islands&apos; position within the auroral oval, combined with their relatively dry climate and dark skies,
            makes them one of the best places on Earth to witness the phenomenon.
          </p>

          <h2 className="mt-8 mb-3 clear-both text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            Looking Ahead
          </h2>

          <ArticleFigure index={5} image={boats} float="left" />

          <p className="mb-4">
            Tourism has grown rapidly in recent years, bringing both economic opportunity and environmental pressure.
            The communities of Lofoten are navigating a careful balance: welcoming visitors while preserving the
            pristine landscape and traditional way of life that make the islands special. Sustainable tourism
            initiatives, strict building codes, and a deep cultural connection to the sea offer reasons for optimism.
          </p>

          <p className="clear-both">
            Whether you come for the hiking, the fishing, the surfing, or simply to stand in awe of the scenery, Lofoten
            has a way of resetting your sense of scale. In a world that often feels thoroughly mapped and explored,
            these islands retain a wildness that is increasingly rare — and utterly unforgettable.
          </p>
        </article>

        <LightboxOverlay />
        <LightboxFrame ariaLabel="Article photos">
          <LightboxCloseButton />
          <StackedItemGroup>
            {articleImages.map((img, i) => (
              <Lightbox.Item key={img.id} index={i} caption={img.caption} className={stackedItemClass}>
                <LightboxFullImage src={img.src} alt={img.alt} />
              </Lightbox.Item>
            ))}
          </StackedItemGroup>
          <LightboxNavBar />
          <LightboxCaptionLine />
        </LightboxFrame>
      </Lightbox.Root>
    </ExampleShell>
  );
}
