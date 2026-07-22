'use client';

import * as React from 'react';

import {
  LightboxContext,
  isLowEndDevice,
  supportsViewTransitions,
  type LightboxContextValue,
  type NavigationSource,
} from './lightbox-context';
import {
  LightboxActiveZoomContext,
  LightboxZoomPublishContext,
  type ActiveZoomControls,
  type LightboxZoomPublishContextValue,
  type PublishActiveZoom,
} from './lightbox-zoom-context';
import {
  DEFAULT_DECODE_MAX_WAIT,
  resolveScrollBehavior,
  resolveTriggerIndex,
  scrollTriggerEl,
  useViewTransitionMorph,
  type ScrollTriggerIntoView,
} from './use-view-transition-morph';

interface LightboxRootProps {
  /** Lightbox parts and page content (triggers typically live as children of Root). */
  children?: React.ReactNode;
  /** Uncontrolled initial open state. @default false */
  defaultOpen?: boolean;
  /** Controlled open state. */
  open?: boolean;
  /**
   * Called when open state changes (immediately, before enter/exit
   * animations finish). Prefer this for syncing URL state or stores.
   */
  onOpenChange?: (open: boolean) => void;
  /**
   * Called when the open/close transition settles. Receives `true` after
   * open completes, `false` after close completes. Prefer this for cleanup
   * and focus management.
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
   * Accepts a single option or an array of options, so you can combine the
   * moments below. `behavior` controls the scroll animation per option:
   * `"smooth"` (default) or `"instant"`.
   *
   * - `null` (default) — no automatic scrolling
   * - `{ type: "onChange" }` — scroll to the active trigger whenever the active
   *   index changes while the lightbox is open (preemptive; keeps the trigger
   *   in view as the user navigates)
   * - `{ type: "onOpenComplete" }` — scroll to the active trigger once the open
   *   transition finishes. The viewer covers the page and scroll is locked, so
   *   this reposition is invisible — it only pays off by ensuring the close
   *   morph lands on-screen without a jump when the trigger was partially
   *   off-screen at open time. `"instant"` recommended.
   * - `{ type: "onClose" }` — scroll to the active trigger just before the close
   *   morph runs (visible reposition at close start)
   *
   * @example
   * // Trigger is always positioned for the close morph, with no visible jump:
   * scrollTriggerIntoView={[
   *   { type: 'onChange', behavior: 'instant' },
   *   { type: 'onOpenComplete', behavior: 'instant' },
   * ]}
   *
   * @default null
   */
  scrollTriggerIntoView?: ScrollTriggerIntoView;
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
  /** Open the lightbox. Optional index sets the active item. Without a click origin there is no trigger-element morph. */
  open: (index?: number) => void;
  /** Close the lightbox. */
  close: () => void;
  /** Navigate to an index (source: button). */
  goTo: (index: number) => void;
}

/**
 * Waits for the currently-running animations on `el` to finish, then invokes
 * `onSettled` — but only while `gen` is still the current generation, so a
 * superseding open/close aborts a stale settle callback. When `el` is absent
 * there is nothing to animate, so `onSettled` runs synchronously.
 *
 * This is the shared "let the consumer's enter/exit CSS transition play out,
 * then act" primitive used by both the non-VT paths in `setOpen` and the
 * external-sync effect below.
 */
