'use client';

import * as React from 'react';
import { Lightbox, ScrollGallery } from 'react-image-gallery';
import { X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { ExampleShell } from '../../../_components/example-shell';
import { LightboxFrame, LightboxOverlay } from '../../../_components/lightbox-chrome';

const screenCategories = ['Dashboard', 'Settings', 'Profile', 'Onboarding', 'Checkout', 'Analytics'] as const;

const designScreens = Array.from({ length: 32 }, (_, i) => {
  const isPortrait = i % 5 === 1 || i % 5 === 3;
  const w = isPortrait ? 800 : 1400;
  const h = isPortrait ? 1200 : 900;
  const category = screenCategories[i % screenCategories.length];
  const variant = Math.floor(i / screenCategories.length) + 1;
  return {
    id: `screen-${i}`,
    src: `https://picsum.photos/seed/design${i}/${w}/${h}`,
    thumb: `https://picsum.photos/seed/design${i}/${Math.round(w / 3)}/${Math.round(h / 3)}`,
    alt: `${category} — variant ${variant}`,
    caption: `${category} v${variant} — ${isPortrait ? 'Mobile' : 'Desktop'}`,
    category,
    isPortrait,
  };
});

const iconButton =
  'inline-flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-30';

const scrollItemStyle: React.CSSProperties = {
  position: 'relative',
  inset: 'auto',
  visibility: 'visible',
  animation: 'none',
  scrollSnapAlign: 'center',
  flexShrink: 0,
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px',
  boxSizing: 'border-box',
};

export default function DesignFileInspectorPage() {
  const [activeIndex, setActiveIndex] = React.useState(0);

  return (
    <ExampleShell
      title="Design file inspector"
      description={
        <>
          32 design screens in a masonry grid. Opening the lightbox enters a presentation mode driven by a vertical{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">ScrollGallery</code> with a
          right-rail thumbnail strip. Tests many items, mixed aspect ratios, and morphing back to small grid
          thumbnails.
        </>
      }
    >
      <Lightbox.Root
        viewTransition
        value={activeIndex}
        onValueChange={setActiveIndex}
        loop
        scrollTriggerIntoView={{ type: 'onClose', behavior: 'instant' }}
      >
        <div className="py-4">
          <div className="mx-auto mb-6 flex max-w-5xl flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Design System — App Screens</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {designScreens.length} screens across {screenCategories.length} categories
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {screenCategories.map((cat) => (
                <Badge key={cat} variant="outline">
                  {cat}
                </Badge>
              ))}
            </div>
          </div>

          <div className="mx-auto max-w-5xl [column-gap:0.75rem] [columns:220px]">
            {designScreens.map((screen, i) => (
              <div key={screen.id} className="mb-3 [break-inside:avoid]">
                <Lightbox.Trigger
                  index={i}
                  className="block w-full rounded-lg bg-transparent p-0 transition-opacity duration-[200ms] ease-out-expo data-[morph-target]:opacity-0"
                >
                  <img
                    src={screen.thumb}
                    alt={screen.alt}
                    className="block w-full rounded-lg"
                    loading="lazy"
                  />
                </Lightbox.Trigger>
                <div className="flex items-baseline justify-between px-1 py-2">
                  <span className="truncate text-xs font-medium">{screen.alt}</span>
                  <Badge variant="secondary" className="ml-2 shrink-0">
                    {screen.isPortrait ? 'Mobile' : 'Desktop'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        <LightboxOverlay />

        <LightboxFrame ariaLabel="Design screen inspector" className="flex flex-col items-stretch">
          <div className="absolute right-4 top-4 z-10">
            <Lightbox.Close className={iconButton} aria-label="Close">
              <X aria-hidden className="h-5 w-5" />
            </Lightbox.Close>
          </div>
          <div className="absolute left-4 top-4 z-10">
            <Lightbox.Counter className="font-mono text-sm tabular-nums text-white/70" />
          </div>

          <ScrollGallery.Root value={activeIndex} onValueChange={setActiveIndex} orientation="vertical">
            <div className="flex min-h-0 w-full flex-1">
              <Lightbox.ItemGroup
                render={<ScrollGallery.Viewport aria-label="Design screens" />}
                preload={designScreens.length}
                className="flex flex-1 flex-col overflow-y-auto overscroll-y-contain [scroll-snap-type:y_mandatory] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {designScreens.map((screen, i) => (
                  <Lightbox.Item
                    key={screen.id}
                    index={i}
                    caption={screen.caption}
                    render={<ScrollGallery.Item />}
                    style={scrollItemStyle}
                  >
                    <img
                      src={screen.src}
                      alt={screen.alt}
                      className="max-h-full max-w-full rounded-lg object-contain"
                    />
                  </Lightbox.Item>
                ))}
              </Lightbox.ItemGroup>

              <ScrollGallery.ScrollMarkerGroup
                aria-label="Screen thumbnails"
                className="flex w-16 shrink-0 flex-col items-center gap-1.5 overflow-y-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {designScreens.map((screen, i) => (
                  <ScrollGallery.ScrollMarker
                    key={screen.id}
                    index={i}
                    className={
                      'shrink-0 overflow-hidden rounded-sm border-2 border-transparent p-0 opacity-40 transition data-[active]:border-white data-[active]:opacity-100 ' +
                      (screen.isPortrait ? 'h-12 w-8' : 'h-8 w-12')
                    }
                  >
                    <img
                      src={screen.thumb}
                      alt={screen.alt}
                      className="block h-full w-full object-cover"
                      loading="lazy"
                    />
                  </ScrollGallery.ScrollMarker>
                ))}
              </ScrollGallery.ScrollMarkerGroup>
            </div>

            <Lightbox.Caption className="block px-5 py-2 text-center text-sm text-white/80" />
          </ScrollGallery.Root>
        </LightboxFrame>
      </Lightbox.Root>
    </ExampleShell>
  );
}
