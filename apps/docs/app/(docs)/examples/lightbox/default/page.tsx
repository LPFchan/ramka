'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Removed — use Overview hero / Composition instead. */
export default function DefaultRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/docs/lightbox');
  }, [router]);
  return (
    <p className="px-6 py-12 text-sm text-neutral-500">
      Moved to{' '}
      <a href="/docs/lightbox" className="underline">
        Lightbox overview
      </a>
      .
    </p>
  );
}
