'use client';

import { mergeProps, useRender } from '@base-ui/react';
import * as React from 'react';

import { useLightboxContext } from './lightbox-context';

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

function useOptionalLightboxTriggerContext(): LightboxTriggerRenderState | null {
  return React.useContext(LightboxTriggerContext);
}

interface LightboxTriggerProps
  extends Omit<useRender.ComponentProps<'button', LightboxTriggerState>, 'children'> {
  /** Item index this trigger opens. Required. */
  index: number;
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
 */
const LightboxTrigger = React.forwardRef<HTMLButtonElement, LightboxTriggerProps>(
  function LightboxTrigger(props, forwardedRef) {
    const { render, index, crossfade, children, ...elementProps } = props;
    const {
      open,
      activeIndex,
      setOpen,
      setActiveIndex,
      triggerElementsRef,
      triggerMorphElementsRef,
      triggerImageElementsRef,
      openingTriggerIndexRef,
      openingTriggerElementRef,
      openingTriggerImageRef,
      morphTo,
    } = useLightboxContext();

    const internalRef = React.useRef<HTMLButtonElement | null>(null);
    // The image node the consumer designated via `imageRef`, if any.
    const imageNodeRef = React.useRef<HTMLImageElement | null>(null);
    // The morph node the consumer designated via `morphRef`, if any.
    const morphNodeRef = React.useRef<HTMLElement | null>(null);

    // Register (or clear) this trigger's morph override in the element-keyed
    // registry. Keyed by the trigger element so it's correct even when several
    // triggers share an index; the resolver falls back to the trigger itself
    // when there's no entry. No-op until the trigger element is mounted — on
    // first mount the child's `morphRef` fires before the trigger's own
    // ref (refs resolve bottom-up), so `mergedRefCallback` re-runs this once the
    // element exists; later toggles re-run it directly from `morphRef`.
    const registerMorphElement = React.useCallback(() => {
      const triggerEl = internalRef.current;
      const registry = triggerMorphElementsRef.current;
      if (!triggerEl || !registry) return;
      const morphNode = morphNodeRef.current;
      if (morphNode) {
        registry.set(triggerEl, morphNode);
      } else {
        registry.delete(triggerEl);
      }
    }, [triggerMorphElementsRef]);

    const mergedRefCallback = React.useCallback(
      (node: HTMLButtonElement | null) => {
        const prev = internalRef.current;
        internalRef.current = node;
        // Register in the trigger elements map for view transitions
        if (node) {
          triggerElementsRef.current.set(index, node);
          // Child refs (incl. `morphRef`) have already fired by now, so
          // pick up any designated morph node for this freshly-mounted trigger.
          registerMorphElement();
        } else {
          triggerElementsRef.current.delete(index);
          if (prev) triggerMorphElementsRef.current?.delete(prev);
        }
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef, index, triggerElementsRef, triggerMorphElementsRef, registerMorphElement],
    );

    const imageRef = React.useCallback(
      (node: HTMLImageElement | null) => {
        imageNodeRef.current = node;
        if (node) {
          triggerImageElementsRef.current?.set(index, node);
        } else {
          triggerImageElementsRef.current?.delete(index);
        }
      },
      [index, triggerImageElementsRef],
    );

    const morphRef = React.useCallback(
      (node: HTMLElement | null) => {
        morphNodeRef.current = node;
        registerMorphElement();
      },
      [registerMorphElement],
    );

    const handleClick = React.useCallback(() => {
      openingTriggerIndexRef.current = index;
      // Capture the exact clicked element + its designated image so placeholder/
      // morph sourcing is correct even when multiple triggers share this index.
      openingTriggerElementRef.current = internalRef.current;
      openingTriggerImageRef.current = imageNodeRef.current;
      setActiveIndex(index, 'trigger');
      setOpen(true);
    }, [
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
      if (morphTo === 'origin') return index === openingTriggerIndexRef.current;
      if (morphTo === 'closest') {
        if (triggerElementsRef.current.has(activeIndex)) return activeIndex === index;
        let best = -1;
        let bestDist = Infinity;
        for (const idx of triggerElementsRef.current.keys()) {
          const dist = Math.abs(idx - activeIndex);
          if (dist < bestDist) { bestDist = dist; best = idx; }
        }
        return index === best;
      }
      return active;
    }, [open, morphTo, activeIndex, index, active, openingTriggerIndexRef, triggerElementsRef]);

    const state = React.useMemo<LightboxTriggerState>(() => ({ open, active, morphTarget }), [open, active, morphTarget]);

    const renderState = React.useMemo<LightboxTriggerRenderState>(
      () => ({ imageRef, morphRef, open, active }),
      [imageRef, morphRef, open, active],
    );

    const resolvedChildren =
      typeof children === 'function' ? children(renderState) : children;

    const rendered = useRender({
      render,
      ref: mergedRefCallback,
      state,
      stateAttributesMapping: triggerStateAttributesMapping,
      props: mergeProps<'button'>(
        {
          type: 'button',
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
