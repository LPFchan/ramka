'use client';

import * as React from 'react';
import * as Lightbox from '@ramka/react/lightbox';

import { lightboxImages } from '../../../_data/lightbox-images';
import {
  LightboxGallery,
  LightboxTriggerGrid,
  LightboxTriggerImage,
  triggerFocusClass,
} from '../../../_components/lightbox-chrome';

const btnClass =
  'rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-50 dark:hover:bg-neutral-800';

const overlayBtnClass =
  'rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-black/75';

/**
 * Navigation mirrors, indices do not. The in-viewer buttons jump by index and
 * land on the same photo they would in an LTR gallery — only the direction the
 * track travels to get there is flipped.
 *
 * These docs are an LTR page, and nothing here compensates for that: `dir` on
 * Root reaches the portaled viewer by itself.
 */
export function RtlHandleDemo() {
  const lightbox = React.useMemo(() => Lightbox.createHandle(), []);
  const [index, setIndex] = React.useState(0);

  const last = lightboxImages.length - 1;
  const jumps = [
    { label: 'First (0)', index: 0 },
    { label: 'Index 3', index: 3 },
    { label: `Last (${last})`, index: last },
  ];

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          גלריית תמונות · active index {index}
        </p>
        <button type="button" onClick={() => lightbox.open(0)} className={btnClass}>
          פתיחת הגלריה
        </button>
      </div>

      <LightboxTriggerGrid>
        {lightboxImages.map((img, i) => (
          <Lightbox.Trigger
            key={img.id}
            handle={lightbox}
            id={`rtl-photo-${i}`}
            index={i}
            className={`block overflow-hidden rounded-2xl ${triggerFocusClass}`}
          >
            <LightboxTriggerImage src={img.src} alt={img.alt} />
          </Lightbox.Trigger>
        ))}
      </LightboxTriggerGrid>

      <Lightbox.Root handle={lightbox} dir="rtl" onValueChange={setIndex}>
        <LightboxGallery
          items={lightboxImages}
          ariaLabel="גלריית תמונות בגודל מלא"
          overlay={
            <div className="pointer-events-none absolute inset-x-0 top-3 z-40 flex justify-center">
              <div className="pointer-events-auto flex gap-2" dir="ltr">
                {jumps.map((jump) => (
                  <button
                    key={jump.index}
                    type="button"
                    data-rtl-goto={jump.index}
                    onClick={() => lightbox.goTo(jump.index)}
                    className={overlayBtnClass}
                  >
                    {jump.label}
                  </button>
                ))}
              </div>
            </div>
          }
        />
      </Lightbox.Root>
    </div>
  );
}
