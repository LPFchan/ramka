'use client';

import * as React from 'react';

import type { SlidesGeometry } from './lightbox-slides-geometry';
import type { LightboxViewTransitionPreset } from './vt-timing';

type NavigationSource = 'trigger' | 'keyboard' | 'thumbnail' | 'button' | 'scroll' | 'imperative';

/** Options for a close (`setOpen(false, …)`) that tune return-focus behavior. */
interface LightboxCloseOptions {
  /**
   * Controls whether the trigger that regains focus on close shows a focus
   * ring (`:focus-visible`), via the `focusVisible` option of `HTMLElement.focus()`:
   *   - `true` — the close was keyboard-driven (e.g. Escape), so keyboard users
   *     should see where focus landed.
   *   - `false` — the close was pointer/touch-driven (backdrop tap, pull-to-
   *     dismiss), so no ring should appear even though focus moves
   *     programmatically. This defeats Chromium's heuristic of preserving the
   *     dialog's focus-visible state onto the return target.
   *   - omitted — leave it to the browser's own heuristic (used for
   *     programmatic/controlled closes with no interaction modality).
   * Mirrors Base UI's FloatingFocusManager return-focus handling.
   */
  focusVisible?: boolean;
}

interface LightboxContextValue {
  open: boolean;
  setOpen: (open: boolean, options?: LightboxCloseOptions) => void;
  /** Whether the portal should be in the DOM (stays true during exit animations). */
  mounted: boolean;
  /**
   * True while the portal is mounted but must not paint:
   * - VT open pre-mount: DOM/layout/decode run before `startViewTransition`.
   * - VT close hold: stays mounted (hidden) until `finished` so unmounting
   *   the overlay inside the update callback cannot abort the morph.
   *
   * Content / Backdrop use `visibility: hidden` while this is true.
   * Focus/scroll-lock side effects hold off until reveal on open.
   */
  preparing: boolean;
  /**
   * True from the start of an open transition until it finishes (the morph's
   * `finished` promise resolves, or the non-VT enter animation settles). Lets
   * `Lightbox.Item` hold its morph placeholder in place until the open is fully
   * done — clearing it mid-morph can flash on mobile Safari. Only meaningful for
   * items that mount *during* the open (the morphing slide); items navigated to
   * afterwards see `false` and clear their placeholder on image load as usual.
   */
  openTransitionPendingRef: React.MutableRefObject<boolean>;
  /**
   * Subscribe to open-transition completion. Fires once per open when the morph
   * finishes (and on close, so a placeholder gated on an interrupted open is
   * released). Returns an unsubscribe fn. Used by `Lightbox.Item` to defer
   * clearing its placeholder until the open morph is over.
   */
  subscribeOpenComplete: (listener: () => void) => () => void;
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
   *   - zoom/pan gestures won't start or continue (a swipe can't be hijacked
   *     into a pinch — including a second finger landing mid-scroll).
   * Stays `false` when no scroller writes it (non-`Slides` lightboxes), so their
   * navigation and gestures are never gated.
   */
  navigationLockedRef: React.MutableRefObject<boolean>;
  itemCount: number;
  registerItem: (index: number) => () => void;
  loop: boolean;
  /**
   * Stable id prefix for the whole lightbox instance (from `React.useId()` in
   * Root). `Lightbox.Item` and `Lightbox.Thumbnail` derive matching element ids
   * from it (`${baseId}-panel-${index}` / `${baseId}-tab-${index}`) so the
   * tab↔tabpanel `aria-controls` / `aria-labelledby` association required by the
   * WAI-ARIA Tabs pattern is wired without threading ids through the consumer.
   */
  baseId: string;
  /**
   * Whether a `Lightbox.ThumbnailGroup` (a `tablist`) is currently mounted.
   * When true, `Lightbox.Item`s expose `role="tabpanel"` and associate with
   * their controlling thumbnail tab (the APG "tabbed carousel" variant). When
   * false, there are no tabs to own the panels, so items instead expose the
   * standalone carousel-slide semantics (`role="group"` +
   * `aria-roledescription="slide"` + an `N of total` label) — never an orphaned
   * `tabpanel`, which is invalid ARIA without an associated `tab`.
   */
  hasTablist: boolean;
  /**
   * Registers a mounted `Lightbox.ThumbnailGroup` so items can switch to
   * tabpanel semantics. Returns an unregister fn; `hasTablist` flips back to
   * false once the last tablist unmounts.
   */
  registerTablist: () => () => void;
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
  /**
   * The Root's raw `viewTransition` prop — the timing preset name (or
   * boolean). The Portal resolves it so the preset's `--lightbox-vt-*` motion
   * vars are always available inside the portal subtree, not just while a
   * morph is running (skins read them for their non-VT open/close fades).
   */
  transitionPreset: boolean | LightboxViewTransitionPreset | undefined;
  morphTo: 'active' | 'origin' | 'closest';
  triggerElementsRef: React.RefObject<Map<number, HTMLElement>>;
  /**
   * Registry mapping each trigger element → the descendant it should morph
   * into, as designated by the trigger render-prop's `morphRef`. Keyed
   * by the trigger *element* (not its index) so it stays correct when several
   * triggers share an index. A trigger with no entry morphs itself.
   */
  triggerMorphElementsRef: React.RefObject<WeakMap<HTMLElement, HTMLElement>>;
  activeItemElementRef: React.MutableRefObject<HTMLElement | null>;
  /**
   * Registry mapping each item element → the descendant it should morph into.
   * Populated by the item render-prop's `morphRef` (explicit override)
   * or, failing that, its `imageRef` (the destination image is the natural
   * target). Keyed by the item element. An item with no entry falls back to a
   * `querySelector('img'/'video')` scan, then the container. See
   * findItemMorphTarget.
   */
  itemMorphElementsRef: React.RefObject<WeakMap<HTMLElement, HTMLElement>>;
  openingTriggerIndexRef: React.MutableRefObject<number>;
  /**
   * The exact trigger element that opened the lightbox (click or
   * `handle.open(..., { triggerId })`). Cleared (null) on opens with no
   * originating element. Unlike `triggerElementsRef` (keyed by index,
   * last-registered wins), this disambiguates the origin when several
   * triggers share one index.
   */
  openingTriggerElementRef: React.MutableRefObject<HTMLElement | null>;
  /**
   * The `<img>` of the opening trigger, as designated via the trigger
   * render-prop's `imageRef`. Its live `currentSrc` is what `Lightbox.Item`
   * paints as the destination image's placeholder background. Cleared when
   * there is no originating trigger; falls back to `triggerImageElementsRef`
   * keyed by index.
   */
  openingTriggerImageRef: React.MutableRefObject<HTMLImageElement | null>;
  /**
   * Per-index map of the `<img>` each trigger designated via `imageRef`.
   * Last-registered wins (like `triggerElementsRef`); used as the placeholder
   * source when a specific item opens without a clicked element (controlled /
   * programmatic open) or for preloaded adjacent slides.
   */
  triggerImageElementsRef: React.RefObject<Map<number, HTMLImageElement>>;
  /**
   * Triggers that declared a stable `id` (for `handle.open` / Root `triggerId`
   * association). Keyed by id; used when the Trigger is under Root without
   * going through a detached handle registration.
   */
  triggerIdsRef: React.RefObject<
    Map<
      string,
      {
        id: string;
        index: number;
        element: HTMLElement | null;
        image: HTMLImageElement | null;
      }
    >
  >;
  dialogElementRef: React.MutableRefObject<HTMLElement | null>;

  /**
   * The currently-mounted `Lightbox.Stage` element (if any). When set, Stage
   * is the media interaction surface for wheel pull-to-dismiss, Zoom pan
   * viewport geometry, and arrow/Home/End gallery keyboard navigation.
   * Stays `null` when no Stage is rendered — Content itself is the stage.
   */
  stageElementRef: React.MutableRefObject<HTMLElement | null>;

  /**
   * The currently-mounted `Lightbox.Backdrop` element (if any). Populated
   * by the Backdrop primitive's ref callback so descendants like the
   * pull-to-dismiss hook can read its opacity / data attributes without
   * needing a direct ref. Stays `null` when no Backdrop is rendered.
   */
  backdropElementRef: React.MutableRefObject<HTMLElement | null>;

  /**
   * The currently-mounted `Lightbox.Slides` viewport element (if any).
   * Populated by Slides' ref callback so scroll-linked chrome
   * (`Lightbox.ThumbnailStrip`) can mirror scroll without DOM sniffing.
   * Stays `null` when no Slides scroller is rendered.
   */
  slidesViewportRef: React.MutableRefObject<HTMLElement | null>;
  /**
   * Latest Slides offset geometry (`offsets` / `base` / `step` / `count`), owned
   * and updated by `Lightbox.Slides`. ThumbnailStrip reads this instead of re-querying
   * the slide DOM.
   */
  slidesGeometryRef: React.MutableRefObject<SlidesGeometry>;
  /**
   * Subscribe to Slides viewport attach/detach / geometry publish. Returns an
   * unsubscribe function. Used by ThumbnailStrip to (re)wire scroll mirroring
   * without polling.
   */
  subscribeSlidesViewport: (listener: () => void) => () => void;
  /** Notify `subscribeSlidesViewport` listeners (called by Slides). */
  notifySlidesViewport: () => void;
  /**
   * When a `Lightbox.ThumbnailStrip` is mounted, its discrete-nav entry point
   * (WAAPI track scrub + index commit, no stage view transition). Written by
   * the strip; read by `navigate`. `null` when no strip is mounted.
   */
  thumbnailStripSelectRef: React.MutableRefObject<
    ((index: number, source: NavigationSource) => void) | null
  >;
  /**
   * Discrete navigation entry point for keyboard / Previous / Next. Routes
   * through the mounted ThumbnailStrip (so the strip scrubs with the stage)
   * and falls back to a plain `setActiveIndex` when no strip is mounted.
   */
  navigate: (index: number, source: NavigationSource) => void;
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

