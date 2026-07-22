'use client';

import * as React from 'react';
import { Lightbox } from 'ramka';

import { lightboxImages } from '../../_data/lightbox-images';
import {
  LightboxCloseButton,
  LightboxFrame,
  LightboxFullImage,
  LightboxNavBar,
  LightboxOverlay,
  LightboxTriggerGrid,
  LightboxTriggerImage,
  StackedItemGroup,
  stackedItemClass,
  triggerFocusClass,
  triggerMorphHideClass,
} from '../../_components/lightbox-chrome';

const btnClass =
  'rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-50 dark:hover:bg-neutral-800';

export function ControlledStateDemo() {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setOpen(true)} className={btnClass}>
          Open lightbox
        </button>
        <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
          Active index
          <input
            type="number"
            min={0}
            max={lightboxImages.length - 1}
            value={value}
            onChange={(e) =>
              setValue(Math.max(0, Math.min(lightboxImages.length - 1, Number(e.target.value))))
            }
            className="w-16 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <span className="text-xs text-neutral-500">open = {String(open)}</span>
      </div>

      <Lightbox.Root open={open} onOpenChange={setOpen} value={value} onValueChange={setValue}>
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
    </div>
  );
}

export function CreateHandleDemo() {
  const lightbox = React.useMemo(() => Lightbox.createHandle(), []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">Product photos</p>
        <button
          type="button"
          onClick={() => lightbox.open(0, { triggerId: 'photo-0' })}
          className={btnClass}
        >
          View gallery
        </button>
      </div>

      <LightboxTriggerGrid>
        {lightboxImages.map((img, i) => (
          <Lightbox.Trigger
            key={img.id}
            handle={lightbox}
            id={`photo-${i}`}
            index={i}
            className={`block overflow-hidden rounded-2xl ${triggerMorphHideClass} ${triggerFocusClass}`}
          >
            <LightboxTriggerImage src={img.src} alt={img.alt} />
          </Lightbox.Trigger>
        ))}
      </LightboxTriggerGrid>

      <Lightbox.Root handle={lightbox}>
        <LightboxOverlay />
        <LightboxFrame ariaLabel="Product photo gallery">
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
    </div>
  );
}

interface LogEntry {
  id: number;
  ts: string;
  callback: string;
  value: string;
}

export function LifecycleCallbacksDemo() {
  const [log, setLog] = React.useState<LogEntry[]>([]);
  const counter = React.useRef(0);

  const push = React.useCallback((callback: string, value: string) => {
    counter.current += 1;
    setLog((prev) =>
      [
        {
          id: counter.current,
          ts: new Date().toLocaleTimeString(undefined, { hour12: false }),
          callback,
          value,
        },
        ...prev,
      ].slice(0, 12),
    );
  }, []);

  return (
    <div className="space-y-4">
      <Lightbox.Root
        onOpenChange={(open) => push('onOpenChange', String(open))}
        onOpenChangeComplete={(open) => push('onOpenChangeComplete', String(open))}
        onValueChange={(value, { source }) => push('onValueChange', `index=${value} source=${source}`)}
      >
        <LightboxTriggerGrid>
          {lightboxImages.map((img, i) => (
            <Lightbox.Trigger
              key={img.id}
              index={i}
              className={`block overflow-hidden rounded-2xl ${triggerMorphHideClass} ${triggerFocusClass}`}
            >
              <LightboxTriggerImage src={img.src} alt={img.alt} />
            </Lightbox.Trigger>
          ))}
        </LightboxTriggerGrid>
        <LightboxOverlay />
        <LightboxFrame ariaLabel="Lifecycle-callbacks photo gallery">
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

      <section className="w-full max-w-2xl rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Event log</div>
        {log.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">Open or close the lightbox to see events.</p>
        ) : (
          <ul className="mt-2 space-y-1 font-mono text-xs text-neutral-700 dark:text-neutral-300">
            {log.map((entry) => (
              <li key={entry.id} className="flex gap-3">
                <span className="text-neutral-400">{entry.ts}</span>
                <span className="text-neutral-900 dark:text-neutral-100">{entry.callback}</span>
                <span className="text-neutral-500">→</span>
                <span>{entry.value}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
