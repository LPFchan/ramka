'use client';

import * as React from 'react';

import {
  LightboxContext,
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
  resolveTriggerIndex,
  scrollTriggerEl,
  useViewTransitionMorph,
} from './use-view-transition-morph';

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
      if (!isControlledOpen) {
        setUncontrolledOpen(true);
      }
      onOpenChangeRef.current?.(true);
    }, [isControlledOpen]);

    const commitClose = React.useCallback(() => {
      if (!isControlledOpen) {
        setUncontrolledOpen(false);
      }
      onOpenChangeRef.current?.(false);
      setMounted(false);
    }, [isControlledOpen]);

    const handleOpenComplete = React.useCallback(() => {
      onOpenChangeCompleteRef.current?.(true);
    }, []);

    const handleCloseComplete = React.useCallback((triggerEl: HTMLElement | undefined) => {
      triggerEl?.focus({ preventScroll: true });
      onOpenChangeCompleteRef.current?.(false);
    }, []);

    const morph = useViewTransitionMorph({
      morphTo,
      scrollTriggerIntoView,
      decodeMaxWait,
      triggerElementsRef,
      activeItemElementRef,
      openingTriggerIndexRef,
      activeIndexRef,
      closeGenRef,
      commitOpen,
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

        const useVT = viewTransition && supportsViewTransitions();

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
            if (scrollTriggerIntoView) {
              const triggerEl = triggerElementsRef.current.get(closeTriggerIdx);
              scrollTriggerEl(triggerEl, 'instant');
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
              requestAnimationFrame(() => focusTarget?.focus({ preventScroll: true }));
              onOpenChangeCompleteRef.current?.(false);
            });
          }
        }
      },
      [isControlledOpen, viewTransition, scrollTriggerIntoView, morphTo, morph, commitOpen],
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
      runAfterAnimations(dialogElementRef.current, gen, closeGenRef, () => {
        setMounted(false);
      });
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
