/** Lightbox docs IA — left-nav pages under Lightbox. */
export const lightboxDocsPages = {
  overview: {
    href: '/docs/lightbox',
    title: 'Overview',
  },
  stateLifecycle: {
    href: '/docs/lightbox/state-lifecycle',
    title: 'State & lifecycle',
  },
  composition: {
    href: '/docs/lightbox/composition',
    title: 'Composition',
  },
  nextjsImage: {
    href: '/docs/lightbox/nextjs-image',
    title: 'Next.js Image',
  },
  viewTransitions: {
    href: '/docs/lightbox/view-transitions',
    title: 'View transitions',
  },
  gestures: {
    href: '/docs/lightbox/gestures',
    title: 'Gestures',
  },
  zoom: {
    href: '/docs/lightbox/zoom',
    title: 'Zoom & a11y',
  },
  rtl: {
    href: '/docs/lightbox/rtl',
    title: 'RTL support',
  },
  csp: {
    href: '/docs/lightbox/csp',
    title: 'Content Security Policy',
  },
  api: {
    href: '/docs/lightbox/api',
    title: 'API reference',
  },
} as const;

/** Ordered pager trail for Lightbox docs. */
export const lightboxDocsPagerOrder = [
  lightboxDocsPages.overview,
  lightboxDocsPages.stateLifecycle,
  lightboxDocsPages.composition,
  lightboxDocsPages.nextjsImage,
  lightboxDocsPages.viewTransitions,
  lightboxDocsPages.gestures,
  lightboxDocsPages.zoom,
  lightboxDocsPages.rtl,
  lightboxDocsPages.csp,
  lightboxDocsPages.api,
] as const;

const api = lightboxDocsPages.api.href;

/** Deep links into `/docs/lightbox/api` part sections. */
export const lightboxApiHref = {
  root: `${api}#api-root`,
  trigger: `${api}#api-trigger`,
  portal: `${api}#api-portal`,
  content: `${api}#api-content`,
  stage: `${api}#api-stage`,
  backdrop: `${api}#api-backdrop`,
  close: `${api}#api-close`,
  item: `${api}#api-item`,
  media: `${api}#api-media`,
  slides: `${api}#api-slides`,
  slide: `${api}#api-slide`,
  previous: `${api}#api-previous`,
  next: `${api}#api-next`,
  counter: `${api}#api-counter`,
  caption: `${api}#api-caption`,
  thumbnailGroup: `${api}#api-thumbnail-group`,
  thumbnail: `${api}#api-thumbnail`,
  thumbnailStrip: `${api}#api-thumbnail-strip`,
  thumbnailStripTrack: `${api}#api-thumbnail-strip-track`,
  zoom: `${api}#api-zoom`,
  zoomIn: `${api}#api-zoom-in`,
  zoomOut: `${api}#api-zoom-out`,
  cspProvider: `${api}#api-csp-provider`,
  documentVt: `${api}#api-view-transition-document`,
  types: `${api}#types`,
  useTriggerContext: `${api}#api-use-trigger-context`,
  useItemContext: `${api}#api-use-item-context`,
  useMediaContext: `${api}#api-use-media-context`,
  createHandle: `${api}#api-create-handle`,
  zoomRef: `${api}#api-zoom-ref`,
} as const;
