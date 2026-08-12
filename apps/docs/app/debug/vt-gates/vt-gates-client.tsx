'use client';

import * as React from 'react';
import Image from 'next/image';
import { Lightbox } from 'ramka';
import { Check, Copy } from 'lucide-react';

import {
  LightboxGallery,
  triggerFocusClass,
  type LightboxGalleryItem,
} from '../../_components/lightbox-chrome';
import { docsHeroA, docsHeroB, docsHeroC } from '../../(docs)/docs/lightbox/images.generated';

// Mirrors packages/ramka/src/lightbox/lightbox-context.tsx — keep in sync.
const LOW_END_MEMORY_GIB = 4;
const LOW_END_CORE_COUNT = 4;

const GALLERY: LightboxGalleryItem[] = [
  { id: 'vt-a', src: docsHeroA, thumb: docsHeroA, alt: 'Mountain ridge', caption: 'Mountain ridge' },
  { id: 'vt-b', src: docsHeroB, thumb: docsHeroB, alt: 'Coastal path', caption: 'Coastal path' },
  { id: 'vt-c', src: docsHeroC, thumb: docsHeroC, alt: 'Forest light', caption: 'Forest light' },
];

type GateProbe = {
  capturedAt: string;
  ua: string;
  hasStartViewTransition: boolean;
  prefersReducedMotion: boolean;
  deviceMemory: number | null;
  hardwareConcurrency: number | null;
  isLowEndByRamkaHeuristic: boolean;
  lowEndReason: string | null;
  ramkaWouldUseVT: boolean;
  verdict: string;
  dpr: number;
  screen: [number, number];
  inner: [number, number];
  visualViewport: {
    width: number;
    height: number;
    scale: number;
    offsetLeft: number;
    offsetTop: number;
  } | null;
  connection: {
    effectiveType?: string;
    saveData?: boolean;
  } | null;
};

type LogEntry = {
  id: number;
  at: string;
  kind: string;
  body: unknown;
};

function collectGates(): GateProbe {
  const deviceMemory =
    typeof navigator !== 'undefined'
      ? ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null)
      : null;
  const hardwareConcurrency =
    typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? null) : null;

  let lowEndReason: string | null = null;
  let isLowEndByRamkaHeuristic = false;
  if (typeof deviceMemory === 'number' && deviceMemory < LOW_END_MEMORY_GIB) {
    isLowEndByRamkaHeuristic = true;
    lowEndReason = `deviceMemory ${deviceMemory} < ${LOW_END_MEMORY_GIB}`;
  } else if (typeof hardwareConcurrency === 'number' && hardwareConcurrency < LOW_END_CORE_COUNT) {
    isLowEndByRamkaHeuristic = true;
    lowEndReason = `hardwareConcurrency ${hardwareConcurrency} < ${LOW_END_CORE_COUNT}`;
  }

  const hasStartViewTransition =
    typeof document !== 'undefined' && 'startViewTransition' in document;
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ramkaWouldUseVT = hasStartViewTransition && !prefersReducedMotion && !isLowEndByRamkaHeuristic;

  let verdict: string;
  if (!hasStartViewTransition) {
    verdict = 'SKIP — document.startViewTransition is missing';
  } else if (prefersReducedMotion) {
    verdict =
      'SKIP — prefers-reduced-motion: reduce (check Android Accessibility → Remove animations, or Developer options animation scales)';
  } else if (isLowEndByRamkaHeuristic) {
    verdict = `SKIP — ramka isLowEndDevice() (${lowEndReason})`;
  } else {
    verdict = 'PASS — ramka should call startViewTransition on open/close';
  }

  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean };
  };
  const connection = nav.connection
    ? {
        effectiveType: nav.connection.effectiveType,
        saveData: nav.connection.saveData,
      }
    : null;

  const vv = window.visualViewport;

  return {
    capturedAt: new Date().toISOString(),
    ua: navigator.userAgent,
    hasStartViewTransition,
    prefersReducedMotion,
    deviceMemory,
    hardwareConcurrency,
    isLowEndByRamkaHeuristic,
    lowEndReason,
    ramkaWouldUseVT,
    verdict,
    dpr: window.devicePixelRatio,
    screen: [window.screen.width, window.screen.height],
    inner: [window.innerWidth, window.innerHeight],
    visualViewport: vv
      ? {
          width: vv.width,
          height: vv.height,
          scale: vv.scale,
          offsetLeft: vv.offsetLeft,
          offsetTop: vv.offsetTop,
        }
      : null,
    connection,
  };
}

