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

export const navSections: NavSection[] = [
  {
    title: 'Getting started',
    links: [{ href: '/', title: 'Installation' }],
  },
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
  {
    title: 'Examples',
    links: lightboxExamples.map(toExampleLink),
  },
];
