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
    slug: 'default',
    title: 'Default',
    description: 'A grid of triggers opens a fullscreen modal — uses Lightbox.Backdrop for the scrim.',
  },
  {
    slug: 'with-thumbnails',
    title: 'With thumbnails',
    description: 'Add a Lightbox.ThumbnailGroup with arrow-key tablist navigation.',
  },
  {
    slug: 'with-captions',
    title: 'With captions',
    description: 'Per-item captions exposed through Lightbox.Caption with aria-live updates.',
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
    slug: 'with-zoom',
    title: 'With zoom',
    description: 'Pinch, double-tap, scroll, and keyboard zoom + pan inside a Lightbox.Zoom wrapper.',
  },
  {
    slug: 'view-transition',
    title: 'View transition morph',
    description: 'Animate the trigger thumbnail into the lightbox using the View Transitions API.',
  },
  {
    slug: 'lifecycle-callbacks',
    title: 'Lifecycle callbacks',
    description: 'See onOpenChange (fires immediately) and onOpenChangeComplete (after animations) in action.',
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
