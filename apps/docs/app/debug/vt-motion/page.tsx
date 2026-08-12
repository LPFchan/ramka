'use client';

import { notFound } from 'next/navigation';
import * as React from 'react';
import Image from 'next/image';
import { Lightbox } from 'ramka';
import { X } from 'lucide-react';

import { lightboxChromeButton } from '../../_components/lightbox-chrome';
import { vtMotionPhoto } from './images.generated';

/**
 * Dev-only: controlled View Transition motion test. A single real photo on a
 * non-scrollable page with a real close button — the minimal real-world case
 * for recording and comparing morph trajectories on devices.
 */

const PHOTO = {
  image: vtMotionPhoto,
  alt: 'Motion test photo',
};

export default function VtMotionDebugPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-10 overflow-hidden bg-background">
      {/* One-tap variant switching for on-device A/B recording sessions. */}
      <div className="flex gap-4 text-lg">
        <a className="rounded border px-4 py-2" href="/debug/vt-motion?vtab=q7&vtdebug">
          Variant Q7
        </a>
        <a className="rounded border px-4 py-2" href="/debug/vt-motion?vtab=k2&vtdebug">
          Variant K2
        </a>
      </div>

      <Lightbox.Root viewTransition>
        <Lightbox.Trigger index={0}>
          {({ imageRef }) => (
            <Image
              ref={imageRef}
              src={PHOTO.image}
              alt={PHOTO.alt}
              placeholder="blur"
              width={240}
              height={160}
              sizes="240px"
              loading="eager"
              draggable={false}
              className="rounded-lg select-none"
            />
          )}
        </Lightbox.Trigger>

        <Lightbox.Portal>
          <Lightbox.Backdrop className="lightbox-demo-backdrop fixed inset-0" />
          <Lightbox.Content
            aria-label="VT motion debug"
            className="lightbox-demo-content fixed inset-0 flex flex-col overscroll-contain outline-none"
          >
            <Lightbox.Slides aria-label="Images" className="lightbox-demo-slides flex-1">
              <Lightbox.Slide className="h-full">
                <Lightbox.Item index={0}>
                  <Lightbox.Zoom>
                    <Lightbox.Media width={PHOTO.image.width} height={PHOTO.image.height}>
                      <Image
                        src={PHOTO.image}
                        alt={PHOTO.alt}
                        sizes="100vw"
                        loading="eager"
                        draggable={false}
                        className="select-none"
                      />
                    </Lightbox.Media>
                  </Lightbox.Zoom>
                </Lightbox.Item>
              </Lightbox.Slide>
            </Lightbox.Slides>

            <div className="absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-30">
              <Lightbox.Close className={lightboxChromeButton} aria-label="Close">
                <X aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </Lightbox.Close>
            </div>
          </Lightbox.Content>
        </Lightbox.Portal>
      </Lightbox.Root>
    </div>
  );
}
