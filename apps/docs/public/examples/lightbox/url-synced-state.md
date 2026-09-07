# URL-synced state

Masonry wall wired to Next.js dynamic routes ([[...id]]) — every photo is a shareable URL: deep links open the viewer on that slide, swiping rewrites the URL in place, and browser Back closes the viewer.

## Source

```tsx examples/lightbox/url-synced-state/[[...id]]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { UrlSyncedStateDemo } from '../url-synced-state-demo';
import { GALLERY_PAGE_TITLE, galleryPhotos, photoPageTitle } from '../photos';

/**
 * Optional catch-all: `/examples/lightbox/url-synced-state` renders the grid,
 * and `/examples/lightbox/url-synced-state/5` is the same page deep-linked
 * into the lightbox — the client demo reads the photo id from the pathname and
 * opens on that slide. One route (one page component) for both URL shapes
 * means client-side URL changes reconcile into the same mounted tree, so the
 * viewer never remounts while it rewrites the URL.
 */
interface UrlSyncedStateRouteProps {
  params: Promise<{ id?: string[] }>;
}

/** Prerender the grid plus every photo permalink. */
export function generateStaticParams() {
  return [{ id: [] }, ...galleryPhotos.map((photo) => ({ id: [photo.id] }))];
}

export async function generateMetadata({ params }: UrlSyncedStateRouteProps): Promise<Metadata> {
  const { id } = await params;
  const photo = id?.length ? galleryPhotos.find((p) => p.id === id[0]) : undefined;
  if (photo) {
    const title = photoPageTitle(photo);
    const description = `${photo.alt} — a deep link straight into the lightbox, driven by a Next.js dynamic route and ramka's controlled open/value props.`;
    return {
      title,
      description,
      // `title`/`description` alone don't cascade into the OpenGraph object
      // inherited from the root layout — without an explicit `openGraph` here,
      // a shared photo URL unfurls as the generic site card. This is the
      // "shareable URL with per-photo metadata" half of the demo's pitch, so
      // give crawlers the actual photo. `StaticImageData` supplies a
      // site-relative `src` plus intrinsic dimensions; the root layout's
      // `metadataBase` resolves it to an absolute URL. (Per-photo canonicals
      // come free — the root layout's `canonical: './'` resolves per page.)
      openGraph: {
        title,
        description: photo.alt,
        images: [
          {
            url: photo.image.src,
            width: photo.image.width,
            height: photo.image.height,
            alt: photo.alt,
          },
        ],
      },
      twitter: { card: 'summary_large_image' },
    };
  }
  return {
    title: GALLERY_PAGE_TITLE,
    description:
      'A masonry lightbox wired to Next.js dynamic routes: every photo is a shareable URL — deep links open the viewer, swipes rewrite the URL, browser Back closes it. Built with ramka.',
  };
}

export default async function UrlSyncedStateRoute({ params }: UrlSyncedStateRouteProps) {
  const { id } = await params;
  // Unknown photo ids 404 like any other dynamic route. `id?.length` (not
  // `id &&`): the grid's static param is literally `{ id: [] }`, and an empty
  // array is truthy — Next currently normalizes it to `undefined` at prerender
  // time, but the guard shouldn't lean on that.
  if (id?.length && (id.length > 1 || !galleryPhotos.some((photo) => photo.id === id[0]))) {
    notFound();
  }
  return <UrlSyncedStateDemo />;
}
```

```tsx examples/lightbox/url-synced-state/url-synced-state-demo.tsx
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
import { GALLERY_PAGE_TITLE, galleryPhotos, photoPageTitle } from './photos';

/**
 * The grid renders at this route; every photo also exists as its own URL under
 * the `[[...id]]` optional catch-all — `/examples/lightbox/url-synced-state/5` —
 * so slides are shareable, deep-linkable pages with their own metadata (see
 * `[[...id]]/page.tsx`).
 */
const BASE_PATH = '/examples/lightbox/url-synced-state';

const items = galleryPhotos.map((photo) => ({
  ...photo,
  src: photo.image,
  thumb: photo.image,
}));

