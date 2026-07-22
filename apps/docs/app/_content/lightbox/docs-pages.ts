/** Lightbox docs IA — left-nav subpages under Components → Lightbox. */
export const lightboxDocsPages = {
  overview: {
    href: '/docs/lightbox',
    title: 'Overview',
  },
  viewTransitions: {
    href: '/docs/lightbox/view-transitions',
    title: 'View transitions',
  },
  api: {
    href: '/docs/lightbox/api',
    title: 'API reference',
  },
} as const;

const api = lightboxDocsPages.api.href;

/** Deep links into `/docs/lightbox/api` part sections. */
export const lightboxApiHref = {
  root: `${api}#api-root`,
  trigger: `${api}#api-trigger`,
  item: `${api}#api-item`,
  documentVt: `${api}#api-view-transition-document`,
  useTriggerContext: `${api}#api-use-trigger-context`,
  useItemContext: `${api}#api-use-item-context`,
} as const;
