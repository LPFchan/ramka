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
  /** Extra source files to embed in the example's `.md`, same base dir. */
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
    slug: 'moodboard',
    title: 'Moodboard',
    description:
      'Masonry wall wired to Next.js dynamic routes ([[...id]]) — every photo is a shareable URL: deep links open the viewer on that slide, swiping rewrites the URL in place, and browser Back closes the viewer.',
    pagePath: 'moodboard/[[...id]]/page.tsx',
    extraSources: ['moodboard/moodboard-demo.tsx', 'moodboard/photos.ts'],
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
