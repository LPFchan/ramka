import { lightboxExamples, type ExampleLink } from '../_components/examples';

export interface NavLink {
  href: string;
  title: string;
  description?: string;
}

export interface NavSection {
  title: string;
  links: NavLink[];
  /** Optional nested groups (e.g. Examples → API patterns / Product). */
  groups?: { title: string; links: NavLink[] }[];
}

/** Example slugs that demonstrate API patterns (vs product case studies). */
const apiPatternSlugs = new Set([
  'default',
  'controlled',
  'imperative-api',
  'lifecycle-callbacks',
  'lazy-loading',
  'morph-to-setting',
  'crossfade',
]);

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
    links: [{ href: '/docs/lightbox', title: 'Lightbox' }],
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
