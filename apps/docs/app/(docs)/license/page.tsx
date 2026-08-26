import type { Metadata } from 'next';

import { docsLinkClassName } from '../../_components/docs-link';

const GPL_URL = 'https://www.gnu.org/licenses/gpl-3.0.html';

export const metadata: Metadata = {
  title: 'License — ramka',
  description: 'ramka is dual-licensed: GPL-3.0-only, or a commercial license for proprietary software.',
};

export default function LicensePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-14 md:px-10 md:py-16">
      <h1 className="text-5xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">License</h1>
      <p className="mt-6 text-[17px] leading-7 text-neutral-600 dark:text-neutral-400">ramka is dual-licensed.</p>
      <p className="mt-4 text-[17px] leading-7 text-neutral-600 dark:text-neutral-400">
        Use it under{' '}
        <a href={GPL_URL} target="_blank" rel="noreferrer" className={docsLinkClassName}>
          GPL-3.0-only
        </a>{' '}
        for free, or purchase a commercial license for proprietary software.
      </p>

      <section className="mt-14 space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Commercial license
        </h2>
        <p className="text-[15px] leading-7 text-neutral-600 dark:text-neutral-400">
          The commercial license lets you use ramka in proprietary software without relying on the GPL.
        </p>
        <p className="text-[15px] leading-7 text-neutral-600 dark:text-neutral-400">
          Pricing and full commercial terms are coming soon.
        </p>
      </section>
    </div>
  );
}
