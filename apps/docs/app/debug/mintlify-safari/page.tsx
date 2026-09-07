'use client';

import { notFound } from 'next/navigation';
import * as React from 'react';
import * as Lightbox from '@ramka/react/lightbox';
import { X } from 'lucide-react';

import { lightboxChromeButton } from '../../_components/lightbox-chrome';

/**
 * Dev-only: local reproduction of the Mintlify docs implementation
 * (https://www.mintlify.com/docs/create/image-embeds) for debugging the
 * Safari pre-transition lag on open and close.
 *
 * Faithful to the client's setup:
 * - the exact same asset (bigbend.jpg, 2048×1044, single size — the trigger
 *   thumbnail and the viewer share one full-res JPEG),
 * - a `display: contents` trigger button wrapping a plain `<img>`,
 * - the Frame wrapper (grid pattern + mask-image gradient behind the image),
 * - sticky chrome with `backdrop-filter` in the viewport (root snapshot cost),
 * - a long scrollable prose page.
 *
 * The HUD patches `document.startViewTransition` and logs, per interaction:
 * click → destination <img>.complete at mount (Safari reports `false` for
 * cached images; Chrome `true`) → startViewTransition call (the gap before it
 * is ramka's prepare + decode wait) → VT `ready` (capture + pseudo-tree cost)
 * → `finished`. WebKit's Core Animation first-commit latency (~100ms) happens
 * AFTER `ready` on the compositor and is invisible to JS — compare a screen
 * recording against the `ready` timestamp to see it.
 */

const IMG_SRC = '/debug/bigbend.jpg';
const IMG_W = 2048;
const IMG_H = 1044;
const IMG_ALT = 'Big Bend landscape with purple flowers, mountains and blue sky';

// ---------------------------------------------------------------------------
// Style-recalc bench
//
// Reproduces the document-level writes `applyMorphState` performs on <html>
// right before every open/close `startViewTransition`, and measures the
// forced style flush each one causes — in isolation. The flip of
// `data-ramka-view-transition` arms the injected isolation rule
// (`:root[…] * { view-transition-name: none !important }`) and the inherited
// `--lightbox-*` custom properties invalidate every element too, so both are
// O(document size). Run with the heavy-DOM toggle on/off and in Safari vs
// Chrome to attribute the pre-transition stagger.
// ---------------------------------------------------------------------------

const MORPH_DOC_ATTR = 'data-ramka-view-transition';

/** The inline vars applyMorphState writes on <html> (snappy-preset values). */
const MORPH_DOC_VARS: ReadonlyArray<readonly [string, string]> = [
  ['--lightbox-vt-duration', '340ms'],
  ['--lightbox-vt-easing', 'cubic-bezier(0.38, 0.66, 0, 1)'],
  ['--lightbox-vt-crossfade-close-easing', 'cubic-bezier(0.22, 0, 0.35, 1)'],
  ['--lightbox-vt-root-easing', 'cubic-bezier(0.16, 1, 0.3, 1)'],
  ['--lightbox-morph-old-opacity', '1'],
  ['--lightbox-morph-new-opacity', '1'],
  ['--lightbox-morph-border-radius-from', '12px'],
  ['--lightbox-morph-border-radius-to', '0px'],
];

/** Locate the injected isolation rule so the bench can A/B without it. */
function findIsolationRule(): { sheet: CSSStyleSheet; index: number; cssText: string } | null {
  const sheets = [
    ...(document.adoptedStyleSheets ?? []),
    ...Array.from(document.styleSheets),
  ];
  for (const sheet of sheets) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin
    }
    for (let i = 0; i < rules.length; i++) {
      const text = rules[i]!.cssText;
      if (text.includes(MORPH_DOC_ATTR) && text.includes('view-transition-name')) {
        return { sheet: sheet as CSSStyleSheet, index: i, cssText: text };
      }
    }
  }
  return null;
}

