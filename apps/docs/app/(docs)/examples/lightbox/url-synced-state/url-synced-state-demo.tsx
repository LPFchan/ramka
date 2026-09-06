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

type Tile = (typeof items)[number];

/**
 * Responsive column count without CSS multicol (2 on mobile, 3 from `sm`).
 *
 * Known tradeoff: the server can't know the viewport, so desktop grid visits
 * paint 2 columns first and re-bucket to 3 after hydration — a visible
 * reshuffle. Accepted here because the alternative (CSS multicol) re-balances
 * the whole grid on every layout invalidation mid-morph; see the `columns`
 * memo below for why that's the worse cost.
 */
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

  const cols = useColumnCount();
  // Distribute tiles round-robin into flex columns. This intentionally avoids
  // CSS `columns` (multicol): opening the lightbox locks page scroll (hides the
  // scrollbar → width change) and toggles a document-wide view-transition-name
  // reset, either of which forces the background to re-layout DURING the
  // transition. Multicol re-balances every item on any such invalidation — one
  // of the heaviest layouts there is — which starves the morph/backdrop of
  // frames (worst on mobile Safari). A flex-column reflow is cheap by contrast.
  // (Column-major DOM order means Tab/reading order zigzags versus visual
  // order — an inherent texture of masonry, multicol included.)
  const columns = React.useMemo(() => {
    const buckets: { tile: Tile; index: number }[][] = Array.from({ length: cols }, () => []);
    items.forEach((tile, i) => buckets[i % cols]!.push({ tile, index: i }));
    return buckets;
  }, [cols]);

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
