'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Old Examples alias — demos live on View transitions. */
export default function CrossfadeRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/docs/lightbox/view-transitions#crossfade');
  }, [router]);
  return (
    <p className="px-6 py-12 text-sm text-neutral-500">
      Moved to{' '}
      <a href="/docs/lightbox/view-transitions#crossfade" className="underline">
        View transitions → Trigger crossfade
      </a>
      .
    </p>
  );
}
