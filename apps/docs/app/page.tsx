import Link from 'next/link';

import { ApplesToApples } from './_components/apples-to-apples';
import { EnvironmentBanner } from './_components/environment-banner';
import { FooterWordplay } from './_components/footer-wordplay';
import { InstallCommand } from './_components/install-command';
import { LandingDemo } from './_components/landing-demo';
import { SponsorSection } from './_components/sponsor-section';
import { SponsorsShowcase } from './_components/sponsors-showcase';
import { ThemeToggle } from './_components/theme-toggle';

const GITHUB_URL = 'https://github.com/arturbien/ramka';

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <div className="isolate flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          ramka
        </span>
        <div className="flex items-center gap-2">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="ramka on GitHub"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <GitHubIcon className="h-4 w-4" />
          </a>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-3xl px-6 pt-16 text-center md:pt-24">
          <h1 className="text-balance text-5xl font-semibold tracking-tight text-neutral-950 md:text-7xl dark:text-neutral-50">
            The lightbox for&nbsp;React.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-neutral-500 md:text-xl dark:text-neutral-400">
            Unstyled, accessible primitives built on native scrolling and view transitions.
            Morph, swipe, zoom, and pull-to-dismiss, all out of the box.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/docs"
              className="inline-flex h-11 items-center rounded-full bg-neutral-900 px-6 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-300"
            >
              Documentation
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-neutral-200 px-6 text-sm font-medium text-neutral-900 transition hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-900"
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
        </section>

        <ApplesToApples />

        <EnvironmentBanner />

        <SponsorsShowcase />

        <SponsorSection />
      </main>

      <footer className="border-t border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-neutral-500 dark:text-neutral-400">
          <FooterWordplay />
          <nav className="flex items-center gap-5">
            <Link href="/docs" className="transition hover:text-neutral-900 dark:hover:text-neutral-100">
              Docs
            </Link>
            <Link
              href="/examples/lightbox/responsive-gallery"
              className="transition hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              Examples
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              GitHub
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
