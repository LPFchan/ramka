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
  LightboxTriggerGrid,
  LightboxTriggerImage,
  StackedItemGroup,
  stackedItemClass,
  triggerMorphHideClass,
} from '../../../_components/lightbox-chrome';

interface LogEntry {
  id: number;
  ts: string;
  callback: string;
  value: string;
}

export default function LifecycleCallbacksPage() {
  const [log, setLog] = React.useState<LogEntry[]>([]);
  const counter = React.useRef(0);

  const push = React.useCallback((callback: string, value: string) => {
    counter.current += 1;
    setLog((prev) =>
      [
        { id: counter.current, ts: new Date().toLocaleTimeString(undefined, { hour12: false }), callback, value },
        ...prev,
      ].slice(0, 12),
    );
  }, []);

  return (
    <ExampleShell
      title="Lifecycle callbacks"
      description={
        <>
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">onOpenChange</code> fires
          immediately when the open state changes — perfect for syncing URL state.{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">onOpenChangeComplete</code>{' '}
          fires after the enter/exit transition finishes — perfect for cleanup and focus management.
        </>
      }
    >
      <Lightbox.Root
        onOpenChange={(open) => push('onOpenChange', String(open))}
        onOpenChangeComplete={(open) => push('onOpenChangeComplete', String(open))}
        onValueChange={(value, { source }) => push('onValueChange', `index=${value} source=${source}`)}
      >
        <LightboxTriggerGrid>
          {lightboxImages.map((img, i) => (
            <Lightbox.Trigger key={img.id} index={i} className={`block overflow-hidden rounded-2xl ${triggerMorphHideClass}`}>
              <LightboxTriggerImage src={img.thumb} alt={img.alt} />
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

      <section className="mt-6 w-full max-w-2xl rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
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
    </ExampleShell>
  );
}
