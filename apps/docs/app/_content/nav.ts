import { lightboxExamples, type ExampleLink } from '../_components/examples';
import { lightboxPresets } from '../(docs)/presets/presets';
import { debugPagesList } from './debug-pages';
import { lightboxDocsPages } from './lightbox/docs-pages';

export interface NavLink {
  href: string;
  title: string;
  description?: string;
  /**
   * When true (default for most links), only an exact pathname match is active.
   * Use `prefix` so a parent route stays highlighted on nested pages.
   */
  match?: 'exact' | 'prefix';
}

export interface NavSection {
  title: string;
  links: NavLink[];
  /** Optional nested groups under a section title. */
  groups?: { title: string; links: NavLink[] }[];
}

function toExampleLink(ex: ExampleLink): NavLink {
  return {
    href: `/examples/lightbox/${ex.slug}`,
    title: ex.title,
    description: ex.description,
  };
}

const baseNavSections: NavSection[] = [
  {
    title: 'Getting started',
    links: [{ href: '/docs', title: 'Installation' }],
  },
  {
    title: 'Lightbox',
    links: [
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
    ],
  },
  {
    title: 'Presets',
    links: lightboxPresets,
  },
  {
    title: 'Examples',
    links: lightboxExamples.map(toExampleLink),
  },
];

const debugNavSection: NavSection = {
  title: 'Debug',
  links: debugPagesList.map((page) => ({
    href: page.href,
    title: page.title,
    description: page.description,
  })),
};

/** Sidebar sections. Debug links are included only outside production builds. */
export const navSections: NavSection[] =
  process.env.NODE_ENV === 'production'
    ? baseNavSections
    : [...baseNavSections, debugNavSection];
