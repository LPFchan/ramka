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

export function MobileNav() {
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-neutral-200 bg-white/80 px-4 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-950/80 md:hidden">
      <Drawer open={open} onOpenChange={setOpen} swipeDirection="down" showSwipeHandle>
        <DrawerTrigger
          aria-label="Open navigation"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <Menu className="h-4 w-4" />
        </DrawerTrigger>

        <DrawerContent className="data-[swipe-axis=y]:[--drawer-content-max-height:85dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>ramka</DrawerTitle>
            <DrawerDescription>Unstyled gallery & lightbox primitives</DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2">
            <SidebarNav onNavigate={() => setOpen(false)} />
          </div>
        </DrawerContent>
      </Drawer>

      <Link
        href="/"
        className="text-sm font-semibold tracking-tight text-neutral-900 hover:text-neutral-600 dark:text-neutral-50 dark:hover:text-neutral-300"
      >
        ramka
      </Link>

      <ThemeToggle />
    </header>
  );
}
