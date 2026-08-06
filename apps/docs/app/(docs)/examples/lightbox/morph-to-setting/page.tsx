'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Old Examples alias — demos live on View transitions. */
export default function MorphToRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/docs/lightbox/view-transitions#morph-to');
  }, [router]);
  return (
    <p className="px-6 py-12 text-sm text-neutral-500">
      Moved to{' '}
      <a href="/docs/lightbox/view-transitions#morph-to" className="underline">
        View transitions → Root morphTo
      </a>
      .
    </p>
  );
}
