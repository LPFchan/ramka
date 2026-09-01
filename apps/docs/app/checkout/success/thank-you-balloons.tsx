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
      // The widest row ("THANK": five balloon glyphs plus inter-character
      // spacing) spans roughly 4.5x its font size, so scale against 950px:
      // full size on desktop, and on phones the row keeps a little air on
      // both sides instead of the K grazing the edge. The library centers
      // each row but doesn't shrink one that overflows.
      const scale = Math.min(1, window.innerWidth / 950);
      // Each entry is one centered row; the library releases them a second
      // apart, so "THANK" lifts off first, "YOU" follows, then the emoji.
      textBalloons([
        { text: 'THANK', fontSize: Math.round(180 * scale), color },
        { text: 'YOU', fontSize: Math.round(180 * scale), color },
        { text: '🥹🔥✌️', fontSize: Math.round(200 * scale), color },
      ]);
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  return null;
}
