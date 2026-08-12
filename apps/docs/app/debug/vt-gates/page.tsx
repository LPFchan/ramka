import { VtGatesClient } from './vt-gates-client';

/**
 * Production-accessible on-device View Transition diagnostics.
 * Testers open this URL, exercise the lightbox, and Copy all.
 */
export default function VtGatesDebugPage() {
  return <VtGatesClient />;
}
