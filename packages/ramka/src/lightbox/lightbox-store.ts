'use client';

import * as React from 'react';

/**
 * Hot-state store for the lightbox's O(n) part populations.
 *
 * ## Why this exists (the fan-out problem)
 *
 * `Lightbox.Item`, `Lightbox.Trigger`, and `Lightbox.Thumbnail` are the parts
 * a gallery renders once *per photo*. They used to read `open` / `activeIndex`
 * straight from the root context, so every navigation or open/close commit
 * re-rendered all of them — O(n) React work per swipe, and (worse) inside the
 * view transition's `flushSync(commitPrepare/commitClose)`, where it directly
 * delays the morph's snapshot capture. At ~1000 items that was a visible
 * pre-transition freeze; navigation cost scaled linearly with gallery size.
 *
 * The store inverts the dependency: those parts subscribe to *derived
 * primitives* ("am I active", "am I in the preload window", "is the lightbox
 * open") via `useSyncExternalStore`, so a commit re-renders only the parts
 * whose derived value actually flipped — O(preload) per navigation instead of
 * O(n). Everything singular (Slides, Content, Counter, Next/Previous, …)
 * keeps reading the plain root context; splitting THAT would change who
 * re-renders for no benefit (see the "One Provider on purpose" note in
 * lightbox-context.tsx — this store is the sanctioned exception for the
 * per-item populations, in the same family as `subscribeCaptions` and the
 * detached-trigger handle store).
 *
 * ## Write timing (the part that must not be reordered)
 *
 * The Root SYNCS the store during its own render (`setStateSilent`) and
 * NOTIFIES subscribers in a layout effect (`notify`):
 *
 * - **Render-phase sync** is what keeps *mounting* parts correct: the VT open
 *   runs `flushSync(commitPrepare)` and expects the freshly-mounted active
 *   `Lightbox.Item` to register itself for the morph within that flush. A
 *   mounting component's `getSnapshot` runs during that same render pass — if
 *   the store were only written post-commit, the item would mount against the
 *   PREVIOUS open's index and the morph would name the wrong element. The
 *   write is idempotent and derived purely from Root state, so StrictMode's
 *   double render is harmless. A discarded concurrent render can leave the
 *   store briefly ahead of committed state; the next commit's layout effect
 *   re-asserts the committed values before anyone is notified, and
 *   `useSyncExternalStore`'s consistency check covers readers in between.
 *
 * - **Layout-effect notify** is what keeps *mounted* parts correct without
 *   fan-out: subscribers re-render synchronously before paint (inside the
 *   same `flushSync` on the VT paths), but only the ones whose selected
 *   primitive changed. Notification must NOT happen during render (that
 *   would be a cross-component setState-in-render).
 *
 * Selectors MUST return primitives — `useSyncExternalStore` compares
 * snapshots with `Object.is`, and an object-returning selector would loop.
 */

/** The reactive values the per-item parts derive their state from. */
interface LightboxHotState {
  open: boolean;
  activeIndex: number;
  /** Live registered-item count (or the `count` prop before registration). */
  itemCount: number;
  loop: boolean;
  hasTablist: boolean;
  morphTo: 'active' | 'origin' | 'closest';
  /** Whether the view-transition morph is enabled (drives trigger warm-up). */
  viewTransition: boolean;
}

interface LightboxStore {
  getState: () => LightboxHotState;
  /**
   * Replace the state WITHOUT notifying. Render-phase only (Root), so parts
   * mounting in the same commit read fresh values. See module docs.
   */
  setStateSilent: (next: LightboxHotState) => void;
  /** Notify subscribers. Layout-effect only (Root), post-commit. */
  notify: () => void;
  subscribe: (listener: () => void) => () => void;
}

function createLightboxStore(initial: LightboxHotState): LightboxStore {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    setStateSilent: (next) => {
      state = next;
    },
    notify: () => {
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function hotStateEqual(a: LightboxHotState, b: LightboxHotState): boolean {
  return (
    a.open === b.open &&
    a.activeIndex === b.activeIndex &&
    a.itemCount === b.itemCount &&
    a.loop === b.loop &&
    a.hasTablist === b.hasTablist &&
    a.morphTo === b.morphTo &&
    a.viewTransition === b.viewTransition
  );
}

/**
 * Subscribe to a PRIMITIVE derived from the hot state. The selector may close
 * over render values (`index`, `preload`, …) — `useSyncExternalStore` re-reads
 * a changed `getSnapshot` on every render, and store notifications re-run the
 * latest one, so closures never go stale.
 *
 * Server snapshot: the store is created during Root's first render with that
 * render's state, so the same read is correct on the server and byte-for-byte
 * identical in the hydration render.
 */
function useLightboxStoreValue<T extends string | number | boolean | null | undefined>(
  store: LightboxStore,
  selector: (state: LightboxHotState) => T,
): T {
  const getSnapshot = () => selector(store.getState());
  return React.useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

export { createLightboxStore, hotStateEqual, useLightboxStoreValue };
export type { LightboxHotState, LightboxStore };
