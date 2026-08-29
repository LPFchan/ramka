import type { MetadataRoute } from 'next';

import { navSections } from './_content/nav';
import { siteUrl } from './_content/site';

/** Routes that have no sidebar entry: the landing page, articles, and the legal pages. */
const unlistedRoutes = [
  '/',
  '/blog/why-native-scrolling',
  '/license',
  '/license/commercial',
  '/license/notices',
  '/privacy',
  '/returns',
  '/terms',
];

/**
 * Docs, presets and examples are taken from the sidebar, so a new page reaches
 * the sitemap by being navigable rather than by being remembered here. Debug
 * routes are dropped: the sidebar carries them outside production, and they are
 * not pages anyone should land on from search.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const navRoutes = navSections
    .flatMap((section) => [...section.links, ...(section.groups?.flatMap((group) => group.links) ?? [])])
    .map((link) => link.href)
    .filter((href) => !href.startsWith('/debug') && !href.includes('#'));

  // `lastModified` is deliberately omitted. A CI checkout stamps every file with
  // the build time, so any value derived from the filesystem would claim the
  // whole site changed on every deploy — worse than saying nothing.
  return [...new Set([...unlistedRoutes, ...navRoutes])].map((route) => ({
    url: `${siteUrl}${route}`,
  }));
}
