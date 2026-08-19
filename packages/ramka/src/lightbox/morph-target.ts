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
export function findItemMorphTarget(
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
export function findTriggerMorphTarget(
  container: HTMLElement,
  registry?: WeakMap<HTMLElement, HTMLElement> | null,
): HTMLElement {
  return registry?.get(container) ?? container;
}

/**
 * Resolves the View Transition **capture** destination.
 *
 * A shared destination (Stage `morphRef`) wins — the snapshot is that
 * surface, not the active item. Otherwise falls back to the per-item chain
 * ({@link findItemMorphTarget}). Decode / placeholder still use the item
 * target; only the named VT group uses this.
 */
export function findDestinationMorphTarget(
  itemEl: HTMLElement | null | undefined,
  itemRegistry?: WeakMap<HTMLElement, HTMLElement> | null,
  sharedDestination?: HTMLElement | null,
): HTMLElement | null {
  if (sharedDestination) return sharedDestination;
  if (!itemEl) return null;
  return findItemMorphTarget(itemEl, itemRegistry);
}
