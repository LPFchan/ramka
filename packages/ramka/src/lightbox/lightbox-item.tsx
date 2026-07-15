'use client';

import { mergeProps, useRender } from '@base-ui/react';
import * as React from 'react';

import { useLightboxContext } from './lightbox-context';
import { useLightboxItemGroupContext } from './lightbox-item-group';

interface LightboxItemState extends Record<string, unknown> {
  active: boolean;
  index: number;
}

/**
 * Context published by each `Lightbox.Item` so descendants (notably
 * `Lightbox.Zoom`) can learn their own index and whether they are the
 * currently active slide. Used by the active-zoom bridge to decide which
 * slide's zoom controls to expose to global chrome.
 */
interface LightboxItemContextValue {
  index: number;
  active: boolean;
  /**
   * Attach to the destination `<img>`. Exposed here (in addition to the render
   * function) so nested wrapper components — e.g. a shared `<FullImage>` — can
   * opt into the trigger-thumbnail placeholder without the consumer threading a
   * render prop through them.
   */
  imageRef: (node: HTMLImageElement | null) => void;
  /** Attach to override what morphs (defaults to the image). */
  morphElementRef: (node: HTMLElement | null) => void;
}

const LightboxItemContext = React.createContext<LightboxItemContextValue | null>(null);

function useOptionalLightboxItemContext(): LightboxItemContextValue | null {
  return React.useContext(LightboxItemContext);
}

/**
 * Values handed to an item's render-function children.
 */
interface LightboxItemRenderState {
  /** Whether this item is the active slide. */
  active: boolean;
  /** Whether this item is within the preload window (rendered). */
  visible: boolean;
  /** This item's index. */
  index: number;
  /**
   * Attach to the destination `<img>`. The lightbox paints the opening
   * trigger's already-decoded thumbnail (see `triggerImageRef`) as this image's
   * own CSS background until the full-resolution pixels load, then restores the
   * original background — bridging the blank frame after the open morph.
   */
  imageRef: (node: HTMLImageElement | null) => void;
  /**
   * Optional. Attach to override what morphs (defaults to the image). Use when
   * a wrapper — e.g. a rounded card around the image — should morph instead.
   */
  morphElementRef: (node: HTMLElement | null) => void;
}

interface LightboxItemProps extends Omit<useRender.ComponentProps<'div', LightboxItemState>, 'children'> {
  /** The index of this item in the collection. */
  index: number;
  /** Optional caption for this item, displayed by Lightbox.Caption. */
  caption?: React.ReactNode;
  /**
   * Static children, or a render function that receives per-item state plus
   * `imageRef` / `morphElementRef`. Prefer the render function and attach
   * `imageRef` to your `<img>` so the open transition bridges the blank frame
   * with the trigger's thumbnail (see `Lightbox.Trigger`'s `triggerImageRef`).
   */
  children?: React.ReactNode | ((state: LightboxItemRenderState) => React.ReactNode);
}

const itemStateAttributesMapping = {
  active: (value: unknown) => (value ? { 'data-active': '' } : null),
  index: (value: unknown) => ({ 'data-index': String(value) }),
};

/**
 * An individual lightbox item. Only renders when within the preload
 * window (active index +/- preload distance). Supports both static
 * children and render-prop children for lazy loading.
 *
 * When the item is active, registers its DOM element in context
 * so view transitions can morph to/from it.
 *
 * **Image loading tip:** For the smoothest open transition, images inside
 * the active item should be eagerly loaded so they are decoded before the
 * View Transition captures the "new" snapshot. If you use Next.js
 * `<Image>`, set `loading="eager"` (or `priority`/`preload`) on images
 * rendered inside `Lightbox.Item`. The lightbox waits up to 200ms for
 * the image to decode before starting the morph; `loading="lazy"` images
 * that haven't started fetching may miss this window and appear blank
 * during the opening animation.
 */
