import * as React from 'react';
import * as Lightbox from '@ramka/react/lightbox';
import { headers } from 'next/headers';

/**
 * Wiring the CSP nonce: one provider above everything that renders lightbox
 * parts (including detached Triggers outside any Root), fed the same
 * per-request nonce the server put in the `style-src` directive.
 *
 * @docsExcerpt csp-provider
 * @docsExcerptTitle app/layout.tsx
 */
export async function CspProviderExcerpt({ children }: { children: React.ReactNode }) {
  // The same per-request value your middleware put in the CSP header.
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return <Lightbox.CSPProvider nonce={nonce}>{children}</Lightbox.CSPProvider>;
}
