'use client';

import { mergeProps, useRender } from '@base-ui/react';
import * as React from 'react';

import { LightboxContext } from './lightbox-context';
import {
  getLightboxHandleSnapshot,
  getLightboxHandleVersion,
  registerHandleTrigger,
  subscribeLightboxHandle,
  touchHandleTrigger,
  type LightboxHandle,
  type LightboxHandleTriggerRegistration,
} from './lightbox-handle';

/** Direction(s) in which the trigger↔item morph should crossfade snapshots. */
type LightboxCrossfade = 'open' | 'close' | 'both';

interface LightboxTriggerState extends Record<string, unknown> {
  open: boolean;
  active: boolean;
  morphTarget: boolean;
}

/**
 * Values handed to a trigger's render-function children. Attaching the refs is
 * how a consumer *explicitly* designates the trigger's image and morph element —
 * no `querySelector`/`getComputedStyle` guessing.
 */
interface LightboxTriggerRenderState {
  /**
   * Attach to the trigger's `<img>`. Its already-decoded `currentSrc` is reused
   * as the destination image's placeholder so the open transition never shows a
   * blank frame. Works correctly with `srcSet` (reads the candidate the browser
   * actually fetched). Attach it to the single image whose pixels should bridge
   * — e.g. the photo, *not* a `+N` overlay. This does not control what morphs;
   * use `morphRef` (or the trigger root by default) for that.
   */
  imageRef: (node: HTMLImageElement | null) => void;
  /**
   * Optional. Attach to the element that should morph when it should be a
   * *bigger* element than the image (e.g. a tile that also contains an overlay).
   * When unattached the whole trigger morphs, which already includes any
   * overlay — so you rarely need this.
   */
  morphRef: (node: HTMLElement | null) => void;
  /** Whether the lightbox is open. */
  open: boolean;
  /** Whether this trigger's index is the active item. */
  active: boolean;
}

/**
 * Context published by each `Lightbox.Trigger` so a nested wrapper component —
 * e.g. a shared `<TriggerImage>` — can attach `imageRef` without the consumer
 * threading the render function through it. Mirrors the render function's
 * arguments.
 */
const LightboxTriggerContext = React.createContext<LightboxTriggerRenderState | null>(null);

/**
 * Optional context from the enclosing Trigger. Returns
 * `{ imageRef, morphRef, open, active }`, or `null` outside a Trigger.
 */
function useOptionalLightboxTriggerContext(): LightboxTriggerRenderState | null {
  return React.useContext(LightboxTriggerContext);
}

interface LightboxTriggerProps
  extends Omit<useRender.ComponentProps<'button', LightboxTriggerState>, 'children'> {
  /** Item index this trigger opens. Required. */
  index: number;
  /**
   * Stable id for this trigger. Required for `handle.open(index, { triggerId })`
   * association and for detached Triggers. Also applied as the DOM `id`.
   */
  id?: string;
  /**
   * Handle from `Lightbox.createHandle()`. Pass the same handle as Root to use
   * this Trigger outside the Root tree (Base UI Dialog-style detached triggers).
   */
  handle?: LightboxHandle;
  /**
   * Crossfade between trigger and item snapshots during the view-transition
   * morph. Omit (default) for a hard-cut morph — ideal when trigger and item
   * show the same image at different crops/sizes. Use a direction when they
   * differ visually:
   * - `'both'` — crossfade on open and close (e.g. a stack → single photo)
   * - `'open'` — crossfade only when opening
   * - `'close'` — crossfade only when closing (e.g. poster → live video)
   *
   * Sets `data-crossfade` / `data-lightbox-no-crossfade` for CSS.
   */
  crossfade?: LightboxCrossfade;
  /**
   * Static children, or a render function that receives `imageRef` /
   * `morphRef` (attach them to designate the placeholder source and the
   * morph element) plus `open` / `active` state. The render function is the
   * recommended form: it wires the flash-free placeholder without any DOM
   * guessing.
   */
  children?: React.ReactNode | ((state: LightboxTriggerRenderState) => React.ReactNode);
}

