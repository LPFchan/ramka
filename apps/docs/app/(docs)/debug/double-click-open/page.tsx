'use client';

import { notFound } from 'next/navigation';
import * as React from 'react';
import Image, { type StaticImageData } from 'next/image';
import { Lightbox } from 'ramka';
import { X, ZoomIn, ZoomOut } from 'lucide-react';

import {
  type LightboxGalleryItem,
  galleryItemDims,
  lightboxChromeButton,
  lightboxChromeButtonMd,
} from '../../../_components/lightbox-chrome';

import { AccessibleDoubleClickTile } from './double-click-trigger';
import { dblA, dblB, dblC, dblD, dblE, dblF } from './images.generated';

const PHOTOS: LightboxGalleryItem[] = [
  {
    id: 'dbl-a',
    src: dblA,
    thumb: dblA,
    alt: 'Coastal cliffs at dusk',
    caption: 'Coastal cliffs at dusk',
  },
  {
    id: 'dbl-b',
    src: dblB,
    thumb: dblB,
    alt: 'Forest trail in morning light',
    caption: 'Forest trail',
  },
  {
    id: 'dbl-c',
    src: dblC,
    thumb: dblC,
    alt: 'City skyline reflection',
    caption: 'City skyline',
  },
  {
    id: 'dbl-d',
    src: dblD,
    thumb: dblD,
    alt: 'Desert highway',
    caption: 'Desert highway',
  },
  {
    id: 'dbl-e',
    src: dblE,
    thumb: dblE,
    alt: 'Harbor boats at blue hour',
    caption: 'Harbor at blue hour',
  },
  {
    id: 'dbl-f',
    src: dblF,
    thumb: dblF,
    alt: 'Mountain lake panorama',
    caption: 'Mountain lake',
  },
];

/**
 * Dev-only: double-click preview + accessible single-pointer open control.
 */
export default function DoubleClickOpenDebugPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const handle = React.useMemo(() => Lightbox.createHandle(), []);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
      <header>
        <p className="text-[11px] font-semibold tracking-widest text-amber-700 uppercase dark:text-amber-400">
          Debug · development only
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Double-click to open (accessible)
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
          Custom open gestures use <code className="text-sm">Lightbox.createHandle()</code> and{' '}
          <code className="text-sm">handle.open(index, {'{ triggerId }'})</code> — not overlays or
          synthetic clicks. Each tile keeps a real <code className="text-sm">Lightbox.Trigger</code>{' '}
          as the single-pointer control (WCAG 2.5.1); double-click on the preview is an optional
          pointer shortcut.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          What to verify
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
          <li>Single click on the photo preview does nothing</li>
          <li>
            The preview hides while it carries <code className="text-xs">data-morph-target</code>{' '}
            (library-injected hide — no consumer CSS needed)
          </li>
          <li>
            Each <strong className="font-medium text-neutral-800 dark:text-neutral-200">Open …</strong>{' '}
            button opens on single click, Enter, and Space
          </li>
          <li>Closing returns focus to the Open button that owns that tile&apos;s trigger id</li>
          <li>Touch / single-tap users can open via the Open button (no double-click required)</li>
        </ul>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-neutral-50/80 p-4 text-sm leading-relaxed text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-300">
        <p className="font-medium text-neutral-900 dark:text-neutral-100">Accessibility pattern</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong className="font-medium text-neutral-900 dark:text-neutral-100">WCAG 2.5.1</strong>{' '}
            — double-click alone is not sufficient; the labeled{' '}
            <code className="text-xs">Lightbox.Trigger</code> button is the single-pointer alternative.
          </li>
          <li>
            Preview uses <code className="text-xs">{'role="group"'}</code> + screen-reader label; the
            decorative image is <code className="text-xs">aria-hidden</code>.
          </li>
          <li>
            <code className="text-xs">morphRef</code> points at the visible preview; the library
            sets <code className="text-xs">data-morph-target</code> there and hides it while the
            morph runs.
          </li>
          <li>
            Default <code className="text-xs">Lightbox.Trigger</code> (single click) remains the
            recommended production default when no custom gesture is required.
          </li>
        </ul>
      </section>

      <Lightbox.Root handle={handle} loop morphTo="closest" viewTransition>
        <div className="grid max-w-lg grid-cols-2 gap-4 sm:grid-cols-3">
          {PHOTOS.map((photo, i) => (
            <AccessibleDoubleClickTile key={photo.id} handle={handle} photo={photo} index={i} />
          ))}
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          {PHOTOS.length} tiles · double-click preview or use each Open button
        </p>

        <Lightbox.Portal>
          <Lightbox.Backdrop className="lightbox-demo-backdrop lightbox-demo-backdrop-light fixed inset-0" />
          <Lightbox.Content
            aria-label="Double-click open debug gallery"
            pullToClose
            className="lightbox-demo-content fixed inset-0 flex flex-col overscroll-contain outline-none"
          >
            <Lightbox.Slides
              aria-label="Full-size images"
              preload={1}
              className="lightbox-demo-slides flex-1 gap-5 [&::-webkit-scrollbar]:hidden md:gap-0"
            >
              {PHOTOS.map((photo, i) => (
                <Lightbox.Slide key={photo.id} className="lightbox-demo-slide-pad h-full">
                  <Lightbox.Item index={i} caption={photo.caption ?? photo.alt}>
                    <Lightbox.Zoom maxZoom={4}>
                      <Lightbox.Media
                        {...(galleryItemDims(photo) ?? {})}
                        className="overflow-hidden rounded-none md:rounded-lg"
                      >
                        <Image
                          src={photo.src as StaticImageData}
                          alt={photo.alt}
                          sizes="100vw"
                          loading="eager"
                          draggable={false}
                          className="select-none"
                        />
                      </Lightbox.Media>
                    </Lightbox.Zoom>
                  </Lightbox.Item>
                </Lightbox.Slide>
              ))}
            </Lightbox.Slides>

            <div className="lightbox-demo-chrome-top lightbox-demo-chrome-hide absolute left-3 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-30">
              <Lightbox.Counter className="min-w-[3.5rem] font-mono text-sm tabular-nums text-black/70 dark:text-white/70" />
            </div>

            <div className="lightbox-demo-chrome-top lightbox-demo-chrome-hide absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-30 flex gap-2">
              <Lightbox.ZoomOut className={lightboxChromeButtonMd} aria-label="Zoom out">
                <ZoomOut aria-hidden className="h-4 w-4" strokeWidth={2.25} />
              </Lightbox.ZoomOut>
              <Lightbox.ZoomIn className={lightboxChromeButtonMd} aria-label="Zoom in">
                <ZoomIn aria-hidden className="h-4 w-4" strokeWidth={2.25} />
              </Lightbox.ZoomIn>
              <Lightbox.Close className={lightboxChromeButton} aria-label="Close">
                <X aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </Lightbox.Close>
            </div>

            <div className="lightbox-demo-chrome-bottom lightbox-demo-chrome-hide pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-3 px-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
              <Lightbox.Caption className="pointer-events-auto block min-h-[1.25rem] max-w-full truncate px-6 text-center text-sm text-black/70 dark:text-white/80" />
            </div>
          </Lightbox.Content>
        </Lightbox.Portal>
      </Lightbox.Root>
    </div>
  );
}
