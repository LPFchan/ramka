'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import * as React from 'react';

import { LightboxItemDataAttributes } from './lightbox-data-attributes';
import { useLightboxContext } from './lightbox-context';
import { tryPaintCanvasPlaceholder } from './lightbox-placeholder';
import { useSlidesPreload } from './lightbox-slides';
import { inertWhen } from './react-compat';

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
   * opt into the trigger-thumbnail canvas placeholder without the consumer
   * threading a render prop through them. Prefer wrapping media in
   * `Lightbox.Media`, which wires this automatically.
   */
  imageRef: (node: HTMLImageElement | null) => void;
  /** Attach to override what morphs (defaults to Media, then the image). */
  morphRef: (node: HTMLElement | null) => void;
  /**
   * Called by `Lightbox.Media` to register the sized media host as the morph /
   * placeholder target. Prefer Media over wiring `morphRef` manually.
   */
  registerMedia: (node: HTMLElement | null) => void;
  /**
   * Called by `Lightbox.Media` so Item can flip `data-placeholder` when it
   * inserts or removes the canvas underlay. Ref-based — does not re-render Item.
   */
  registerPlaceholder: (setPlaceholder: ((on: boolean) => void) | null) => void;
}

const LightboxItemContext = React.createContext<LightboxItemContextValue | null>(null);

/**
 * Optional context from the enclosing Item. Returns
 * `{ index, active, imageRef, morphRef, registerMedia, registerPlaceholder }`, or `null` outside an Item.
 */
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
   * Attach to the destination `<img>`. Until the full-resolution pixels load,
   * the lightbox bridges the open morph by painting the opening trigger's
   * already-decoded thumbnail (see `Lightbox.Trigger`'s `imageRef`) into a
   * `<canvas>` underlay behind this image, then removes it once the image is
   * painted.
   */
  imageRef: (node: HTMLImageElement | null) => void;
  /**
   * Optional. Attach to override what morphs (defaults to the image). Use when
   * a wrapper — e.g. a rounded card around the image — should morph instead.
   */
  morphRef: (node: HTMLElement | null) => void;
}

interface LightboxItemProps extends Omit<useRender.ComponentProps<'div', LightboxItemState>, 'children'> {
  /** The index of this item in the collection. */
  index: number;
  /** Optional caption for this item, displayed by Lightbox.Caption. */
  caption?: React.ReactNode;
  /**
   * Static children, or a render function that receives per-item state plus
   * `imageRef` / `morphRef`. Prefer the render function and attach
   * `imageRef` to your `<img>` so the open transition bridges the blank frame
   * with the trigger's thumbnail (see `Lightbox.Trigger`'s `imageRef`).
   */
  children?: React.ReactNode | ((state: LightboxItemRenderState) => React.ReactNode);
}

const itemStateAttributesMapping = {
  active: (value: unknown) => (value ? { 'data-active': '' } : null),
  index: (value: unknown) => ({ 'data-index': String(value) }),
};

