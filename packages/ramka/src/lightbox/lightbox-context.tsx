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

/**
 * Finds the best element to use as the view transition morph target
 * within a container. Looks for an explicit [data-lightbox-morph] marker
 * first, then falls back to the first <img> or <video>, then the container.
 */
function findMorphTarget(container: HTMLElement): HTMLElement {
  return (
    container.querySelector<HTMLElement>('[data-lightbox-morph]') ??
    container.querySelector<HTMLElement>('img') ??
    container.querySelector<HTMLElement>('video') ??
    container
  );
}

export { LightboxContext, useLightboxContext, supportsViewTransitions, VIEW_TRANSITION_NAME, findMorphTarget };
export type { LightboxContextValue, NavigationSource };
