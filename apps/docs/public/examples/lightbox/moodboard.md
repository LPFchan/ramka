# Moodboard

Masonry wall wired to Next.js dynamic routes ([[...id]]) — every photo is a shareable URL: deep links open the viewer on that slide, swiping rewrites the URL in place, and browser Back closes the viewer.

## Source

```tsx examples/lightbox/moodboard/[[...id]]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { MoodboardDemo } from '../moodboard-demo';
import { moodboardPhotos } from '../photos';

/**
 * Optional catch-all: `/examples/lightbox/moodboard` renders the grid, and
 * `/examples/lightbox/moodboard/mb-05` is the same page deep-linked into the
 * lightbox — the client demo reads the photo id from the pathname and opens on
 * that slide. One route (one page component) for both URL shapes means
 * client-side URL changes reconcile into the same mounted tree, so the viewer
 * never remounts while it rewrites the URL.
 */
interface MoodboardRouteProps {
  params: Promise<{ id?: string[] }>;
}

/** Prerender the grid plus every photo permalink. */
export function generateStaticParams() {
  return [{ id: [] }, ...moodboardPhotos.map((photo) => ({ id: [photo.id] }))];
}

export async function generateMetadata({ params }: MoodboardRouteProps): Promise<Metadata> {
  const { id } = await params;
  const photo = id ? moodboardPhotos.find((p) => p.id === id[0]) : undefined;
  if (photo) {
    return {
      title: `${photo.caption} — Moodboard example`,
      description: `${photo.alt} — a deep link straight into the moodboard lightbox, driven by a Next.js dynamic route and ramka's controlled open/value props.`,
    };
  }
  return {
    title: 'Moodboard example',
    description:
      'A masonry lightbox wired to Next.js dynamic routes: every photo is a shareable URL — deep links open the viewer, swipes rewrite the URL, browser Back closes it. Built with ramka.',
  };
}

export default async function MoodboardRoute({ params }: MoodboardRouteProps) {
  const { id } = await params;
  // Unknown photo ids 404 like any other dynamic route.
  if (id && (id.length > 1 || !moodboardPhotos.some((photo) => photo.id === id[0]))) {
    notFound();
  }
  return <MoodboardDemo />;
}
```

```tsx examples/lightbox/moodboard/moodboard-demo.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import * as Lightbox from '@ramka/react/lightbox';

import { ExampleShell } from '../../../../_components/example-shell';
import {
  LightboxGallery,
  triggerFocusClass,
} from '../../../../_components/lightbox-chrome';
import { moodboardPhotos } from './photos';

/**
 * The grid renders at this route; every photo also exists as its own URL under
 * the `[[...id]]` optional catch-all — `/examples/lightbox/moodboard/mb-05` —
 * so slides are shareable, deep-linkable pages with their own metadata (see
 * `[[...id]]/page.tsx`).
 */
const BASE_PATH = '/examples/lightbox/moodboard';

// Guarded so the server render doesn't warn — same trick the library uses.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

const items = moodboardPhotos.map((photo) => ({
  ...photo,
  src: photo.image,
  thumb: photo.image,
}));

/** `/…/moodboard/mb-05` → 4; the bare grid URL (or an unknown id) → -1. */
function photoIndexFromPathname(pathname: string): number {
  if (!pathname.startsWith(`${BASE_PATH}/`)) return -1;
  const id = decodeURIComponent(pathname.slice(BASE_PATH.length + 1));
  return moodboardPhotos.findIndex((photo) => photo.id === id);
}

type Tile = (typeof items)[number];

/** Responsive column count without CSS multicol (2 on mobile, 3 from `sm`). */
function useColumnCount() {
  const [cols, setCols] = React.useState(2);
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const update = () => setCols(mq.matches ? 3 : 2);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return cols;
}

