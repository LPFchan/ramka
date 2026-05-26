export interface ExampleLink {
  slug: string;
  title: string;
  description: string;
}

export const examples: ExampleLink[] = [
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
