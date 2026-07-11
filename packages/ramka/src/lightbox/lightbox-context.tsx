'use client';

import * as React from 'react';

type NavigationSource = 'trigger' | 'keyboard' | 'thumbnail' | 'button';

interface LightboxContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Whether the portal should be in the DOM (stays true during exit animations). */
  mounted: boolean;
  activeIndex: number;
  setActiveIndex: (index: number, source: NavigationSource) => void;
  itemCount: number;
  registerItem: (index: number) => () => void;
  loop: boolean;
  captionsRef: React.RefObject<Map<number, React.ReactNode>>;
  registerCaption: (index: number, caption: React.ReactNode) => () => void;
  /**
   * Subscribe to caption-registry changes. Lets `Lightbox.Caption` read the
   * ref-based registry reactively via `useSyncExternalStore` — so a caption
   * that registers or changes without `activeIndex` moving still updates —
   * without turning the registry into state (which would re-render on every
   * item mount).
   */
  subscribeCaptions: (onChange: () => void) => () => void;

  // View transition support
  viewTransition: boolean;
  morphTo: 'active' | 'origin' | 'closest';
  triggerElementsRef: React.RefObject<Map<number, HTMLElement>>;
  activeItemElementRef: React.MutableRefObject<HTMLElement | null>;
  openingTriggerIndexRef: React.MutableRefObject<number>;
  dialogElementRef: React.MutableRefObject<HTMLElement | null>;

  /**
   * The currently-mounted `Lightbox.Backdrop` element (if any). Populated
   * by the Backdrop primitive's ref callback so descendants like the
   * pull-to-dismiss hook can read its opacity / data attributes without
   * needing a direct ref. Stays `null` when no Backdrop is rendered.
   */
  backdropElementRef: React.MutableRefObject<HTMLElement | null>;
}

const LightboxContext = React.createContext<LightboxContextValue | undefined>(undefined);

function useLightboxContext(): LightboxContextValue {
  const context = React.useContext(LightboxContext);
  if (context === undefined) {
    throw new Error('Lightbox compound components must be used within a Lightbox.Root');
  }
  return context;
}

const VIEW_TRANSITION_NAME = 'lightbox-morph';

function supportsViewTransitions(): boolean {
  return (
    typeof document !== 'undefined' &&
    'startViewTransition' in document &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

const MORPH_MARKER_SELECTOR = '[data-lightbox-morph]';

/**
 * Resolves the morph target for the **destination item**. An explicit
 * `[data-lightbox-morph]` marker always wins; otherwise it falls back to the
 * first `<img>`/`<video>`, then the container itself.
 *
 * The media fallback matters here: an item is a full-viewport container, so
 * morphing to its image lands the animation on the letterboxed image rather
 * than blowing the thumbnail up to fill the whole viewport.
 */
function findItemMorphTarget(container: HTMLElement): HTMLElement {
  return (
    container.querySelector<HTMLElement>(MORPH_MARKER_SELECTOR) ??
    container.querySelector<HTMLElement>('img') ??
    container.querySelector<HTMLElement>('video') ??
    container
  );
}

/**
 * Resolves the morph target for the **trigger**. An explicit
 * `[data-lightbox-morph]` marker wins; otherwise the trigger element itself is
 * used.
 *
 * Unlike the item, the trigger deliberately does NOT hunt for an inner
 * `<img>`: the border-radius, clipping, and chrome a consumer applies live on
 * the trigger element (e.g. a `rounded-xl overflow-hidden` button wrapping an
 * image), so morphing the element itself reproduces exactly what the user
 * sees. Mark a descendant with `data-lightbox-morph` to morph just that part.
 */
function findTriggerMorphTarget(container: HTMLElement): HTMLElement {
  return container.querySelector<HTMLElement>(MORPH_MARKER_SELECTOR) ?? container;
}

export {
  LightboxContext,
  useLightboxContext,
  supportsViewTransitions,
  VIEW_TRANSITION_NAME,
  findItemMorphTarget,
  findTriggerMorphTarget,
};
export type { LightboxContextValue, NavigationSource };