export function MoodboardDemo() {
  // Single URL source. `usePathname` updates on native History API writes
  // (Next.js shallow routing) AND on browser back/forward, so one hook covers
  // deep links, swipes, and the Back button.
  const pathname = usePathname();
  const urlIndex = photoIndexFromPathname(pathname);

  // Local state is the lightbox's source of truth; the URL mirrors it. Driving
  // `open` straight from the pathname would also work, but a trigger tap would
  // then wait for the routing round-trip before the open lands — and the
  // library only runs the view-transition morph when open flips through its
  // own gesture path (Trigger / Close / Escape / pull-to-dismiss). Controlled
  // props updated synchronously from the callbacks keep that path intact.
  //
  // Deep links hydrate OPEN — the photo page loads with the viewer already in
  // the server HTML, no post-hydration pop-in. That is only possible because
  // deep-link visits skip the body portal (see `deepLinkVisit` below): a
  // portal target like `document.body` does not exist during server rendering,
  // so a server render with `open={true}` plus a real portal is a guaranteed
  // hydration mismatch. In-place rendering is deterministic on both sides.
  const [open, setOpen] = React.useState(urlIndex !== -1);
  const [index, setIndex] = React.useState(urlIndex === -1 ? 0 : urlIndex);

  // Decided ONCE per mount, never mid-session: swapping `container` would
  // reparent the portal subtree and remount an open viewer. Deep-link visits
  // render the viewer in place (`container: null`) so it exists in the server
  // HTML; regular visits portal to document.body as usual. The in-place host
  // gets `relative z-50` so the fixed viewer stacks above the docs page's
  // sticky mobile header (z-40) — portaled hosts win by document order and
  // must NOT carry a z-index (it would stack above body-level tooltips).
  const [deepLinkVisit] = React.useState(urlIndex !== -1);

  // Deep links paint the RIGHT photo before hydration. A scroller's scroll
  // offset can't be serialized into HTML — the server-rendered track always
  // sits at 0, showing slide 0 (or a blank past the preload window) — but a
  // TRANSFORM serializes fine. While this flag is on, a CSS rule translates
  // every slide by `-index × slide width` (ssr-slide-shift.css) so the server
  // HTML shows the deep-linked photo at scroll 0. The layout effect drops the
  // shift during the hydration commit, and ordering makes the swap invisible:
  // transforms don't affect scroll geometry, so the library's own layout
  // effect (a child — runs first) still reads scrollLeft 0, derives slide 0 ≠
  // active, and jumps the scroller to the real offset; the shift then comes
  // off in the same commit — one paint, no flash, works in every browser.
  const [ssrSlideShift, setSsrSlideShift] = React.useState(deepLinkVisit);
  useIsomorphicLayoutEffect(() => setSsrSlideShift(false), []);

  // `handleOpenChange` needs the freshest active index when it writes the
  // opened URL: a trigger tap reports its index (onValueChange) before the
  // open commits, and state from the previous render would lag behind it.
  const indexRef = React.useRef(index);

  // URL → lightbox. Covers the pathname changing underneath us — browser
  // back/forward — after the initial render (deep links already hydrate open,
  // so the mount run is a no-op). Gesture-driven changes wrote the URL
  // themselves in the callbacks below, so this no-ops for them too. URL-driven
  // flips render without the morph by design — Back closing the viewer fades,
  // it doesn't morph, matching how photo viewers behave elsewhere.
  React.useEffect(() => {
    if (urlIndex !== -1) {
      indexRef.current = urlIndex;
      setIndex(urlIndex);
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [urlIndex]);

  // Lightbox → URL, written from the gesture callbacks — never from an effect,
  // so URL-driven prop flips can't echo back into history. The writes use the
  // native History API (Next.js shallow routing — `usePathname` stays in
  // sync); `router.push` would also work but round-trips the server on every
  // change, and shallow writes keep URL sync free even mid-swipe.
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      // Opening pushes ONE history entry, so the browser Back button closes
      // the viewer instead of leaving the page.
      window.history.pushState(null, '', `${BASE_PATH}/${moodboardPhotos[indexRef.current]!.id}`);
    } else {
      // Gesture closes REWRITE the entry instead of popping it. Never call
      // history.back() here: on a morph close this callback fires inside the
      // View Transition's DOM-update callback (state must commit between the
      // two snapshots), and a synchronous pop lands a popstate — router
      // re-render plus the popped entry's SCROLL RESTORATION — mid-morph.
      // When scrollTriggerIntoView had scrolled a half-visible tile into view
      // during the session, that restore yanks the page back between the VT
      // snapshots and the close visibly morphs onto the wrong tile. The cost
      // of replacing instead: one leftover grid history entry per viewer
      // session (Back from the closed grid steps through it — harmless).
      // `replaceState` is safe in the commit: it fires no popstate and
      // restores no scroll, and the async pathname re-render it triggers
      // reconciles to identical DOM.
      window.history.replaceState(null, '', BASE_PATH);
    }
  };

  const handleValueChange = (nextIndex: number) => {
    indexRef.current = nextIndex;
    setIndex(nextIndex);
    // Swiping / arrow keys REPLACE the current entry — no history spam.
    // Skipped while closed: a trigger tap reports its index before the open
    // commits, and handleOpenChange writes that URL itself.
    if (open) {
      window.history.replaceState(null, '', `${BASE_PATH}/${moodboardPhotos[nextIndex]!.id}`);
    }
  };

  const cols = useColumnCount();
  // Distribute tiles round-robin into flex columns. This intentionally avoids
  // CSS `columns` (multicol): opening the lightbox locks page scroll (hides the
  // scrollbar → width change) and toggles a document-wide view-transition-name
  // reset, either of which forces the background to re-layout DURING the
  // transition. Multicol re-balances every item on any such invalidation — one
  // of the heaviest layouts there is — which starves the morph/backdrop of
  // frames (worst on mobile Safari). A flex-column reflow is cheap by contrast.
  const columns = React.useMemo(() => {
    const buckets: { tile: Tile; index: number }[][] = Array.from({ length: cols }, () => []);
    items.forEach((tile, i) => buckets[i % cols]!.push({ tile, index: i }));
    return buckets;
  }, [cols]);

  return (
    <ExampleShell
      title="Moodboard"
      description="A masonry wall wired to a Next.js dynamic route — the page lives at an [[...id]] optional catch-all, and the lightbox is controlled via open / value on Lightbox.Root. Tapping a tile opens the viewer and pushes /examples/lightbox/moodboard/mb-05 with the native History API (shallow routing), swiping rewrites that URL in place, and the browser Back button closes the viewer. Loading a photo URL cold serves the viewer already open, straight from the server HTML with per-photo metadata: deep-link visits render the Portal in place (container={null}) instead of into document.body, which is what makes a server-rendered open lightbox possible at all — portals cannot be serialized into server HTML. Because the controlled props update synchronously from the gesture callbacks, trigger taps keep the view-transition morph."
      docsHref="/docs/lightbox/state-lifecycle"
      docsLabel="State & lifecycle docs"
    >
      <Lightbox.Root
        open={open}
        onOpenChange={handleOpenChange}
        value={index}
        onValueChange={handleValueChange}
        loop
        scrollTriggerIntoView={[
          { type: 'onChange', behavior: 'instant' },
          { type: 'onOpenComplete', behavior: 'instant' },
        ]}
      >
        {/* Flex-column masonry (not CSS `columns`) — see useColumnCount above for
            why. Tiles keep their natural aspect once loaded; round-robin keeps a
            balanced-ish layout without measuring heights. */}
        <div className="flex max-w-2xl gap-4">
          {columns.map((column, ci) => (
            <div key={ci} className="flex min-w-0 flex-1 flex-col gap-4">
              {column.map(({ tile, index: tileIndex }) => (
                <Lightbox.Trigger
                  key={tile.id}
                  index={tileIndex}
                  className={`block w-full cursor-pointer overflow-hidden rounded-xl border-none bg-transparent p-0 ${triggerFocusClass}`}
                >
                  {({ imageRef }) => (
                    <Image
                      ref={imageRef}
                      src={tile.image}
                      alt={tile.alt}
                      placeholder="blur"
                      sizes="(min-width: 640px) 224px, 50vw"
                      loading="lazy"
                      className="block h-auto w-full rounded-xl bg-neutral-100 object-cover transition duration-200 hover:opacity-90 dark:bg-neutral-800"
                    />
                  )}
                </Lightbox.Trigger>
              ))}
            </div>
          ))}
        </div>

        <LightboxGallery
          items={items}
          ariaLabel="Moodboard photos"
          backdrop="solid"
          portalProps={
            deepLinkVisit
              ? {
                  container: null,
                  className: `relative z-50${ssrSlideShift ? ' lightbox-demo-ssr-slide-shift' : ''}`,
                  style: ssrSlideShift
                    ? ({ '--lightbox-demo-ssr-index': index } as React.CSSProperties)
                    : undefined,
                }
              : undefined
          }
        />
      </Lightbox.Root>
    </ExampleShell>
  );
}
```

```ts examples/lightbox/moodboard/photos.ts
import type { StaticImageData } from 'next/image';

