import type { ReactNode } from 'react';

import { MobileNav } from '../_components/mobile-nav';
import { Sidebar } from '../_components/sidebar';

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="isolate flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
