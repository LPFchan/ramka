import { isFirefox } from './is-firefox';

/**
 * True on Android Chrome (mobile Blink).
 *
 * Blink includes URL-bar outsets in the view-transition snapshot containing
 * block. Unmounting the fullscreen overlay between old/new capture — or
 * capturing while the bar is still moving — aborts the morph
 * (`InvalidStateError: Transition was aborted because of invalid state`).
 *
 * Desktop Chromium and WebKit do not have that abort. Holding the overlay
 * mounted on close also keeps unnamed chrome (thumbnail strip, zoom
 * controls) in the live tree; WebKit keeps painting those until `finished`,
 * so they pop instead of fading with `::view-transition-old(root)`.
 *
 * Prefer this over a plain `/Android/` sniff so Firefox on Android and
 * WebKit (Safari, every iOS browser) stay on the unmount-in-callback path.
 */
function isAndroidBlinkSnapshotRoot(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  // GestureEvent has only ever shipped in WebKit — same signal as the
  // composited-morph Safari path. Chrome on iOS is WebKit too.
  if ('GestureEvent' in window) return false;
  if (isFirefox()) return false;

  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  const mobile =
    typeof uaData?.mobile === 'boolean' ? uaData.mobile : /Android/i.test(navigator.userAgent);
  if (!mobile) return false;

  // Blink: `window.chrome` is present on Chrome/Edge; UA fallback for tests.
  if ('chrome' in window) return true;
  return /Chrome\//i.test(navigator.userAgent);
}

export { isAndroidBlinkSnapshotRoot };