/** `/…/url-synced-state/5` → 4; the bare grid URL (or an unknown id) → -1. */
function photoIndexFromPathname(pathname: string): number {
  if (!pathname.startsWith(`${BASE_PATH}/`)) return -1;
  // decodeURIComponent throws on malformed percent-sequences. Navigation can't
  // deliver one (the server 400s those before rendering), but any code calling
  // pushState with an arbitrary string can — treat it as "not a photo URL".
  let id: string;
  try {
    id = decodeURIComponent(pathname.slice(BASE_PATH.length + 1));
  } catch {
    return -1;
  }
  return galleryPhotos.findIndex((photo) => photo.id === id);
}

/**
 * Masonry inputs (see masonry-grid.css for the layout itself and the full
 * design rationale). A column is 120 row-units wide, a gap is 9; a tile's
 * span is its aspect-derived height in those units plus its own bottom gap.
 * Unit-relative means the SAME span works at both breakpoints — the number
 * can live in the server HTML and the column switch is pure CSS, which is
 * what makes the server paint correct at any viewport (a JS column count
 * guessed 2 on the server and visibly re-bucketed desktop visits to 3 after
 * hydration). The photos are exact 2:3 / 3:2 / 1:1 crops, so the spans are
 * exact integers — no rounding crop from the `object-cover` below.
 */
const MASONRY_COL_UNITS = 120;
const MASONRY_GAP_UNITS = 9;

function masonrySpan(image: { width: number; height: number }): number {
  return Math.round((MASONRY_COL_UNITS * image.height) / image.width) + MASONRY_GAP_UNITS;
}

