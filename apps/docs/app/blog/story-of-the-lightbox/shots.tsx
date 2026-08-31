'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import * as Lightbox from '@ramka/react/lightbox';
import { X, ZoomIn, ZoomOut } from 'lucide-react';

import { lightboxChromeButton, lightboxChromeButtonMd, triggerFocusClass } from '../../_components/lightbox-chrome';
import { ARTICLE_IMAGES, type ArticleImageId } from './article-images';

/**
 * An article figure that opens in its own dedicated ramka viewer. The
 * artifacts are standalone illustrations, not a set, so each Shot is a
 * self-contained single-image lightbox: no counter, no arrows, no filmstrip.
 *
 * The chrome is a deliberate nod to the 2005 original this article is about:
 * a translucent black dim with the photo lit in the middle and a caption
 * underneath. Same idea, modern parts (morph open, pinch and double-tap
 * zoom, pull to dismiss).
 *
 * Src/dims/alt come from the shared manifest (`article-images.ts`); the rich
 * linked caption stays in the article prose.
 */
export function Shot({ id, caption, narrow = false }: { id: ArticleImageId; caption: ReactNode; narrow?: boolean }) {
  const img = ARTICLE_IMAGES.find((i) => i.id === id)!;
  return (
    <figure className="mt-8">
      <Lightbox.Root>
        <Lightbox.Trigger
          index={0}
          className={`block w-full cursor-zoom-in overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 ${
            narrow ? 'mx-auto max-w-sm' : ''
          } ${triggerFocusClass}`}
        >
          {({ imageRef }) => (
            <Image
              ref={imageRef}
              src={img.src}
              alt={img.alt}
              sizes="(min-width: 768px) 672px, 100vw"
              placeholder="blur"
              draggable={false}
              className="block w-full select-none"
            />
          )}
        </Lightbox.Trigger>

        <Lightbox.Portal>
          {/* The classic dim: translucent black, the 2005 overlay.png in one CSS declaration. */}
          <Lightbox.Backdrop className="lightbox-demo-backdrop fixed inset-0 bg-black/85" />
          <Lightbox.Content
            aria-label={img.caption}
            className="lightbox-demo-content lightbox-demo-content-solo fixed inset-0 flex flex-col overscroll-contain outline-none"
          >
            <Lightbox.Slides
              aria-label="Full-size image"
              className="lightbox-demo-slides flex-1 [&::-webkit-scrollbar]:hidden"
            >
              <Lightbox.Slide className="lightbox-demo-slide-pad h-full">
                <Lightbox.Item index={0} caption={img.caption}>
                  <Lightbox.Zoom maxZoom={6}>
                    <Lightbox.Media
                      width={img.src.width}
                      height={img.src.height}
                      className="overflow-hidden rounded-none md:rounded-lg"
                    >
                      <Image
                        src={img.src}
                        alt={img.alt}
                        sizes="100vw"
                        loading="eager"
                        // No placeholder: this index has a trigger image, so
                        // Ramka paints the open bridge (docs/lightbox/nextjs-image).
                        draggable={false}
                        className="select-none"
                      />
                    </Lightbox.Media>
                  </Lightbox.Zoom>
                </Lightbox.Item>
              </Lightbox.Slide>
            </Lightbox.Slides>

            <div className="lightbox-demo-chrome-top lightbox-demo-chrome-hide absolute end-3 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-30 flex gap-2">
              {/* Desktop-only zoom buttons; pinch and double-tap cover touch. */}
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

            <div className="lightbox-demo-chrome-bottom lightbox-demo-chrome-bottom-solo lightbox-demo-chrome-hide pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center px-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
              <Lightbox.Caption className="block max-w-full truncate text-center text-[13px] font-medium leading-tight text-white/90" />
            </div>
          </Lightbox.Content>
        </Lightbox.Portal>
      </Lightbox.Root>
      <figcaption className="mt-3 text-center text-[13px] leading-6 text-neutral-400 dark:text-neutral-500">
        {caption}
      </figcaption>
    </figure>
  );
}
