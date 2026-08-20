import { notFound } from 'next/navigation';

export const metadata = {
  title: 'Chromium VT repros · ramka',
  robots: { index: false, follow: false },
};

/**
 * Dev-only launcher for the standalone Chromium bug-report HTML.
 * The linked pages are static files (no Next layout / ramka / docs chrome)
 * so they match what we file on issues.chromium.org.
 */
export default function ChromiumReproIndexPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Chromium repros</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Raw HTML — same files as <code>repros/chromium/</code>. Open on Chrome
          Android with the URL bar visible. Keep this tab in the foreground.
        </p>
      </div>
      <a
        className="rounded-lg border px-4 py-4 text-lg"
        href="/debug/chromium-url-bar.html"
      >
        1. URL bar aborts View Transition
      </a>
      <a
        className="rounded-lg border px-4 py-4 text-lg"
        href="/debug/chromium-safe-area-resize.html"
      >
        2. env(safe-area-inset) overlay fires resize
      </a>
    </div>
  );
}
