/**
 * Documented `data-*` attributes published by Lightbox parts.
 * JSDoc here is the source of truth for the docs site API tables
 * (`pnpm docs:api`). Prefer these constants over string literals when
 * reading/writing attributes in library code.
 *
 * Open/close state attrs follow Base UI Dialog conventions:
 * - Trigger uses `data-popup-open` when the lightbox is open.
 * - Content/Backdrop use mutually exclusive `data-open` / `data-closed`.
 * Part identity markers use the `data-ramka-*` prefix.
 */

export enum LightboxTriggerDataAttributes {
  /** Always present on the trigger element. */
  trigger = 'data-ramka-trigger',
  /** Present when the corresponding lightbox is open. */
  open = 'data-popup-open',
  /** Present when this trigger’s index is the active item. */
  active = 'data-active',
  /**
   * Present on the resolved morph element while it is the open/close morph
   * source: the trigger root by default, or the node designated via
   * `morphRef` when attached. Style hide/opacity against this attribute
   * directly — do not assume it lives on the Trigger button.
   */
  morphTarget = 'data-morph-target',
  /** Reflects the crossfade prop: `open` | `close` | `both`. */
  crossfade = 'data-crossfade',
}

export enum LightboxContentDataAttributes {
  /** Present while the lightbox is open. */
  open = 'data-open',
  /** Present while the lightbox is closed (still rendered). */
  closed = 'data-closed',
  /** Present while a pull-to-dismiss drag is in progress. */
  pulling = 'data-pulling',
  /** Present while the dismiss animation runs after crossing the threshold. */
  pullDismissing = 'data-pull-dismissing',
  /** Present during an active pinch/zoom gesture (blocks pull-to-dismiss). */
  zooming = 'data-zooming',
  /** Present when content zoom is greater than 1× (held through zoom-out animation). */
  zoomed = 'data-zoomed',
}

export enum LightboxBackdropDataAttributes {
  /** Present while the lightbox is open. */
  open = 'data-open',
  /** Present while the lightbox is closed (still rendered). */
  closed = 'data-closed',
  /** Present while pull-to-dismiss is active (mirrors Content). */
  pulling = 'data-pulling',
}

export enum LightboxItemGroupDataAttributes {
  /** Current active index as a string. */
  activeIndex = 'data-active-index',
  /** `forward` or `backward` — last navigation direction. */
  direction = 'data-direction',
}

export enum LightboxItemDataAttributes {
  /** Always present on the item element. */
  item = 'data-ramka-item',
  /** Present when this item is the active index. */
  active = 'data-active',
  /** The item index as a string. */
  index = 'data-index',
  /**
   * Transient during view-transition open — suppress consumer entrance fades
   * on the destination item.
   */
  skipFade = 'data-skip-fade',
}

export enum LightboxSlidesDataAttributes {
  /** Current active index. */
  activeIndex = 'data-active-index',
  /** `forward` or `backward`. */
  direction = 'data-direction',
  /** Always `horizontal`. */
  orientation = 'data-orientation',
}

export enum LightboxSlideDataAttributes {
  /** Always present on the slide element. */
  slide = 'data-ramka-slide',
}

export enum LightboxPreviousDataAttributes {
  /** Present when navigation is unavailable. */
  disabled = 'data-disabled',
}

export enum LightboxNextDataAttributes {
  /** Present when navigation is unavailable. */
  disabled = 'data-disabled',
}

export enum LightboxCaptionDataAttributes {
  /** Present when the active item has a caption. */
  hasCaption = 'data-has-caption',
}

export enum LightboxThumbnailGroupDataAttributes {
  /** Present when focus is inside the group. */
  focusWithin = 'data-focus-within',
}

export enum LightboxThumbnailDataAttributes {
  /** Present when this thumbnail’s index is active. */
  active = 'data-active',
  /** The thumbnail index as a string. */
  index = 'data-index',
}

export enum LightboxThumbnailStripDataAttributes {
  /** Always present on the thumbnail strip root. */
  root = 'data-ramka-thumbnail-strip',
  /** Always present on the scroll-linked tablist track. */
  track = 'data-ramka-thumbnail-strip-track',
  /** Present while a pointer thumb-select scrub animation is in flight. */
  scrubbing = 'data-scrubbing',
}

export enum LightboxMediaDataAttributes {
  /** Always present on the media host. */
  media = 'data-ramka-media',
  /** Present while the open-morph placeholder canvas is bridging. */
  placeholder = 'data-placeholder',
  /** Present when a structural fit-box width is resolved (prop or img dims). */
  width = 'data-width',
  /** Present when a structural fit-box height is resolved (prop or img dims). */
  height = 'data-height',
}

export enum LightboxZoomDataAttributes {
  /** Present when zoom > 1. */
  zoom = 'data-zoom',
  /** Present while panning with a pointer. */
  dragging = 'data-dragging',
}

export enum LightboxZoomInDataAttributes {
  /** Present when zoom-in is unavailable. */
  disabled = 'data-disabled',
}

export enum LightboxZoomOutDataAttributes {
  /** Present when zoom-out is unavailable. */
  disabled = 'data-disabled',
}

export enum LightboxDocumentDataAttributes {
  /** Present during a morph. Value is `opening` or `closing`. */
  viewTransition = 'data-ramka-view-transition',
  /** Present for hard-cut morphs (no trigger↔item snapshot crossfade). */
  noCrossfade = 'data-ramka-no-crossfade',
}
