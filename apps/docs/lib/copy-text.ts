/**
 * Copy text to the clipboard in a way that works on Mobile Safari.
 *
 * The Async Clipboard API often rejects on iOS, and by the time the promise
 * settles the user-gesture token is gone — so a deferred `execCommand` fallback
 * also fails. A synchronous `execCommand('copy')` path keeps the activation.
 */
export function copyText(text: string): boolean {
  if (typeof document === 'undefined') return false;

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  // Keep the node in-flow for iOS selection; off-screen + 12pt avoids zoom.
  textarea.style.cssText =
    'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:none;outline:none;box-shadow:none;background:transparent;opacity:0;font-size:12pt;';

  const selection = document.getSelection();
  const previousRange =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }

  document.body.removeChild(textarea);

  if (previousRange && selection) {
    selection.removeAllRanges();
    selection.addRange(previousRange);
  }

  return ok;
}
