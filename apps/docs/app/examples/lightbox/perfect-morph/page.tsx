'use client';

import { Lightbox } from 'react-image-gallery';

import { ExampleShell } from '../../../_components/example-shell';
import {
  LightboxCloseButton,
  LightboxFrame,
  LightboxFullImage,
  LightboxNavBar,
  LightboxOverlay,
  StackedItemGroup,
  stackedItemClass,
} from '../../../_components/lightbox-chrome';

const horizontalTargets = [
  { src: 'https://picsum.photos/seed/pm1/1200/800', alt: 'Landscape one' },
  { src: 'https://picsum.photos/seed/pm2/1200/800', alt: 'Landscape two' },
];

const verticalTargets = [
  { src: 'https://picsum.photos/seed/pmv1/800/1200', alt: 'Portrait one' },
  { src: 'https://picsum.photos/seed/pmv2/800/1200', alt: 'Portrait two' },
];

export default function PerfectMorphPage() {
  return (
    <ExampleShell
      title="Perfect morph"
      description={
        <>
          The trigger image and the full lightbox image have very different aspect ratios. The View Transitions API
          combined with <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">object-fit: cover</code>{' '}
          on the morph snapshots produces a smooth crop-and-letterbox animation in both directions — without any
          crossfade. Try clicking either pair of triggers below.
        </>
      }
    >
      <div className="flex flex-col gap-10">
        <Lightbox.Root viewTransition>
          <div className="flex items-center justify-center gap-4">
            {horizontalTargets.map((img, i) => (
              <Lightbox.Trigger
                key={img.src}
                index={i}
                className="block cursor-pointer rounded-xl border-none bg-transparent p-0"
              >
                <img
                  src={img.src}
                  alt={img.alt}
                  className="block h-80 w-40 rounded-xl object-cover"
                  loading="lazy"
                />
              </Lightbox.Trigger>
            ))}
          </div>

          <LightboxOverlay />
          <LightboxFrame ariaLabel="Aspect-ratio mismatch morph (portrait triggers)">
            <LightboxCloseButton />
            <StackedItemGroup>
              {horizontalTargets.map((img, i) => (
                <Lightbox.Item key={img.src} index={i} className={stackedItemClass}>
                  <LightboxFullImage src={img.src} alt={img.alt} />
                </Lightbox.Item>
              ))}
            </StackedItemGroup>
            <LightboxNavBar />
          </LightboxFrame>
        </Lightbox.Root>

        <Lightbox.Root viewTransition>
          <div className="flex flex-col items-stretch justify-center gap-4">
            {verticalTargets.map((img, i) => (
              <Lightbox.Trigger
                key={img.src}
                index={i}
                className="block w-full cursor-pointer rounded-xl border-none bg-transparent p-0"
              >
                <img
                  src={img.src}
                  alt={img.alt}
                  className="block h-[220px] w-full rounded-xl object-cover"
                  loading="lazy"
                />
              </Lightbox.Trigger>
            ))}
          </div>

          <LightboxOverlay />
          <LightboxFrame ariaLabel="Aspect-ratio mismatch morph (landscape triggers)">
            <LightboxCloseButton />
            <StackedItemGroup>
              {verticalTargets.map((img, i) => (
                <Lightbox.Item key={img.src} index={i} className={stackedItemClass}>
                  <LightboxFullImage src={img.src} alt={img.alt} />
                </Lightbox.Item>
              ))}
            </StackedItemGroup>
            <LightboxNavBar />
          </LightboxFrame>
        </Lightbox.Root>
      </div>
    </ExampleShell>
  );
}