export function UrlSyncedStateDemo() {
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
  // Note this branch isn't strictly "the server rendered this": a client-side
  // remount at a photo URL (open a photo, navigate to another docs page, press
  // Back without bfcache) also mounts with `urlIndex !== -1` and takes the
  // in-place path. That's fine — it renders identically — the only difference
  // is the SSR flags below briefly suppress an open fade nobody would see.
  const [deepLinkVisit] = React.useState(urlIndex !== -1);

  // Destination blur is the ONE exception to the Next.js Image guide's rule
  // ("index has a trigger image → no destination blur"). That rule exists
  // because on gesture opens Ramka paints the trigger's already-decoded image
  // behind the destination, and an LQIP would cover that sharp bridge with a
  // blurry one. A deep-link visit has no gesture: the bridge can't paint
  // before hydration and the grid image is cold-loading in parallel — while
  // `blurDataURL` is inlined into the server HTML, making it the only
  // placeholder that can exist on first paint. So: blur destinations for
  // deep-link visits, keep them clean for regular visits. Per-mount like the
  // portal decision above; the (unchanged) LQIP background layers behind
  // already-loaded pixels, so later in-session opens stay bridged and sharp.
  const galleryItems = React.useMemo(
    () => (deepLinkVisit ? items.map((item) => ({ ...item, destinationBlur: true })) : items),
    [deepLinkVisit],
  );

  // Deep links paint the RIGHT photo before hydration via the library's
  // `Slides ssrSlideShift` (passed through LightboxGallery below): the server
  // HTML carries a transform that translates every slide by
  // `-index × slide width` so the deep-linked photo sits at scroll offset 0,
  // and the library swaps the real scroll in — same commit, one paint — at
  // hydration. The skin's only obligation is mirroring the track's gap into
  // `--lightbox-ssr-slide-gap` (see lightbox-chrome.tsx, next to the gap
  // utilities it restates).

  // A server-rendered open viewer must not FADE in — the skin's open fades run
  // off @starting-style, which applies on first render, and for SSR'd markup
  // first render is page load. While this flag is on, a host class flattens
  // every transition inside (ssr-no-transitions.css) so the server paint is
  // the final frame. Removed one frame AFTER the first post-hydration paint —
  // transitions consult the after-change style, so a layout-effect removal
  // (same style recalc where the strip's data-positioned lands) would restart
  // the exact fades being suppressed. Double rAF: the first can fire before
  // the pending paint, the second is guaranteed to be a frame behind it.
  const [ssrNoTransitions, setSsrNoTransitions] = React.useState(deepLinkVisit);
  React.useEffect(() => {
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => setSsrNoTransitions(false));
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // `handleOpenChange` needs the freshest active index when it writes the
  // opened URL: a trigger tap reports its index (onValueChange) before the
  // open commits, and state from the previous render would lag behind it.
  const indexRef = React.useRef(index);
  // Same discipline for `open` in `handleValueChange`: render-scope `open`
  // is the last COMMITTED value, so if a close and a value change ever landed
  // in the same task the guard below would see stale `true` and strand a
  // photo URL on a closed viewer. No current library path emits that ordering,
  // but the guard's correctness shouldn't depend on non-contractual event
  // ordering. (The library uses the same ref technique internally.)
  const openRef = React.useRef(open);

  // URL → lightbox. Covers the pathname changing underneath us — browser
  // back/forward — after the initial render (deep links already hydrate open,
  // so the mount run is a no-op). Gesture-driven changes wrote the URL
  // themselves in the callbacks below, so this no-ops for them too. URL-driven
  // flips render without the morph by design — Back closing the viewer fades,
  // it doesn't morph, matching how photo viewers behave elsewhere.
  React.useEffect(() => {
    if (urlIndex !== -1) {
      indexRef.current = urlIndex;
      openRef.current = true;
      setIndex(urlIndex);
      setOpen(true);
    } else {
      openRef.current = false;
      setOpen(false);
    }
  }, [urlIndex]);

  // The tab title follows the URL. Shallow History writes (below) never re-run
  // Next.js metadata — `generateMetadata` ran once, for the URL this page
  // LOADED with — so without this a deep-link visit keeps the first photo's
  // title forever: through every swipe and even after the viewer closes.
  // Owning the URL writes means owning the title too. Same strings as the
  // server metadata (shared helpers in photos.ts); the ` — ramka` suffix
  // mirrors the root layout's title template, which only applies server-side.
  // An effect (not the callbacks) so Back/Forward flips retitle as well.
  React.useEffect(() => {
    const base = open ? photoPageTitle(galleryPhotos[index]!) : GALLERY_PAGE_TITLE;
    document.title = `${base} — ramka`;
  }, [open, index]);

  // Lightbox → URL, written from the gesture callbacks — never from an effect,
  // so URL-driven prop flips can't echo back into history. The writes use the
  // native History API (Next.js shallow routing — `usePathname` stays in
  // sync); `router.push` would also work but round-trips the server on every
  // change, and shallow writes keep URL sync free even mid-swipe.
  const handleOpenChange = (nextOpen: boolean) => {
    openRef.current = nextOpen;
    setOpen(nextOpen);
    if (nextOpen) {
      // Opening pushes ONE history entry, so the browser Back button closes
      // the viewer instead of leaving the page.
      window.history.pushState(null, '', `${BASE_PATH}/${galleryPhotos[indexRef.current]!.id}`);
    } else {
      // Gesture closes REWRITE the entry instead of popping it. Never call
      // history.back() here: on a morph close this callback fires inside the
      // View Transition's DOM-update callback (state must commit between the
      // two snapshots), and a synchronous pop lands a popstate — router
      // re-render plus the popped entry's SCROLL RESTORATION — mid-morph.
      // When scrollTriggerIntoView had scrolled a half-visible tile into view
      // during the session, that restore yanks the page back between the VT
      // snapshots and the close visibly morphs onto the wrong tile. The cost
      // of replacing instead: one leftover grid history entry PER viewer
      // session (three sessions = four Backs to leave the page), and Back
      // onto an older grid entry replays that entry's scroll restoration —
      // if scrollTriggerIntoView moved the grid during the session, that
      // "no-op" Back visibly jumps the scroll position. Nothing breaks, and
      // the same jump would land mid-morph with history.back(); if a clean
      // stack matters more to you than morph closes, pop the entry from
      // onOpenChangeComplete(false) instead (after the transition settles).
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
    // Skipped while closed (via openRef, see above): a trigger tap reports its
    // index before the open commits, and handleOpenChange writes that URL.
    if (openRef.current) {
      window.history.replaceState(null, '', `${BASE_PATH}/${galleryPhotos[nextIndex]!.id}`);
    }
  };

  return (
    <ExampleShell
      title="URL-synced state"
      description="Every photo in this masonry wall is its own URL, driven by a Next.js dynamic route — the page lives at an [[...id]] optional catch-all, and the lightbox is controlled via open / value on Lightbox.Root. Tapping a tile opens the viewer and pushes /examples/lightbox/url-synced-state/5 with the native History API (shallow routing), swiping rewrites that URL in place, and the browser Back button closes the viewer. Loading a photo URL cold serves the viewer already open, straight from the server HTML with per-photo metadata: deep-link visits render the Portal in place (container={null}) instead of into document.body, which is what makes a server-rendered open lightbox possible at all — portals cannot be serialized into server HTML. Because the controlled props update synchronously from the gesture callbacks, trigger taps keep the view-transition morph."
      docsHref="/docs/lightbox/state-lifecycle"
      docsLabel="State & lifecycle docs"
    >
      <Lightbox.Root
        open={open}
        onOpenChange={handleOpenChange}
        value={index}
        onValueChange={handleValueChange}
        // Items register through effects, which never run on the server — so
        // without this an SSR-open page paints the counter as "6 of 0" until
        // hydration. `count` is the pre-registration fallback.
        count={galleryPhotos.length}
        loop
        scrollTriggerIntoView={[
          { type: 'onChange', behavior: 'instant' },
          { type: 'onOpenComplete', behavior: 'instant' },
        ]}
      >
        {/* Grid-span masonry — layout and rationale in masonry-grid.css, span
            math next to masonrySpan above. One DOM order for every viewport:
            the server HTML is correct at any width and the 2↔3 column switch
            is pure CSS, so refreshes never reshuffle. Each tile's own bottom
            gap is margin in the same row-units its span already counts;
            grid auto-placement drops each tile into the topmost open slot,
            which also keeps Tab order close to visual order (the old
            column-major bucketing zigzagged). */}
        <div className="lightbox-demo-masonry max-w-2xl">
          <div className="lightbox-demo-masonry-grid">
            {items.map((tile, tileIndex) => (
              <Lightbox.Trigger
                key={tile.id}
                index={tileIndex}
                className={`block w-full cursor-pointer overflow-hidden rounded-xl border-none bg-transparent p-0 ${triggerFocusClass}`}
                style={{
                  gridRowEnd: `span ${masonrySpan(tile.image)}`,
                  // The gap MUST be margin, not padding: the trigger is the
                  // view-transition morph target, and padding would grow its
                  // box past the visible image — the morph would land on a
                  // rect that includes the gap. Margin stays outside the
                  // border box (grid stretch subtracts it from the area), so
                  // the trigger's rect IS the image's rect.
                  marginBottom: `calc(var(--masonry-unit) * ${MASONRY_GAP_UNITS})`,
                }}
              >
                {({ imageRef }) => (
                  <Image
                    ref={imageRef}
                    src={tile.image}
                    alt={tile.alt}
                    placeholder="blur"
                    sizes="(min-width: 640px) 224px, 50vw"
                    loading="lazy"
                    className="block h-full w-full rounded-xl bg-neutral-100 object-cover transition duration-200 hover:opacity-90 dark:bg-neutral-800"
                  />
                )}
              </Lightbox.Trigger>
            ))}
          </div>
        </div>

        <LightboxGallery
          items={galleryItems}
          ariaLabel="Gallery photos"
          backdrop="solid"
          // Items register captions in effects, which never run on the server —
          // without this a deep-link visit paints an empty caption placard.
          // Fallback children render only until the registry fills, so it can't
          // go stale after a swipe.
          captionFallback={deepLinkVisit ? galleryPhotos[index]?.caption : undefined}
          // Server-rendered deep links paint the deep-linked slide, not slide 0
          // (library feature — forwarded to `Lightbox.Slides`). Inert for
          // regular visits: the stand-in only renders for server paint.
          ssrSlideShift
          portalProps={
            deepLinkVisit
              ? {
                  container: null,
                  className: `relative z-50${
                    ssrNoTransitions ? ' lightbox-demo-ssr-no-transitions' : ''
                  }`,
                }
              : undefined
          }
        />
      </Lightbox.Root>
    </ExampleShell>
  );
}
```

```ts examples/lightbox/url-synced-state/photos.ts
import type { StaticImageData } from 'next/image';

import { galleryImages } from './images.generated';

/**
 * Shared photo catalogue for the URL-synced state example. Plain data (no
 * `'use client'`) on purpose: the client demo maps it into grid tiles and
 * gallery slides, while the server route (`[[...id]]/page.tsx`) uses the same
 * ids and captions for `generateStaticParams`, per-photo metadata, and 404s —
 * one list, so a photo's URL can never drift from its slide.
 */
export interface GalleryPhoto {
  /**
   * URL segment for the photo's deep link (`…/url-synced-state/5`). An
   * opaque STABLE id — the routing looks photos up by this value, never by
   * array position, so reordering or removing photos can't repoint existing
   * links. (These happen to be numeric; any string works.)
   */
  id: string;
  alt: string;
  caption: string;
  image: StaticImageData;
}

/**
 * Page titles, shared by the server metadata (`[[...id]]/page.tsx`) and the
 * client demo. Shallow History API writes never re-run `generateMetadata` —
 * it ran once, for the URL the page LOADED with — so the demo mirrors the
 * title into `document.title` from the same state that drives the URL. One
 * source keeps the two from drifting. (The root layout's title template
 * appends the site suffix to these on the server.)
 */
export const GALLERY_PAGE_TITLE = 'URL-synced state example';

export function photoPageTitle(photo: GalleryPhoto): string {
  return `${photo.caption} — ${GALLERY_PAGE_TITLE}`;
}

export const galleryPhotos: GalleryPhoto[] = (
  [
    { id: '1', alt: 'Foggy pine ridge at dawn', caption: 'Dawn ridge' },
    { id: '2', alt: 'Empty coastal highway', caption: 'Open road' },
    { id: '3', alt: 'Overhead of a linen breakfast table', caption: 'Slow morning' },
    { id: '4', alt: 'Narrow sunlit alley', caption: 'Warm alley' },
    { id: '5', alt: 'Wide desert dunes', caption: 'Dunes' },
    { id: '6', alt: 'Rain on a window', caption: 'Rainy glass' },
    { id: '7', alt: 'Calm lake reflection', caption: 'Still water' },
    { id: '8', alt: 'Tall concrete staircase', caption: 'Ascent' },
    { id: '9', alt: 'Close-up of dried flowers', caption: 'Pressed petals' },
    { id: '10', alt: 'Panoramic city skyline at dusk', caption: 'Dusk skyline' },
    { id: '11', alt: 'Single tree in a green field', caption: 'Lone tree' },
    { id: '12', alt: 'Textured stone wall', caption: 'Stonework' },
  ] as const
).map((photo, i) => ({ ...photo, image: galleryImages[i]! }));
```

```css app/lightbox-demo/ssr-no-transitions.css
/*
 * No entrance motion when the page ITSELF is the entrance — used by
 * deep-linked visits that server-render the lightbox already open
 * (the URL-synced state example's dynamic route).
 *
 * The skin's open/close fades run off `@starting-style` (open-close.css,
 * chrome-hide, the strip's data-positioned reveal), and @starting-style
 * applies on an element's FIRST render — which, on a server-rendered open
 * viewer, is page load. A refreshed deep link would fade its own content in
 * as if it had just opened. While this class is on the Portal host every
 * transition inside is flattened, so the server paint IS the final frame.
 *
 * The demo removes the class one frame AFTER the first post-hydration paint
 * (not in the hydration commit): transitions consult the after-change style,
 * so dropping it in the same style recalc where e.g. the strip's
 * `data-positioned` lands would start the very fades being suppressed.
 *
 * (The companion problem — painting the RIGHT slide before hydration — is
 * library-owned: `Lightbox.Slides ssrSlideShift`, plus the skin mirroring the
 * track gap into `--lightbox-ssr-slide-gap` in lightbox-chrome.tsx. This file
 * is only about suppressing the skin's own fades.)
 */
.lightbox-demo-ssr-no-transitions *,
.lightbox-demo-ssr-no-transitions *::before,
.lightbox-demo-ssr-no-transitions *::after {
  transition: none !important;
}
```

```css app/lightbox-demo/thumbnail-strip-scroll-link.css
/**
 * Docs-only thumbnail-strip cosmetics (default gallery chrome).
 *
 * Library ThumbnailStrip owns midline padding, overflow clip, and the
 * ScrollTimeline → track transform link. Selection chrome here is a simple
 * floating square. Aspect-morph nine-slice lives on the debug recipes page.
 */

.lightbox-demo-thumbnail-strip {
  --lightbox-demo-thumb-h: 4.5rem;
  --lightbox-demo-thumbnail-strip-fade: 40px;
  align-self: stretch;
  width: 100%;
  min-width: 0;
  /* Fits the floating indicator's overhang (3px gap + 2px stroke). */
  padding-block: 0.3125rem;
  /*
   * Soft clip on both edges. Stops at 25/50/75% of the fade use smoothstep
   * alphas (t²(3−2t)) so the dissolve eases in/out instead of a hard ramp.
   */
  -webkit-mask-image: linear-gradient(
    to right,
    rgb(0 0 0 / 0) 0,
    rgb(0 0 0 / 0.156) calc(var(--lightbox-demo-thumbnail-strip-fade) * 0.25),
    rgb(0 0 0 / 0.5) calc(var(--lightbox-demo-thumbnail-strip-fade) * 0.5),
    rgb(0 0 0 / 0.844) calc(var(--lightbox-demo-thumbnail-strip-fade) * 0.75),
    #000 var(--lightbox-demo-thumbnail-strip-fade),
    #000 calc(100% - var(--lightbox-demo-thumbnail-strip-fade)),
    rgb(0 0 0 / 0.844) calc(100% - var(--lightbox-demo-thumbnail-strip-fade) * 0.75),
    rgb(0 0 0 / 0.5) calc(100% - var(--lightbox-demo-thumbnail-strip-fade) * 0.5),
    rgb(0 0 0 / 0.156) calc(100% - var(--lightbox-demo-thumbnail-strip-fade) * 0.25),
    rgb(0 0 0 / 0) 100%
  );
  mask-image: linear-gradient(
    to right,
    rgb(0 0 0 / 0) 0,
    rgb(0 0 0 / 0.156) calc(var(--lightbox-demo-thumbnail-strip-fade) * 0.25),
    rgb(0 0 0 / 0.5) calc(var(--lightbox-demo-thumbnail-strip-fade) * 0.5),
    rgb(0 0 0 / 0.844) calc(var(--lightbox-demo-thumbnail-strip-fade) * 0.75),
    #000 var(--lightbox-demo-thumbnail-strip-fade),
    #000 calc(100% - var(--lightbox-demo-thumbnail-strip-fade)),
    rgb(0 0 0 / 0.844) calc(100% - var(--lightbox-demo-thumbnail-strip-fade) * 0.75),
    rgb(0 0 0 / 0.5) calc(100% - var(--lightbox-demo-thumbnail-strip-fade) * 0.5),
    rgb(0 0 0 / 0.156) calc(100% - var(--lightbox-demo-thumbnail-strip-fade) * 0.25),
    rgb(0 0 0 / 0) 100%
  );
}

/*
 * Hidden until the library has positioned the track against the Slides
 * scroller (`data-positioned`, set in a layout effect before first client
 * paint). Client-side opens carry the attribute on their first painted frame,
 * so this never hides anything there. It only matters for pages that
 * server-render an open lightbox (URL-synced state deep links): scroll/transform
 * positions cannot be serialized into HTML, so the SSR'd strip sits at offset
 * 0 until hydration — a strip pointing at the wrong photo reads as broken,
 * a strip fading in a beat late reads as loading.
 */
.lightbox-demo-thumbnail-strip:not([data-positioned]) {
  opacity: 0;
}

.lightbox-demo-thumbnail-strip[data-positioned] {
  opacity: 1;
  transition: opacity 200ms ease-out;
}

.lightbox-demo-thumbnail-strip [data-ramka-thumbnail-strip-track] {
  display: flex;
  width: max-content;
  gap: 0.625rem;
  align-items: center;
}

.lightbox-demo-thumbnail-strip [role='tab'] {
  box-sizing: border-box;
  position: relative;
  display: block;
  width: var(--lightbox-demo-thumb-h);
  height: var(--lightbox-demo-thumb-h);
  flex-shrink: 0;
  overflow: hidden;
  margin: 0;
  border: 0;
  border-radius: 0.5rem;
  padding: 0;
  appearance: none;
  background: transparent;
}

.lightbox-demo-thumbnail-strip [role='tab'] img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

/* Stationary midline square — same size as a thumb + 3px gap + 2px stroke. */
.lightbox-demo-thumbnail-strip-indicator {
  position: absolute;
  left: 50%;
  top: 50%;
  box-sizing: border-box;
  width: calc(var(--lightbox-demo-thumb-h) + 10px);
  height: calc(var(--lightbox-demo-thumb-h) + 10px);
  border-radius: calc(0.5rem + 3px);
  border: 2px solid #000;
  pointer-events: none;
  transform: translate(-50%, -50%);
}

:is(.dark, [data-theme='dark']) .lightbox-demo-thumbnail-strip-indicator {
  border-color: #fff;
}

/* Thumb-jump slides crossfade CSS is injected by the library — tune with
   `--lightbox-select-vt-*` on Slides (or a parent). */
```
