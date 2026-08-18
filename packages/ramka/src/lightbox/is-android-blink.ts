import { isFirefox } from './is-firefox';

/**
 * True on Android Chrome (mobile Blink).
 *
 * Blink includes URL-bar outsets in the view-transition snapshot containing
 * block. Capturing while the bar is still moving aborts the morph
 * (`InvalidStateError: Transition was aborted because of invalid state`).
 * Unmounting the fullscreen overlay between old/new capture does the same,
 * which is why close holds the overlay mounted until `finished` on Android
 * Chrome only. Safari/desktop unmount in the callback so chrome fades with
 * the root snapshot — extra named groups on the fullscreen dialog are not
 * an option (WebKit rasterizes each on the CPU).
 *
 * Desktop Chromium and WebKit do not have that abort, so they skip the
 * open-path settle wait.
 *
 * Prefer this over a plain `/Android/` sniff so Firefox on Android and
 * WebKit (Safari, every iOS browser) skip the wait.
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