import { moodboardImages } from './images.generated';

/**
 * Shared photo catalogue for the moodboard example. Plain data (no
 * `'use client'`) on purpose: the client demo maps it into grid tiles and
 * gallery slides, while the server route (`[[...id]]/page.tsx`) uses the same
 * ids and captions for `generateStaticParams`, per-photo metadata, and 404s —
 * one list, so a photo's URL can never drift from its slide.
 */
export interface MoodboardPhoto {
  /** URL segment for the photo's deep link (`…/moodboard/mb-05`). */
  id: string;
  alt: string;
  caption: string;
  image: StaticImageData;
}

export const moodboardPhotos: MoodboardPhoto[] = (
  [
    { id: 'mb-01', alt: 'Foggy pine ridge at dawn', caption: 'Dawn ridge' },
    { id: 'mb-02', alt: 'Empty coastal highway', caption: 'Open road' },
    { id: 'mb-03', alt: 'Overhead of a linen breakfast table', caption: 'Slow morning' },
    { id: 'mb-04', alt: 'Narrow sunlit alley', caption: 'Warm alley' },
    { id: 'mb-05', alt: 'Wide desert dunes', caption: 'Dunes' },
    { id: 'mb-06', alt: 'Rain on a window', caption: 'Rainy glass' },
    { id: 'mb-07', alt: 'Calm lake reflection', caption: 'Still water' },
    { id: 'mb-08', alt: 'Tall concrete staircase', caption: 'Ascent' },
    { id: 'mb-09', alt: 'Close-up of dried flowers', caption: 'Pressed petals' },
    { id: 'mb-10', alt: 'Panoramic city skyline at dusk', caption: 'Dusk skyline' },
    { id: 'mb-11', alt: 'Single tree in a green field', caption: 'Lone tree' },
    { id: 'mb-12', alt: 'Textured stone wall', caption: 'Stonework' },
  ] as const
).map((photo, i) => ({ ...photo, image: moodboardImages[i]! }));
```
