'use client';

/**
 * Root context bag — state + ref registries only.
 *
 * Layer map and what belongs where: `lightbox.ts` (SoC contract). Do not add
 * paint, snap geometry, morph-target resolution, or VT capability checks here.
 */

import * as React from 'react';

import type { LightboxStore } from './lightbox-store';
import type { SlidesGeometry } from './lightbox-slides-geometry';
import type { InitializedRef } from '../react-compat';
import type { LightboxViewTransitionPreset } from './vt-timing';
import type { TextDirection } from './lightbox-direction';

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

/** Open / index / ARIA / captions / shell element refs. */
interface LightboxStateSlice {
  open: boolean;
  setOpen: (open: boolean, options?: LightboxCloseOptions) => void;
  /** Whether the portal should be in the DOM (stays true during exit animations). */
  mounted: boolean;
  /**
   * True while the portal is mounted but must not paint:
   * - VT open pre-mount: DOM/layout/decode run before `startViewTransition`.
   * - VT close hold (Android Chrome only): stays mounted (hidden) until
   *   `finished` so unmounting the overlay cannot abort the morph. Safari
   *   unmounts in the callback instead — chrome fades with the root snapshot.
   *   Never give Content/Backdrop their own view-transition-name: WebKit
   *   CPU-rasterizes every named group, and those nodes are fullscreen.
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
  /**
   * Last navigation direction, updated in the same commit as `activeIndex`.
   * `Lightbox.Slides` exposes it as `data-direction` for consumer CSS.
   *
   * Navigation order, *not* reading direction — see `dir` for the latter.
   */
  direction: 'forward' | 'backward';
  /**
   * Resolved reading direction from the `dir` prop on `Lightbox.Root`.
   * Mirrors scroll geometry, thumbnail-strip travel, and arrow keys.
   */
  dir: TextDirection;
  /**
   * The `dir` prop exactly as given — `undefined` when omitted. `Lightbox.Portal`
   * writes it to the portal host so CSS direction follows the prop across the
   * portal boundary, and omits the attribute entirely when there is no prop, so
   * an inherited `direction` still reaches the lightbox.
   */
  dirAttribute?: TextDirection;
  setActiveIndex: (index: number, source: NavigationSource) => void;
  /**
   * Set by a scroller (e.g. `Lightbox.Slides`) while a *user* scroll/fling is in
   * flight — the single "a swipe is in progress" signal. A browser fling can't
   * be cancelled from JS, so rather than fight it, three consumers defer to the
   * swipe while this is `true`:
   *   - `setActiveIndex` drops discrete navigation (`keyboard`/`thumbnail`/
   *     `button`) so the marker can't diverge from the real scroll position.
   *   - pull-to-dismiss won't start (a swipe can't become a dismiss mid-scroll).
   *     Cleared on `scrollend`, not on a quiet gap — a trackpad swipe that
   *     turns vertical mid-gesture must not pull until the user has released.
   *     Exception: a trackpad pinch mid-swipe can cancel the scroll without
   *     `scrollend`; Slides then settles on a quiet gap after that pinch.
   *   - zoom/pan gestures won't start or continue (a swipe can't be hijacked
   *     into a pinch — including a second finger landing mid-scroll).
   * Stays `false` when no Slides scroller writes it, so navigation and
   * gestures are never gated.
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
  captionsRef: InitializedRef<Map<number, React.ReactNode>>;
  registerCaption: (index: number, caption: React.ReactNode) => () => void;
  /**
   * Subscribe to caption-registry changes. Lets `Lightbox.Caption` read the
   * ref-based registry reactively via `useSyncExternalStore` — so a caption
   * that registers or changes without `activeIndex` moving still updates —
   * without turning the registry into state (which would re-render on every
   * item mount).
   */
  subscribeCaptions: (onChange: () => void) => () => void;
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
}

/** View-transition flags + trigger/item morph registries. */
interface LightboxMorphSlice {
  viewTransition: boolean;
  /**
   * The Root's raw `viewTransition` prop — the timing preset name (or
   * boolean). The Portal resolves it so the preset's `--lightbox-vt-*` motion
   * vars are always available inside the portal subtree, not just while a
   * morph is running (skins read them for their non-VT open/close fades).
   */
  transitionPreset: boolean | LightboxViewTransitionPreset | undefined;
  morphTo: 'active' | 'origin' | 'closest';
  triggerElementsRef: InitializedRef<Map<number, HTMLElement>>;
  /**
   * Registry mapping each trigger element → the descendant it should morph
   * into, as designated by the trigger render-prop's `morphRef`. Keyed
   * by the trigger *element* (not its index) so it stays correct when several
   * triggers share an index. A trigger with no entry morphs itself.
   */
  triggerMorphElementsRef: InitializedRef<WeakMap<HTMLElement, HTMLElement>>;
  activeItemElementRef: React.MutableRefObject<HTMLElement | null>;
  /**
   * Registry mapping each item element → the descendant it should morph into.
   * Populated by the item render-prop's `morphRef` (explicit override)
   * or, failing that, its `imageRef` (the destination image is the natural
   * target). Keyed by the item element. An item with no entry falls back to a
   * `querySelector('img'/'video')` scan, then the container. See
   * findItemMorphTarget.
   */
  itemMorphElementsRef: InitializedRef<WeakMap<HTMLElement, HTMLElement>>;
  /**
   * Shared capture destination (Stage `morphRef`). When set, the View
   * Transition names this node instead of the active item. Decode /
   * placeholder stay on the item. `null` when nothing is attached.
   */
  destinationMorphElementRef: React.MutableRefObject<HTMLElement | null>;
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
  triggerImageElementsRef: InitializedRef<Map<number, HTMLImageElement>>;
  /**
   * Triggers that declared a stable `id` (for `handle.open` / Root `triggerId`
   * association). Keyed by id; used when the Trigger is under Root without
   * going through a detached handle registration.
   */
  triggerIdsRef: InitializedRef<
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
}

