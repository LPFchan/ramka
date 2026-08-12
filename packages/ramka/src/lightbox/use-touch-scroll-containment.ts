'use client';

import * as React from 'react';

// ---------------------------------------------------------------------------
// Touch scroll containment for the open lightbox.
//
// iOS Safari expands/collapses its address bar in response to vertical pan
// gestures. `overscroll-behavior: contain` on Content does not stop this:
// browser-chrome expansion is not scroll chaining — when a touch drag finds
// nothing scrollable in its ancestor chain (and the page scroll is locked),
// Safari hands the pan to the browser UI itself, expanding the collapsed
// address bar and resizing the viewport over the open viewer.
//
// Touches that start on the active media are already covered: pull-to-dismiss
// preventDefaults their vertical touchmoves once the drag locks vertical. But
// the pull deliberately ignores interactive chrome (Close / Prev / Next /
// links / `[data-ramka-no-pull]`), so a drag starting on the close button had
// no one canceling its moves — and the bar expanded.
//
// This hook is the containment layer for everything else inside the host:
// when a touch drag locks vertical and NO element between the touch target
// and the host can actually scroll further in that direction, its moves are
// canceled — same 6px lock + preventDefault pattern the pull gesture uses,
// which is proven to keep Safari's chrome parked. Gestures that CAN be
// consumed by inner scroll containers (caption/comment panels, consumer side
// panels) are left fully native, as are horizontal drags (Slides and the
// thumbnail strip own those; horizontal pans never move the address bar).
// ---------------------------------------------------------------------------

/**
 * Distance (CSS px) before the drag commits to an axis. Matches the pull
 * gesture's direction lock so both layers agree on when a drag is "real" —
 * and small tap wiggles never get their moves canceled (which could swallow
 * a legitimate click on the chrome control).
 */
const DIRECTION_LOCK_DISTANCE = 6;

function isScrollableOverflow(value: string): boolean {
  return value === 'auto' || value === 'scroll';
}

/**
 * Whether `el` can consume a vertical pan of direction `deltaY` (finger
 * displacement: positive = finger moving down = content scrolling up).
 */
function canScrollVertically(el: HTMLElement, deltaY: number): boolean {
  if (el.scrollHeight <= el.clientHeight) return false;
  if (!isScrollableOverflow(getComputedStyle(el).overflowY)) return false;
  if (deltaY > 0) return el.scrollTop > 0;
  return el.scrollTop < el.scrollHeight - el.clientHeight - 1;
}

/**
 * Whether any element from `target` up to (but excluding) `host` can consume
 * the vertical pan. Checked once at direction lock — iOS decides a gesture's
 * scroll target at its start, so the answer is stable for the whole drag.
 */
function chainCanScrollVertically(
  target: EventTarget | null,
  host: HTMLElement,
  deltaY: number,
): boolean {
  let node = target instanceof Element ? target : null;
  while (node && node !== host) {
    if (node instanceof HTMLElement && canScrollVertically(node, deltaY)) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

interface TouchScrollContainmentOptions {
  /** Element whose touch drags must never reach the browser chrome. */
  hostRef: React.RefObject<HTMLElement | null>;
  disabled?: boolean;
}

function useTouchScrollContainment({ hostRef, disabled = false }: TouchScrollContainmentOptions) {
  React.useEffect(() => {
    if (disabled) return;
    const host = hostRef.current;
    if (!host) return;

    let tracking = false;
    let startX = 0;
    let startY = 0;
    /** `pending` until the 6px lock; then latched for the whole gesture. */
    let decision: 'pending' | 'prevent' | 'allow' = 'pending';

    const reset = () => {
      tracking = false;
      decision = 'pending';
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        // Multi-finger belongs to pinch-zoom; Content's document-level pinch
        // guard already cancels those moves.
        reset();
        return;
      }
      const touch = event.touches[0]!;
      tracking = true;
      decision = 'pending';
      startX = touch.clientX;
      startY = touch.clientY;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!tracking) return;
      if (event.touches.length !== 1) {
        decision = 'allow';
        return;
      }
      const touch = event.touches[0]!;

      if (decision === 'pending') {
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;
        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < DIRECTION_LOCK_DISTANCE) {
          return;
        }
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          // Horizontal — Slides / thumbnail strip / consumer scrollers own it,
          // and horizontal pans never move the address bar.
          decision = 'allow';
        } else {
          // Touch events keep the touchstart target for the whole gesture, so
          // walking from `event.target` inspects the chain iOS itself would
          // pick a scroller from.
          decision = chainCanScrollVertically(event.target, host, deltaY)
            ? 'allow'
            : 'prevent';
        }
      }

      if (decision === 'prevent' && event.cancelable) {
        event.preventDefault();
      }
    };

    const handleTouchSettled = (event: TouchEvent) => {
      if (event.touches.length === 0) {
        reset();
      }
    };

    host.addEventListener('touchstart', handleTouchStart, { passive: true });
    host.addEventListener('touchmove', handleTouchMove, { passive: false });
    host.addEventListener('touchend', handleTouchSettled, { passive: true });
    host.addEventListener('touchcancel', handleTouchSettled, { passive: true });

    return () => {
      host.removeEventListener('touchstart', handleTouchStart);
      host.removeEventListener('touchmove', handleTouchMove);
      host.removeEventListener('touchend', handleTouchSettled);
      host.removeEventListener('touchcancel', handleTouchSettled);
    };
  }, [hostRef, disabled]);
}

export { useTouchScrollContainment };
export type { TouchScrollContainmentOptions };
