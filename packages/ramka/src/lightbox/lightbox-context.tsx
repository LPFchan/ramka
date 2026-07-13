'use client';

import * as React from 'react';

type NavigationSource = 'trigger' | 'keyboard' | 'thumbnail' | 'button' | 'scroll';

interface LightboxContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Whether the portal should be in the DOM (stays true during exit animations). */
  mounted: boolean;
  /**
   * True during the brief "pre-mount" phase of a View Transition open: the
   * portal is mounted (so its DOM/layout and image decode happen off the
   * transition's render-suppressed critical path) but must not paint yet, or
   * it would appear in the transition's *old* snapshot. `Lightbox.Content` and
   * `Lightbox.Backdrop` render `visibility: hidden` while this is true, and
   * focus/scroll-lock side effects hold off until the reveal.
   */
  preparing: boolean;
  activeIndex: number;
  setActiveIndex: (index: number, source: NavigationSource) => void;
  /**
   * Set by a scroller (e.g. `Lightbox.Slides`) while a *user* scroll/fling is in
   * flight — the single "a swipe is in progress" signal. A browser fling can't
   * be cancelled from JS, so rather than fight it, three consumers defer to the
   * swipe while this is `true`:
   *   - `setActiveIndex` drops discrete navigation (`keyboard`/`thumbnail`/
   *     `button`) so the marker can't diverge from the real scroll position.
   *   - pull-to-dismiss won't start (a swipe can't become a dismiss mid-scroll).
   *   - zoom/pan gestures won't start (a swipe can't be hijacked into a zoom).
   * Stays `false` when no scroller writes it (non-`Slides` lightboxes), so their
   * navigation and gestures are never gated.
   */
  navigationLockedRef: React.MutableRefObject<boolean>;
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

// A View Transition snapshots the whole document and crossfades it, which is
// comparatively heavy on constrained hardware. Below these thresholds we skip
// the morph and fall back to the plain (fade) path instead.
//
// `deviceMemory` reports 0.25–8 (GiB, capped); `< 4` targets ≤2 GiB devices.
// `hardwareConcurrency` `< 4` targets ≤3 logical cores. Both signals are
// advisory and coarse by design (privacy), so we only treat clearly low values
// as low-end and never downgrade a typical 4-core / 4 GiB+ machine.
const LOW_END_MEMORY_GIB = 4;
const LOW_END_CORE_COUNT = 4;

/**
 * Best-effort detection of a low-powered device via the Device Memory and
 * `hardwareConcurrency` hints. SSR-safe and defensive: when neither hint is
 * exposed (e.g. Safari/Firefox omit `deviceMemory`) it returns `false`, so the
 * richer View Transition path stays the default everywhere it's supported.
 */
function isLowEndDevice(): boolean {
  if (typeof navigator === 'undefined') return false;

  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof deviceMemory === 'number' && deviceMemory < LOW_END_MEMORY_GIB) {
    return true;
  }

  const cores = navigator.hardwareConcurrency;
  if (typeof cores === 'number' && cores < LOW_END_CORE_COUNT) {
    return true;
  }

  return false;
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
  isLowEndDevice,
  VIEW_TRANSITION_NAME,
  findItemMorphTarget,
  findTriggerMorphTarget,
};
export type { LightboxContextValue, NavigationSource };
