'use client';

import * as React from 'react';

/**
 * Releases "Thank you" text balloons once, shortly after the success page
 * mounts (balloons-js is the maintainer's own library, so the purchase
 * celebration doubles as a product demo). Renders nothing; the library
 * animates in its own fixed-position layer and cleans it up when the
 * balloons float off-screen.
 */
export function ThankYouBalloons() {
  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Cancellation instead of a fired-once ref: Strict Mode's dev-only
    // remount cleans up the first timer before scheduling the second, so the
    // balloons still release exactly once, and navigating away pre-release
    // doesn't float them over another page.
    let cancelled = false;

    // A short pause so the page reads as settled before the celebration
    // starts, and the balloons never compete with the initial paint.
    const timeout = window.setTimeout(async () => {
      const { textBalloons } = await import('balloons-js');
      if (cancelled) return;

      const color = "#171717";
      // Each entry is one centered row; the library releases them a second
      // apart, so "THANK" lifts off first, "YOU" follows, then the emoji:
      // the frame is ramka itself, the heart the thanks, the balloon the
      // library carrying the moment. One of each, slightly smaller, so the
      // sign-off stays quieter than the words above it.
      textBalloons([
        { text: 'THANK', fontSize: 180, color },
        { text: 'YOU', fontSize: 180, color },
        { text: '🥹🔥✌️', fontSize: 200, color },
      ]);
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  return null;
}
