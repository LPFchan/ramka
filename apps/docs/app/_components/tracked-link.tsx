'use client';

import type { ComponentProps } from 'react';

import Link from 'next/link';
import { track } from '@vercel/analytics';

/**
 * Funnel instrumentation for the purchase path (landing → /license →
 * checkout). Fires a Vercel Analytics custom event on click, then lets the
 * navigation proceed as usual.
 */

type EventProps = Record<string, string>;

export function TrackedLink({
  event,
  eventData,
  ...props
}: ComponentProps<typeof Link> & { event: string; eventData?: EventProps }) {
  return <Link {...props} onClick={() => track(event, eventData)} />;
}

/** Plain anchor variant for external destinations like the Whop checkout. */
export function TrackedAnchor({
  event,
  eventData,
  ...props
}: ComponentProps<'a'> & { event: string; eventData?: EventProps }) {
  // eslint-disable-next-line jsx-a11y/anchor-has-content -- content comes via props
  return <a {...props} onClick={() => track(event, eventData)} />;
}
