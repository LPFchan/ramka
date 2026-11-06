/** Dev-only debug pages — linked from the sidebar in development only. */
export const debugPages = {
  minimalComposition: {
    href: '/debug/minimal-composition',
    title: 'Minimal composition',
    description:
      'Morph, swipe, zoom and chrome from 15 parts, with a live part-identity and engine-fetch audit.',
  },
  mediaStretch: {
    href: '/debug/media-stretch',
    title: 'Media stretch',
    description: 'Verify Lightbox.Media grid-stretches a direct img child without size-full.',
  },
  thumbnailStrip: {
    href: '/debug/thumbnail-strip',
    title: 'ThumbnailStrip',
    description: 'Recipes for Lightbox.ThumbnailStrip — bare through creative skins.',
  },
  lightboxOverlays: {
    href: '/debug/lightbox-overlays',
    title: 'Lightbox overlays',
    description: 'Default preset + shadcn dialog, dropdown, and tooltip inside the viewer.',
  },
  dynamicItems: {
    href: '/debug/dynamic-items',
    title: 'Dynamic items',
    description: 'Docs chrome + in-viewer dropdown to add/remove slides while open.',
  },
  doubleClickOpen: {
    href: '/debug/double-click-open',
    title: 'Double-click open',
    description: 'Double-click preview + accessible Open trigger via createHandle().',
  },
  moodboardSnug: {
    href: '/debug/moodboard-snug',
    title: 'Moodboard (snug slides)',
    description:
      'Mixed-media masonry moodboard — photos, vertical clips, and 3D models — with snug slides and sibling dim/blur while zoomed.',
  },
  realEstateListing: {
    href: '/debug/real-estate-listing',
    title: 'Real estate listing',
    description:
      'Property page with hero grid + remaining photos; lightbox shows all photos in a swipeable Lightbox.Slides viewport.',
  },
  morphEasterEggs: {
    href: '/debug/morph-easter-eggs',
    title: 'Morph easter eggs',
    description:
      "Five candidate easter eggs for the landing page's morph bento card — the same card wired to different custom lightboxes.",
  },
  heavyFeed: {
    href: '/debug/heavy-feed',
    title: 'Heavy feed',
    description:
      'Feed-shaped stress page for morph profiling — URL-driven DOM size (500–20k elements), synthetic main-thread load, and live-update churn.',
  },
} as const;

export const debugPagesList = Object.values(debugPages);
