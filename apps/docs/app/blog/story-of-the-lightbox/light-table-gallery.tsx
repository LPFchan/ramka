'use client';

import Image from 'next/image';
import * as Lightbox from '@ramka/react/lightbox';
import { X, ZoomIn, ZoomOut } from 'lucide-react';

import { triggerFocusClass } from '../../_components/lightbox-chrome';
import { LIGHT_TABLE_IMAGES } from './article-images';
import './light-table.css';

/**
 * The photo set for "The room was dark first": a hero shot plus a row of
 * three, opening into a viewer built like the polaroid ThumbnailStrip
 * recipe, then skinned as the E-Z-View slide sorter from the photos: a flat
 * molded top panel holds the printed name and the controls, tiered rack
 * lanes glow across the backdrop, and the thumbs are cardboard slide mounts
 * standing on their own lit ledge, each window keeping its photo's real
 * aspect ratio. The furniture the section is about, as chrome.
 *
 * These four are a genuine set, so unlike the article's solo Shots they
 * share one Root: swipe, strip and counter work across them. Skin lives in
 * `light-table.css`; labels/credits in `article-images.ts`.
 */

const triggerClassName = `group relative block w-full cursor-zoom-in overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 ${triggerFocusClass}`;

export function LightTableGallery() {
  const [hero, ...rest] = LIGHT_TABLE_IMAGES;
  return (
    <figure className="mt-8">
      <Lightbox.Root
        loop
        morphTo="closest"
        scrollTriggerIntoView={[
          { type: 'onChange', behavior: 'instant' },
          { type: 'onOpenComplete', behavior: 'instant' },
        ]}
      >
        <div className="flex flex-col gap-3">
          <Lightbox.Trigger index={0} className={triggerClassName}>
            {({ imageRef }) => (
              <Image
                ref={imageRef}
                src={hero.src}
                width={hero.width}
                height={hero.height}
                alt={hero.alt}
                sizes="(min-width: 768px) 672px, 100vw"
                draggable={false}
                className="aspect-[16/10] w-full select-none object-cover"
              />
            )}
          </Lightbox.Trigger>
          <div className="grid grid-cols-3 gap-3">
            {rest.map((img, i) => (
              <Lightbox.Trigger key={img.id} index={i + 1} className={triggerClassName}>
                {({ imageRef }) => (
                  <Image
                    ref={imageRef}
                    src={img.src}
                    width={img.width}
                    height={img.height}
                    alt={img.alt}
                    sizes="(min-width: 768px) 216px, 33vw"
                    draggable={false}
                    className="aspect-square w-full select-none object-cover"
                  />
                )}
              </Lightbox.Trigger>
            ))}
          </div>
        </div>

        <Lightbox.Portal>
          <Lightbox.Backdrop className="lightbox-demo-backdrop lt-backdrop fixed inset-0" />
          <Lightbox.Content
            aria-label="Photos of light tables and slides"
            pullToClose
            className="lightbox-demo-content lt-viewer-content fixed inset-0 flex flex-col overscroll-contain outline-none"
          >
            {/*
             * Printed branding: silkscreened onto the plastic, so it lives
             * under the slides (a zoomed photo passes over it) and behind
             * the zoom shade (it dims together with the frame). Mirrors the
             * top panel's box so the two rows line up.
             */}
            <div className="lt-top-panel lightbox-demo-chrome-hide pointer-events-none absolute inset-x-0 top-0 flex items-center px-4 md:px-5">
              <div className="flex min-w-0 items-baseline gap-2.5">
                <span className="lt-panel-script truncate">ramka</span>
                <span className="lt-panel-title truncate">slide sorter</span>
              </div>
            </div>
            {/* Backlight dimmer: darkens the plastic behind the photo as zoom rises. */}
            <div aria-hidden className="lt-zoom-shade pointer-events-none absolute inset-0 z-0" />
            <Lightbox.Slides
              aria-label="Full-size photos"
              preload={1}
              className="lightbox-demo-slides z-10 flex-1 gap-5 [&::-webkit-scrollbar]:hidden md:gap-0"
            >
              {LIGHT_TABLE_IMAGES.map((img, i) => (
                <Lightbox.Slide key={img.id} className="lightbox-demo-slide-pad h-full">
                  <Lightbox.Item index={i} caption={img.label}>
                    <Lightbox.Zoom maxZoom={4}>
                      <Lightbox.Media width={img.width} height={img.height} className="lt-media">
                        <Image
                          src={img.src}
                          width={img.width}
                          height={img.height}
                          alt={img.alt}
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

            {/* The sorter's flat top panel: controls only — the printed name
                is silkscreened onto the plastic below the slides. */}
            <div className="lt-top-panel lightbox-demo-chrome-top lightbox-demo-chrome-hide absolute inset-x-0 top-0 z-30 flex items-center justify-end gap-3 px-4 md:px-5">
              <div className="flex items-center gap-2">
                {/* Desktop-only zoom buttons; pinch and double-tap cover touch. */}
                <Lightbox.ZoomOut className="lt-btn hidden md:inline-flex" aria-label="Zoom out">
                  <ZoomOut aria-hidden className="h-4 w-4" strokeWidth={2.25} />
                </Lightbox.ZoomOut>
                <Lightbox.ZoomIn className="lt-btn hidden md:inline-flex" aria-label="Zoom in">
                  <ZoomIn aria-hidden className="h-4 w-4" strokeWidth={2.25} />
                </Lightbox.ZoomIn>
                <Lightbox.Close className="lt-btn inline-flex" aria-label="Close">
                  <X aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.25} />
                </Lightbox.Close>
              </div>
            </div>

            <div className="lightbox-demo-chrome-bottom lightbox-demo-chrome-hide pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-1 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
              <Lightbox.Caption className="lt-viewer-caption pointer-events-auto block min-h-[1.2rem] max-w-full truncate px-4 text-center drop-shadow-[0_1px_1px_rgb(255_255_255/0.7)] dark:drop-shadow-[0_1px_2px_rgb(0_0_0/0.65)]" />
              <div className="pointer-events-auto w-full min-w-0">
                <Lightbox.ThumbnailStrip className="lt-strip">
                  <Lightbox.ThumbnailStripTrack aria-label="Thumbnails">
                    {LIGHT_TABLE_IMAGES.map((img, i) => (
                      <Lightbox.Thumbnail key={img.id} index={i}>
                        <span className="lt-window" style={{ ['--lt-ar' as string]: String(img.width / img.height) }}>
                          <Image
                            src={img.src}
                            alt=""
                            width={img.width}
                            height={img.height}
                            sizes="160px"
                            draggable={false}
                          />
                        </span>
                        <span className="lt-mount-label">{img.label}</span>
                      </Lightbox.Thumbnail>
                    ))}
                  </Lightbox.ThumbnailStripTrack>
                </Lightbox.ThumbnailStrip>
              </div>
            </div>
          </Lightbox.Content>
        </Lightbox.Portal>
      </Lightbox.Root>
      <figcaption className="mt-3 text-center text-[13px] leading-6 text-neutral-400 dark:text-neutral-500">
        The furniture, at work. Photos by{' '}
        <a
          href="https://unsplash.com/@priscilladupreez"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-2 transition hover:decoration-neutral-500 dark:text-neutral-50 dark:decoration-neutral-700 dark:hover:decoration-neutral-500"
        >
          Priscilla Du Preez
        </a>
        ,{' '}
        <a
          href="https://unsplash.com/@ninjason"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-2 transition hover:decoration-neutral-500 dark:text-neutral-50 dark:decoration-neutral-700 dark:hover:decoration-neutral-500"
        >
          Jason Leung
        </a>{' '}
        and{' '}
        <a
          href="https://unsplash.com/@jakubzerdzicki"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-2 transition hover:decoration-neutral-500 dark:text-neutral-50 dark:decoration-neutral-700 dark:hover:decoration-neutral-500"
        >
          Jakub Żerdzicki
        </a>{' '}
        on{' '}
        <a
          href="https://unsplash.com/license"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-2 transition hover:decoration-neutral-500 dark:text-neutral-50 dark:decoration-neutral-700 dark:hover:decoration-neutral-500"
        >
          Unsplash
        </a>
        .
      </figcaption>
    </figure>
  );
}
