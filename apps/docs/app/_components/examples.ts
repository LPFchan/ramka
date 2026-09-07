export interface ExampleLink {
  slug: string;
  title: string;
  description: string;
  /**
   * Page file for the LLM docs, relative to `app/(docs)/examples/lightbox/`.
   * Defaults to `${slug}/page.tsx`; examples whose page lives inside a dynamic
   * segment point at it here.
   */
  pagePath?: string;
  /**
   * Extra source files to embed in the example's `.md`, relative to `app/`
   * (NOT the examples dir): load-bearing skin CSS lives outside the `(docs)`
   * tree, and an example doc that omits it teaches a silently degraded copy
   * of the pattern.
   */
  extraSources?: string[];
}

export interface ExampleGroup {
  group: string;
  basePath: string;
  links: ExampleLink[];
}

export const lightboxExamples: ExampleLink[] = [
  {
    slug: 'photos-app',
    title: 'Photos app',
    description: 'macOS Photos–style square grid under a sticky, blurred toolbar with a fade gradient and "Library" title.',
  },
  {
    slug: 'photos-app-rtl',
    title: 'Photos app (RTL)',
    description:
      'The same photos app mirrored for a right-to-left locale — dir="rtl" on Lightbox.Root mirrors navigation, the thumbnail strip, and the arrow keys.',
  },
  {
    slug: 'infinite-scroll',
    title: 'Infinite scroll',
    description:
      'An endless feed where the lightbox paginates too — one photo array drives grid tiles and slides; the grid loads pages via an IntersectionObserver sentinel, and onValueChange fetches ahead inside the open viewer. The viewer is Lightbox.VirtualSlides: only a window of slides around the active index is mounted, so the native scroll-snap track stays cheap however long the feed grows, with a minimal Previous/Next chrome (no thumbnails).',
  },
  {
    slug: 'url-synced-state',
    title: 'URL-synced state',
    description:
      'Masonry wall wired to Next.js dynamic routes ([[...id]]) — every photo is a shareable URL: deep links open the viewer on that slide, swiping rewrites the URL in place, and browser Back closes the viewer.',
    pagePath: 'url-synced-state/[[...id]]/page.tsx',
    extraSources: [
      '(docs)/examples/lightbox/url-synced-state/url-synced-state-demo.tsx',
      '(docs)/examples/lightbox/url-synced-state/photos.ts',
      // The SSR deep-link pattern is inert without these: the no-transitions
      // rule and the strip's data-positioned reveal. A copy made from the .md
      // alone would fade itself in on load and snap the strip — with no error
      // to notice. (Painting the RIGHT slide pre-hydration is library-owned:
      // `Slides ssrSlideShift`, plus the `--lightbox-ssr-slide-gap` var set in
      // the chrome next to the track's gap utilities.)
      'lightbox-demo/ssr-no-transitions.css',
      'lightbox-demo/thumbnail-strip-scroll-link.css',
    ],
  },
  {
    slug: 'intercepted-routes',
    title: 'Intercepted routes',
    description:
      'The nextgram pattern: grid of plain Links, a @modal parallel-route slot, and an (.)photos/[id] intercepting route mounting an already-open controlled lightbox — Back closes it, hard loads get a standalone photo page (one URL, two presentations).',
    extraSources: [
      '(docs)/examples/lightbox/intercepted-routes/layout.tsx',
      '(docs)/examples/lightbox/intercepted-routes/photo-modal.tsx',
      '(docs)/examples/lightbox/intercepted-routes/photos.ts',
      '(docs)/examples/lightbox/intercepted-routes/@modal/default.tsx',
      '(docs)/examples/lightbox/intercepted-routes/@modal/(.)photos/[id]/page.tsx',
      '(docs)/examples/lightbox/intercepted-routes/photos/[id]/page.tsx',
    ],
  },
  {
    slug: 'text-message',
    title: 'Text message',
    description: 'iMessage-style chat with a single morphTo="origin" trigger over a stack of attachments.',
  },
  {
    slug: 'film-trailers',
    title: 'Film trailers',
    description: 'Movie posters morph into a fullscreen <video> that auto-plays on becoming active.',
  },
  {
    slug: '3d-models',
    title: '3D models',
    description:
      'Three.js product grid with Lightbox.Slides — onBeforeOpen preheats GLBs before the morph; shared orbit with each trigger.',
  },
];

export const exampleGroups: ExampleGroup[] = [
  { group: 'Lightbox', basePath: '/examples/lightbox', links: lightboxExamples },
];
