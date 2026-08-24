'use client';

import { ChevronLeft, ChevronRight, Minus, Plus, X } from 'lucide-react';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import * as React from 'react';
import * as Lightbox from 'ramka/lightbox';

import { lightboxImageFiles } from '../../../_data/images.generated';

/**
 * Dev-only: the composition most galleries actually ship — a morphing,
 * swipeable, zoomable viewer with chrome. It leaves out only the parts that are
 * genuinely optional (Backdrop, Stage, Caption, thumbnails), so it is the
 * realistic floor for a full-featured lightbox rather than a stripped demo.
 *
 * Both lazy engines are exercised here: the morph loads because
 * `viewTransition` is left at its default, and zoom loads because Zoom is
 * mounted. Everything else is nearly free — Slides/Slide are layout, and the
 * chrome parts read Root's state and render one element each.
 *
 * The audit panel scans for every `data-ramka-*` marker in
 * `LIGHTBOX_PART_IDENTITY_ATTRIBUTES`, so a part mounting something extra shows
 * up as a failing check rather than quietly changing what this page documents.
 * `scripts/probe-consumer.mjs` measures the same set as
 * "minimal-composition page".
 */

/** Explicit rather than relying on the Slides default, so the audit can check it. */
const PRELOAD = 1;

/** Root renders no host element, so it has no marker to scan for. */
const COMPOSITION = [
  Lightbox.LightboxTriggerDataAttributes.trigger,
  Lightbox.LightboxPortalDataAttributes.portal,
  Lightbox.LightboxContentDataAttributes.content,
  Lightbox.LightboxSlidesDataAttributes.slides,
  Lightbox.LightboxSlideDataAttributes.slide,
  Lightbox.LightboxItemDataAttributes.item,
  Lightbox.LightboxMediaDataAttributes.media,
  Lightbox.LightboxZoomDataAttributes.host,
  Lightbox.LightboxZoomInDataAttributes.zoomIn,
  Lightbox.LightboxZoomOutDataAttributes.zoomOut,
  Lightbox.LightboxPreviousDataAttributes.previous,
  Lightbox.LightboxNextDataAttributes.next,
  Lightbox.LightboxCounterDataAttributes.counter,
  Lightbox.LightboxCloseDataAttributes.close,
] as string[];

const partName = (attribute: string) => attribute.replace('data-ramka-', '');

// The three lazily-imported engines, named after the modules the loaders
// `import()` — see lightbox-{morph,zoom,pull}-loader.ts. Pull is tracked only so
// the request list below is not silently incomplete.
const MORPH_CHUNK = /lightbox-morph-runtime/;
const ZOOM_CHUNK = /lightbox-zoom-runtime/;
const ENGINE_CHUNK = /lightbox-(morph|zoom|pull)-runtime/;

type Check = {
  id: string;
  label: string;
  /** `null` when the environment cannot answer — neither pass nor fail. */
  pass: boolean | null;
  detail: string;
};

type Audit = {
  counts: { attribute: string; count: number }[];
  engineRequests: string[];
  checks: Check[];
  failed: number;
};

