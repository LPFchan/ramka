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

export default function ControlledLightboxPage() {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(0);

  return (
    <ExampleShell
      title="Controlled"
      description={
        <>
          The <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">open</code> and{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">value</code> props put you
          fully in charge. Both can come from any source — URL params, a store, even another component.
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-50 dark:hover:bg-neutral-800"
        >
          Open lightbox
        </button>

        <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
          Active index
          <input
            type="number"
            min={0}
            max={lightboxImages.length - 1}
            value={value}
            onChange={(e) => setValue(Math.max(0, Math.min(lightboxImages.length - 1, Number(e.target.value))))}
            className="w-16 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>

        <span className="text-xs text-neutral-500">open = {String(open)}</span>
      </div>

      <Lightbox.Root open={open} onOpenChange={setOpen} value={value} onValueChange={(v) => setValue(v)}>
        <LightboxOverlay />

        <LightboxFrame ariaLabel="Controlled photo gallery">
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
