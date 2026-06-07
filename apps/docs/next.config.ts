import type { NextConfig } from 'next';

// When building for GitHub Pages we serve the site from
// https://<user>.github.io/<repo>/, so it needs a base path and a fully
// static export. This is enabled via the GITHUB_PAGES env var (set in CI)
// so local `next dev`/`next start` keep working at the root.
const isGithubPages = process.env.GITHUB_PAGES === 'true';
const basePath = isGithubPages ? '/ramka' : '';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['ramka'],
  ...(isGithubPages
    ? {
        output: 'export',
        basePath,
        // Next's image optimizer needs a server; disable it for static export.
        images: { unoptimized: true },
        // Avoid 404s on refresh by emitting `path/index.html` files.
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
