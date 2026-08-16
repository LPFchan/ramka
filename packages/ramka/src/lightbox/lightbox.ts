/**
 * Lightbox — a headless, unstyled compound component for modal media viewing.
 *
 * Combines modal dialog semantics (overlay, scroll lock, Escape to close,
 * backdrop) with gallery navigation (prev/next, thumbnails, counter).
 *
 * Key design decisions:
 *
 * - **Preload-gated slides**: `Lightbox.Slides` keeps slide boxes mounted (so
 *   scroll extent is correct) but only mounts `Lightbox.Item` contents for the
 *   active index plus `preload` neighbors.
 *
 * - **Multiple triggers**: Each Trigger accepts an `index` prop, so a grid
 *   of thumbnails can each open the lightbox at the corresponding item.
 *
 * - **Structural ARIA, consumer-owned wording**: The consumer provides the
 *   dialog's accessible name (`aria-label`/`aria-labelledby` on Content — the
 *   library warns in development if it's missing), the carousel label, alt
 *   text, and captions in their language. The primitives own the structural
 *   ARIA per the WAI-ARIA APG:
 *     - Content → `role="dialog"` + `aria-modal`, focus trap, Escape.
 *     - Slides → carousel container (`role="group"` +
 *       `aria-roledescription="carousel"`).
 *     - Item → a `tabpanel` associated with its Thumbnail `tab` when a
 *       `Lightbox.ThumbnailGroup` (tablist) is present, otherwise a standalone
 *       carousel slide (`role="group"` + `aria-roledescription="slide"` with an
 *       `N of total` name). Never an orphaned `tabpanel`.
 *     - Counter/Caption → polite live regions.
 *
 * - **CSS-driven transitions**: State is exposed via data attributes
 *   (data-active, data-direction, data-disabled, data-open, etc.)
 *   so transitions are fully controlled by the consumer's CSS.
 *
 * - **Portal owns mounting**: `Lightbox.Portal` portals Backdrop + Content
 *   (Base UI Dialog style). Pass `container` / `keepMounted` on Portal only.
 *
 * - **Backdrop is a separate primitive**: Unlike many lightbox libs that
 *   bundle a styled scrim into the dialog, `Lightbox.Backdrop` is an
 *   opt-in unstyled element you place beside `Lightbox.Content` inside
 *   `Lightbox.Portal`. This keeps the primitives free of ship-as-is styles
 *   while still exposing the element the pull-to-dismiss gesture animates.
 *
 * Layers (SoC contract — put new code in its layer, not the nearest file):
 *
 *   Root (state + ref registries)
 *     ├─ Trigger
 *     └─ Portal
 *          ├─ Backdrop
 *          └─ Content          dialog: focus, Escape, accessible name
 *               ├─ Stage?      optional pull / pan / arrow scope
 *               │    └─ Slides → Slide → Item → Zoom → Media
 *               └─ chrome      Close, Prev/Next, Counter, Caption, thumbs
 *
 *   1. State — Root. Open, index, direction, itemCount, loop, handle,
 *      captions, preparing/mounted. Morph/trigger registries stay as refs
 *      here. Do not put paint, snap geometry, or keyboard policy on Root.
 *   2. Shell — Portal, Content, Backdrop, Stage, Close. Content is the
 *      dialog. Stage is the interaction surface when present; otherwise
 *      Content is the stage. Backdrop is a sibling, never baked into Content.
 *   3. Layout — Slides / Slide. Snap geometry + preload. Item reads index
 *      from Root and preload from Slides. No second layout host.
 *   4. Media — Item, Media, Zoom. Item = identity, ARIA, morph refs, and
 *      *when* to bridge the open morph. Media = sized host (fit-box +
 *      canvas container). Zoom = per-slide engine (lazy). Placeholder
 *      paint lives in lightbox-placeholder.ts; the effect stays on Item.
 *      Do not move paint into Media (Media is optional).
 *   5. Chrome — Previous/Next, Counter, Caption, ThumbnailGroup/Thumbnail,
 *      ThumbnailStrip. ThumbnailGroup is the ARIA tablist; ThumbnailStrip
 *      is scroll-linked Photos chrome. Two jobs, two parts.
 *   6. Engines — morph / zoom / pull lazy chunks, not primitives.
 *      Capability + VT name: vt-constants.ts. Target resolution:
 *      morph-target.ts. Helpers do not belong on lightbox-context.tsx.
 *
 * Sub-components:
 *   Root            — State provider (open, activeIndex, controlled/uncontrolled)
 *   Trigger         — Opens lightbox at a specific item index
 *   Portal          — Portals Backdrop + Content (container / keepMounted)
 *   Content         — Modal overlay (div-based) + keyboard navigation
 *   Backdrop        — Optional visible scrim, closes on click, animated by pull-to-dismiss
 *   Close           — Closes the lightbox
 *   Stage           — Optional media interaction surface (pull / pan / arrow scope)
 *   Slides/Slide    — Horizontal snap carousel; preload-gates Item contents
 *   Item            — Individual media item with lazy-load support. Its render
 *                     function exposes `imageRef` / `morphRef` (escape hatches;
 *                     prefer Media for the common case)
 *   Media           — Sized destination media host (morph + placeholder canvas).
 *                     Put fit-box sizing here; place <img>/<video> inside
 *   Previous/Next   — Navigation buttons (auto-disable at boundaries)
 *   Counter         — "1 / 12" display with aria-live
 *   Caption         — Per-item caption from Item's caption prop
 *   ThumbnailGroup  — Tablist container for thumbnails
 *   Thumbnail       — Tab button navigating to a specific item
 *   ThumbnailStrip       — Centered scroll-linked thumbnail strip (pad + ScrollTimeline)
 *   ThumbnailStripTrack  — Linked tablist track (ThumbnailGroup + transform target)
 *   Zoom            — Zoom/pan wrapper for item content (pinch, scroll, keyboard)
 *   ZoomIn          — Button to zoom in (consumes ZoomContext)
 *   ZoomOut         — Button to zoom out (consumes ZoomContext)
 */