function engineRequests(): string[] {
  if (typeof performance === 'undefined' || !performance.getEntriesByType) return [];
  return performance
    .getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((name) => ENGINE_CHUNK.test(name))
    .map((name) => name.replace(/^.*\/static\//, 'static/').replace(/\?.*$/, ''));
}

function runAudit(itemCount: number, activeIndex: number): Audit {
  const count = (attribute: string) => document.querySelectorAll(`[${attribute}]`).length;
  const counts = Lightbox.LIGHTBOX_PART_IDENTITY_ATTRIBUTES.map((attribute) => ({
    attribute: attribute as string,
    count: count(attribute),
  }));

  const present = counts.filter((c) => c.count > 0).map((c) => c.attribute);
  const unexpected = present.filter((a) => !COMPOSITION.includes(a));
  const missing = COMPOSITION.filter((a) => !present.includes(a));

  const content = document.querySelector(`[${Lightbox.LightboxContentDataAttributes.content}]`);
  const counter = document.querySelector(`[${Lightbox.LightboxCounterDataAttributes.counter}]`);
  const activeItem = document.querySelector(
    `[${Lightbox.LightboxItemDataAttributes.item}][${Lightbox.LightboxItemDataAttributes.active}]`,
  );

  const role = activeItem?.getAttribute('role') ?? '';
  const roleDescription = activeItem?.getAttribute('aria-roledescription') ?? '';
  const itemLabel = activeItem?.getAttribute('aria-label') ?? '';
  const contentName = content?.getAttribute('aria-label') ?? content?.getAttribute('aria-labelledby') ?? '';

  const requests = engineRequests();
  const morphFetched = requests.filter((r) => MORPH_CHUNK.test(r));
  const zoomFetched = requests.filter((r) => ZOOM_CHUNK.test(r));

  // Only meaningful once *some* engine chunk has been seen — otherwise this
  // build does not surface them as separate resources and the absence of a
  // morph request proves nothing.
  const enginesVisible = requests.length > 0;

  const isDisabled = (part: string, flag: string) => Boolean(document.querySelector(`[${part}][${flag}]`));
  const prevDisabled = isDisabled(
    Lightbox.LightboxPreviousDataAttributes.previous,
    Lightbox.LightboxPreviousDataAttributes.disabled,
  );
  const nextDisabled = isDisabled(
    Lightbox.LightboxNextDataAttributes.next,
    Lightbox.LightboxNextDataAttributes.disabled,
  );
  const zoomInDisabled = isDisabled(
    Lightbox.LightboxZoomInDataAttributes.zoomIn,
    Lightbox.LightboxZoomInDataAttributes.disabled,
  );
  const zoomOutDisabled = isDisabled(
    Lightbox.LightboxZoomOutDataAttributes.zoomOut,
    Lightbox.LightboxZoomOutDataAttributes.disabled,
  );

  const slideBoxes = count(Lightbox.LightboxSlideDataAttributes.slide);
  const mountedItems = count(Lightbox.LightboxItemDataAttributes.item);
  const withinPreload = Array.from({ length: itemCount }, (_, i) => i).filter(
    (i) => Math.abs(i - activeIndex) <= PRELOAD,
  ).length;

  const checks: Check[] = [
    {
      id: 'only-composition',
      label: 'No part outside the composition is mounted',
      pass: unexpected.length === 0,
      detail:
        unexpected.length === 0
          ? `${present.length} of ${counts.length} markers present`
          : `unexpected: ${unexpected.map(partName).join(', ')}`,
    },
    {
      id: 'all-present',
      label: `All ${COMPOSITION.length} DOM-rendering parts are mounted (Root is context-only)`,
      pass: missing.length === 0,
      detail:
        missing.length === 0 ? COMPOSITION.map(partName).join(', ') : `missing: ${missing.map(partName).join(', ')}`,
    },
    {
      id: 'morph-fetch',
      label: 'The morph engine is fetched, because viewTransition is on',
      pass: enginesVisible ? morphFetched.length > 0 : null,
      detail: enginesVisible
        ? morphFetched.length > 0
          ? morphFetched.join(', ')
          : 'no morph chunk seen — unsupported browser, a low-end device, or stale patterns'
        : 'this build does not emit engines as separate resources',
    },
    {
      id: 'zoom-fetch',
      label: 'The zoom engine is fetched, because Zoom is mounted',
      pass: enginesVisible ? zoomFetched.length > 0 : null,
      detail: enginesVisible
        ? zoomFetched.length > 0
          ? zoomFetched.join(', ')
          : 'no zoom chunk seen — the patterns above may be stale'
        : 'this build does not emit engines as separate resources',
    },
    {
      id: 'slides-preload',
      label: 'Slides keeps every slide box mounted but only preloads neighbours',
      pass: slideBoxes === itemCount && mountedItems === withinPreload,
      detail: `${slideBoxes} slide boxes, ${mountedItems} items mounted (preload ${PRELOAD} around index ${activeIndex} → ${withinPreload})`,
    },
    {
      id: 'item-aria',
      label: 'Item is a standalone carousel slide, not an orphaned tabpanel',
      pass: role === 'group' && roleDescription === 'slide' && /^\d+ of \d+$/.test(itemLabel),
      detail: activeItem
        ? `role=${role || '—'} roledescription=${roleDescription || '—'} label=${itemLabel || '—'}`
        : 'no active item in the DOM',
    },
    {
      id: 'dialog',
      label: 'Content is a modal dialog with an accessible name',
      pass:
        content?.getAttribute('role') === 'dialog' &&
        content?.getAttribute('aria-modal') === 'true' &&
        contentName.length > 0,
      detail: content
        ? `role=${content.getAttribute('role') ?? '—'} aria-modal=${content.getAttribute('aria-modal') ?? '—'} name=${contentName || '—'}`
        : 'Content not in the DOM',
    },
    {
      id: 'nav-bounds',
      label: 'Previous / Next disable themselves at the ends',
      pass: prevDisabled === (activeIndex === 0) && nextDisabled === (activeIndex === itemCount - 1),
      detail: `index ${activeIndex} of ${itemCount - 1} — previous ${prevDisabled ? 'disabled' : 'enabled'}, next ${nextDisabled ? 'disabled' : 'enabled'}`,
    },
    {
      id: 'counter',
      label: 'Counter tracks the active index and announces politely',
      pass:
        counter?.textContent?.trim() === `${activeIndex + 1} / ${itemCount}` &&
        counter?.getAttribute('aria-live') === 'polite',
      detail: counter
        ? `"${counter.textContent?.trim()}" aria-live=${counter.getAttribute('aria-live') ?? '—'}`
        : 'Counter not in the DOM',
    },
    {
      id: 'zoom-bounds',
      label: 'ZoomOut is disabled at rest, ZoomIn is available',
      pass: zoomOutDisabled && !zoomInDisabled,
      detail: `zoom-in ${zoomInDisabled ? 'disabled' : 'enabled'}, zoom-out ${zoomOutDisabled ? 'disabled' : 'enabled'} — chrome tracks the active slide's Zoom`,
    },
  ];

  return {
    counts,
    engineRequests: requests,
    checks,
    failed: checks.filter((c) => c.pass === false).length,
  };
}

const BUTTON =
  'grid size-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white data-disabled:pointer-events-none data-disabled:opacity-30';
const EDGE_BUTTON = `absolute z-10 ${BUTTON}`;

/**
 * State the audit reads. The zoom chrome starts disabled and enables itself
 * once the lazy engine registers as the active zoom, so a single scan after
 * open would race it — observing these keeps the panel correct without
 * guessing a delay, and keeps it live while swiping and zooming.
 */
const AUDITED_ATTRIBUTES = ['data-disabled', 'data-active', 'data-active-index'];

export default function MinimalCompositionDebugPage() {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(0);
  const [audit, setAudit] = React.useState<Audit | null>(null);

  // The portal subtree only exists while open, so scan on open and then on any
  // mount or state-attribute change inside it. Coalesced to one scan per frame.
  React.useEffect(() => {
    if (!open) {
      setAudit(null);
      return;
    }
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setAudit(runAudit(lightboxImageFiles.length, value)));
    };
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: AUDITED_ATTRIBUTES,
    });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [open, value]);

  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400">
          Debug · development only
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Minimal composition — a full-featured viewer
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
          Morph, swipe, zoom and chrome from {COMPOSITION.length + 1} parts — {COMPOSITION.length} of the{' '}
          {Lightbox.LIGHTBOX_PART_IDENTITY_ATTRIBUTES.length} part markers, for 15.5 KB gzipped eager. This is the
          realistic floor for a gallery you would actually ship, not a stripped demo: what is left out is genuinely
          optional.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">What this costs</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
            <li>15.5 KB gz eager — only 1.2 KB more than Root/Trigger/Portal/Content/Item/Media</li>
            <li>Slides and Slide are layout; the chrome parts render one element each</li>
            <li>~11.5 KB gz fetched for the zoom engine, because Zoom is mounted</li>
            <li>~7.7 KB gz fetched for the morph engine, warmed after paint rather than on open</li>
            <li>All 22 parts would be 19.7 KB gz, so this is most of the library</li>
          </ul>
        </section>
        <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">What is left out</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
            <li>
              <strong>Backdrop</strong> — Content carries the scrim itself
            </li>
            <li>
              <strong>Caption</strong> — no per-item text
            </li>
            <li>
              <strong>ThumbnailGroup / Thumbnail / ThumbnailStrip</strong> — which is also what keeps Item a slide
              rather than a tabpanel
            </li>
            <li>
              <strong>Stage</strong> — Content is the interaction surface
            </li>
            <li>
              Drop <code className="text-xs">viewTransition</code> to <code className="text-xs">{'{false}'}</code> and
              the morph engine never reaches the network — the one cheap opt-out left
            </li>
          </ul>
        </section>
      </div>

      <div
        className={
          audit == null
            ? 'rounded-lg border border-neutral-200 px-4 py-3 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400'
            : audit.failed === 0
              ? 'rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
              : 'rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100'
        }
      >
        {audit == null ? (
          'Open the lightbox to audit the mounted parts.'
        ) : (
          <div className="space-y-2">
            <p className="font-medium">
              {audit.failed === 0 ? 'All checks passing' : `${audit.failed} check(s) failing`}
            </p>
            <ul className="space-y-1">
              {audit.checks.map((c) => (
                <li key={c.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span
                    className={
                      c.pass === null
                        ? 'text-neutral-500'
                        : c.pass
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-red-700 dark:text-red-300'
                    }
                  >
                    {c.pass === null ? '–' : c.pass ? '✓' : '✗'}
                  </span>
                  <span>{c.label}</span>
                  <span className="text-xs opacity-70">{c.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {audit ? (
        <details className="rounded-lg border border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <summary className="cursor-pointer text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Part identity scan ({Lightbox.LIGHTBOX_PART_IDENTITY_ATTRIBUTES.length} markers) and engine requests (
            {audit.engineRequests.length})
          </summary>
          <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
            {audit.counts.map(({ attribute, count }) => (
              <li key={attribute} className="flex items-baseline justify-between gap-2 text-xs">
                <code
                  className={
                    count > 0 ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-400 dark:text-neutral-600'
                  }
                >
                  {partName(attribute)}
                </code>
                <span
                  className={
                    count > 0
                      ? 'tabular-nums text-neutral-600 dark:text-neutral-400'
                      : 'tabular-nums text-neutral-300 dark:text-neutral-700'
                  }
                >
                  {count}
                </span>
              </li>
            ))}
          </ul>
          {audit.engineRequests.length > 0 ? (
            <ul className="mt-3 space-y-1 border-t border-neutral-200 pt-3 dark:border-neutral-800">
              {audit.engineRequests.map((name) => (
                <li key={name} className="truncate text-xs text-neutral-600 dark:text-neutral-400">
                  <code>{name}</code>
                </li>
              ))}
            </ul>
          ) : null}
        </details>
      ) : null}

      {/* `viewTransition` is left at its default (on), so opening morphs from the
          trigger. The trigger's `imageRef` is what makes that morph clean — without
          it the library warns and the first frame can flash blank. */}
      <Lightbox.Root open={open} onOpenChange={setOpen} value={value} onValueChange={setValue}>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {lightboxImageFiles.map((photo, i) => (
            <Lightbox.Trigger
              key={photo.src}
              index={i}
              className="overflow-hidden rounded-lg outline-offset-2 focus-visible:outline-2 focus-visible:outline-sky-500"
            >
              {({ imageRef }) => (
                <Image
                  ref={imageRef}
                  src={photo}
                  alt={`Photo ${i + 1}`}
                  placeholder="blur"
                  className="aspect-square size-full cursor-pointer object-cover"
                />
              )}
            </Lightbox.Trigger>
          ))}
        </div>

        <Lightbox.Portal>
          {/* No Backdrop part — Content carries the scrim itself. */}
          <Lightbox.Content
            aria-label="Minimal composition photo viewer"
            className="fixed inset-0 flex flex-col bg-neutral-950/95 outline-none"
          >
            {/* Slides bakes in the scroller (flex, overflow, snap); the consumer
                owns sizing. Slide is the snap box and needs the scrollport width. */}
            <Lightbox.Slides
              preload={PRELOAD}
              aria-label="Photos"
              className="flex-1 scrollbar-none [&::-webkit-scrollbar]:hidden"
            >
              {lightboxImageFiles.map((photo, i) => (
                <Lightbox.Slide
                  key={photo.src}
                  className="h-full min-w-full flex-[0_0_100%] px-4 pt-16 pb-24 sm:px-20 sm:pt-20"
                >
                  <Lightbox.Item index={i}>
                    <Lightbox.Zoom>
                      <Lightbox.Media width={photo.width} height={photo.height}>
                        {/* draggable={false} is required: the Zoom host sets
                            `user-select: none`, but that does not suppress native
                            image drag-and-drop, which would hijack the mouse pan. */}
                        <Image src={photo} alt={`Photo ${i + 1}`} sizes="100vw" priority={i === 0} draggable={false} />
                      </Lightbox.Media>
                    </Lightbox.Zoom>
                  </Lightbox.Item>
                </Lightbox.Slide>
              ))}
            </Lightbox.Slides>

            {/* Chrome sits beside Slides and targets the active slide's Zoom. */}
            <Lightbox.Counter className="absolute left-4 top-4 z-10 rounded-full bg-white/10 px-3 py-1.5 text-sm tabular-nums text-white backdrop-blur" />
            <Lightbox.Close className={`${EDGE_BUTTON} right-4 top-4`}>
              <X className="size-5" aria-hidden />
            </Lightbox.Close>
            <Lightbox.Previous className={`${EDGE_BUTTON} left-4 top-1/2 -translate-y-1/2`}>
              <ChevronLeft className="size-6" aria-hidden />
            </Lightbox.Previous>
            <Lightbox.Next className={`${EDGE_BUTTON} right-4 top-1/2 -translate-y-1/2`}>
              <ChevronRight className="size-6" aria-hidden />
            </Lightbox.Next>

            <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2">
              <Lightbox.ZoomOut className={BUTTON}>
                <Minus className="size-5" aria-hidden />
              </Lightbox.ZoomOut>
              <Lightbox.ZoomIn className={BUTTON}>
                <Plus className="size-5" aria-hidden />
              </Lightbox.ZoomIn>
            </div>
          </Lightbox.Content>
        </Lightbox.Portal>
      </Lightbox.Root>

      <p className="text-sm text-neutral-500 dark:text-neutral-500">
        Open a thumbnail and it morphs from that thumbnail; closing morphs back. Then swipe or drag the carousel, use
        the buttons or ← → / Home / End, pinch or ctrl-scroll or +/− to zoom, and Escape to close. The audit re-runs on
        every index change and on any part mounting or changing state.
      </p>
    </div>
  );
}