function runStyleRecalcBench(log: (text: string, strong?: boolean) => void) {
  const docEl = document.documentElement;
  const flush = () => void docEl.offsetWidth;
  const median = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

  const time = (apply: () => void, cleanup: () => void): number => {
    const samples: number[] = [];
    for (let i = 0; i < 7; i++) {
      flush();
      const t0 = performance.now();
      apply();
      flush(); // pays the invalidated recalc
      samples.push(performance.now() - t0);
      cleanup();
      flush();
    }
    return median(samples);
  };

  const fmt = (ms: number) => `${ms.toFixed(2)}ms`;
  const setVars = () => {
    for (const [k, v] of MORPH_DOC_VARS) docEl.style.setProperty(k, v);
  };
  const clearVars = () => {
    for (const [k] of MORPH_DOC_VARS) docEl.style.removeProperty(k);
  };
  const setAttr = () => docEl.setAttribute(MORPH_DOC_ATTR, 'opening');
  const clearAttr = () => docEl.removeAttribute(MORPH_DOC_ATTR);

  log(`— bench: ${document.getElementsByTagName('*').length} elements —`, true);

  log(
    `control attr (no matching rules): ${fmt(
      time(() => docEl.setAttribute('data-vt-bench', ''), () => docEl.removeAttribute('data-vt-bench')),
    )}`,
  );
  log(`${MORPH_DOC_ATTR} flip (isolation rule armed): ${fmt(time(setAttr, clearAttr))}`, true);
  log(`inherited custom props only (×${MORPH_DOC_VARS.length}): ${fmt(time(setVars, clearVars))}`, true);
  log(
    `attr + props (= applyMorphState): ${fmt(
      time(
        () => {
          setAttr();
          setVars();
        },
        () => {
          clearAttr();
          clearVars();
        },
      ),
    )}`,
    true,
  );

  const iso = findIsolationRule();
  if (!iso) {
    log('isolation rule not found — open/close the lightbox once, then re-run');
    return;
  }
  iso.sheet.deleteRule(iso.index);
  try {
    log(`${MORPH_DOC_ATTR} flip with isolation rule REMOVED: ${fmt(time(setAttr, clearAttr))}`, true);
  } finally {
    iso.sheet.insertRule(iso.cssText, iso.index);
  }
}

// ---------------------------------------------------------------------------
// Timing HUD
// ---------------------------------------------------------------------------

interface LogEntry {
  id: number;
  text: string;
  strong?: boolean;
}

function useVtTimingLog() {
  const [entries, setEntries] = React.useState<LogEntry[]>([]);
  const idRef = React.useRef(0);
  const t0Ref = React.useRef<number | null>(null);

  const log = React.useCallback((text: string, strong = false) => {
    setEntries((prev) => [...prev.slice(-39), { id: ++idRef.current, text, strong }]);
  }, []);

  const stamp = React.useCallback(
    (label: string, strong = false) => {
      const t0 = t0Ref.current;
      const delta = t0 == null ? null : Math.round(performance.now() - t0);
      log(delta == null ? label : `+${delta}ms  ${label}`, strong);
    },
    [log],
  );

  React.useEffect(() => {
    // t0 = the click that ramka reacts to (open) or Escape keydown (close).
    const onClick = () => {
      t0Ref.current = performance.now();
      // Runs after React's own (synchronous) click work: if a VT open just
      // started, the destination tree is already prepare-mounted. Whether the
      // freshly-mounted destination <img> reports `complete` is the
      // Safari-vs-Chrome decode-wait discriminator.
      queueMicrotask(() => {
        const img = document.querySelector<HTMLImageElement>('[data-ramka-media] img');
        if (img) {
          stamp(
            `destination <img> at mount: complete=${img.complete} naturalWidth=${img.naturalWidth}`,
          );
        }
      });
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        t0Ref.current = performance.now();
        log('— Escape (close intent) —', true);
      }
    };
    window.addEventListener('click', onClick);
    window.addEventListener('keydown', onKeyDown, true);

    // Phase attribute flips right before startViewTransition (applyMorphState).
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName !== 'data-ramka-view-transition') continue;
        const value = document.documentElement.getAttribute('data-ramka-view-transition');
        if (value) stamp(`morph state applied (${value})`);
      }
    });
    observer.observe(document.documentElement, { attributes: true });

    // Patch startViewTransition to time the capture pipeline.
    const doc = document as Document & {
      startViewTransition?: (cb: () => void | Promise<void>) => {
        ready: Promise<void>;
        finished: Promise<void>;
      };
    };
    const original = doc.startViewTransition?.bind(document);
    if (original) {
      doc.startViewTransition = (cb: () => void | Promise<void>) => {
        stamp('startViewTransition() called (old capture begins)', true);
        const vt = original(() => {
          stamp('VT update callback (reveal/commit)');
          return cb();
        });
        vt.ready.then(
          () => stamp('VT ready — pseudos live, animation may start', true),
          () => stamp('VT ready REJECTED (transition skipped!)', true),
        );
        vt.finished.then(
          () => stamp('VT finished'),
          () => stamp('VT finished (rejected)'),
        );
        return vt;
      };
    }

    return () => {
      window.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKeyDown, true);
      observer.disconnect();
      if (original) doc.startViewTransition = original;
    };
  }, [log, stamp]);

  return { entries, log };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface RepConfig {
  /** Mintlify styles the trigger button `display: contents`. */
  triggerContents: boolean;
  /** Wire `morphRef` to the <img> (vs. default: the trigger root morphs). */
  morphRefOnImg: boolean;
  /** Root `awaitImageDecode` (the ≤200ms pre-VT decode wait). */
  awaitImageDecode: boolean;
  /** Sticky backdrop-blur chrome in the viewport (root snapshot raster cost). */
  blurChrome: boolean;
  /**
   * Mintlify-scale DOM: a fixed sidebar with thousands of nav links. The
   * morph flips `data-ramka-view-transition` on <html> and the injected
   * isolation rule (`* { view-transition-name: none }`) plus the inherited
   * `--lightbox-vt-*` custom-property writes invalidate style for EVERY
   * element — twice per morph, on open AND close, synchronously inside the
   * capture window. Cost is proportional to DOM size, so a minimal page
   * never shows it.
   */
  heavyDom: boolean;
}

