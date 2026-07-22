'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Moved into Lightbox → State & lifecycle. */
export default function ControlledRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/docs/lightbox/state-lifecycle#controlled');
  }, [router]);
  return (
    <p className="px-6 py-12 text-sm text-neutral-500">
      Moved to{' '}
      <a href="/docs/lightbox/state-lifecycle#controlled" className="underline">
        State & lifecycle → Controlled state
      </a>
      .
    </p>
  );
}