export { createHandle } from './lightbox-handle';
export type { LightboxHandle, LightboxHandleOpenOptions } from './lightbox-handle';

export { LightboxRoot as Root } from './lightbox-root';
export { LightboxTrigger as Trigger } from './lightbox-trigger';
export { LightboxPortal as Portal } from './lightbox-portal';
export { LightboxContent as Content } from './lightbox-content';
export { LightboxBackdrop as Backdrop } from './lightbox-backdrop';
export { LightboxClose as Close } from './lightbox-close';
export { LightboxStage as Stage } from './lightbox-stage';
export { LightboxItem as Item } from './lightbox-item';
export { LightboxMedia as Media } from './lightbox-media';
export { LightboxSlides as Slides } from './lightbox-slides';
export { LightboxSlide as Slide } from './lightbox-slide';
export { LightboxPrevious as Previous } from './lightbox-previous';
export { LightboxNext as Next } from './lightbox-next';
export { LightboxCounter as Counter } from './lightbox-counter';
export { LightboxCaption as Caption } from './lightbox-caption';
export { LightboxThumbnailGroup as ThumbnailGroup } from './lightbox-thumbnail-group';
export { LightboxThumbnail as Thumbnail } from './lightbox-thumbnail';
export { LightboxThumbnailStrip as ThumbnailStrip } from './lightbox-thumbnail-strip';
export { LightboxThumbnailStripTrack as ThumbnailStripTrack } from './lightbox-thumbnail-strip-track';
export { LightboxZoom as Zoom } from './lightbox-zoom';
export { LightboxZoomIn as ZoomIn } from './lightbox-zoom-in';
export { LightboxZoomOut as ZoomOut } from './lightbox-zoom-out';

export type { LightboxRootProps, LightboxBeforeOpen, LightboxBeforeOpenContext } from './lightbox-root';
export type { LightboxViewTransitionPreset } from './vt-timing';
export type {
  LightboxTriggerProps,
  LightboxTriggerState,
  LightboxTriggerRenderState,
  LightboxCrossfade,
} from './lightbox-trigger';
export type { LightboxPortalProps } from './lightbox-portal';
export type { LightboxContentProps } from './lightbox-content';
export type { LightboxBackdropProps, LightboxBackdropState } from './lightbox-backdrop';
export type { LightboxCloseProps, LightboxCloseState } from './lightbox-close';
export type { LightboxStageProps, LightboxStageState } from './lightbox-stage';
export type { LightboxItemProps, LightboxItemState, LightboxItemRenderState } from './lightbox-item';
export type { LightboxMediaProps, LightboxMediaState, LightboxMediaContextValue } from './lightbox-media';
export type { LightboxSlidesProps, LightboxSlidesState } from './lightbox-slides';
export type { LightboxSlideProps } from './lightbox-slide';
export type { LightboxPreviousProps, LightboxPreviousState } from './lightbox-previous';
export type { LightboxNextProps, LightboxNextState } from './lightbox-next';
export type { LightboxCounterProps, LightboxCounterState } from './lightbox-counter';
export type { LightboxCaptionProps, LightboxCaptionState } from './lightbox-caption';
export type { LightboxThumbnailGroupProps, LightboxThumbnailGroupState } from './lightbox-thumbnail-group';
export type { LightboxThumbnailProps, LightboxThumbnailState } from './lightbox-thumbnail';
export type { LightboxThumbnailStripProps, LightboxThumbnailStripState } from './lightbox-thumbnail-strip';
export type { LightboxThumbnailStripTrackProps } from './lightbox-thumbnail-strip-track';
export type { NavigationSource } from './lightbox-context';
export type { LightboxZoomProps, LightboxZoomState, LightboxZoomRef } from './lightbox-zoom';
export type { LightboxZoomInProps, LightboxZoomInState } from './lightbox-zoom-in';
export type { LightboxZoomOutProps, LightboxZoomOutState } from './lightbox-zoom-out';

export {
  LightboxTriggerDataAttributes,
  LightboxPortalDataAttributes,
  LightboxContentDataAttributes,
  LightboxBackdropDataAttributes,
  LightboxCloseDataAttributes,
  LightboxStageDataAttributes,
  LightboxItemDataAttributes,
  LightboxMediaDataAttributes,
  LightboxSlidesDataAttributes,
  LightboxSlideDataAttributes,
  LightboxPreviousDataAttributes,
  LightboxNextDataAttributes,
  LightboxCounterDataAttributes,
  LightboxCaptionDataAttributes,
  LightboxThumbnailGroupDataAttributes,
  LightboxThumbnailDataAttributes,
  LightboxThumbnailStripDataAttributes,
  LightboxZoomDataAttributes,
  LightboxZoomInDataAttributes,
  LightboxZoomOutDataAttributes,
  LightboxDocumentDataAttributes,
  LIGHTBOX_PART_IDENTITY_ATTRIBUTES,
} from './lightbox-data-attributes';
export {
  LightboxContentCssVars,
  LightboxBackdropCssVars,
  LightboxDocumentCssVars,
  LightboxThumbnailStripCssVars,
} from './lightbox-css-vars';