const triggerStateAttributesMapping = {
  open: (value: unknown) => (value ? { 'data-open': '' } : null),
  active: (value: unknown) => (value ? { 'data-active': '' } : null),
  morphTarget: (value: unknown) => (value ? { 'data-morph-target': '' } : null),
};

const noopSubscribe = () => () => {};

/**
 * A trigger that opens the Lightbox at a specific item index.
 * Multiple triggers can exist — each opens the lightbox at its `index`.
 *
 * When `viewTransition` is enabled on Root, the trigger element is
 * used as the morph source for the view transition animation.
 *
 * Prefer the render-function form of `children` so you can attach
 * `imageRef` to the trigger's image — that's what lets the destination
 * image reuse the already-decoded thumbnail as a placeholder and avoid a blank
 * frame during the open morph.
 *
 * Pass `handle` (from `Lightbox.createHandle()`) to render this Trigger
 * outside `Lightbox.Root`, matching Base UI Dialog detached triggers.
 */
const LightboxTrigger = React.forwardRef<HTMLButtonElement, LightboxTriggerProps>(
  function LightboxTrigger(props, forwardedRef) {
    const { render, index, id: idProp, handle: handleProp, crossfade, children, ...elementProps } =
      props;

    const rootContext = React.useContext(LightboxContext);
    if (!rootContext && !handleProp) {
      throw new Error(
        'Lightbox.Trigger must be used within a Lightbox.Root, or passed a handle from Lightbox.createHandle()',
      );
    }

    // Stable id for handle registration. Prefer the consumer `id` (also used as
    // DOM id / handle.open triggerId); fall back to useId for detached morph.
    const reactId = React.useId();
    const handleTriggerId = idProp ?? reactId;

    // Detached Triggers subscribe to a stable version number (not a new object
    // each read — that would loop useSyncExternalStore).
    const handleVersion = React.useSyncExternalStore(
      handleProp && !rootContext
        ? (onStoreChange) => subscribeLightboxHandle(handleProp, onStoreChange)
        : noopSubscribe,
      () => (handleProp && !rootContext ? getLightboxHandleVersion(handleProp) : 0),
      () => 0,
    );
    void handleVersion;
    const handleSnapshot =
      !rootContext && handleProp ? getLightboxHandleSnapshot(handleProp) : null;

    const open = rootContext?.open ?? handleSnapshot?.open ?? false;
    const activeIndex = rootContext?.activeIndex ?? handleSnapshot?.activeIndex ?? 0;
    const morphTo = rootContext?.morphTo ?? 'active';
    const triggerElementsRef = rootContext?.triggerElementsRef;
    const triggerMorphElementsRef = rootContext?.triggerMorphElementsRef;
    const triggerImageElementsRef = rootContext?.triggerImageElementsRef;
    const triggerIdsRef = rootContext?.triggerIdsRef;
    const openingTriggerIndexRef = rootContext?.openingTriggerIndexRef;
    const openingTriggerElementRef = rootContext?.openingTriggerElementRef;
    const openingTriggerImageRef = rootContext?.openingTriggerImageRef;
    const setOpen = rootContext?.setOpen;
    const setActiveIndex = rootContext?.setActiveIndex;

    const internalRef = React.useRef<HTMLButtonElement | null>(null);
    // The image node the consumer designated via `imageRef`, if any.
    const imageNodeRef = React.useRef<HTMLImageElement | null>(null);
    // The morph node the consumer designated via `morphRef`, if any.
    const morphNodeRef = React.useRef<HTMLElement | null>(null);
    const handleRegistrationRef = React.useRef<LightboxHandleTriggerRegistration | null>(null);

    const syncHandleRegistration = React.useCallback(() => {
      const reg = handleRegistrationRef.current;
      if (!handleProp || !reg) return;
      reg.index = index;
      reg.element = internalRef.current;
      reg.image = imageNodeRef.current;
      reg.morphElement = morphNodeRef.current;
      touchHandleTrigger(handleProp, reg);
    }, [handleProp, index]);

    // Register with the handle for detached / imperative triggerId association.
    React.useLayoutEffect(() => {
      if (!handleProp) {
        handleRegistrationRef.current = null;
        return;
      }
      const reg: LightboxHandleTriggerRegistration = {
        id: handleTriggerId,
        index,
        element: internalRef.current,
        image: imageNodeRef.current,
        morphElement: morphNodeRef.current,
      };
      handleRegistrationRef.current = reg;
      return registerHandleTrigger(handleProp, reg);
    }, [handleProp, handleTriggerId, index]);

    // Register id map when this Trigger is under Root (for handle.open triggerId).
    React.useLayoutEffect(() => {
      if (!idProp || !triggerIdsRef) return;
      const entry = {
        id: idProp,
        index,
        element: internalRef.current,
        image: imageNodeRef.current,
      };
      triggerIdsRef.current.set(idProp, entry);
      return () => {
        if (triggerIdsRef.current.get(idProp) === entry) {
          triggerIdsRef.current.delete(idProp);
        }
      };
    }, [idProp, index, triggerIdsRef]);

    // Register (or clear) this trigger's morph override in the element-keyed
    // registry. Keyed by the trigger element so it's correct even when several
    // triggers share an index; the resolver falls back to the trigger itself
    // when there's no entry. No-op until the trigger element is mounted — on
    // first mount the child's `morphRef` fires before the trigger's own
    // ref (refs resolve bottom-up), so `mergedRefCallback` re-runs this once the
    // element exists; later toggles re-run it directly from `morphRef`.
    const registerMorphElement = React.useCallback(() => {
      const triggerEl = internalRef.current;
      const registry = triggerMorphElementsRef?.current;
      if (!triggerEl || !registry) return;
      const morphNode = morphNodeRef.current;
      if (morphNode) {
        registry.set(triggerEl, morphNode);
      } else {
        registry.delete(triggerEl);
      }
      syncHandleRegistration();
    }, [triggerMorphElementsRef, syncHandleRegistration]);

    const mergedRefCallback = React.useCallback(
      (node: HTMLButtonElement | null) => {
        const prev = internalRef.current;
        internalRef.current = node;
        // Register in the trigger elements map for view transitions (Root tree).
        if (triggerElementsRef) {
          if (node) {
            triggerElementsRef.current.set(index, node);
            // Child refs (incl. `morphRef`) have already fired by now, so
            // pick up any designated morph node for this freshly-mounted trigger.
            registerMorphElement();
          } else {
            triggerElementsRef.current.delete(index);
            if (prev) triggerMorphElementsRef?.current?.delete(prev);
          }
        } else {
          // Detached: keep handle registration in sync with the DOM node.
          syncHandleRegistration();
        }
        if (idProp && triggerIdsRef) {
          const existing = triggerIdsRef.current.get(idProp);
          if (existing) {
            existing.element = node;
          } else {
            triggerIdsRef.current.set(idProp, {
              id: idProp,
              index,
              element: node,
              image: imageNodeRef.current,
            });
          }
        }
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [
        forwardedRef,
        index,
        idProp,
        triggerElementsRef,
        triggerMorphElementsRef,
        triggerIdsRef,
        registerMorphElement,
        syncHandleRegistration,
      ],
    );

    const imageRef = React.useCallback(
      (node: HTMLImageElement | null) => {
        imageNodeRef.current = node;
        if (triggerImageElementsRef) {
          if (node) {
            triggerImageElementsRef.current.set(index, node);
          } else {
            triggerImageElementsRef.current.delete(index);
          }
        }
        if (idProp && triggerIdsRef) {
          const existing = triggerIdsRef.current.get(idProp);
          if (existing) {
            existing.image = node;
          }
        }
        syncHandleRegistration();
      },
      [index, idProp, triggerImageElementsRef, triggerIdsRef, syncHandleRegistration],
    );

    const morphRef = React.useCallback(
      (node: HTMLElement | null) => {
        morphNodeRef.current = node;
        registerMorphElement();
      },
      [registerMorphElement],
    );

    const handleClick = React.useCallback(() => {
      if (rootContext && setOpen && setActiveIndex && openingTriggerIndexRef) {
        openingTriggerIndexRef.current = index;
        // Capture the exact clicked element + its designated image so placeholder/
        // morph sourcing is correct even when multiple triggers share this index.
        if (openingTriggerElementRef) {
          openingTriggerElementRef.current = internalRef.current;
        }
        if (openingTriggerImageRef) {
          openingTriggerImageRef.current = imageNodeRef.current;
        }
        setActiveIndex(index, 'trigger');
        setOpen(true);
        return;
      }
      // Detached Trigger: open through the shared handle (associates this element).
      handleProp?.open(index, { triggerId: handleTriggerId });
    }, [
      rootContext,
      handleProp,
      handleTriggerId,
      index,
      setActiveIndex,
      setOpen,
      openingTriggerIndexRef,
      openingTriggerElementRef,
      openingTriggerImageRef,
    ]);

    const active = open && activeIndex === index;

    const morphTarget = React.useMemo(() => {
      if (!open) return false;
      if (!triggerElementsRef || !openingTriggerIndexRef) {
        return active;
      }
      if (morphTo === 'origin') return index === openingTriggerIndexRef.current;
      if (morphTo === 'closest') {
        if (triggerElementsRef.current.has(activeIndex)) return activeIndex === index;
        let best = -1;
        let bestDist = Infinity;
        for (const idx of triggerElementsRef.current.keys()) {
          const dist = Math.abs(idx - activeIndex);
          if (dist < bestDist) {
            bestDist = dist;
            best = idx;
          }
        }
        return index === best;
      }
      return active;
    }, [open, morphTo, activeIndex, index, active, openingTriggerIndexRef, triggerElementsRef]);

    const state = React.useMemo<LightboxTriggerState>(
      () => ({ open, active, morphTarget }),
      [open, active, morphTarget],
    );

    const renderState = React.useMemo<LightboxTriggerRenderState>(
      () => ({ imageRef, morphRef, open, active }),
      [imageRef, morphRef, open, active],
    );

    const resolvedChildren = typeof children === 'function' ? children(renderState) : children;

    const rendered = useRender({
      render,
      ref: mergedRefCallback,
      state,
      stateAttributesMapping: triggerStateAttributesMapping,
      props: mergeProps<'button'>(
        {
          type: 'button',
          id: idProp,
          onClick: handleClick,
          // Stable styling hook — consumer CSS can target every trigger
          // (e.g. for a default focus outline) without relying on
          // state-only attributes like `data-open` or `data-active`.
          // Mirrors the `data-lightbox-item` hook on Lightbox.Item.
          'data-lightbox-trigger': '',
          ...(crossfade ? { 'data-crossfade': crossfade } : undefined),
        } as React.ComponentPropsWithRef<'button'>,
        elementProps as React.ComponentPropsWithRef<'button'>,
        { children: resolvedChildren } as React.ComponentPropsWithRef<'button'>,
      ),
      defaultTagName: 'button',
    });

    return (
      <LightboxTriggerContext.Provider value={renderState}>
        {rendered}
      </LightboxTriggerContext.Provider>
    );
  },
);

LightboxTrigger.displayName = 'LightboxTrigger';

export { LightboxTrigger, LightboxTriggerContext, useOptionalLightboxTriggerContext };
export type {
  LightboxTriggerProps,
  LightboxTriggerState,
  LightboxTriggerRenderState,
  LightboxCrossfade,
};
