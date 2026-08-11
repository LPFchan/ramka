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
    slug: 'text-message',
    title: 'Text message',
    description: 'iMessage-style chat with a single morphTo="origin" trigger over a stack of attachments.',
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
    slug: 'google-maps',
    title: 'Google Maps',
    description:
      'Map preview of Wrocław morphs into a fullscreen Google Map — onBeforeOpen waits for the iframe to load; pull-to-dismiss off so pan/zoom stay with the map.',
  },
];

export const exampleGroups: ExampleGroup[] = [
  { group: 'Lightbox', basePath: '/examples/lightbox', links: lightboxExamples },
];
