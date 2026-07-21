/**
 * Lightbox — a headless, unstyled compound component for modal media viewing.
 *
 * Combines modal dialog semantics (overlay, scroll lock, Escape to close,
 * backdrop) with gallery navigation (prev/next, thumbnails, counter).
 *
 * Key design decisions:
 *
 * - **Swap-based rendering**: In the stacked `Lightbox.ItemGroup` layout only
 *   the active item (plus `preload` adjacent items) is rendered in the DOM,
 *   keeping memory usage low for large image collections. (The swipeable
 *   `Lightbox.Slides` layout keeps slide boxes mounted but preload-gates their
 *   contents the same way.)
 *
 * - **Multiple triggers**: Each Trigger accepts an `index` prop, so a grid
 *   of thumbnails can each open the lightbox at the corresponding item.
 *
 * - **No ARIA assumptions**: The consumer provides aria-label, captions,
 *   and alt text in their language. The primitive handles structural ARIA
 *   (dialog role, live regions, tablist pattern for thumbnails).
 *
 * - **CSS-driven transitions**: State is exposed via data attributes
 *   (data-active, data-direction, data-disabled, data-open, etc.)
 *   so transitions are fully controlled by the consumer's CSS.
 *
 * - **Backdrop is a separate primitive**: Unlike many lightbox libs that
 *   bundle a styled scrim into the dialog, `Lightbox.Backdrop` is an
 *   opt-in unstyled element you place anywhere inside `Lightbox.Content`.
 *   This keeps the primitives free of ship-as-is styles while still
 *   exposing the element the pull-to-dismiss gesture animates.
 *
 * Sub-components:
 *   Root            — State provider (open, activeIndex, controlled/uncontrolled)
 *   Trigger         — Opens lightbox at a specific item index
 *   Content         — Modal overlay (div-based) + keyboard navigation
 *   Backdrop        — Optional visible scrim, closes on click, animated by pull-to-dismiss
 *   Close           — Closes the lightbox
 *   ItemGroup       — Container for items, manages swap rendering + preload
 *   Item            — Individual media item with lazy-load support. Its render
 *                     function exposes `imageRef` (mark the destination image,
 *                     enabling the flash-free trigger-thumbnail placeholder) and
 *                     `morphRef` (override what morphs)
 *   Previous/Next   — Navigation buttons (auto-disable at boundaries)
 *   Counter         — "1 / 12" display with aria-live
 *   Caption         — Per-item caption from Item's caption prop
 *   ThumbnailGroup  — Tablist container for thumbnails
 *   Thumbnail       — Tab button navigating to a specific item
 *   Zoom            — Zoom/pan wrapper for item content (pinch, scroll, keyboard)
 *   ZoomIn          — Button to zoom in (consumes ZoomContext)
 *   ZoomOut         — Button to zoom out (consumes ZoomContext)
 */
export { LightboxRoot as Root } from './lightbox-root';
export { LightboxTrigger as Trigger } from './lightbox-trigger';
export { LightboxContent as Content } from './lightbox-content';
export { LightboxBackdrop as Backdrop } from './lightbox-backdrop';
export { LightboxClose as Close } from './lightbox-close';
export { LightboxItemGroup as ItemGroup } from './lightbox-item-group';
export { LightboxItem as Item } from './lightbox-item';
export { LightboxSlides as Slides } from './lightbox-slides';
export { LightboxSlide as Slide } from './lightbox-slide';
export { LightboxPrevious as Previous } from './lightbox-previous';
export { LightboxNext as Next } from './lightbox-next';
export { LightboxCounter as Counter } from './lightbox-counter';
export { LightboxCaption as Caption } from './lightbox-caption';
export { LightboxThumbnailGroup as ThumbnailGroup } from './lightbox-thumbnail-group';
export { LightboxThumbnail as Thumbnail } from './lightbox-thumbnail';
export { LightboxZoom as Zoom } from './lightbox-zoom';
export { LightboxZoomIn as ZoomIn } from './lightbox-zoom-in';
export { LightboxZoomOut as ZoomOut } from './lightbox-zoom-out';

export type { LightboxRootProps, LightboxRootRef } from './lightbox-root';
export type {
  LightboxTriggerProps,
  LightboxTriggerState,
  LightboxTriggerRenderState,
  LightboxCrossfade,
} from './lightbox-trigger';
export type { LightboxContentProps } from './lightbox-content';
export type { LightboxBackdropProps, LightboxBackdropState } from './lightbox-backdrop';
export type { LightboxCloseProps, LightboxCloseState } from './lightbox-close';
export type { LightboxItemGroupProps, LightboxItemGroupState } from './lightbox-item-group';
export type {
  LightboxItemProps,
  LightboxItemState,
  LightboxItemRenderState,
} from './lightbox-item';
export type { LightboxSlidesProps, LightboxSlidesState } from './lightbox-slides';
export type { LightboxSlideProps } from './lightbox-slide';
export type { LightboxPreviousProps, LightboxPreviousState } from './lightbox-previous';
export type { LightboxNextProps, LightboxNextState } from './lightbox-next';
export type { LightboxCounterProps, LightboxCounterState } from './lightbox-counter';
export type { LightboxCaptionProps, LightboxCaptionState } from './lightbox-caption';
export type { LightboxThumbnailGroupProps, LightboxThumbnailGroupState } from './lightbox-thumbnail-group';
export type { LightboxThumbnailProps, LightboxThumbnailState } from './lightbox-thumbnail';
export type { NavigationSource } from './lightbox-context';
export type { LightboxZoomProps, LightboxZoomState, LightboxZoomRef } from './lightbox-zoom';
export type { LightboxZoomInProps, LightboxZoomInState } from './lightbox-zoom-in';
export type { LightboxZoomOutProps, LightboxZoomOutState } from './lightbox-zoom-out';
