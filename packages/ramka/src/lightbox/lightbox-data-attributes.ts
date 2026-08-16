/**
 * Documented `data-*` attributes published by Lightbox parts.
 * JSDoc here is the source of truth for the docs site API tables
 * (`pnpm docs:api`). Prefer these constants over string literals when
 * reading/writing attributes in library code.
 *
 * ## Naming
 * - **`data-ramka-*`**: part identity / stable DOM lookup hooks. Every
 *   DOM-rendering primitive MUST publish exactly one identity marker
 *   (listed in `LIGHTBOX_PART_IDENTITY_ATTRIBUTES`). Root is exempt — it
 *   renders no host element.
 * - **Plain `data-*`**: transient UI state (`data-open`, `data-active`, …).
 *
 * Open/close state attrs follow Base UI Dialog conventions:
 * - Trigger uses `data-popup-open` when the lightbox is open.
 * - Content/Backdrop use mutually exclusive `data-open` / `data-closed`.
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

export enum LightboxPortalDataAttributes {
  /** Always present on the portal host element. */
  portal = 'data-ramka-portal',
}

export enum LightboxContentDataAttributes {
  /** Always present on the dialog surface. */
  content = 'data-ramka-content',
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
  /** Always present on the backdrop element. */
  backdrop = 'data-ramka-backdrop',
  /** Present while the lightbox is open. */
  open = 'data-open',
  /** Present while the lightbox is closed (still rendered). */
  closed = 'data-closed',
  /** Present while pull-to-dismiss is active (mirrors Content). */
  pulling = 'data-pulling',
}

export enum LightboxCloseDataAttributes {
  /** Always present on the close button. */
  close = 'data-ramka-close',
}

export enum LightboxStageDataAttributes {
  /** Always present on the media interaction stage. */
  stage = 'data-ramka-stage',
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
  /** Always present on the slides scrollport. */
  slides = 'data-ramka-slides',
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
  /** Always present on the previous button. */
  previous = 'data-ramka-previous',
  /** Present when navigation is unavailable. */
  disabled = 'data-disabled',
}

export enum LightboxNextDataAttributes {
  /** Always present on the next button. */
  next = 'data-ramka-next',
  /** Present when navigation is unavailable. */
  disabled = 'data-disabled',
}

export enum LightboxCounterDataAttributes {
  /** Always present on the counter element. */
  counter = 'data-ramka-counter',
}

export enum LightboxCaptionDataAttributes {
  /** Always present on the caption element. */
  caption = 'data-ramka-caption',
  /** Present when the active item has a caption. */
  hasCaption = 'data-has-caption',
}

export enum LightboxThumbnailGroupDataAttributes {
  /** Always present on the thumbnail group (tablist). */
  thumbnailGroup = 'data-ramka-thumbnail-group',
  /** Present when focus is inside the group. */
  focusWithin = 'data-focus-within',
}

export enum LightboxThumbnailDataAttributes {
  /** Always present on the thumbnail button. */
  thumbnail = 'data-ramka-thumbnail',
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
  /** Present while a discrete-nav scrub animation is in flight. */
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
  /** Always present on the zoom container. */
  host = 'data-ramka-zoom',
  /** Present when zoom > 1. */
  zoom = 'data-zoom',
  /** Present while panning with a pointer. */
  dragging = 'data-dragging',
}

export enum LightboxZoomInDataAttributes {
  /** Always present on the zoom-in button. */
  zoomIn = 'data-ramka-zoom-in',
  /** Present when zoom-in is unavailable. */
  disabled = 'data-disabled',
}

export enum LightboxZoomOutDataAttributes {
  /** Always present on the zoom-out button. */
  zoomOut = 'data-ramka-zoom-out',
  /** Present when zoom-out is unavailable. */
  disabled = 'data-disabled',
}

export enum LightboxDocumentDataAttributes {
  /** Present during a morph. Value is `opening` or `closing`. */
  viewTransition = 'data-ramka-view-transition',
  /**
   * Present while the morph dissolves trigger↔item snapshots (Trigger
   * `crossfade` is active for this phase). Absent for the default hard-cut.
   */
  crossfade = 'data-ramka-crossfade',
  /**
   * Present during a morph. Value is the active `viewTransition` timing
   * preset name (`default`, `snappy`, `relaxed`, `spring`) — read by the
   * composited morph and available to skin CSS for per-preset styling.
   */
  viewTransitionPreset = 'data-ramka-vt-preset',
}

/**
 * Identity markers for every DOM-rendering Lightbox part.
 * Root is omitted (context provider only). Document-level attrs live on
 * `<html>` via `LightboxDocumentDataAttributes`, not here.
 *
 * When adding a new DOM primitive: add its `data-ramka-*` enum member, set it
 * on the host in the component, append it here, and extend
 * `lightbox-part-identity.test.tsx`.
 */
export const LIGHTBOX_PART_IDENTITY_ATTRIBUTES = [
  LightboxTriggerDataAttributes.trigger,
  LightboxPortalDataAttributes.portal,
  LightboxContentDataAttributes.content,
  LightboxBackdropDataAttributes.backdrop,
  LightboxCloseDataAttributes.close,
  LightboxStageDataAttributes.stage,
  LightboxItemDataAttributes.item,
  LightboxSlidesDataAttributes.slides,
  LightboxSlideDataAttributes.slide,
  LightboxPreviousDataAttributes.previous,
  LightboxNextDataAttributes.next,
  LightboxCounterDataAttributes.counter,
  LightboxCaptionDataAttributes.caption,
  LightboxThumbnailGroupDataAttributes.thumbnailGroup,
  LightboxThumbnailDataAttributes.thumbnail,
  LightboxThumbnailStripDataAttributes.root,
  LightboxThumbnailStripDataAttributes.track,
  LightboxMediaDataAttributes.media,
  LightboxZoomDataAttributes.host,
  LightboxZoomInDataAttributes.zoomIn,
  LightboxZoomOutDataAttributes.zoomOut,
] as const;
