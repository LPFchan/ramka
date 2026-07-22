'use client';

import * as React from 'react';
import { Lightbox } from 'ramka';

import { lightboxImages } from '../../../_data/lightbox-images';
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

export default function ImperativeApiPage() {
  const lightboxRef = React.useRef<Lightbox.LightboxRootRef | null>(null);

  return (
    <ExampleShell
      title="Imperative API"
      docsHref="/docs/lightbox/api#api-root-ref"
      docsLabel="LightboxRootRef"
      description={
        <>
          Forward a ref to <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">Lightbox.Root</code>{' '}
          and you get <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">open(index?)</code>,
          {' '}<code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">close()</code>, and
          {' '}<code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">goTo(index)</code> —
          drive the lightbox from anywhere without managing state.
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        {lightboxImages.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => lightboxRef.current?.open(i)}
            className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-50 dark:hover:bg-neutral-800"
          >
            Open #{i + 1}
          </button>
        ))}
        <button
          type="button"
          onClick={() => lightboxRef.current?.goTo(0)}
          className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-50 dark:hover:bg-neutral-800"
        >
          goTo(0)
        </button>
      </div>

      <Lightbox.Root ref={lightboxRef}>
        <LightboxOverlay />

        <LightboxFrame ariaLabel="Imperative-control photo gallery">
          <LightboxCloseButton />

          <StackedItemGroup>
            {lightboxImages.map((img, i) => (
              <Lightbox.Item key={img.id} index={i} className={stackedItemClass}>
                <LightboxFullImage src={img.src} alt={img.alt} />
              </Lightbox.Item>
            ))}
          </StackedItemGroup>

          <LightboxNavBar />
        </LightboxFrame>
      </Lightbox.Root>
    </ExampleShell>
  );
}
