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

export const scrollGalleryExamples: ExampleLink[] = [
  { slug: 'default', title: 'Default', description: 'The basic horizontal gallery with snap, buttons, and marker dots.' },
  {
    slug: 'dynamic-items',
    title: 'Dynamic items',
    description: 'Add and remove items at runtime; the markers and button state stay in sync.',
  },
  {
    slug: 'without-scroll-snap',
    title: 'Without scroll snap',
    description: 'The same gallery without `scroll-snap-type`.',
  },
  {
    slug: 'imperative-scroll-to',
    title: 'Imperative scrollTo',
    description: 'Drive the gallery programmatically via `ref.current.scrollTo(index)`.',
  },
  { slug: 'vertical', title: 'Vertical', description: 'A vertically scrolling gallery with vertical navigation.' },
  {
    slug: 'default-value',
    title: 'Default value',
    description: 'Start the gallery at a specific item using `defaultValue`.',
  },
  {
    slug: 'step-by-item',
    title: 'Step by item',
    description: 'Use `step={1}` on the buttons to advance one item at a time.',
  },
  {
    slug: 'step-by-item-no-snap',
    title: 'Step by item (no snap)',
    description: 'Step buttons working without `scroll-snap-type`.',
  },
  {
    slug: 'product-gallery',
    title: 'Product gallery',
    description: 'A real-world product page layout with overlay nav, dash markers, and thumbnail markers.',
  },
  { slug: 'loop', title: 'Loop', description: 'Set `loop` to wrap navigation at the boundaries.' },
  {
    slug: 'loop-step-by-item',
    title: 'Loop + step by item',
    description: 'Combining `loop` with `step={1}` on the buttons.',
  },
  {
    slug: 'resizable-viewport',
    title: 'Resizable viewport',
    description: 'The active index recomputes as the viewport resizes.',
  },
  { slug: 'snap-to-center', title: 'Snap to center', description: 'Items snap to the viewport center.' },
  {
    slug: 'controlled-value',
    title: 'Controlled (value)',
    description: 'Fully controlled mode where your state is the single source of truth.',
  },
  {
    slug: 'scroll-behavior',
    title: 'Scroll behavior',
    description: 'Toggle between smooth and instant programmatic scrolling.',
  },
  {
    slug: 'testimonials',
    title: 'Testimonials',
    description: 'A real-world testimonial carousel with center-aligned cards and edge fades.',
  },
];

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
    description: 'Drive open / close / goTo via ref.current.* — no buttons needed.',
  },
  {
    slug: 'lifecycle-callbacks',
    title: 'Lifecycle callbacks',
    description: 'See onOpenChange (fires immediately) and onOpenChangeComplete (after animations) in action.',
  },
  {
    slug: 'lazy-loading',
    title: 'Lazy loading',
    description: 'Render heavy items only when active using Item render props and preload={0}.',
  },
  {
    slug: 'morph-to-setting',
    title: 'morphTo strategies',
    description: 'Side-by-side comparison of morphTo="active" vs "origin" vs "closest".',
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
    description: 'Property page with hero grid + remaining photos; lightbox shows all photos in a scroll gallery.',
  },
  {
    slug: 'design-file-inspector',
    title: 'Design file inspector',
    description: 'Masonry grid of 32 design screens with a vertical scroll-gallery presentation mode.',
  },
];

export const exampleGroups: ExampleGroup[] = [
  { group: 'ScrollGallery', basePath: '/examples', links: scrollGalleryExamples },
  { group: 'Lightbox', basePath: '/examples/lightbox', links: lightboxExamples },
];

/**
 * Back-compat re-export so existing scroll-gallery pages keep working
 * (page.tsx imports `examples` directly).
 */
export const examples: ExampleLink[] = scrollGalleryExamples;
