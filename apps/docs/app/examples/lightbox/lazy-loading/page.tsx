'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Moved into Lightbox → Composition. */
export default function LazyLoadingRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/docs/lightbox/composition#item-group');
  }, [router]);
  return (
    <p className="px-6 py-12 text-sm text-neutral-500">
      Moved to{' '}
      <a href="/docs/lightbox/composition#item-group" className="underline">
        Composition → ItemGroup
      </a>
      .
    </p>
  );
}
