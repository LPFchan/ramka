'use client';

import { mergeProps, useRender } from '@base-ui/react';
import * as React from 'react';

import { LightboxItemDataAttributes } from './lightbox-data-attributes';
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
}

const LightboxItemContext = React.createContext<LightboxItemContextValue | null>(null);

/**
 * Optional context from the enclosing Item. Returns
 * `{ index, active, imageRef, morphRef, registerMedia }`, or `null` outside an Item.
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
 * Resolve an `object-position` string into the fraction (0..1) of the free
 * space (`box - drawn`) to offset the drawn image on each axis. Mirrors CSS:
 * a single value sets the horizontal axis and centers the vertical; keywords
 * and percentages are honored, other lengths fall back to centered. Used to
 * place the canvas placeholder's letterbox rect the same way `object-position`
 * would place the live image.
 */
function resolveObjectPosition(
  objectPosition: string,
  freeX: number,
  freeY: number,
): { x: number; y: number } {
  const axisFraction = (token: string | undefined, axis: 'x' | 'y'): number => {
    if (!token) return 0.5;
    if (token === 'center') return 0.5;
    if (token === (axis === 'x' ? 'left' : 'top')) return 0;
    if (token === (axis === 'x' ? 'right' : 'bottom')) return 1;
    if (token.endsWith('%')) {
      const pct = Number.parseFloat(token);
      return Number.isFinite(pct) ? pct / 100 : 0.5;
    }
    return 0.5;
  };
  const parts = (objectPosition || '').trim().split(/\s+/);
  return {
    x: freeX * axisFraction(parts[0], 'x'),
    y: freeY * axisFraction(parts[1] ?? 'center', 'y'),
  };
}

interface CanvasPlaceholderArgs {
  img: HTMLImageElement;
  source: HTMLImageElement | null;
  fit: 'contain' | 'cover';
  borderRadius: string;
  objectPosition: string;
  /**
   * Non-replaced host that already owns the morph (`Lightbox.Media` or an
   * explicit Item `morphRef`). Required — we never insert into `img.parentElement`
   * or retarget the morph to a mystery wrapper (that stretched under Zoom).
   */
  host: HTMLElement;
}

/**
 * Paint the trigger thumbnail into a `<canvas>` placed behind the destination
 * `<img>` as the open-morph bridge, returning a restore fn — or `null` when a
 * canvas can't be used (no 2D context, no decoded source, unresolved box) so the
 * caller falls back to the CSS-background placeholder.
 *
 * A canvas is used instead of a `background-image`/`<img>` because it's a
 * pre-rasterized bitmap: `drawImage` of the already-decoded trigger thumbnail is
 * synchronous, so unlike an async image decode (which WebKit does per-draw-size
 * and often *after* it captures the view-transition "new" snapshot) the pixels
 * are guaranteed present in the snapshot and across the VT→live handoff — no
 * blank frame, no fallback to the opaque trigger snapshot, no late letterboxing.
 */
function tryPaintCanvasPlaceholder(args: CanvasPlaceholderArgs): (() => void) | null {
  const { img, source, fit, borderRadius, objectPosition, host } = args;
  if (!source) return null;

  // A decoded source is required to draw synchronously (the trigger is on-screen
  // and decoded, so this holds in practice; bail defensively otherwise).
  const natW = source.naturalWidth;
  const natH = source.naturalHeight;
  if (!(source.complete && natW > 0 && natH > 0)) return null;

  // Replaced elements can't host a sibling canvas — host must be Media / morphRef.
  if (host === img) return null;

  const boxW = img.clientWidth || host.clientWidth;
  const boxH = img.clientHeight || host.clientHeight;
  if (!(boxW > 0 && boxH > 0)) return null;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null;
  try {
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');
  } catch {
    return null;
  }
  if (!ctx) return null;

  const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 3);
  canvas.width = Math.max(1, Math.round(boxW * dpr));
  canvas.height = Math.max(1, Math.round(boxH * dpr));
  canvas.setAttribute('data-ramka-placeholder', '');
  const cstyle = canvas.style;
  cstyle.position = 'absolute';
  cstyle.top = '0';
  cstyle.left = '0';
  cstyle.width = '100%';
  cstyle.height = '100%';
  cstyle.zIndex = '-1'; // paint beneath the in-flow destination <img>
  cstyle.pointerEvents = 'none';

  // Letterbox rect from the trigger's intrinsic size (object-fit math).
  const scale =
    fit === 'cover' ? Math.max(boxW / natW, boxH / natH) : Math.min(boxW / natW, boxH / natH);
  const drawW = natW * scale;
  const drawH = natH * scale;
  const { x: posX, y: posY } = resolveObjectPosition(objectPosition, boxW - drawW, boxH - drawH);

  try {
    ctx.scale(dpr, dpr);
    // Cross-origin sources taint the canvas — fine here: we only paint it, never
    // read pixels back (no toDataURL/getImageData), so there's no SecurityError.
    ctx.drawImage(source, posX, posY, drawW, drawH);
  } catch {
    return null;
  }

  // Prepare the host: (1) a positioned + isolated stacking context so the
  // `z-index:-1` canvas paints ABOVE the host background but BELOW the in-flow
  // <img> (without `isolation`, a negative z-index could sink the canvas behind
  // the host's ancestors and vanish); (2) clip to the image's rounding so the
  // morph group's animated radius is clean and the handoff to the live rounded
  // <img> is seamless. All saved and restored when the bridge ends.
  const savedPosition = host.style.position;
  const savedOverflow = host.style.overflow;
  const savedRadius = host.style.borderRadius;
  const savedIsolation = host.style.isolation;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  host.style.isolation = 'isolate';
  host.style.overflow = 'hidden';
  host.style.borderRadius = borderRadius;

  host.insertBefore(canvas, host.firstChild);

  return () => {
    canvas.remove();
    host.style.position = savedPosition;
    host.style.overflow = savedOverflow;
    host.style.borderRadius = savedRadius;
    host.style.isolation = savedIsolation;
  };
}

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
    const { render, index, caption, children, style, ...elementProps } = props;

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
      openTransitionPendingRef,
      subscribeOpenComplete,
      baseId,
      hasTablist,
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
      // Prefer Media's border-radius (the morph host) when present.
      const hostForRadius = mediaNodeRef.current ?? morphNodeRef.current;
      const borderRadius = hostForRadius
        ? getComputedStyle(hostForRadius).borderRadius || cs.borderRadius
        : cs.borderRadius;

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
              borderRadius,
              objectPosition: cs.objectPosition,
              host: canvasHost,
            })
          : null;

      let restore: () => void;
      if (canvasRestore) {
        restore = canvasRestore;
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
    const total = groupContext.itemCount;
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
      () => ({ index, active: isActive, imageRef, morphRef, registerMedia }),
      [index, isActive, imageRef, morphRef, registerMedia],
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
          inert: !isActive ? true : undefined,
          style: {
            // Fill the Slide (or stacked host) so Zoom’s 100% has a definite box.
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
