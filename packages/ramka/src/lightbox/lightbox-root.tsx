'use client';

import * as React from 'react';
import { flushSync } from 'react-dom';

import {
  LightboxContext,
  VIEW_TRANSITION_NAME,
  findMorphTarget,
  supportsViewTransitions,
  type LightboxContextValue,
  type NavigationSource,
} from './lightbox-context';

function startViewTransition(
  callback: () => void | Promise<void>,
): { finished: Promise<void> } {
  return (
    document as Document & {
      startViewTransition: (cb: () => void | Promise<void>) => { finished: Promise<void> };
    }
  ).startViewTransition(callback);
}

/**
 * Default upper bound (ms) for how long the open morph waits on the
 * destination image to decode. Used when `awaitImageDecode` is `true`.
 */
const DEFAULT_DECODE_MAX_WAIT = 200;

/**
 * Wait for an image element to decode (pixels composited and ready to paint).
 * If the image is already complete (e.g. served from cache on a re-open),
 * resolves immediately with zero delay. Otherwise waits for `decode()` to
 * finish, bounded by `maxWait` ms so the transition is never blocked
 * for too long on slow connections. Resolves immediately for non-image
 * elements (video, custom HTML).
 *
 * Works with plain `<img>` as well as framework image components (e.g.
 * Next.js `<Image>`) that render a native `<img>` with `srcset`. The
 * browser's `decode()` resolves for whichever source was selected from
 * the srcset. For best results, images inside Lightbox.Item should use
 * `loading="eager"` so the browser starts fetching immediately on mount
 * rather than waiting for a lazy-load intersection.
 */
function waitForImageDecode(
  target: HTMLElement | null,
  maxWait: number = DEFAULT_DECODE_MAX_WAIT,
): Promise<void> {
  if (!target) return Promise.resolve();
  const img =
    target.tagName === 'IMG'
      ? (target as HTMLImageElement)
      : target.querySelector<HTMLImageElement>('img');
  if (!img || !('decode' in img)) return Promise.resolve();
  // Image already loaded (e.g. cached from a previous open) — no wait needed.
  // The VT API captures the snapshot after this callback resolves, so the
  // browser will have composited the cached image by then.
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise<void>((resolve) => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    img.decode().then(settle, settle);
    setTimeout(settle, maxWait);
  });
}

interface LightboxRootProps {
  children?: React.ReactNode;
  /** Uncontrolled initial open state. @default false */
  defaultOpen?: boolean;
  /** Controlled open state. */
  open?: boolean;
  /** Callback when open state changes (fires immediately, before animations). */
  onOpenChange?: (open: boolean) => void;
  /**
   * Callback when the open/close transition finishes. Receives the
   * final open state — `true` after the open animation completes,
   * `false` after the close animation completes.
   */
  onOpenChangeComplete?: (open: boolean) => void;
  /** Uncontrolled initial active index. @default 0 */
  defaultValue?: number;
  /** Controlled active index. */
  value?: number;
  /** Callback when active index changes. */
  onValueChange?: (value: number, metadata: { source: NavigationSource }) => void;
  /** Wrap navigation at boundaries. @default false */
  loop?: boolean;
  /**
   * Enable view transition morph animation between trigger and lightbox item.
   * When clicking a trigger, the element smoothly morphs into the fullscreen
   * lightbox item. On close, it morphs back. Requires browser support for
   * the View Transitions API. Falls back to normal fade when unsupported
   * or when prefers-reduced-motion is set.
   * @default false
   */
  viewTransition?: boolean;
  /**
   * Scroll the active trigger element into the viewport so close
   * animations land on-screen instead of animating off-viewport.
   *
   * - `null` (default) — no automatic scrolling
   * - `{ type: "onClose" }` — scroll to the active trigger just before closing
   * - `{ type: "onChange" }` — scroll to the active trigger whenever the active
   *   index changes while the lightbox is open (preemptive; trigger
   *   is always in view by the time the user closes)
   *
   * `behavior` controls the scroll animation: `"smooth"` (default) or `"instant"`.
   *
   * @default null
   */
  scrollTriggerIntoView?: null | {
    type: 'onChange' | 'onClose';
    behavior?: 'smooth' | 'instant';
  };
  /**
   * Controls which trigger receives the View Transition morph on close.
   *
   * - `'active'` (default) — morph to the trigger matching the current
   *   active index. No morph if no trigger exists for that index.
   * - `'origin'` — always morph back to the trigger that originally
   *   opened the lightbox, regardless of which item is active.
   * - `'closest'` — morph to the trigger at the active index if it
   *   exists, otherwise fall back to the nearest registered trigger.
   *
   * @default 'active'
   */
  morphTo?: 'active' | 'origin' | 'closest';
  /**
   * How long the open morph waits for the destination image to decode
   * before starting, so the lightbox doesn't flash empty space while the
   * full-size image is still loading.
   *
   * - `true` (default) — wait up to ~200ms, then start regardless.
   * - `false` — don't wait; start the transition immediately. Useful when
   *   the trigger image doubles as a placeholder for the lightbox item so
   *   there is nothing to wait for.
   * - `number` — wait up to this many milliseconds. The morph starts as
   *   soon as the image decodes (or is served from cache), or when the
   *   timeout elapses — whichever comes first.
   *
   * Only relevant when `viewTransition` is enabled.
   * @default true
   */
  awaitImageDecode?: boolean | number;
}

