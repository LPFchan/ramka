'use client';

import { notFound } from 'next/navigation';
import * as React from 'react';
import * as Lightbox from '@ramka/react/lightbox';
import { X } from 'lucide-react';

import { lightboxChromeButton, triggerFocusClass } from '../../_components/lightbox-chrome';
import { installPerfHarness } from './harness';

/**
 * Perf lab: reproduces the Safari open/close stutter on element-heavy pages.
 *
 * Renders N image tiles immediately (default 1500 — an "infinite feed" that
 * already loaded everything) with the same lightbox composition as the
 * infinite-scroll example. Every image is an inline SVG data URI, so there is
 * zero network noise in measurements.
 *
 * Query params:
 * - `n`        page tiles rendered (default 1500)
 * - `gallery`  how many of those tiles are lightbox triggers/slides
 *              (default = n). `?n=1500&gallery=30` separates "page DOM size"
 *              costs from "gallery size" costs.
 * - `links`    inert prose links appended below the grid (default 0).
 *              `?n=4&links=15000` reproduces the PR #80 / Mintlify shape:
 *              a tiny gallery on a ~16k-element page (with a blurred sticky
 *              header, like the original repro).
 * - `ablate`   comma list: `adopt`, `rootvars`, `userselect`, `isolation`,
 *              `vt` (see harness.ts) — neutralizes one lag suspect at a time.
 * - `morph`    `off` disables the viewTransition prop entirely.
 *
 * Instrumentation lives in harness.ts; results in the bottom-left HUD and
 * `window.__perfLab`. Normally dev-only; a production build includes it when
 * built with NEXT_PUBLIC_PERF_LAB=1 (the measurement script does this so the
 * numbers come from a production React build).
 */

interface LabConfig {
  n: number;
  gallery: number;
  links: number;
  morph: boolean;
}