function runAfterAnimations(
  el: HTMLElement | null,
  gen: number,
  genRef: React.MutableRefObject<number>,
  onSettled: () => void,
): void {
  if (!el) {
    onSettled();
    return;
  }
  Promise.allSettled(el.getAnimations().map((a) => a.finished)).then(() => {
    if (genRef.current === gen) onSettled();
  });
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

    // Set by a scroller while a user scroll/fling is in flight (see context).
    const navigationLockedRef = React.useRef(false);

    const setActiveIndex = React.useCallback(
      (index: number, source: NavigationSource) => {
        // A user swipe/fling owns the position while it's in flight: a browser
        // fling can't be cancelled from JS, so discrete navigation that lands
        // mid-scroll is dropped (not queued) to keep the marker and the actual
        // scroll position from ever diverging. Swipe-derived (`scroll`) updates
        // and opening (`trigger`) always pass.
        if (
          navigationLockedRef.current &&
          (source === 'keyboard' || source === 'thumbnail' || source === 'button')
        ) {
          return;
        }
        if (!isControlledValue) {
          setUncontrolledValue(index);
        }
        onValueChangeRef.current?.(index, { source });
      },
      [isControlledValue],
    );

    // Scroll the active trigger into view when the active index changes *while
    // already open* (preemptive, so the destination trigger is on-screen for the
    // close morph). This must NOT fire on the open→true edge: nothing changed
    // yet — the lightbox just opened — and the clicked trigger is the open
    // morph's origin, so scrolling it would move the morph's start point and
    // jump the page mid-open. We therefore only scroll on a real index change
    // between two consecutive open states (also skipping no-op re-renders where
    // the index is unchanged). The close path scrolls the origin trigger into
    // view on its own, so opening never needs to.
    const scrollSyncRef = React.useRef({ open, activeIndex });
    React.useEffect(() => {
      const prev = scrollSyncRef.current;
      scrollSyncRef.current = { open, activeIndex };
      const behavior = resolveScrollBehavior(scrollTriggerIntoView, 'onChange');
      if (!behavior || !open) return;
      if (!prev.open || prev.activeIndex === activeIndex) return;
      const el = triggerElementsRef.current.get(activeIndex);
      scrollTriggerEl(el, behavior);
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
    // triggering re-renders on every item mount. LightboxCaption subscribes
    // via useSyncExternalStore, so it reads the ref reactively (updating on
    // register/unregister or a changed caption) without Root re-rendering.
    const captionsRef = React.useRef(new Map<number, React.ReactNode>());
    const captionListenersRef = React.useRef(new Set<() => void>());

    const subscribeCaptions = React.useCallback((onChange: () => void) => {
      captionListenersRef.current.add(onChange);
      return () => {
        captionListenersRef.current.delete(onChange);
      };
    }, []);

    const registerCaption = React.useCallback((index: number, caption: React.ReactNode) => {
      captionsRef.current.set(index, caption);
      captionListenersRef.current.forEach((listener) => listener());
      return () => {
        captionsRef.current.delete(index);
        captionListenersRef.current.forEach((listener) => listener());
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
    // Pre-mount phase flag for the VT open path (see `commitPrepare` /
    // `commitReveal`). Never true for an initially-open lightbox.
    const [preparing, setPreparing] = React.useState(false);
    const closeGenRef = React.useRef(0);

    // Open-transition lifecycle, observed by `Lightbox.Item` so it can hold its
    // morph placeholder until the open morph is fully done (see the placeholder
    // effect in lightbox-item). `openTransitionPendingRef` is true from the
    // start of an open until it settles; `openCompleteListenersRef` holds the
    // items currently waiting for that settle.
    const openTransitionPendingRef = React.useRef(false);
    const openCompleteListenersRef = React.useRef<Set<() => void>>(new Set());
    const subscribeOpenComplete = React.useCallback((listener: () => void) => {
      openCompleteListenersRef.current.add(listener);
      return () => {
        openCompleteListenersRef.current.delete(listener);
      };
    }, []);
    // Mark the open transition settled and release every waiting placeholder.
    // Called both when an open finishes and when a close starts (so a
    // placeholder gated on an interrupted open isn't left waiting forever).
    const settleOpenTransition = React.useCallback(() => {
      openTransitionPendingRef.current = false;
      openCompleteListenersRef.current.forEach((listener) => listener());
    }, []);

    // Document scroll lock, owned here in Root rather than in Lightbox.Content.
    // Content unmounts at the *start* of the VT close (commitClose runs inside
    // the transition callback), so a lock tied to Content's lifecycle would be
    // released while the close animation is still playing — letting the page
    // scroll behind the transition. Root outlives the transition, so it holds
    // the lock until the close fully completes (handleCloseComplete / the
    // post-exit-animation unmount). Imperative + idempotent so the various
    // open/close code paths can acquire/release it at explicit lifecycle points.
    const scrollLockCleanupRef = React.useRef<(() => void) | null>(null);
    const lockScroll = React.useCallback(() => {
      if (scrollLockCleanupRef.current || typeof document === 'undefined') return;
      const html = document.documentElement;
      const body = document.body;
      // Width freed when the classic scrollbar disappears under
      // `overflow: hidden`. Compensate with body padding so locking doesn't
      // shift page content left. Zero on overlay-scrollbar platforms
      // (mobile / macOS overlay), so this is a no-op there.
      const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);
      const originalOverflow = html.style.overflow;
      const originalPaddingRight = body.style.paddingRight;
      html.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        const currentPadding = parseFloat(window.getComputedStyle(body).paddingRight) || 0;
        body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
      }
      scrollLockCleanupRef.current = () => {
        html.style.overflow = originalOverflow;
        body.style.paddingRight = originalPaddingRight;
      };
    }, []);
    const unlockScroll = React.useCallback(() => {
      scrollLockCleanupRef.current?.();
      scrollLockCleanupRef.current = null;
    }, []);

    // Tracks the most recent open value that internal setOpen has
    // claimed responsibility for. When the derived `open` differs from
    // this ref, the change came from outside (e.g. a controlled prop
    // mutated by something other than Lightbox.Trigger / Close /
    // imperative handle) and the sync effect below needs to mount or
    // unmount the portal manually.
    const lastInternalOpenRef = React.useRef(open);

    // View transition refs
    const triggerElementsRef = React.useRef<Map<number, HTMLElement>>(new Map());
    // Trigger element → its designated morph descendant (via the trigger
    // render-prop's `morphRef`). Keyed by element so it's correct even
    // when several triggers share an index. See findTriggerMorphTarget.
    const triggerMorphElementsRef = React.useRef<WeakMap<HTMLElement, HTMLElement>>(new WeakMap());
    const activeItemElementRef = React.useRef<HTMLElement | null>(null);
    // Item element → its designated morph descendant (via the item render-prop's
    // `morphRef`, else its `imageRef`). Keyed by element. See
    // findItemMorphTarget.
    const itemMorphElementsRef = React.useRef<WeakMap<HTMLElement, HTMLElement>>(new WeakMap());
    const openingTriggerIndexRef = React.useRef(0);
    const openingTriggerElementRef = React.useRef<HTMLElement | null>(null);
    const openingTriggerImageRef = React.useRef<HTMLImageElement | null>(null);
    const triggerImageElementsRef = React.useRef<Map<number, HTMLImageElement>>(new Map());
    const dialogElementRef = React.useRef<HTMLElement | null>(null);
    const backdropElementRef = React.useRef<HTMLElement | null>(null);
    const activeIndexRef = React.useRef(activeIndex);
    activeIndexRef.current = activeIndex;

    // --- Active-zoom bridge ---
    // The active slide's Lightbox.Zoom publishes its controls here so a single
    // set of global zoom controls (and Content's pull/keyboard logic) can drive
    // whichever slide is active. `activeZoom` is reactive (buttons re-render on
    // enabled-state changes); `activeZoomRef` mirrors it for imperative,
    // always-fresh reads.
    const [activeZoom, setActiveZoom] = React.useState<ActiveZoomControls | null>(null);
    const activeZoomRef = React.useRef<ActiveZoomControls | null>(null);
    React.useEffect(() => {
      activeZoomRef.current = activeZoom;
    }, [activeZoom]);

    // Functional-updater form lets the publishing Zoom guard its own cleanup by
    // identity, so a slide swap (new Zoom publishes, old Zoom's cleanup runs)
    // never nulls out the incoming controls regardless of effect ordering.
    const publishActiveZoom = React.useCallback<PublishActiveZoom>((next) => {
      setActiveZoom((prev) => (typeof next === 'function' ? next(prev) : next));
    }, []);

    const zoomPublishValue = React.useMemo<LightboxZoomPublishContextValue>(
      () => ({ publish: publishActiveZoom, activeZoomRef }),
      [publishActiveZoom],
    );

    // --- View Transition morph ---
    // The morph mechanics (startViewTransition, document-level morph state,
    // flushSync timing, generation-guarded completion) live in the hook. Root
    // owns React state via commit callbacks and the lifecycle callbacks.
    const commitOpen = React.useCallback(() => {
      setMounted(true);
      lockScroll();
      if (!isControlledOpen) {
        setUncontrolledOpen(true);
      }
      onOpenChangeRef.current?.(true);
    }, [isControlledOpen, lockScroll]);

    // VT open is split into two commits so the expensive React reconciliation
    // (mounting the whole viewer + gallery) happens BEFORE `startViewTransition`
    // — off the transition's render-suppressed critical path — and only a cheap
    // reveal runs inside the callback.
    //
    // `commitPrepare` mounts the tree but keeps `open` false, so Content/Backdrop
    // render `visibility: hidden` (invisible in the transition's old snapshot)
    // while their layout settles and destination images start decoding.
    const commitPrepare = React.useCallback(() => {
      setMounted(true);
      setPreparing(true);
    }, []);

    // `commitReveal` flips the prepared tree visible and marks the lightbox open
    // (firing onOpenChange). The DOM already exists, so this is a paint-only flip
    // rather than a mount.
    const commitReveal = React.useCallback(() => {
      setPreparing(false);
      setMounted(true);
      // Lock at reveal (not prepare) so hiding the scrollbar — which can reflow
      // the page — is masked by the transition rather than showing as a jump.
      lockScroll();
      if (!isControlledOpen) {
        setUncontrolledOpen(true);
      }
      onOpenChangeRef.current?.(true);
    }, [isControlledOpen, lockScroll]);

    const commitClose = React.useCallback(() => {
      if (!isControlledOpen) {
        setUncontrolledOpen(false);
      }
      onOpenChangeRef.current?.(false);
      setMounted(false);
    }, [isControlledOpen]);

    const handleOpenComplete = React.useCallback(() => {
      settleOpenTransition();
      onOpenChangeCompleteRef.current?.(true);
    }, [settleOpenTransition]);

    const handleCloseComplete = React.useCallback(
      (triggerEl: HTMLElement | undefined) => {
        // Release the page scroll lock only now — after the close transition has
        // finished — so the page can't scroll behind an in-flight VT close.
        unlockScroll();
        triggerEl?.focus({ preventScroll: true });
        onOpenChangeCompleteRef.current?.(false);
      },
      [unlockScroll],
    );

    const morph = useViewTransitionMorph({
      morphTo,
      scrollTriggerIntoView,
      decodeMaxWait,
      triggerElementsRef,
      triggerMorphElementsRef,
      activeItemElementRef,
      itemMorphElementsRef,
      openingTriggerIndexRef,
      activeIndexRef,
      closeGenRef,
      commitPrepare,
      commitReveal,
      commitClose,
      onOpenComplete: handleOpenComplete,
      onCloseComplete: handleCloseComplete,
    });

    const setOpen = React.useCallback(
      (nextOpen: boolean) => {
        closeGenRef.current += 1;
        // Mark this transition as internal so the external-sync effect
        // below doesn't double-handle the mount lifecycle when the
        // controlled `open` prop subsequently updates via onOpenChange.
        lastInternalOpenRef.current = nextOpen;

        // Open-transition gate for `Lightbox.Item` placeholders: mark it pending
        // as the open begins (items mounting during the morph will wait for it),
        // and settle it as a close begins (so a placeholder gated on an
        // interrupted open is released before the item unmounts).
        if (nextOpen) {
          openTransitionPendingRef.current = true;
        } else {
          settleOpenTransition();
        }

        // Skip the (document-snapshotting) morph on low-end hardware and fall
        // back to the plain fade path, which is far cheaper to composite.
        const useVT = viewTransition && supportsViewTransitions() && !isLowEndDevice();

        if (useVT) {
          // The generation was bumped above; the morph captures it on call.
          if (nextOpen) {
            morph.open();
          } else {
            morph.close();
          }
        } else {
          // --- No view transition ---
          if (nextOpen) {
            commitOpen();
            // Wait a frame for the enter animation to register before
            // observing it, then fire the completion callback once it settles.
            const gen = closeGenRef.current;
            requestAnimationFrame(() => {
              if (closeGenRef.current !== gen) return;
              runAfterAnimations(dialogElementRef.current, gen, closeGenRef, () => {
                const openCompleteBehavior = resolveScrollBehavior(
                  scrollTriggerIntoView,
                  'onOpenComplete',
                );
                if (openCompleteBehavior) {
                  const idx = resolveTriggerIndex(
                    activeIndexRef.current,
                    morphTo,
                    openingTriggerIndexRef.current,
                    triggerElementsRef.current,
                  );
                  scrollTriggerEl(triggerElementsRef.current.get(idx), openCompleteBehavior);
                }
                settleOpenTransition();
                onOpenChangeCompleteRef.current?.(true);
              });
            });
          } else {
            const closeTriggerIdx = resolveTriggerIndex(
              activeIndexRef.current,
              morphTo,
              openingTriggerIndexRef.current,
              triggerElementsRef.current,
            );
            const closeBehavior = resolveScrollBehavior(scrollTriggerIntoView, 'onClose');
            if (closeBehavior) {
              const triggerEl = triggerElementsRef.current.get(closeTriggerIdx);
              scrollTriggerEl(triggerEl, closeBehavior);
            }
            if (!isControlledOpen) {
              setUncontrolledOpen(false);
            }
            onOpenChangeRef.current?.(false);
            const gen = closeGenRef.current;
            const focusTarget = triggerElementsRef.current.get(closeTriggerIdx);
            // Keep the item mounted until the consumer's exit transition
            // finishes, then unmount, restore focus, and fire completion.
            runAfterAnimations(dialogElementRef.current, gen, closeGenRef, () => {
              setMounted(false);
              // Release the scroll lock only after the exit animation settles.
              unlockScroll();
              requestAnimationFrame(() => focusTarget?.focus({ preventScroll: true }));
              onOpenChangeCompleteRef.current?.(false);
            });
          }
        }
      },
      [isControlledOpen, viewTransition, scrollTriggerIntoView, morphTo, morph, commitOpen, unlockScroll, settleOpenTransition],
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
        // External/controlled open has no originating click element; clear it
        // so a stale clicked trigger from a prior open isn't reused.
        openingTriggerElementRef.current = null;
        openingTriggerImageRef.current = null;
        setMounted(true);
        lockScroll();
        return;
      }

      const gen = ++closeGenRef.current;
      runAfterAnimations(dialogElementRef.current, gen, closeGenRef, () => {
        setMounted(false);
        unlockScroll();
      });
    }, [open, lockScroll, unlockScroll]);

    // Initially-open lightbox (defaultOpen / controlled-open at mount): the
    // open-commit paths above don't run, so acquire the lock here. The cleanup
    // also guarantees the lock is released if Root unmounts while still open.
    React.useEffect(() => {
      if (mounted && !preparing) lockScroll();
      return () => unlockScroll();
      // Mount/unmount only — subsequent opens lock via commitOpen/commitReveal.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Imperative handle
    React.useImperativeHandle(
      forwardedRef,
      () => ({
        open: (index?: number) => {
          if (index !== undefined) {
            openingTriggerIndexRef.current = index;
            setActiveIndex(index, 'trigger');
          }
          // Programmatic open: no originating element, so clear it. Placeholder
          // sourcing falls back to the index-keyed trigger map.
          openingTriggerElementRef.current = null;
          openingTriggerImageRef.current = null;
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
        preparing,
        openTransitionPendingRef,
        subscribeOpenComplete,
        activeIndex,
        setActiveIndex,
        navigationLockedRef,
        itemCount,
        registerItem,
        loop,
        captionsRef,
        registerCaption,
        subscribeCaptions,
        viewTransition,
        morphTo,
        triggerElementsRef,
        triggerMorphElementsRef,
        activeItemElementRef,
        itemMorphElementsRef,
        openingTriggerIndexRef,
        openingTriggerElementRef,
        openingTriggerImageRef,
        triggerImageElementsRef,
        dialogElementRef,
        backdropElementRef,
      }),
      [open, setOpen, mounted, preparing, subscribeOpenComplete, activeIndex, setActiveIndex, itemCount, registerItem, loop, registerCaption, subscribeCaptions, viewTransition, morphTo],
    );

    return (
      <LightboxContext.Provider value={contextValue}>
        <LightboxZoomPublishContext.Provider value={zoomPublishValue}>
          <LightboxActiveZoomContext.Provider value={activeZoom}>{children}</LightboxActiveZoomContext.Provider>
        </LightboxZoomPublishContext.Provider>
      </LightboxContext.Provider>
    );
  },
);

LightboxRoot.displayName = 'LightboxRoot';

export { LightboxRoot };
export type { LightboxRootProps, LightboxRootRef };
