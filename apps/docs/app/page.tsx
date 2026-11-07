import Link from 'next/link';

import { siteUrl } from './_content/site';
import { ApplesToApples } from './_components/apples-to-apples';
import { FeaturesBento } from './_components/features-bento';
import { FramedTestimonial } from './_components/framed-testimonial';
import { GitHubIcon } from './_components/github-icon';
import { InstallCommand } from './_components/install-command';
import { LandingDemo } from './_components/landing-demo';
import { SiteFooter } from './_components/site-footer';
import { SiteHeader } from './_components/site-header';
import { TrustedBy } from './_components/trusted-by';

const GITHUB_URL = 'https://github.com/arturbien/ramka';

/** schema.org entity markup for search engines. */
const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'ramka',
  url: siteUrl,
  description:
    'Headless React lightbox with View Transitions morph animations, pinch to zoom, swipe navigation, and pull to dismiss. Unstyled, accessible image gallery primitives built on native scrolling.',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  sameAs: ['https://github.com/arturbien/ramka'],
  author: {
    '@type': 'Person',
    name: 'Artur Bień',
    url: 'https://github.com/arturbien',
  },
};

export default function HomePage() {
  return (
    <div className="isolate flex min-h-screen flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <SiteHeader />

      <main className="flex-1">
        <section className="mx-auto w-full max-w-3xl px-6 pt-16 text-center md:pt-24">
          <h1 className="text-balance text-5xl font-semibold tracking-tight text-neutral-950 md:text-7xl dark:text-neutral-50">
            The lightbox for&nbsp;React.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-neutral-500 md:text-xl dark:text-neutral-400">
            Unstyled, accessible primitives built on native scrolling and view transitions. Morph, swipe, zoom, and
            pull-to-dismiss, all out of the box.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/docs"
              className="inline-flex h-11 items-center rounded-full bg-neutral-900 px-4 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-300"
            >
              Documentation
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-neutral-200 px-4 text-sm font-medium text-neutral-900 transition hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-900"
            >
              <GitHubIcon className="h-4 w-4" />
              GitHub
            </a>
          </div>

          <div className="mt-5">
            <InstallCommand />
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-6 pb-24 pt-16 md:pt-24">
          <p className="mb-6 text-center text-sm text-neutral-400 dark:text-neutral-600">
            Click any image. Swipe, pinch to zoom, pull to dismiss.
          </p>
          <LandingDemo />
          <TrustedBy />
        </section>

        <FeaturesBento />

        <FramedTestimonial />

        <ApplesToApples />
      </main>

      <SiteFooter />
    </div>
  );
}