function svgUri(i: number, w: number, h: number): string {
  const hue = (i * 47) % 360;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="100%" height="100%" fill="hsl(${hue},65%,58%)"/>` +
    `<rect x="4%" y="6%" width="60%" height="10%" rx="8" fill="hsl(${hue},65%,45%)"/>` +
    `<text x="50%" y="55%" font-family="system-ui" font-size="${Math.round(h / 5)}" ` +
    `fill="white" text-anchor="middle">${i + 1}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export default function PerfLabPage() {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_PERF_LAB !== '1') {
    notFound();
  }

  // Config comes from the URL after mount: keeps SSR output param-independent
  // and guarantees the harness (with its ablation patches) is installed before
  // any tile can be clicked.
  const [config, setConfig] = React.useState<LabConfig | null>(null);
  React.useEffect(() => {
    installPerfHarness();
    const params = new URLSearchParams(window.location.search);
    const n = Math.max(1, Number(params.get('n')) || 1500);
    const galleryParam = Number(params.get('gallery'));
    const gallery = Math.min(n, galleryParam > 0 ? galleryParam : n);
    const links = Math.max(0, Number(params.get('links')) || 0);
    setConfig({ n, gallery, links, morph: params.get('morph') !== 'off' });
  }, []);

  if (!config) {
    return <div className="p-8 font-mono text-sm text-neutral-500">perf-lab: loading config…</div>;
  }

  const { n, gallery, links, morph } = config;
  const tiles = Array.from({ length: n }, (_, i) => i);
  const slides = Array.from({ length: gallery }, (_, i) => i);
  const linkParagraphs = Array.from({ length: Math.ceil(links / 50) }, (_, p) => p);

  return (
    <div className="min-h-screen select-none" data-perf-ready={n}>
      <div
        className={`sticky top-0 z-30 border-b border-black/[0.06] px-4 py-2.5 dark:border-white/[0.08] ${
          links > 0 ? 'bg-background/70 backdrop-blur-md' : 'bg-background'
        }`}
      >
        <span className="font-mono text-[13px] text-neutral-600 dark:text-neutral-300">
          perf-lab · {n} tiles · {gallery} in gallery · {links} links · morph{' '}
          {morph ? 'on' : 'off'}
        </span>
      </div>

      <Lightbox.Root viewTransition={morph} awaitImageDecode={false}>
        <div className="grid grid-cols-3 gap-0.5 md:grid-cols-4 lg:grid-cols-5">
          {tiles.map((i) =>
            i < gallery ? (
              <Lightbox.Trigger
                key={i}
                index={i}
                data-perf-tile={i}
                className={`relative block aspect-square cursor-pointer overflow-hidden bg-transparent p-0 ${triggerFocusClass}`}
              >
                {({ imageRef }) => (
                  <>
                    <img
                      ref={imageRef}
                      src={svgUri(i, 320, 320)}
                      alt={`Photo ${i + 1}`}
                      width={320}
                      height={320}
                      loading="lazy"
                      draggable={false}
                      className="block size-full object-cover"
                    />
                    <span className="pointer-events-none absolute bottom-1 left-1.5 text-[10px] font-medium text-white/80">
                      #{i + 1}
                    </span>
                  </>
                )}
              </Lightbox.Trigger>
            ) : (
              // Inert tile: identical DOM weight, not part of the gallery.
              <div key={i} className="relative block aspect-square overflow-hidden">
                <img
                  src={svgUri(i, 320, 320)}
                  alt=""
                  width={320}
                  height={320}
                  loading="lazy"
                  draggable={false}
                  className="block size-full object-cover"
                />
                <span className="pointer-events-none absolute bottom-1 left-1.5 text-[10px] font-medium text-white/80">
                  #{i + 1}
                </span>
              </div>
            ),
          )}
        </div>

        {links > 0 && (
          <section className="mx-auto max-w-3xl px-6 py-10 text-sm leading-7">
            {linkParagraphs.map((p) => (
              <p key={p} className="mb-4">
                {Array.from({ length: Math.min(50, links - p * 50) }, (_, j) => {
                  const idx = p * 50 + j;
                  return (
                    <React.Fragment key={idx}>
                      <a
                        href={`#link-${idx}`}
                        className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                      >
                        doc link {idx}
                      </a>
                      {' · '}
                    </React.Fragment>
                  );
                })}
              </p>
            ))}
          </section>
        )}

        <Lightbox.Portal>
          <Lightbox.Backdrop className="lightbox-demo-backdrop fixed inset-0 bg-white dark:bg-black" />
          <Lightbox.Content
            aria-label="Perf lab photos"
            className="lightbox-demo-content lightbox-demo-content-solo fixed inset-0 flex flex-col overscroll-contain outline-none"
          >
            <Lightbox.Slides
              aria-roledescription="carousel"
              aria-label="Full-size photos"
              preload={2}
              className="lightbox-demo-slides flex-1 gap-5 [&::-webkit-scrollbar]:hidden md:gap-0"
            >
              {slides.map((i) => (
                <Lightbox.Slide key={i} className="lightbox-demo-slide-pad h-full">
                  <Lightbox.Item
                    index={i}
                    aria-roledescription="slide"
                    aria-label={`${i + 1} of ${gallery}`}
                  >
                    <Lightbox.Zoom maxZoom={6}>
                      <Lightbox.Media
                        width={1200}
                        height={800}
                        className="overflow-hidden rounded-none md:rounded-lg"
                      >
                        <img
                          src={svgUri(i, 1200, 800)}
                          alt={`Photo ${i + 1}`}
                          width={1200}
                          height={800}
                          loading="eager"
                          draggable={false}
                          className="select-none"
                        />
                      </Lightbox.Media>
                    </Lightbox.Zoom>
                  </Lightbox.Item>
                </Lightbox.Slide>
              ))}
            </Lightbox.Slides>

            <div className="lightbox-demo-chrome-top lightbox-demo-chrome-hide absolute end-3 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-30 flex gap-2">
              <Lightbox.Close className={lightboxChromeButton} aria-label="Close">
                <X aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </Lightbox.Close>
            </div>
          </Lightbox.Content>
        </Lightbox.Portal>
      </Lightbox.Root>
    </div>
  );
}
