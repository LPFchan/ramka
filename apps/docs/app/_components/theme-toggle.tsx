'use client';

import * as React from 'react';
import { flushSync } from 'react-dom';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

const supportsViewTransitions = () =>
  typeof document !== 'undefined' &&
  typeof (document as Document & { startViewTransition?: unknown }).startViewTransition === 'function';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function ThemeToggle({ variant = 'outline' }: { variant?: 'outline' | 'ghost' }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === 'dark';

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark';

    // next-themes applies the `class` attribute in a useEffect, which runs
    // *after* the View Transition callback — so the new snapshot would miss
    // the theme change. Apply the class synchronously here, then sync React
    // state via setTheme (its effect becomes a no-op).
    const apply = () => {
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(next);
      root.style.colorScheme = next;
      setTheme(next);
    };

    if (!supportsViewTransitions() || prefersReducedMotion()) {
      apply();
      return;
    }

    (
      document as Document & { startViewTransition: (cb: () => void) => unknown }
    ).startViewTransition(() => flushSync(apply));
  };

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={toggleTheme}
      className={
        variant === 'ghost'
          ? 'inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 transition hover:bg-black/[0.05] hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/[0.08] dark:hover:text-neutral-100'
          : 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'
      }
    >
      {/* Avoid a hydration mismatch: until mounted we don't know the resolved
          theme, so render a stable icon and swap once on the client. */}
      {mounted && isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