function formatEntry(entry: LogEntry): string {
  const body =
    typeof entry.body === 'string' ? entry.body : JSON.stringify(entry.body, null, 2);
  return `[${entry.at}] ${entry.kind}\n${body}`;
}

export function VtGatesClient() {
  const [gates, setGates] = React.useState<GateProbe | null>(null);
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [copied, setCopied] = React.useState(false);
  const logIdRef = React.useRef(0);
  const logPanelRef = React.useRef<HTMLDivElement>(null);

  const appendLog = React.useCallback((kind: string, body: unknown) => {
    const id = ++logIdRef.current;
    setLogs((prev) => [
      ...prev,
      { id, at: new Date().toISOString(), kind, body },
    ]);
  }, []);

  const refreshGates = React.useCallback(() => {
    const next = collectGates();
    setGates(next);
    appendLog('gates', next);
  }, [appendLog]);

  React.useEffect(() => {
    // Pin the document scroller for the lifetime of this page so lightbox
    // scroll-lock / focus restore can't jump an underlying scroll position.
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    (window as unknown as Record<string, unknown>).__RAMKA_VT_DEBUG__ = true;
    refreshGates();

    const originalLog = console.log.bind(console);
    console.log = (...args: unknown[]) => {
      if (args[0] === '[ramka-vt-trace]') {
        let payload: unknown = args[1];
        if (typeof payload === 'string') {
          try {
            payload = JSON.parse(payload);
          } catch {
            // keep raw string
          }
        }
        appendLog('vt-trace', payload);
      } else if (args[0] === '[ramka-vt-composited]') {
        // Composited-upgrade decisions (upgrade committed / bail reasons).
        appendLog('vt-composited', args.slice(1));
      }
      originalLog(...args);
    };

    const onReducedMotion = () => refreshGates();
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener('change', onReducedMotion);

  const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type !== 'attributes' || !m.attributeName?.startsWith('data-ramka-')) continue;
        appendLog('html-attr', {
          attr: m.attributeName,
          value: html.getAttribute(m.attributeName),
        });
      }
    });
    observer.observe(html, {
      attributes: true,
      attributeFilter: [
        'data-ramka-view-transition',
        'data-ramka-vt-preset',
        'data-ramka-crossfade',
      ],
    });

    return () => {
      console.log = originalLog;
      mq.removeEventListener('change', onReducedMotion);
      observer.disconnect();
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [appendLog, refreshGates]);

  React.useEffect(() => {
    // Keep scroll inside the log panel — never scrollIntoView (that moves the page).
    const panel = logPanelRef.current;
    if (panel) panel.scrollTop = panel.scrollHeight;
  }, [logs]);

  const runNativeProbe = async () => {
    appendLog('native-probe', 'starting…');
    if (!('startViewTransition' in document)) {
      appendLog('native-probe', { ok: false, reason: 'startViewTransition missing' });
      return;
    }
    const t0 = performance.now();
    try {
      const transition = document.startViewTransition(() => {
        document.documentElement.dataset.ramkaVtProbe = String(Date.now());
      });
      const ready = transition.ready
        .then(() => {
          const anims = document.getAnimations().filter((a) => {
            const pseudo = (a.effect as KeyframeEffect | null)?.pseudoElement;
            return pseudo?.startsWith('::view-transition') ?? false;
          });
          return {
            ok: true as const,
            phase: 'ready',
            ms: Math.round(performance.now() - t0),
            animationCount: anims.length,
            animations: anims.slice(0, 12).map((a) => ({
              pseudo: (a.effect as KeyframeEffect | null)?.pseudoElement ?? null,
              name: (a as CSSAnimation).animationName ?? null,
              duration: a.effect?.getComputedTiming().duration ?? null,
            })),
          };
        })
        .catch((err: unknown) => ({
          ok: false as const,
          phase: 'ready-rejected',
          ms: Math.round(performance.now() - t0),
          error: String(err),
        }));

      const finished = transition.finished
        .then(() => ({
          ok: true as const,
          phase: 'finished',
          ms: Math.round(performance.now() - t0),
        }))
        .catch((err: unknown) => ({
          ok: false as const,
          phase: 'finished-rejected',
          ms: Math.round(performance.now() - t0),
          error: String(err),
        }));

      appendLog('native-probe-ready', await ready);
      appendLog('native-probe-finished', await finished);
    } catch (err) {
      appendLog('native-probe', { ok: false, error: String(err) });
    } finally {
      delete document.documentElement.dataset.ramkaVtProbe;
    }
  };

  const copyAll = async () => {
    const text = [
      '=== ramka VT gates debug ===',
      gates ? formatEntry({ id: 0, at: gates.capturedAt, kind: 'gates', body: gates }) : '(no gates)',
      '',
      '=== event log ===',
      ...logs.map(formatEntry),
    ].join('\n\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that block clipboard without a secure gesture path.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const pass = gates?.ramkaWouldUseVT === true;

  return (
    // Fixed shell: document never scrolls on open/close (scroll lock / focus /
    // log growth can't jump the page under the morph).
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background text-neutral-900 dark:text-neutral-50">
      <div className="mx-auto flex w-full max-w-3xl shrink-0 flex-col gap-3 px-4 pt-4">
        <header className="space-y-1">
          <p className="text-[11px] font-semibold tracking-widest text-amber-700 uppercase dark:text-amber-400">
            Debug · shareable
          </p>
          <h1 className="text-xl font-semibold tracking-tight">View Transition gates</h1>
          <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
            Tap a photo, close, then Copy all and send the clipboard contents.
          </p>
        </header>

        <section
          className={`rounded-lg border px-3 py-2 text-sm ${
            pass
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
              : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
          }`}
        >
          <p className="font-medium">{gates?.verdict ?? 'Collecting…'}</p>
          {gates?.lowEndReason ? (
            <p className="mt-1 text-xs opacity-80">Low-end reason: {gates.lowEndReason}</p>
          ) : null}
        </section>

        <section className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => refreshGates()}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium dark:border-neutral-700 dark:bg-neutral-900"
          >
            Re-check gates
          </button>
          <button
            type="button"
            onClick={() => void runNativeProbe()}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium dark:border-neutral-700 dark:bg-neutral-900"
          >
            Native VT probe
          </button>
          <button
            type="button"
            onClick={() => setLogs([])}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium dark:border-neutral-700 dark:bg-neutral-900"
          >
            Clear log
          </button>
        </section>

        <Lightbox.Root viewTransition scrollTriggerIntoView={null}>
          <div className="grid max-w-md grid-cols-3 gap-2">
            {GALLERY.map((img, i) => (
              <Lightbox.Trigger
                key={img.id}
                index={i}
                className={`block aspect-square overflow-hidden rounded-lg bg-transparent p-0 ${triggerFocusClass}`}
              >
                {({ imageRef }) => (
                  <Image
                    ref={imageRef}
                    src={img.thumb}
                    alt={img.alt}
                    placeholder="blur"
                    sizes="150px"
                    className="block size-full object-cover"
                  />
                )}
              </Lightbox.Trigger>
            ))}
          </div>
          <LightboxGallery items={GALLERY} ariaLabel="VT gates debug gallery" />
        </Lightbox.Root>
      </div>

      <div
        ref={logPanelRef}
        className="mx-auto mt-3 min-h-0 w-full max-w-3xl flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-24"
      >
        {gates ? (
          <section className="space-y-2">
            <h2 className="text-sm font-medium">Gate snapshot</h2>
            <pre className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-[11px] leading-relaxed whitespace-pre-wrap dark:border-neutral-800 dark:bg-neutral-950">
              {JSON.stringify(gates, null, 2)}
            </pre>
          </section>
        ) : null}

        <section className="space-y-2">
          <h2 className="text-sm font-medium">Event log ({logs.length})</h2>
          <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
            {logs.length === 0 ? (
              <p className="text-xs text-neutral-500">No events yet.</p>
            ) : (
              logs.map((entry) => (
                <pre
                  key={entry.id}
                  className="text-[11px] leading-relaxed whitespace-pre-wrap text-neutral-800 dark:text-neutral-200"
                >
                  {formatEntry(entry)}
                </pre>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="shrink-0 border-t border-neutral-200 bg-background/95 p-3 backdrop-blur dark:border-neutral-800">
        <button
          type="button"
          onClick={() => void copyAll()}
          className="mx-auto flex w-full max-w-3xl items-center justify-center gap-2 rounded-md bg-neutral-900 px-4 py-3 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" aria-hidden />
              Copied — paste into chat
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" aria-hidden />
              Copy all
            </>
          )}
        </button>
      </div>
    </div>
  );
}
