'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Consent gate for the Whop pixel. The pixel stores a browser identifier
 * (cookies/local storage), which under the ePrivacy rules (art. 5(3) of
 * Directive 2002/58/EC; in Poland art. 399 of the Electronic Communications
 * Law) needs prior consent — it is conversion attribution, not storage
 * strictly necessary for the site. Vercel Analytics is cookieless and stays
 * outside the gate; the theme preference is user-requested functionality.
 *
 * The choice lands in localStorage under CONSENT_STORAGE_KEY, which the inline
 * bootstrap in the root layout reads on later loads so a consented visitor's
 * pixel still runs at first paint. Storing the choice itself is exempt storage
 * (it exists only to honor the visitor's decision).
 */
export const CONSENT_STORAGE_KEY = 'ramka-consent';

/** Reopens the banner, so consent can be withdrawn as easily as it was given. */
const OPEN_EVENT = 'ramka:consent-open';

declare global {
  interface Window {
    /** Defined by the inline bootstrap in the root layout. */
    __ramkaLoadWhopPixel?: () => void;
  }
}

function storedChoice(): string | null {
  try {
    return localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

const buttonBase =
  'inline-flex h-9 flex-1 items-center justify-center rounded-full px-4 text-[13px] font-medium transition';

export function ConsentBanner() {
  // Closed until the effect runs: the server render can't know the stored
  // choice, and flashing the banner at every returning visitor would be worse
  // than a first-paint delay for new ones.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const choice = storedChoice();
    if (choice !== 'granted' && choice !== 'denied') setOpen(true);

    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  if (!open) return null;

  const choose = (choice: 'granted' | 'denied') => {
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, choice);
    } catch {
      // Storage unavailable: treat as session-only. The pixel still only
      // loads on an explicit allow.
    }
    if (choice === 'granted') window.__ramkaLoadWhopPixel?.();
    setOpen(false);
  };

  return (
    <div
      role="region"
      aria-label="Tracking consent"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-24px_rgba(0,0,0,0.18)] sm:left-4 sm:mx-0 dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_16px_40px_-24px_rgba(0,0,0,0.8)]"
    >
      <p className="text-[13px] leading-5 text-neutral-600 dark:text-neutral-400">
        Allow a conversion pixel? It stores an identifier in your browser so a later license purchase can be attributed
        to this visit. Site analytics are cookieless either way.{' '}
        <Link
          href="/privacy"
          className="underline decoration-neutral-300 underline-offset-2 transition hover:decoration-neutral-500 dark:decoration-neutral-700 dark:hover:decoration-neutral-500"
        >
          Privacy Policy
        </Link>
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => choose('granted')}
          className={`${buttonBase} bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-300`}
        >
          Allow
        </button>
        <button
          type="button"
          onClick={() => choose('denied')}
          className={`${buttonBase} border border-neutral-200 text-neutral-900 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-900`}
        >
          Decline
        </button>
      </div>
    </div>
  );
}

/** Footer entry point for changing the stored choice later. */
export function ConsentPreferencesLink({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      Tracking preferences
    </button>
  );
}
