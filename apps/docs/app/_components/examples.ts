export interface ExampleLink {
  slug: string;
  title: string;
  description: string;
}

export interface ExampleGroup {
  group: string;
  basePath: string;
  links: ExampleLink[];
}

export const lightboxExamples: ExampleLink[] = [
  {
    slug: 'responsive-gallery',
    title: 'Responsive gallery',
    description:
      'The canonical real-world lightbox in a social feed: crossfade `+N` grids, swipe navigation, desktop-only thumbnails, view-transition morph, pinch/scroll zoom, and pull-to-dismiss.',
  },
  {
    slug: 'photos-app',
    title: 'Photos app',
    description: 'macOS Photos–style square grid under a sticky, blurred toolbar with a fade gradient and "Library" title.',
  },
  {
    slug: 'moodboard',
    title: 'Moodboard',
    description:
      'Masonry wall of images with unknown dimensions (no width/height, no reserved aspect ratio) — stresses the morph size-resolution fallback and trigger-thumbnail placeholder.',
  },
  {
    slug: 'default',
    title: 'Default',
    description: 'A grid of triggers opens a fullscreen modal — uses Lightbox.Backdrop for the scrim.',
  },
  {
    slug: 'controlled',
    title: 'Controlled',
    description: 'External state drives both the open prop and the active index.',
  },
  {
    slug: 'imperative-api',
    title: 'Imperative API',
    description:
      'Root ref open/close/goTo — note programmatic open has no trigger morph (View transitions guide).',
  },
  {
    slug: 'lifecycle-callbacks',
    title: 'Lifecycle callbacks',
    description: 'See onOpenChange (fires immediately) and onOpenChangeComplete (after animations) in action.',
  },
  {
    slug: 'lazy-loading',
    title: 'Lazy loading',
    description:
      'ItemGroup preload + active/visible render props — see Composition → ItemGroup.',
  },
  {
    slug: 'text-message',
    title: 'Text message',
    description: 'iMessage-style chat with a single morphTo="origin" trigger over a stack of attachments.',
  },
  {
    slug: 'within-article',
    title: 'Within article',
    description: 'Lightbox triggers embedded in long-form article copy with float layouts.',
  },
  {
    slug: 'color-palette',
    title: 'Color palette',
    description: 'Flat color swatches morph into full photographs dominated by that hue.',
  },
  {
    slug: 'film-trailers',
    title: 'Film trailers',
    description: 'Movie posters morph into a fullscreen <video> that auto-plays on becoming active.',
  },
  {
    slug: 'real-estate-listing',
    title: 'Real estate listing',
    description: 'Property page with hero grid + remaining photos; lightbox shows all photos in a swipeable Lightbox.Slides viewport.',
  },
];

export const exampleGroups: ExampleGroup[] = [
  { group: 'Lightbox', basePath: '/examples/lightbox', links: lightboxExamples },
];
