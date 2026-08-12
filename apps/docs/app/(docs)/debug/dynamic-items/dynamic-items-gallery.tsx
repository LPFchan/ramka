'use client';

import * as React from 'react';
import Image from 'next/image';
import { Lightbox } from 'ramka';
import { X, ZoomIn, ZoomOut } from 'lucide-react';

import {
  type LightboxGalleryItem,
  galleryItemDims,
  lightboxChromeButton,
  lightboxChromeButtonMd,
} from '../../../_components/lightbox-chrome';

import './dynamic-items.css';

function DynamicItemsThumbnailStrip({
  items,
  className,
  isRemoving,
}: {
  items: LightboxGalleryItem[];
  className: string;
  isRemoving: (item: LightboxGalleryItem) => boolean;
}) {
  if (items.length <= 1) return null;

  return (
    <Lightbox.ThumbnailStrip className={className}>
      <Lightbox.ThumbnailStripTrack aria-label="Photo thumbnails">
        {items.map((item, i) => (
          <Lightbox.Thumbnail
            key={item.id ?? i}
            index={i}
            className={isRemoving(item) ? 'dynamic-items-thumb-removing' : undefined}
          >
            {typeof item.thumb === 'object' ? (
              <Image src={item.thumb} alt={item.alt} sizes="96px" draggable={false} />
            ) : (
              <img src={item.thumb} alt={item.alt} draggable={false} />
            )}
          </Lightbox.Thumbnail>
        ))}
      </Lightbox.ThumbnailStripTrack>
      <span className="lightbox-demo-thumbnail-strip-indicator" aria-hidden />
    </Lightbox.ThumbnailStrip>
  );
}

/** Docs chrome gallery with exit classes for slides mid-removal. */
export function DynamicItemsGallery({
  items,
  ariaLabel,
  overlay,
  isRemoving,
}: {
  items: LightboxGalleryItem[];
  ariaLabel: string;
  overlay?: React.ReactNode;
  isRemoving: (item: LightboxGalleryItem) => boolean;
}) {
  const preload = 2;
  const maxZoom = 6;
  const thumbClass = 'pointer-events-auto hidden md:block lightbox-demo-thumbnail-strip';

  return (
    <Lightbox.Portal>
      <Lightbox.Backdrop className="lightbox-demo-backdrop lightbox-demo-backdrop-light fixed inset-0" />
      <Lightbox.Content
        aria-label={ariaLabel}
        className="dynamic-items-root lightbox-demo-content fixed inset-0 flex flex-col overscroll-contain outline-none"
      >
        <Lightbox.Slides
          aria-label="Full-size images"
          preload={preload}
          className="lightbox-demo-slides flex-1 gap-5 [&::-webkit-scrollbar]:hidden md:gap-0"
        >
          {items.map((item, i) => {
            const removing = isRemoving(item);
            return (
            <Lightbox.Slide
              key={item.id ?? i}
              className="lightbox-demo-slide-pad h-full"
            >
              <Lightbox.Item index={i} caption={item.caption ?? item.alt}>
                <div className="dynamic-items-exit-layer" data-removing={removing || undefined}>
                  <Lightbox.Zoom maxZoom={maxZoom}>
                    <Lightbox.Media
                      {...(galleryItemDims(item) ?? {})}
                      className="overflow-hidden rounded-none md:rounded-lg"
                    >
                      {typeof item.src === 'object' ? (
                        <Image
                          src={item.src}
                          alt={item.alt}
                          sizes="100vw"
                          loading="eager"
                          draggable={false}
                          className="select-none"
                        />
                      ) : (
                        <img
                          {...(galleryItemDims(item) ?? {})}
                          src={item.src}
                          alt={item.alt}
                          loading="eager"
                          draggable={false}
                          className="select-none"
                        />
                      )}
                    </Lightbox.Media>
                  </Lightbox.Zoom>
                </div>
              </Lightbox.Item>
            </Lightbox.Slide>
            );
          })}
        </Lightbox.Slides>

        {overlay}

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
          <DynamicItemsThumbnailStrip items={items} className={thumbClass} isRemoving={isRemoving} />
        </div>
      </Lightbox.Content>
    </Lightbox.Portal>
  );
}