const HEAVY_DOM_LINKS = 4000;

const FILLER = [
  'Add images to provide visual context, examples, or decoration to your documentation. Use Markdown syntax to add images to your documentation pages, and always include descriptive alt text to improve accessibility and SEO.',
  'Image paths are root-relative from your docs repository. For example, if your image is at images/screenshot.png in your repository, the path is /images/screenshot.png. Relative paths are not supported in this configuration.',
  'For more control over image display, use HTML img tags with JSX inline styles. You can resize images, disable the default zoom on click, wrap them in anchor tags to make them clickable, or add copy and download controls as an overlay.',
  'Image files must be less than 20 MB. For larger files, host them on a CDN service. SVG files that use foreignObject elements render differently in production than in local development, since the image CDN strips foreignObject from SVGs as a security measure.',
  'To display different images for light and dark themes, use utility classes: render the light-mode image with block dark:hidden and the dark-mode image with hidden dark:block so exactly one is visible per theme.',
  'Embed YouTube videos using iframe elements, or use the HTML video element for self-hosted video content. When using JSX syntax, write double-word attributes in camelCase: autoPlay, playsInline, allowFullScreen.',
];

export default function MintlifySafariDebugPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const [config, setConfig] = React.useState<RepConfig>({
    triggerContents: true,
    morphRefOnImg: true,
    awaitImageDecode: true,
    blurChrome: true,
    heavyDom: false,
  });
  const { entries, log } = useVtTimingLog();

  const toggle = (key: keyof RepConfig) => {
    setConfig((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      log(`— config: ${key} → ${String(next[key])} (Root remounted) —`, true);
      return next;
    });
  };

  // Remount the Root whenever config changes so every run starts clean.
  const rootKey = JSON.stringify(config);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mintlify-style sticky chrome: backdrop blur sits in the viewport and
          gets rasterized into every VT root snapshot. */}
      <header
        className={
          'sticky top-0 z-20 border-b border-black/10 dark:border-white/10 ' +
          (config.blurChrome
            ? 'bg-white/60 backdrop-blur-xl backdrop-saturate-150 dark:bg-neutral-900/60'
            : 'bg-white dark:bg-neutral-900')
        }
      >
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6 text-sm">
          <span className="font-medium">Mintlify Safari lag repro</span>
          <span className="text-neutral-500">
            open: click image · close: Esc / ✕ / pull
          </span>
        </div>
      </header>

      {/* Mintlify-scale nav DOM. Visually a plain sidebar; its purpose is the
          element COUNT — every one of these nodes gets style-invalidated by
          the documentElement attribute flip + custom-property writes that
          bracket each morph. */}
      {config.heavyDom && (
        <nav
          aria-label="Fake docs navigation"
          className="fixed bottom-0 left-0 top-14 z-10 hidden w-56 overflow-y-auto border-r border-black/10 p-3 text-xs text-neutral-500 md:block dark:border-white/10"
        >
          <ul>
            {Array.from({ length: HEAVY_DOM_LINKS }, (_, i) => (
              <li key={i} className="truncate">
                <a href="#images" className="block rounded px-2 py-0.5 hover:bg-black/5">
                  <span className="font-medium">Section {Math.floor(i / 40)}</span>
                  <span> · page-{i}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-4 text-2xl font-semibold">Images and embeds</h1>

        {/* Config toggles — each remounts the Root. */}
        <fieldset className="mb-8 grid grid-cols-2 gap-2 rounded-lg border border-black/10 p-4 text-sm dark:border-white/10">
          <legend className="px-1 text-xs uppercase tracking-wide text-neutral-500">
            Repro config
          </legend>
          {(
            [
              ['triggerContents', 'Trigger display: contents (Mintlify)'],
              ['morphRefOnImg', 'morphRef → <img>'],
              ['awaitImageDecode', 'awaitImageDecode (≤200ms)'],
              ['blurChrome', 'backdrop-blur sticky chrome'],
              ['heavyDom', `heavy DOM (${HEAVY_DOM_LINKS}-link sidebar)`],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={config[key]} onChange={() => toggle(key)} />
              {label}
            </label>
          ))}
          <button
            type="button"
            onClick={() => runStyleRecalcBench(log)}
            className="col-span-2 mt-1 justify-self-start rounded border border-black/20 px-3 py-1 font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5"
          >
            Run style-recalc bench
          </button>
        </fieldset>

        {FILLER.slice(0, 3).map((p) => (
          <p key={p.slice(0, 24)} className="mb-5 leading-7 text-neutral-700 dark:text-neutral-300">
            {p}
          </p>
        ))}

        <Lightbox.Root key={rootKey} viewTransition awaitImageDecode={config.awaitImageDecode}>
          {/* Mintlify Frame: padded card, grid pattern + mask gradient overlay. */}
          <div className="not-prose relative overflow-hidden rounded-2xl bg-gray-50/50 p-2 dark:bg-gray-800/25">
            <div
              className="absolute inset-0 bg-[radial-gradient(rgba(0,0,0,0.14)_1px,transparent_1px)] bg-size-[12px_12px] mask-[linear-gradient(0deg,#fff,rgba(255,255,255,0.6))] dark:bg-[radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)]"
              style={{ backgroundPosition: '10px 10px' }}
            />
            <div className="relative flex justify-center overflow-hidden rounded-xl">
              <Lightbox.Trigger
                index={0}
                aria-label="Expand image"
                className={
                  config.triggerContents
                    ? 'contents cursor-pointer'
                    : 'block cursor-zoom-in border-0 bg-transparent p-0'
                }
              >
                {({ imageRef, morphRef }) => (
                  <span className="contents">
                    <img
                      ref={(node) => {
                        imageRef(node);
                        if (config.morphRefOnImg) morphRef(node);
                      }}
                      src={IMG_SRC}
                      alt={IMG_ALT}
                      width={IMG_W}
                      height={IMG_H}
                      loading="eager"
                      draggable={false}
                      className="rounded-xl select-none"
                    />
                  </span>
                )}
              </Lightbox.Trigger>
            </div>
            <div className="pointer-events-none absolute inset-0 rounded-2xl border border-black/5 dark:border-white/5" />
          </div>

          <Lightbox.Portal>
            <Lightbox.Backdrop className="lightbox-demo-backdrop fixed inset-0" />
            <Lightbox.Content
              aria-label="Image viewer"
              className="lightbox-demo-content fixed inset-0 flex flex-col overscroll-contain outline-none"
            >
              <Lightbox.Slides aria-label="Images" className="lightbox-demo-slides flex-1">
                <Lightbox.Slide className="h-full">
                  <Lightbox.Item index={0}>
                    <Lightbox.Zoom>
                      <Lightbox.Media width={IMG_W} height={IMG_H}>
                        {/* Same single full-res asset as the trigger — exactly
                            like the Mintlify page (no size variants). */}
                        <img
                          src={IMG_SRC}
                          alt={IMG_ALT}
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
                  <X aria-hidden className="h-4.5 w-4.5" strokeWidth={2.25} />
                </Lightbox.Close>
              </div>
            </Lightbox.Content>
          </Lightbox.Portal>
        </Lightbox.Root>

        {FILLER.slice(3).map((p) => (
          <p key={p.slice(0, 24)} className="mt-5 leading-7 text-neutral-700 dark:text-neutral-300">
            {p}
          </p>
        ))}
        {/* Extra filler so the page scrolls like a real docs page. */}
        {Array.from({ length: 3 }, (_, i) => (
          <React.Fragment key={i}>
            {FILLER.map((p, j) => (
              <p key={j} className="mt-5 leading-7 text-neutral-700 dark:text-neutral-300">
                {p}
              </p>
            ))}
          </React.Fragment>
        ))}
      </main>

      {/* Timing HUD */}
      <aside
        aria-label="View transition timing log"
        className="fixed bottom-3 left-3 z-50 max-h-[45vh] w-[min(30rem,calc(100vw-1.5rem))] overflow-y-auto rounded-lg border border-black/10 bg-white/90 p-3 font-mono text-[11px] leading-4 shadow-lg backdrop-blur dark:border-white/10 dark:bg-neutral-900/90"
      >
        <div className="mb-1 flex items-baseline justify-between">
          <strong>VT timing (Δ from click / Esc)</strong>
        </div>
        {entries.length === 0 ? (
          <p className="text-neutral-500">Click the image to start logging.</p>
        ) : (
          <ol>
            {entries.map((entry) => (
              <li key={entry.id} className={entry.strong ? 'font-bold' : undefined}>
                {entry.text}
              </li>
            ))}
          </ol>
        )}
        <p className="mt-2 text-neutral-500">
          Note: WebKit&apos;s Core Animation first-commit latency happens after &quot;VT
          ready&quot; on the compositor — it never shows up in these timestamps. Compare a
          screen recording to the ready mark to measure it.
        </p>
      </aside>
    </div>
  );
}