/**
 * Resolves the morph target for the **destination item**.
 *
 * The consumer designates the exact element to morph into via the item
 * render-prop's `morphRef` (explicit) or `imageRef` (the destination
 * image), whichever is registered in `registry` keyed by the item element.
 * With no registered override, the item container itself is the target.
 *
 * Resolution is registry-only — symmetric with {@link findTriggerMorphTarget}.
 * We deliberately do NOT hunt for an inner `<img>`/`<video>`: an item is a
 * full-viewport container, so an un-designated morph lands on that container
 * (a clean crossfade fallback once `isMorphTargetSizeResolvable` rejects the
 * oversized box) rather than silently guessing which descendant is "the"
 * media. Explicit refs are the price of a pixel-perfect, native-feeling morph
 * — there's no ambiguity about which element the trigger animates into, even
 * for items with captions, overlays, or multiple images.
 */
function findItemMorphTarget(
  container: HTMLElement,
  registry?: WeakMap<HTMLElement, HTMLElement> | null,
): HTMLElement {
  return registry?.get(container) ?? container;
}

/**
 * Resolves the morph target for the **trigger**.
 *
 * The consumer designates a specific descendant via the trigger render-prop's
 * `morphRef`, which registers it in `registry` keyed by the trigger
 * element. When there's no registered override, the trigger element itself is
 * the target — its border-radius, clipping, and chrome live on that element, so
 * morphing it reproduces exactly what the user sees.
 *
 * Unlike the item, the trigger deliberately does NOT hunt for an inner `<img>`.
 * Resolution is registry-based rather than a DOM `[data-ramka-morph]` scan:
 * the lookup is O(1), order-independent, and correct even when several triggers
 * share an index (the registry is keyed by element, not index).
 */
function findTriggerMorphTarget(
  container: HTMLElement,
  registry?: WeakMap<HTMLElement, HTMLElement> | null,
): HTMLElement {
  return registry?.get(container) ?? container;
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
export type { LightboxContextValue, NavigationSource, LightboxCloseOptions };