/**
 * An individual lightbox item. Inside `Lightbox.Slides`, only renders when
 * within the preload window (active index +/- preload distance). Outside
 * Slides, every item stays mounted. Supports both static children and
 * render-prop children for lazy loading.
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
    const { render, index, caption, children, style, ...elementProps } = props;

    const {
      registerCaption,
      registerItem,
      activeIndex,
      loop,
      itemCount,
      activeItemElementRef,
      itemMorphElementsRef,
      openingTriggerIndexRef,
      openingTriggerElementRef,
      openingTriggerImageRef,
      triggerImageElementsRef,
      triggerElementsRef,
      openTransitionPendingRef,
      subscribeOpenComplete,
      baseId,
      hasTablist,
    } = useLightboxContext();
    const preload = useSlidesPreload();

    const isActive = index === activeIndex;
    const linearDist = Math.abs(index - activeIndex);
    const distance = loop && itemCount > 0
      ? Math.min(linearDist, itemCount - linearDist)
      : linearDist;
    const isVisible = distance <= preload;

    const internalRef = React.useRef<HTMLDivElement | null>(null);
    // The destination image the consumer designated via `imageRef`, if any.
    const imageNodeRef = React.useRef<HTMLImageElement | null>(null);
    // The morph node the consumer designated via `morphRef`, if any.
    const morphNodeRef = React.useRef<HTMLElement | null>(null);
    // Sized media host from `Lightbox.Media` (preferred morph + placeholder host).
    const mediaNodeRef = React.useRef<HTMLElement | null>(null);
    const warnedRef = React.useRef(false);

    // Register (or clear) this item's morph target: explicit `morphRef` →
    // `Lightbox.Media` → `imageRef`. Keyed by the item element. Prefer Media so
    // the open morph targets the sized media box (not Zoom's transform wrapper).
    const registerMorphElement = React.useCallback(() => {
      const container = internalRef.current;
      const registry = itemMorphElementsRef.current;
      if (!container || !registry) return;
      const node = morphNodeRef.current ?? mediaNodeRef.current ?? imageNodeRef.current;
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

    const morphRef = React.useCallback(
      (node: HTMLElement | null) => {
        morphNodeRef.current = node;
        registerMorphElement();
      },
      [registerMorphElement],
    );

    const registerMedia = React.useCallback(
      (node: HTMLElement | null) => {
        mediaNodeRef.current = node;
        registerMorphElement();
      },
      [registerMorphElement],
    );

    const setMediaPlaceholderRef = React.useRef<((on: boolean) => void) | null>(null);
    const registerPlaceholder = React.useCallback((setPlaceholder: ((on: boolean) => void) | null) => {
      setMediaPlaceholderRef.current = setPlaceholder;
    }, []);

    // Bridge the blank frame until the destination image loads: paint this
    // index's already-decoded trigger thumbnail into a `<canvas>` behind the
    // image (falling back to a CSS background when a canvas is unavailable),
    // then remove it on load.
    //
    // Must re-run when `isVisible` flips true. Items outside the preload
    // window stay mounted but render `null`, so a `[]` effect would fire once
    // with no destination `<img>` and never paint — that's the blank frame
    // when the thumbnail strip jumps past the preload window. On open, this
    // still runs inside `commitPrepare`'s flushSync (visible item, image
    // already in the tree) so the placeholder is in the morph "new" snapshot.
    // Only touches the image when the consumer opted in via `imageRef` (or
    // Media auto-wired it).
    React.useLayoutEffect(() => {
      if (!isVisible) return;
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
                `\`imageRef\` on Lightbox.Trigger's <img> (via its render ` +
                `function) to bridge it, or pass an already-loaded image.`,
            );
          }
        }
        return;
      }

      const cs = getComputedStyle(img);
      const fit = cs.objectFit === 'contain' ? 'contain' : 'cover';

      // Prefer a <canvas> underlay over a CSS background. WHY: during the open
      // morph WebKit routinely captures the destination's "new" view-transition
      // snapshot before an async image decode lands, so a `background-image`
      // (decoded async, per-draw-size, and especially unreliable behind a
      // *replaced* <img>) is blank for the first frame(s) and at the VT→live
      // handoff — which is what makes the placeholder "disappear", the trigger's
      // baked border-radius balloon (we fall back to the opaque old/trigger
      // snapshot), and the letterboxing arrive late. A canvas is a pre-
      // rasterized bitmap: `drawImage` of the already-decoded trigger thumbnail
      // is synchronous, so its backing store is ready before the snapshot and
      // survives the handoff with no re-decode. We size the letterbox rect
      // ourselves from the trigger's intrinsic dimensions (`source.natural*`).
      //
      // Canvas host must be `Lightbox.Media` or an explicit non-img `morphRef`.
      // We do not insert into `img.parentElement` / retarget the morph — that
      // silently used Zoom's full-size transform wrapper. Without a host, fall
      // back to the CSS background on the destination image.
      const canvasHost = morphNodeRef.current ?? mediaNodeRef.current;
      const canvasRestore =
        canvasHost && canvasHost !== img
          ? tryPaintCanvasPlaceholder({
              img,
              source,
              fit,
              objectPosition: cs.objectPosition,
              host: canvasHost,
            })
          : null;

      let restore: () => void;
      if (canvasRestore) {
        const notifyMedia = canvasHost === mediaNodeRef.current;
        if (notifyMedia) setMediaPlaceholderRef.current?.(true);
        restore = () => {
          canvasRestore();
          if (notifyMedia) setMediaPlaceholderRef.current?.(false);
        };
      } else {
        // Fallback: paint the thumbnail as the <img>'s own CSS background. Size
        // it OURSELVES in px (not the `cover|contain` keyword, which resolves
        // against the background's async-reported intrinsic ratio and briefly
        // degenerates to filling the box) using the trigger's intrinsic size.
        const saved = {
          image: img.style.backgroundImage,
          size: img.style.backgroundSize,
          position: img.style.backgroundPosition,
          repeat: img.style.backgroundRepeat,
        };
        restore = () => {
          img.style.backgroundImage = saved.image;
          img.style.backgroundSize = saved.size;
          img.style.backgroundPosition = saved.position;
          img.style.backgroundRepeat = saved.repeat;
        };
        img.style.backgroundImage = `url("${src}")`;
        const boxW = img.clientWidth;
        const boxH = img.clientHeight;
        const natW = source?.naturalWidth ?? 0;
        const natH = source?.naturalHeight ?? 0;
        if (boxW > 0 && boxH > 0 && natW > 0 && natH > 0) {
          const scale =
            fit === 'contain'
              ? Math.min(boxW / natW, boxH / natH)
              : Math.max(boxW / natW, boxH / natH);
          img.style.backgroundSize = `${natW * scale}px ${natH * scale}px`;
        } else {
          img.style.backgroundSize = fit;
        }
        img.style.backgroundPosition = cs.objectPosition || 'center';
        img.style.backgroundRepeat = 'no-repeat';
      }

      let cleared = false;
      let rafA = 0;
      let rafB = 0;
      let imagePainted = false;

      // Only gate on the open transition when one is actually in flight as this
      // item mounts — i.e. the morphing slide. Items navigated to *after* the
      // open (adjacent slides) see no pending transition and clear on load as
      // usual; otherwise they'd wait forever for an open-complete that already
      // fired.
      let openSettled = !openTransitionPendingRef.current;

      // ⚠️ IMPORTANT — the placeholder is the bridge for the open morph, so two
      // independent conditions must BOTH hold before we pull it out from under
      // the destination <img>. Whichever lands last performs the single restore.
      //
      //   (a) the full-res image is actually painted. `load` only means the
      //       bytes arrived; the <img>'s replaced content isn't composited until
      //       a later frame (notably mobile Safari). So decode() (pixels ready)
      //       then wait two animation frames (content composited) before marking
      //       it painted. Clearing any earlier flashes a blank frame.
      //
      //   (b) the open transition has finished. Clearing the placeholder while
      //       the morph is still running swaps the element's paint out mid-
      //       transition and flashes on mobile Safari, so we defer to
      //       `subscribeOpenComplete` (fires on open finish, and on close so an
      //       interrupted open still releases the gate).
      const tryRestore = () => {
        if (cleared || !imagePainted || !openSettled) return;
        cleared = true;
        restore();
      };

      const markPainted = () => {
        imagePainted = true;
        tryRestore();
      };
      const scheduleRestore = () => {
        if (cleared) return;
        rafA = requestAnimationFrame(() => {
          rafB = requestAnimationFrame(markPainted);
        });
      };
      const onLoad = () => {
        if (cleared) return;
        if (typeof img.decode === 'function') {
          img.decode().then(scheduleRestore, scheduleRestore);
        } else {
          scheduleRestore();
        }
      };
      img.addEventListener('load', onLoad);

      const unsubscribeOpenComplete = openSettled
        ? null
        : subscribeOpenComplete(() => {
            openSettled = true;
            tryRestore();
          });

      return () => {
        img.removeEventListener('load', onLoad);
        unsubscribeOpenComplete?.();
        if (rafA) cancelAnimationFrame(rafA);
        if (rafB) cancelAnimationFrame(rafB);
        if (!cleared) restore();
      };
      // `isVisible` is the only render input — trigger/destination nodes are
      // refs, read fresh each time the item enters the preload window.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isVisible]);

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
        ? children({ active: isActive, visible: isVisible, index, imageRef, morphRef })
        : children;
    }, [isVisible, isActive, index, children, imageRef, morphRef]);

    const state = React.useMemo<LightboxItemState>(() => ({ active: isActive, index }), [isActive, index]);

    // ARIA semantics (WAI-ARIA APG). Two valid shapes depending on whether a
    // thumbnail `tablist` is present to own the panels:
    //
    //  - Tabbed carousel (thumbnails present): each item is a `tabpanel`
    //    labelled by its controlling `tab` (`aria-labelledby`). The matching
    //    `tab` sets `aria-controls` back to this panel's id.
    //  - Standalone carousel (no thumbnails): a `tabpanel` with no owning `tab`
    //    is invalid ARIA, so the item becomes a carousel slide instead —
    //    `role="group"` + `aria-roledescription="slide"` with an `N of total`
    //    accessible name (group elements can't use aria-posinset/setsize, so the
    //    APG carousel pattern folds the position into the label).
    const total = itemCount;
    const panelId = `${baseId}-panel-${index}`;
    const tabId = `${baseId}-tab-${index}`;
    const semanticProps: Record<string, string> = hasTablist
      ? { role: 'tabpanel', 'aria-labelledby': tabId }
      : {
          role: 'group',
          'aria-roledescription': 'slide',
          'aria-label': total > 0 ? `${index + 1} of ${total}` : `${index + 1}`,
        };

    const itemContextValue = React.useMemo<LightboxItemContextValue>(
      () => ({ index, active: isActive, imageRef, morphRef, registerMedia, registerPlaceholder }),
      [index, isActive, imageRef, morphRef, registerMedia, registerPlaceholder],
    );

    // useRender is a hook — must always be called regardless of visibility
    const rendered = useRender({
      render,
      ref: mergedRefCallback,
      state,
      stateAttributesMapping: itemStateAttributesMapping,
      props: mergeProps<'div'>(
        {
          // `data-ramka-item` is the stable selector that internal hooks
          // (e.g. pull-to-dismiss) use to walk up from a pointer's target to
          // the owning item. It replaces what was a branded class name in
          // upstream so the primitives stay free of ship-as-is styles.
          [LightboxItemDataAttributes.item]: '',
          id: panelId,
          ...semanticProps,
          // Inactive slides/panels are kept out of the a11y tree (and out of
          // the tab order) so a screen reader never reads an off-screen slide,
          // and the active one is exposed. `inert` also blocks pointer/focus.
          'aria-hidden': !isActive,
          ...inertWhen(!isActive),
          style: {
            // Fill the Slide so Zoom’s 100% has a definite box.
            width: '100%',
            height: '100%',
            ...style,
          },
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
