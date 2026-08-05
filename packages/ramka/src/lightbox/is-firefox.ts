/**
 * True when running in Firefox (Gecko).
 *
 * Used to gate browser-specific View Transition workarounds. Prefer this over
 * inline UA checks so Firefox-only paths stay greppable (`isFirefox`).
 */
function isFirefox(): boolean {
  return typeof navigator !== 'undefined' && /Firefox\//.test(navigator.userAgent);
}

export { isFirefox };
