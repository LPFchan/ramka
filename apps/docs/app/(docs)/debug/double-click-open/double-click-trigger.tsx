'use client';

import * as React from 'react';
import Image, { type StaticImageData } from 'next/image';
import * as Lightbox from '@ramka/react/lightbox';
import type { LightboxHandle, LightboxTriggerRenderState } from '@ramka/react';

import { triggerFocusClass, type LightboxImageSource } from '../../../_components/lightbox-chrome';

type Photo = {
  /** Matches demo `LightboxGalleryItem.id` (optional string | number). */
  id?: string | number;
  thumb: LightboxImageSource;
  alt: string;
};

/**
 * Accessible double-click-to-open tile:
 *
 * - Preview: double-click opens via `handle.open` (pointer convenience).
 * - `Lightbox.Trigger`: explicit single-pointer control (WCAG 2.5.1) with
 *   native button semantics, keyboard (Enter/Space), and focus return.
 * - `morphRef` targets the preview; the library-injected `data-morph-target`
 *   hide covers it during morphs; `imageRef` keeps placeholder bridging.
 */
export function AccessibleDoubleClickTile({
  handle,
  photo,
  index,
}: {
  handle: LightboxHandle;
  photo: Photo;
  index: number;
}) {
  const previewRef = React.useRef<HTMLDivElement | null>(null);
  const triggerId = String(photo.id ?? `dbl-${index}`);
  const open = React.useCallback(() => {
    handle.open(index, { triggerId });
  }, [handle, index, triggerId]);

  const previewId = `${triggerId}-preview`;
  const hintId = `${triggerId}-hint`;

  return (
    <figure className="flex flex-col gap-2">
      <div
        ref={previewRef}
        id={previewId}
        role="group"
        aria-labelledby={`${previewId}-label ${hintId}`}
        className={`relative overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-900`}
        onDoubleClick={open}
      >
        <p id={`${previewId}-label`} className="sr-only">
          {photo.alt}
        </p>
        <Image
          src={photo.thumb as StaticImageData}
          alt=""
          aria-hidden
          placeholder="blur"
          sizes="(min-width: 640px) 170px, 50vw"
          draggable={false}
          className="aspect-square w-full object-cover"
        />
      </div>

      <p id={hintId} className="text-xs text-neutral-500 dark:text-neutral-400">
        Double-click photo
      </p>

      <Lightbox.Trigger
        handle={handle}
        id={triggerId}
        index={index}
        className={`self-start rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-900 shadow-sm transition-colors hover:bg-neutral-50 focus:outline-none dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 ${triggerFocusClass}`}
      >
        {(state) => (
          <TriggerRegistration
            previewRef={previewRef}
            thumb={photo.thumb}
            label={`Open ${photo.alt}`}
            {...state}
          />
        )}
      </Lightbox.Trigger>
    </figure>
  );
}

function TriggerRegistration({
  previewRef,
  thumb,
  label,
  imageRef,
  morphRef,
}: {
  previewRef: React.RefObject<HTMLDivElement | null>;
  thumb: LightboxImageSource;
  label: string;
} & LightboxTriggerRenderState) {
  // morphRef must target the preview div (sibling of the Trigger button).
  // Register it once the Trigger slot has mounted so data-morph-target + hide
  // apply to the visible photo, not the sr-only placeholder img.
  React.useLayoutEffect(() => {
    morphRef(previewRef.current);
    return () => morphRef(null);
  }, [morphRef, previewRef]);

  return (
    <>
      <Image
        ref={imageRef}
        src={thumb as StaticImageData}
        alt=""
        aria-hidden
        sizes="170px"
        className="sr-only"
      />
      {label}
    </>
  );
}
