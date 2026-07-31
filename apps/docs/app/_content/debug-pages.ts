/** Dev-only debug pages — linked from the sidebar in development only. */
export const debugPages = {
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
} as const;

export const debugPagesList = Object.values(debugPages);
