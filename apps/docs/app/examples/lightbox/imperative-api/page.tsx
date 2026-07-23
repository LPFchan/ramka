'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Moved into Lightbox → State & lifecycle. */
export default function ImperativeRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/docs/lightbox/state-lifecycle#imperative');
  }, [router]);
  return (
    <p className="px-6 py-12 text-sm text-neutral-500">
      Moved to{' '}
      <a href="/docs/lightbox/state-lifecycle#imperative" className="underline">
        State & lifecycle → Imperative API
      </a>
      .
    </p>
  );
}