/** Slides viewport/geometry pub-sub + strip-aware `navigate`. */
interface LightboxSlidesBridgeSlice {
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
  /**
   * Written by `Lightbox.VirtualSlides` with its full collection `count`
   * (cleared to `null` on unmount). While set it OVERRIDES the item registry
   * for `itemCount`: a windowed track only ever mounts a handful of items, so
   * the registry — normally the live source of truth — would report the
   * window size and break Next/Previous boundaries, keyboard clamping, and
   * Counter totals for everything past the window.
   */
  setVirtualItemCount: (count: number | null) => void;
}

/**
 * One Provider on purpose — splitting into multiple React contexts would
 * change who re-renders. Slices are a file/type contract only.
 */
type LightboxContextValue = LightboxStateSlice & LightboxMorphSlice & LightboxSlidesBridgeSlice;

const LightboxContext = React.createContext<LightboxContextValue | undefined>(undefined);

function useLightboxContext(): LightboxContextValue {
  const context = React.useContext(LightboxContext);
  if (context === undefined) {
    throw new Error('Lightbox compound components must be used within a Lightbox.Root');
  }
  return context;
}

/**
 * Stable sibling of {@link LightboxContext} for the O(n) per-item parts
 * (`Lightbox.Item`, `Lightbox.Trigger`, `Lightbox.Thumbnail`).
 *
 * Its value identity NEVER changes for the lifetime of a Root — every field is
 * a ref, a `useCallback([])`-stable function (state setters go through a
 * ref-indirection wrapper in Root), the Root's `useId`, or the hot-state
 * store itself. That stability is the load-bearing property: it is what lets
 * a 1000-item gallery skip re-rendering its items and triggers when Root
 * commits `open`/`activeIndex` changes. The reactive values those parts DO
 * need come from `store` via `useLightboxStoreValue` selectors (see
 * lightbox-store.ts for the O(n) fan-out rationale and write-timing rules).
 *
 * When adding a field here, it must be provably identity-stable — anything
 * that can change belongs in the hot store (reactive) or the plain context
 * (singular consumers).
 */
interface LightboxStableContextValue {
  store: LightboxStore;
  baseId: string;
  /** Ref-indirected `setOpen` — stable identity, always-current behavior. */
  setOpen: (open: boolean, options?: LightboxCloseOptions) => void;
  /** Ref-indirected `setActiveIndex` — stable identity, always-current behavior. */
  setActiveIndex: (index: number, source: NavigationSource) => void;
  registerItem: (index: number) => () => void;
  registerCaption: (index: number, caption: React.ReactNode) => () => void;
  subscribeOpenComplete: (listener: () => void) => () => void;
  openTransitionPendingRef: React.MutableRefObject<boolean>;
  activeItemElementRef: React.MutableRefObject<HTMLElement | null>;
  itemMorphElementsRef: InitializedRef<WeakMap<HTMLElement, HTMLElement>>;
  triggerElementsRef: InitializedRef<Map<number, HTMLElement>>;
  triggerMorphElementsRef: InitializedRef<WeakMap<HTMLElement, HTMLElement>>;
  triggerImageElementsRef: InitializedRef<Map<number, HTMLImageElement>>;
  triggerIdsRef: LightboxMorphSlice['triggerIdsRef'];
  openingTriggerIndexRef: React.MutableRefObject<number>;
  openingTriggerElementRef: React.MutableRefObject<HTMLElement | null>;
  openingTriggerImageRef: React.MutableRefObject<HTMLImageElement | null>;
}

const LightboxStableContext = React.createContext<LightboxStableContextValue | undefined>(
  undefined,
);

function useLightboxStableContext(): LightboxStableContextValue {
  const context = React.useContext(LightboxStableContext);
  if (context === undefined) {
    throw new Error('Lightbox compound components must be used within a Lightbox.Root');
  }
  return context;
}

/** Optional read for parts that can live outside a Root (detached Trigger). */
function useLightboxStableContextOptional(): LightboxStableContextValue | undefined {
  return React.useContext(LightboxStableContext);
}

export {
  LightboxContext,
  useLightboxContext,
  LightboxStableContext,
  useLightboxStableContext,
  useLightboxStableContextOptional,
};
export type {
  LightboxContextValue,
  LightboxStableContextValue,
  LightboxStateSlice,
  LightboxMorphSlice,
  LightboxSlidesBridgeSlice,
  NavigationSource,
  LightboxCloseOptions,
};
