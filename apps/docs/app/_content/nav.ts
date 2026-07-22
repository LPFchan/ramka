import { lightboxExamples, type ExampleLink } from '../_components/examples';
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
  /** Optional nested groups (e.g. Components → Lightbox, Examples → API patterns). */
  groups?: { title: string; links: NavLink[] }[];
}

/** Example slugs that demonstrate API patterns (vs product case studies). */
const apiPatternSlugs = new Set(['lazy-loading']);

function toExampleLink(ex: ExampleLink): NavLink {
  return {
    href: `/examples/lightbox/${ex.slug}`,
    title: ex.title,
    description: ex.description,
  };
}

const apiPatternExamples = lightboxExamples
  .filter((ex) => apiPatternSlugs.has(ex.slug))
  .map(toExampleLink);

const productExamples = lightboxExamples
  .filter((ex) => !apiPatternSlugs.has(ex.slug))
  .map(toExampleLink);

export const navSections: NavSection[] = [
  {
    title: 'Getting started',
    links: [{ href: '/', title: 'Installation' }],
  },
  {
    title: 'Components',
    links: [],
    groups: [
      {
        title: 'Lightbox',
        links: [
          lightboxDocsPages.overview,
          lightboxDocsPages.stateLifecycle,
          lightboxDocsPages.composition,
          lightboxDocsPages.viewTransitions,
          lightboxDocsPages.gestures,
          lightboxDocsPages.api,
        ],
      },
    ],
  },
  {
    title: 'Examples',
    links: [],
    groups: [
      { title: 'API patterns', links: apiPatternExamples },
      { title: 'Product', links: productExamples },
    ],
  },
];
