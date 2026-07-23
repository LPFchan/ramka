'use client';

import * as React from 'react';
import { MapPin, Maximize2 } from 'lucide-react';
import { Lightbox } from 'ramka';

import { ExampleShell } from '../../../_components/example-shell';
import {
  LightboxCloseButton,
  LightboxOverlay,
  morphHideClass,
  triggerFocusClass,
} from '../../../_components/lightbox-chrome';

/**
 * Wrocław Market Square (Rynek) — same center in the trigger preview and the
 * fullscreen lightbox so the morph reads as “expand this map”.
 */
const WROCLAW = {
  name: 'Wrocław',
  place: 'Rynek, Wrocław, Poland',
  region: 'Lower Silesia, Poland',
  lat: 51.1097,
  lng: 17.0327,
  previewZoom: 14,
  fullscreenZoom: 15,
};

function googleMapsEmbedUrl(zoom: number) {
  const q = encodeURIComponent(`${WROCLAW.lat},${WROCLAW.lng}`);
  return `https://www.google.com/maps?q=${q}&z=${zoom}&hl=en&output=embed`;
}

/**
 * Resolve when the iframe has loaded (or already did — keepMounted reopen),
 * aborts, or hits `timeoutMs`. Cross-origin embeds don't expose
 * `contentDocument`, so readiness is tracked via `onLoad` → `readyRef`.
 */
function waitForIframeLoad(
  iframe: HTMLIFrameElement | null,
  {
    signal,
    timeoutMs,
    readyRef,
  }: {
    signal: AbortSignal;
    timeoutMs: number;
    readyRef: React.MutableRefObject<boolean>;
  },
): Promise<void> {
  if (!iframe || signal.aborted || readyRef.current) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      iframe.removeEventListener('load', onLoad);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const onLoad = () => {
      readyRef.current = true;
      finish();
    };
    const timer = setTimeout(finish, timeoutMs);
    iframe.addEventListener('load', onLoad, { once: true });
    signal.addEventListener('abort', finish, { once: true });
  });
}

function MapFrame({
  zoom,
  title,
  interactive,
  className,
  iframeRef,
  onLoad,
}: {
  zoom: number;
  title: string;
  interactive: boolean;
  className?: string;
  iframeRef?: React.Ref<HTMLIFrameElement>;
  onLoad?: () => void;
}) {
  return (
    <iframe
      ref={iframeRef}
      title={title}
      src={googleMapsEmbedUrl(zoom)}
      // Destination iframe must not be lazy — keepMounted parks it hidden and
      // `onBeforeOpen` waits for `load`; lazy would stall until reveal/timeout.
      loading={interactive ? 'eager' : 'lazy'}
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
      className={className}
      onLoad={onLoad}
      // Preview must not steal clicks from the Trigger; fullscreen needs gestures.
      style={interactive ? undefined : { pointerEvents: 'none' }}
    />
  );
}

export default function GoogleMapsExamplePage() {
  const mapIframeRef = React.useRef<HTMLIFrameElement>(null);
  const mapIframeReadyRef = React.useRef(false);

  return (
    <ExampleShell
      title="Google Maps"
      docsHref="/docs/lightbox/state-lifecycle#before-open"
      docsLabel="State & lifecycle → onBeforeOpen"
      description={
        <>
          A map preview of Wrocław’s Rynek morphs into a fullscreen Google Map.{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">Portal keepMounted</code>{' '}
          parks the destination iframe so reopen stays warm (with{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">z-[1]</code> on the portal
          host); <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">onBeforeOpen</code>{' '}
          waits for the first{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">load</code> (with a timeout)
          before the View Transition — with{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">
            awaitImageDecode={'{false}'}
          </code>
          .{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">
            pullToClose={'{false}'}
          </code>{' '}
          keeps pan/zoom on the map;{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">
            crossfade=&quot;both&quot;
          </code>{' '}
          dissolves the dissimilar snapshots.
        </>
      }
    >
      <Lightbox.Root
        morphTo="origin"
        awaitImageDecode={false}
        onBeforeOpen={({ signal }) =>
          waitForIframeLoad(mapIframeRef.current, {
            signal,
            timeoutMs: 2000,
            readyRef: mapIframeReadyRef,
          })
        }
      >
        <div className="mx-auto max-w-lg">
          <div className="mb-5">
            <h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Visit us</h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Open the map to explore Wrocław in fullscreen.
            </p>
          </div>

          <Lightbox.Trigger
            index={0}
            crossfade="both"
            className={`group block w-full cursor-pointer rounded-2xl border border-neutral-200 bg-white p-0 text-left shadow-sm dark:border-neutral-800 dark:bg-neutral-950 ${triggerFocusClass}`}
          >
            {({ morphRef }) => (
              <>
                <div
                  ref={morphRef}
                  className={`relative aspect-[4/3] w-full overflow-hidden rounded-t-2xl ${morphHideClass}`}
                >
                  <MapFrame
                    zoom={WROCLAW.previewZoom}
                    title={`Map preview — ${WROCLAW.place}`}
                    interactive={false}
                    className="absolute inset-0 size-full border-0"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/55 to-transparent px-3 pb-3 pt-10">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-neutral-900">
                      <Maximize2 aria-hidden className="size-3.5" strokeWidth={2.25} />
                      Expand map
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-3 px-4 py-3.5">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400">
                    <MapPin aria-hidden className="size-4" strokeWidth={2.25} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{WROCLAW.name}</div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">{WROCLAW.place}</div>
                    <div className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">{WROCLAW.region}</div>
                  </div>
                </div>
              </>
            )}
          </Lightbox.Trigger>
        </div>

        <Lightbox.Portal keepMounted className="relative z-[1]">
          <LightboxOverlay />
          <Lightbox.Content
            aria-label={`Fullscreen map — ${WROCLAW.place}`}
            pullToClose={false}
            className="lightbox-demo-content fixed inset-0 overscroll-contain bg-neutral-950 outline-none"
          >
            <LightboxCloseButton />
            <Lightbox.Item index={0} className="absolute inset-0">
              {({ morphRef }) => (
                <div ref={morphRef} className="absolute inset-0 overflow-hidden">
                  <MapFrame
                    iframeRef={mapIframeRef}
                    zoom={WROCLAW.fullscreenZoom}
                    title={`Interactive map — ${WROCLAW.place}`}
                    interactive
                    className="absolute inset-0 size-full border-0"
                    onLoad={() => {
                      mapIframeReadyRef.current = true;
                    }}
                  />
                </div>
              )}
            </Lightbox.Item>
          </Lightbox.Content>
        </Lightbox.Portal>
      </Lightbox.Root>
    </ExampleShell>
  );
}
