import type { MetadataRoute } from 'next';

import { siteUrl } from './_content/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: '/debug/' }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
