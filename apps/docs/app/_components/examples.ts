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
    slug: 'moodboard-snug',
    title: 'Moodboard (snug slides)',
    description:
      'Mixed-media masonry moodboard — photos, two colorful vertical clips, and three orbitable 3D models — with full-bleed slides and sibling dim/blur while zoomed.',
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
    slug: '3d-models',
    title: '3D models',
    description:
      'Three.js product grid with Lightbox.Slides — onBeforeOpen preheats GLBs before the morph; shared orbit with each trigger.',
  },



  {
    slug: 'real-estate-listing',
    title: 'Real estate listing',
    description: 'Property page with hero grid + remaining photos; lightbox shows all photos in a swipeable Lightbox.Slides viewport.',
  },
  {
    slug: 'google-maps',
    title: 'Google Maps',
    description:
      'Map preview of Wrocław morphs into a fullscreen Google Map — onBeforeOpen waits for the iframe to load; pull-to-dismiss off so pan/zoom stay with the map.',
  },
];

export const exampleGroups: ExampleGroup[] = [
  { group: 'Lightbox', basePath: '/examples/lightbox', links: lightboxExamples },
];
