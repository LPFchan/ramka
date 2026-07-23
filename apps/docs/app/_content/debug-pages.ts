/** Dev-only debug pages — linked from the sidebar in development only. */
export const debugPages = {
  mediaStretch: {
    href: '/debug/media-stretch',
    title: 'Media stretch',
    description: 'Verify Lightbox.Media grid-stretches a direct img child without size-full.',
  },
} as const;

export const debugPagesList = Object.values(debugPages);