const LightboxItem = React.forwardRef<HTMLDivElement, LightboxItemProps>(
  function LightboxItem(props, forwardedRef) {
    const { render, index, caption, children, ...elementProps } = props;

    const {
      registerCaption,
      registerItem,
      activeItemElementRef,
      itemMorphElementsRef,
      openingTriggerIndexRef,
      openingTriggerElementRef,
      openingTriggerImageRef,
      triggerImageElementsRef,
      triggerElementsRef,
    } = useLightboxContext();
    const groupContext = useLightboxItemGroupContext();

    const activeIndex = groupContext.activeIndex;
    const preload = groupContext.preload;
    const isActive = index === activeIndex;
    const linearDist = Math.abs(index - activeIndex);
    const distance = groupContext.loop && groupContext.itemCount > 0
      ? Math.min(linearDist, groupContext.itemCount - linearDist)
      : linearDist;
    const isVisible = distance <= preload;

    const internalRef = React.useRef<HTMLDivElement | null>(null);
    // The destination image the consumer designated via `imageRef`, if any.
    const imageNodeRef = React.useRef<HTMLImageElement | null>(null);
    // The morph node the consumer designated via `morphElementRef`, if any.
    const morphNodeRef = React.useRef<HTMLElement | null>(null);
    const warnedRef = React.useRef(false);

    // Register (or clear) this item's morph target in the element-keyed
    // registry: the explicit `morphElementRef` override, else the `imageRef`
    // image (the destination image is the natural target). Keyed by the item
    // element. No-op until the item element is mounted — on first mount the
    // child refs (`imageRef` / `morphElementRef`) fire before the item's own
    // ref (refs resolve bottom-up), so `mergedRefCallback` re-runs this once the
    // element exists; later toggles re-run it directly. When neither is set,
    // nothing is registered and the resolver morphs into the item container
    // itself (which `isMorphTargetSizeResolvable` then rejects, falling back to
    // a plain crossfade) — attach `imageRef`/`morphElementRef` to morph the media.
    const registerMorphElement = React.useCallback(() => {
      const container = internalRef.current;
      const registry = itemMorphElementsRef.current;
      if (!container || !registry) return;
      const node = morphNodeRef.current ?? imageNodeRef.current;
      if (node) {
        registry.set(container, node);
      } else {
        registry.delete(container);
      }
    }, [itemMorphElementsRef]);

    const mergedRefCallback = React.useCallback(
      (node: HTMLDivElement | null) => {
        const prev = internalRef.current;
        internalRef.current = node;
        if (node) {
          registerMorphElement();
        } else if (prev) {
          itemMorphElementsRef.current?.delete(prev);
        }
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef, itemMorphElementsRef, registerMorphElement],
    );

    const imageRef = React.useCallback(
      (node: HTMLImageElement | null) => {
        imageNodeRef.current = node;
        registerMorphElement();
      },
      [registerMorphElement],
    );

    const morphElementRef = React.useCallback(
      (node: HTMLElement | null) => {
        morphNodeRef.current = node;
        registerMorphElement();
      },
      [registerMorphElement],
    );

    // Bridge the blank frame after the open morph: until the destination image
    // loads, paint the opening trigger's already-decoded thumbnail as this
    // image's own CSS background, then restore on load. Runs on mount inside the
    // `commitPrepare` flushSync — before the View Transition captures the "new"
    // snapshot — so the placeholder is part of the morph end state. Only touches
    // the image when the consumer opted in via `imageRef`.
    React.useLayoutEffect(() => {
      const img = imageNodeRef.current;
      if (!img) return;
      if (img.complete && img.naturalWidth > 0) return; // already decoded

      const clicked =
        openingTriggerIndexRef.current === index ? openingTriggerImageRef.current : null;
      const source = clicked ?? triggerImageElementsRef.current?.get(index) ?? null;
      const src = source?.currentSrc ?? '';

      if (!src) {
        if (process.env.NODE_ENV !== 'production' && !warnedRef.current) {
          const hasTriggerImage = triggerImageElementsRef.current?.has(index) ?? false;
          // Only nag when the trigger genuinely *has* an image that wasn't wired
          // up (a real mistake) — never for intentionally non-image triggers
          // (e.g. a colour swatch). This DOM check is dev-only and off the
          // runtime placeholder path.
          const triggerRoot =
            (openingTriggerIndexRef.current === index ? openingTriggerElementRef.current : null) ??
            triggerElementsRef.current?.get(index) ??
            null;
          const triggerHasImage = !!triggerRoot?.querySelector('img');
          if (triggerHasImage && !hasTriggerImage) {
            warnedRef.current = true;
            // eslint-disable-next-line no-console
            console.warn(
              `[ramka] Lightbox.Item index=${index}: image not yet loaded and no placeholder ` +
                `source found, so the open transition may flash a blank frame. Attach ` +
                `\`triggerImageRef\` to the trigger's <img> (via the Lightbox.Trigger render ` +
                `function) to bridge it, or pass an already-loaded image.`,
            );
          }
        }
        return;
      }

      const saved = {
        image: img.style.backgroundImage,
        size: img.style.backgroundSize,
        position: img.style.backgroundPosition,
        repeat: img.style.backgroundRepeat,
      };
      const restore = () => {
        img.style.backgroundImage = saved.image;
        img.style.backgroundSize = saved.size;
        img.style.backgroundPosition = saved.position;
        img.style.backgroundRepeat = saved.repeat;
      };

      const cs = getComputedStyle(img);
      const fit = cs.objectFit;
      img.style.backgroundImage = `url("${src}")`;
      img.style.backgroundSize = fit === 'cover' || fit === 'contain' ? fit : 'cover';
      img.style.backgroundPosition = cs.objectPosition || 'center';
      img.style.backgroundRepeat = 'no-repeat';

      let cleared = false;
      const onLoad = () => {
        if (cleared) return;
        cleared = true;
        restore();
      };
      img.addEventListener('load', onLoad);
      return () => {
        img.removeEventListener('load', onLoad);
        if (!cleared) restore();
      };
      // Run once on mount: the source trigger and destination image are fixed
      // for this item's lifetime.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Register active item element for view transitions.
    // useLayoutEffect ensures the ref is set synchronously after
    // commit, which is critical for flushSync in the view transition flow.
    React.useLayoutEffect(() => {
      if (isActive && internalRef.current) {
        activeItemElementRef.current = internalRef.current;
      }
    }, [isActive, activeItemElementRef]);

    React.useEffect(() => {
      return registerItem(index);
    }, [index, registerItem]);

    React.useEffect(() => {
      if (caption !== undefined) {
        return registerCaption(index, caption);
      }
    }, [index, caption, registerCaption]);

    const resolvedChildren = React.useMemo(() => {
      if (!isVisible) return null;
      return typeof children === 'function'
        ? children({ active: isActive, visible: isVisible, index, imageRef, morphElementRef })
        : children;
    }, [isVisible, isActive, index, children, imageRef, morphElementRef]);

    const state = React.useMemo<LightboxItemState>(() => ({ active: isActive, index }), [isActive, index]);

    const itemContextValue = React.useMemo<LightboxItemContextValue>(
      () => ({ index, active: isActive, imageRef, morphElementRef }),
      [index, isActive, imageRef, morphElementRef],
    );

    // useRender is a hook — must always be called regardless of visibility
    const rendered = useRender({
      render,
      ref: mergedRefCallback,
      state,
      stateAttributesMapping: itemStateAttributesMapping,
      props: mergeProps<'div'>(
        {
          // `data-lightbox-item` is the stable selector that internal hooks
          // (e.g. pull-to-dismiss) use to walk up from a pointer's target to
          // the owning item. It replaces what was a branded class name in
          // upstream so the primitives stay free of ship-as-is styles.
          'data-lightbox-item': '',
          role: 'tabpanel',
          'aria-hidden': !isActive,
          inert: !isActive ? true : undefined,
        } as React.ComponentPropsWithRef<'div'>,
        elementProps as React.ComponentPropsWithRef<'div'>,
        { children: resolvedChildren } as React.ComponentPropsWithRef<'div'>,
      ),
      defaultTagName: 'div',
    });

    if (!isVisible) return null;

    return <LightboxItemContext.Provider value={itemContextValue}>{rendered}</LightboxItemContext.Provider>;
  },
);

LightboxItem.displayName = 'LightboxItem';

export { LightboxItem, LightboxItemContext, useOptionalLightboxItemContext };
export type {
  LightboxItemProps,
  LightboxItemState,
  LightboxItemContextValue,
  LightboxItemRenderState,
};