interface LightboxRootRef {
  open: (index?: number) => void;
  close: () => void;
  goTo: (index: number) => void;
}

function scrollTriggerEl(el: HTMLElement | undefined, behavior: ScrollBehavior = 'smooth') {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const fullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
  if (!fullyVisible) {
    el.scrollIntoView({ block: 'center', behavior });
  }
}

function resolveTriggerIndex(
  activeIndex: number,
  morphTo: 'active' | 'origin' | 'closest',
  openingIndex: number,
  triggerElements: Map<number, HTMLElement>,
): number {
  if (morphTo === 'origin') return openingIndex;
  if (morphTo === 'active' || triggerElements.has(activeIndex)) return activeIndex;
  let best = -1;
  let bestDist = Infinity;
  for (const idx of triggerElements.keys()) {
    const dist = Math.abs(idx - activeIndex);
    if (dist < bestDist) {
      bestDist = dist;
      best = idx;
    }
  }
  return best >= 0 ? best : activeIndex;
}

const LightboxRoot = React.forwardRef<LightboxRootRef, LightboxRootProps>(
  function LightboxRoot(props, forwardedRef) {
    const {
      children,
      defaultOpen = false,
      open: openProp,
      onOpenChange,
      onOpenChangeComplete,
      defaultValue = 0,
      value: valueProp,
      onValueChange,
      loop = false,
      viewTransition = false,
      scrollTriggerIntoView = null,
      morphTo = 'active',
      awaitImageDecode = true,
    } = props;

    // Resolve the decode-wait budget: `false`/`0` disables the wait,
    // `true` uses the default cap, and a number sets an explicit cap (ms).
    const decodeMaxWait =
      awaitImageDecode === false
        ? 0
        : awaitImageDecode === true
          ? DEFAULT_DECODE_MAX_WAIT
          : Math.max(0, awaitImageDecode);

    // Open state — controlled or uncontrolled
    const isControlledOpen = openProp !== undefined;
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
    const open = isControlledOpen ? openProp : uncontrolledOpen;

    const onOpenChangeRef = React.useRef(onOpenChange);
    React.useEffect(() => {
      onOpenChangeRef.current = onOpenChange;
    }, [onOpenChange]);

    const onOpenChangeCompleteRef = React.useRef(onOpenChangeComplete);
    React.useEffect(() => {
      onOpenChangeCompleteRef.current = onOpenChangeComplete;
    }, [onOpenChangeComplete]);

    // Active index — controlled or uncontrolled
    const isControlledValue = valueProp !== undefined;
    const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
    const activeIndex = isControlledValue ? valueProp : uncontrolledValue;

    const onValueChangeRef = React.useRef(onValueChange);
    React.useEffect(() => {
      onValueChangeRef.current = onValueChange;
    }, [onValueChange]);

    const setActiveIndex = React.useCallback(
      (index: number, source: NavigationSource) => {
        if (!isControlledValue) {
          setUncontrolledValue(index);
        }
        onValueChangeRef.current?.(index, { source });
      },
      [isControlledValue],
    );

    // Scroll the active trigger into view when activeIndex changes while open
    React.useEffect(() => {
      if (scrollTriggerIntoView?.type === 'onChange' && open) {
        const el = triggerElementsRef.current.get(activeIndex);
        scrollTriggerEl(el, scrollTriggerIntoView.behavior);
      }
    }, [scrollTriggerIntoView, open, activeIndex]);

    // Item registry — tracks mounted items so count can grow and shrink
    const registeredItemsRef = React.useRef(new Set<number>());
    const [itemCount, setItemCount] = React.useState(0);

    const registerItem = React.useCallback((index: number) => {
      registeredItemsRef.current.add(index);
      setItemCount(registeredItemsRef.current.size);
      return () => {
        registeredItemsRef.current.delete(index);
        setItemCount(registeredItemsRef.current.size);
      };
    }, []);

    // Caption registry — ref-based to avoid creating new Map objects and
    // triggering re-renders on every item mount. LightboxCaption reads
    // from the ref; it re-renders when activeIndex changes via context.
    const captionsRef = React.useRef(new Map<number, React.ReactNode>());

    const registerCaption = React.useCallback((index: number, caption: React.ReactNode) => {
      captionsRef.current.set(index, caption);
      return () => {
        captionsRef.current.delete(index);
      };
    }, []);

    // Portal mount state — stays true during exit animations so elements
    // remain in the DOM for CSS transitions (non-VT) or are removed
    // immediately inside flushSync (VT close).
    //
    // Initialized from the resolved open value (controlled prop or
    // `defaultOpen`) so a lightbox rendered with `open={true}` on first
    // mount is visible immediately instead of flashing closed for a
    // tick before the sync effect catches up.
    const [mounted, setMounted] = React.useState(() => (isControlledOpen ? Boolean(openProp) : defaultOpen));
    const closeGenRef = React.useRef(0);

    // Tracks the most recent open value that internal setOpen has
    // claimed responsibility for. When the derived `open` differs from
    // this ref, the change came from outside (e.g. a controlled prop
    // mutated by something other than Lightbox.Trigger / Close /
    // imperative handle) and the sync effect below needs to mount or
    // unmount the portal manually.
    const lastInternalOpenRef = React.useRef(open);

    // View transition refs
    const triggerElementsRef = React.useRef<Map<number, HTMLElement>>(new Map());
    const activeItemElementRef = React.useRef<HTMLElement | null>(null);
    const openingTriggerIndexRef = React.useRef(0);
    const dialogElementRef = React.useRef<HTMLElement | null>(null);
    const backdropElementRef = React.useRef<HTMLElement | null>(null);
    const activeIndexRef = React.useRef(activeIndex);
    activeIndexRef.current = activeIndex;

    const setOpen = React.useCallback(
      (nextOpen: boolean) => {
        closeGenRef.current += 1;
        // Mark this transition as internal so the external-sync effect
        // below doesn't double-handle the mount lifecycle when the
        // controlled `open` prop subsequently updates via onOpenChange.
        lastInternalOpenRef.current = nextOpen;

        const useVT = viewTransition && supportsViewTransitions();

        if (useVT) {
          const docEl = document.documentElement;

          const gen = closeGenRef.current;

          if (nextOpen) {
            // --- OPEN with view transition ---
            const triggerIdx = openingTriggerIndexRef.current;
            const triggerEl = triggerElementsRef.current.get(triggerIdx);
            const triggerTarget = triggerEl ? findMorphTarget(triggerEl) : null;
            const useCrossfade = triggerEl?.dataset.crossfade === 'true';

            // Batch all reads before any writes to avoid forced reflow
            const fromRadius = triggerTarget ? getComputedStyle(triggerTarget).borderRadius : null;

            // Writes
            docEl.setAttribute('data-lightbox-view-transition', 'opening');
            if (!useCrossfade) {
              docEl.setAttribute('data-lightbox-no-crossfade', '');
              docEl.style.setProperty('--lightbox-morph-old-opacity', '0');
              docEl.style.setProperty('--lightbox-morph-new-opacity', '1');
            }
            if (triggerTarget) {
              triggerTarget.style.viewTransitionName = VIEW_TRANSITION_NAME;
            }
            if (fromRadius) {
              docEl.style.setProperty('--lightbox-morph-border-radius-from', fromRadius);
            }

            const transition = startViewTransition(async () => {
              if (triggerTarget) {
                triggerTarget.style.viewTransitionName = '';
              }
              flushSync(() => {
                setMounted(true);
                if (!isControlledOpen) {
                  setUncontrolledOpen(true);
                }
                onOpenChangeRef.current?.(true);
              });
              const itemEl = activeItemElementRef.current;
              const itemTarget = itemEl ? findMorphTarget(itemEl) : null;

              // Wait for the destination image to decode before the browser
              // captures the "new" snapshot, preventing a flash of empty space
              // during the morph animation. Bounded by `decodeMaxWait`; skipped
              // entirely when the consumer opts out (awaitImageDecode={false}).
              if (decodeMaxWait > 0) {
                await waitForImageDecode(itemTarget, decodeMaxWait);
              }

              // Read before write to avoid forced reflow
              const toRadius = itemTarget ? getComputedStyle(itemTarget).borderRadius : null;
              if (itemTarget) {
                itemTarget.style.viewTransitionName = VIEW_TRANSITION_NAME;
              }
              if (toRadius) {
                docEl.style.setProperty('--lightbox-morph-border-radius-to', toRadius);
              }
              if (itemEl) {
                itemEl.setAttribute('data-skip-fade', '');
              }
            });

            transition.finished.finally(() => {
              if (closeGenRef.current !== gen) return;
              const itemEl = activeItemElementRef.current;
              const itemTarget = itemEl ? findMorphTarget(itemEl) : null;
              if (itemTarget) {
                itemTarget.style.viewTransitionName = '';
              }
              docEl.removeAttribute('data-lightbox-view-transition');
              docEl.removeAttribute('data-lightbox-no-crossfade');
              docEl.style.removeProperty('--lightbox-morph-old-opacity');
              docEl.style.removeProperty('--lightbox-morph-new-opacity');
              docEl.style.removeProperty('--lightbox-morph-border-radius-from');
              docEl.style.removeProperty('--lightbox-morph-border-radius-to');
              onOpenChangeCompleteRef.current?.(true);
            });
          } else {
            // --- CLOSE with view transition ---
            const itemEl = activeItemElementRef.current;
            const itemTarget = itemEl ? findMorphTarget(itemEl) : null;
            const triggerIdx = resolveTriggerIndex(
              activeIndexRef.current,
              morphTo,
              openingTriggerIndexRef.current,
              triggerElementsRef.current,
            );
            const triggerEl = triggerElementsRef.current.get(triggerIdx);
            const triggerTarget = triggerEl ? findMorphTarget(triggerEl) : null;
            const useCrossfade = triggerEl?.dataset.crossfade === 'true';

            // Batch all reads before any writes to avoid forced reflow
            const fromRadius = itemTarget ? getComputedStyle(itemTarget).borderRadius : null;
            const toRadius = triggerTarget ? getComputedStyle(triggerTarget).borderRadius : null;

            // Writes
            docEl.setAttribute('data-lightbox-view-transition', 'closing');
            if (!useCrossfade) {
              docEl.setAttribute('data-lightbox-no-crossfade', '');
              docEl.style.setProperty('--lightbox-morph-old-opacity', '1');
              docEl.style.setProperty('--lightbox-morph-new-opacity', '0');
            }
            if (itemTarget) {
              itemTarget.style.viewTransitionName = VIEW_TRANSITION_NAME;
            }
            if (fromRadius) {
              docEl.style.setProperty('--lightbox-morph-border-radius-from', fromRadius);
            }
            if (toRadius) {
              docEl.style.setProperty('--lightbox-morph-border-radius-to', toRadius);
            }

            const transition = startViewTransition(() => {
              if (itemTarget) {
                itemTarget.style.viewTransitionName = '';
              }
              flushSync(() => {
                if (!isControlledOpen) {
                  setUncontrolledOpen(false);
                }
                onOpenChangeRef.current?.(false);
                setMounted(false);
              });
              if (scrollTriggerIntoView) {
                scrollTriggerEl(triggerEl, 'instant');
              }
              if (triggerTarget) {
                triggerTarget.style.viewTransitionName = VIEW_TRANSITION_NAME;
              }
            });

            transition.finished.finally(() => {
              if (triggerTarget) {
                triggerTarget.style.viewTransitionName = '';
              }
              docEl.removeAttribute('data-lightbox-view-transition');
              docEl.removeAttribute('data-lightbox-no-crossfade');
              docEl.style.removeProperty('--lightbox-morph-old-opacity');
              docEl.style.removeProperty('--lightbox-morph-new-opacity');
              docEl.style.removeProperty('--lightbox-morph-border-radius-from');
              docEl.style.removeProperty('--lightbox-morph-border-radius-to');
              if (closeGenRef.current === gen) {
                triggerEl?.focus({ preventScroll: true });
                onOpenChangeCompleteRef.current?.(false);
              }
            });
          }
        } else {
          // --- No view transition ---
          if (nextOpen) {
            setMounted(true);
            if (!isControlledOpen) {
              setUncontrolledOpen(true);
            }
            onOpenChangeRef.current?.(true);
            const gen = closeGenRef.current;
            requestAnimationFrame(() => {
              if (closeGenRef.current !== gen) return;
              const el = dialogElementRef.current;
              if (el) {
                Promise.allSettled(el.getAnimations().map((a) => a.finished)).then(() => {
                  if (closeGenRef.current === gen) {
                    onOpenChangeCompleteRef.current?.(true);
                  }
                });
              } else {
                onOpenChangeCompleteRef.current?.(true);
              }
            });
          } else {
            const closeTriggerIdx = resolveTriggerIndex(
              activeIndexRef.current,
              morphTo,
              openingTriggerIndexRef.current,
              triggerElementsRef.current,
            );
            if (scrollTriggerIntoView) {
              const triggerEl = triggerElementsRef.current.get(closeTriggerIdx);
              scrollTriggerEl(triggerEl, 'instant');
            }
            if (!isControlledOpen) {
              setUncontrolledOpen(false);
            }
            onOpenChangeRef.current?.(false);
            const el = dialogElementRef.current;
            const gen = closeGenRef.current;
            const focusTarget = triggerElementsRef.current.get(closeTriggerIdx);
            if (el) {
              Promise.allSettled(el.getAnimations().map((a) => a.finished)).then(() => {
                if (closeGenRef.current === gen) {
                  setMounted(false);
                  requestAnimationFrame(() => focusTarget?.focus({ preventScroll: true }));
                  onOpenChangeCompleteRef.current?.(false);
                }
              });
            } else {
              setMounted(false);
              requestAnimationFrame(() => focusTarget?.focus({ preventScroll: true }));
              onOpenChangeCompleteRef.current?.(false);
            }
          }
        }
      },
      [isControlledOpen, viewTransition, scrollTriggerIntoView, morphTo, decodeMaxWait],
    );

    // Sync `mounted` to externally-driven changes of a controlled
    // `open` prop. When `open` flips without going through internal
    // setOpen (e.g. a parent state setter wired to an external button,
    // a route change, or a store update), `mounted` would otherwise
    // stay stuck at its previous value and Lightbox.Content / Backdrop
    // would refuse to render.
    //
    // For the open path we set `mounted` immediately. For the close
    // path we wait for any CSS transitions on the dialog element to
    // finish before unmounting, matching the non-VT close behavior in
    // setOpen so consumer-defined fade-outs still play.
    //
    // View Transitions are intentionally skipped here — those are
    // bound to user gestures on triggers / close controls. Programmatic
    // open/close via state mutation is treated as a plain mount swap.
    React.useEffect(() => {
      if (open === lastInternalOpenRef.current) return;
      lastInternalOpenRef.current = open;

      if (open) {
        setMounted(true);
        return;
      }

      const gen = ++closeGenRef.current;
      const el = dialogElementRef.current;
      if (el) {
        Promise.allSettled(el.getAnimations().map((a) => a.finished)).then(() => {
          if (closeGenRef.current === gen) {
            setMounted(false);
          }
        });
      } else {
        setMounted(false);
      }
    }, [open]);

    // Imperative handle
    React.useImperativeHandle(
      forwardedRef,
      () => ({
        open: (index?: number) => {
          if (index !== undefined) {
            openingTriggerIndexRef.current = index;
            setActiveIndex(index, 'trigger');
          }
          setOpen(true);
        },
        close: () => setOpen(false),
        goTo: (index: number) => setActiveIndex(index, 'button'),
      }),
      [setActiveIndex, setOpen],
    );

    const contextValue = React.useMemo<LightboxContextValue>(
      () => ({
        open,
        setOpen,
        mounted,
        activeIndex,
        setActiveIndex,
        itemCount,
        registerItem,
        loop,
        captionsRef,
        registerCaption,
        viewTransition,
        morphTo,
        triggerElementsRef,
        activeItemElementRef,
        openingTriggerIndexRef,
        dialogElementRef,
        backdropElementRef,
      }),
      [open, setOpen, mounted, activeIndex, setActiveIndex, itemCount, registerItem, loop, registerCaption, viewTransition, morphTo],
    );

    return <LightboxContext.Provider value={contextValue}>{children}</LightboxContext.Provider>;
  },
);

LightboxRoot.displayName = 'LightboxRoot';

export { LightboxRoot };
export type { LightboxRootProps, LightboxRootRef };
