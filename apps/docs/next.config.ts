import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@ramka/react'],
  async headers() {
    return [
      {
        // Apple Pay domain verification: no charset, no HTML, no redirect.
        source: '/.well-known/apple-developer-merchantid-domain-association',
        headers: [{ key: 'Content-Type', value: 'application/octet-stream' }],
      },
    ];
  },
};

export default nextConfig;
