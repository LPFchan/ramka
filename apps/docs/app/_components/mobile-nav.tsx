'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { SidebarNav } from './sidebar-nav';
import { ThemeToggle } from './theme-toggle';

const GITHUB_URL = 'https://github.com/arturbien/ramka';

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export function MobileNav() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {/* iOS 26 Safari ignores `theme-color` and tints the status bar from
          fixed/sticky elements near the top. A thin solid strip gives it pure
          white/black to sample; the nav surface lives on an absolute child. */}
      
      <header className="sticky top-0 z-40 md:hidden">
      <div
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-30 h-1 w-full bg-white dark:bg-black md:hidden"
      />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-black"
        />
        <div className="relative flex h-14 items-center justify-between gap-2 px-4">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-neutral-900 hover:text-neutral-600 dark:text-neutral-50 dark:hover:text-neutral-300"
          >
            ramka
          </Link>

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

            <Drawer open={open} onOpenChange={setOpen} swipeDirection="down" showSwipeHandle>
              <DrawerTrigger
                aria-label="Open navigation"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <Menu className="h-4 w-4" />
              </DrawerTrigger>

              <DrawerContent className="data-[swipe-axis=y]:[--drawer-content-max-height:85dvh]">
                <DrawerHeader className="text-left">
                  <DrawerTitle>ramka</DrawerTitle>
                  <DrawerDescription>The lightbox for React.</DrawerDescription>
                </DrawerHeader>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2">
                  <SidebarNav onNavigate={() => setOpen(false)} />
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        </div>
      </header>
    </>
  );
}
