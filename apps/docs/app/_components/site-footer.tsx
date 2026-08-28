import Link from 'next/link';

import { FooterWordplay } from './footer-wordplay';

const GITHUB_URL = 'https://github.com/arturbien/ramka';

const footerLinkClassName = 'transition hover:text-neutral-900 dark:hover:text-neutral-100';

/** Footer for the pages outside the docs shell. */
export function SiteFooter() {
  return (
    <footer className="border-t border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-neutral-500 dark:text-neutral-400">
        <FooterWordplay />
        <nav className="flex items-center gap-5">
          <Link href="/docs" className={footerLinkClassName}>
            Docs
          </Link>
          <Link href="/examples/lightbox/photos-app" className={footerLinkClassName}>
            Examples
          </Link>
          <Link href="/license" className={footerLinkClassName}>
            License
          </Link>
          <Link href="/terms" className={footerLinkClassName}>
            Terms
          </Link>
          <Link href="/privacy" className={footerLinkClassName}>
            Privacy
          </Link>
          <Link href="/returns" className={footerLinkClassName}>
            Returns
          </Link>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className={footerLinkClassName}>
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
