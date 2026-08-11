/**
 * Hand-authored API chrome for the Lightbox docs page.
 * Props, data attributes, and CSS variables are generated from package
 * TypeScript — see `generated.ts` and `scripts/generate-lightbox-api.ts`.
 */

/** Path relative to packages/ramka/src/lightbox/. */
export type EnumExtract = {
  enumName: string;
  file: string;
};

export type ExtractSpec =
  | {
      kind: 'interface-props';
      /** Interface name in the package source (e.g. LightboxRootProps). */
      typeName: string;
      /** Path relative to packages/ramka/src/lightbox/. */
      file: string;
      /** Drop these own/inherited names (e.g. redeclared className). */
      exclude?: string[];
      /**
       * Also document these properties from the resolved type even if they
       * come from a heritage clause (e.g. Base UI `render`).
       */
      includeInherited?: string[];
    }
  | {
      kind: 'interface-members';
      typeName: string;
      file: string;
      exclude?: string[];
    }
  | {
      kind: 'hook-return';
      /** Source function name (may differ from the public export alias). */
      functionName: string;
      file: string;
      /** Row name in the props table. @default '(return)' */
      rowName?: string;
    }
  | { kind: 'none' };

export type ApiPartMeta = {
  id: string;
  name: string;
  description: string;
  extract: ExtractSpec;
  /** Base UI–style data-attribute enum with JSDoc (see lightbox-data-attributes.ts). */
  attributesFrom?: EnumExtract;
  /** Base UI–style CSS-variable enum with JSDoc + `@type` (see lightbox-css-vars.ts). */
  cssVariablesFrom?: EnumExtract;
};

export const lightboxApiMeta: ApiPartMeta[] = [
  {
    id: 'api-root',
    name: 'Root',
    description:
      'Groups all parts of the lightbox and owns open state, active index, view-transition morph, scroll locking, and the active-zoom bridge. Pass handle from Lightbox.createHandle() for imperative control and detached Triggers. Prefer onOpenChangeComplete for post-motion work; use scrollTriggerIntoView so close morphs land on-screen when the page scrolled while open.',
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxRootProps',
      file: 'lightbox-root.tsx',
    },
  },
  {
    id: 'api-trigger',
    name: 'Trigger',
    description:
      'Opens the lightbox at a given index and is the morph source (view transitions on by default). Carries the Base UI dialog-trigger disclosure semantics: aria-haspopup="dialog", aria-controls pointing at the dialog while open, and aria-expanded set only on the trigger that opened it. Pass handle + id to use outside Root or for handle.open(..., { triggerId }). Prefer render-prop children to attach imageRef / morphRef.',
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxTriggerProps',
      file: 'lightbox-trigger.tsx',
      includeInherited: ['render'],
    },
    attributesFrom: {
      enumName: 'LightboxTriggerDataAttributes',
      file: 'lightbox-data-attributes.ts',
    },
  },
  {
    id: 'api-portal',
    name: 'Portal',
    description:
      'Portals Backdrop and Content into a host element (default: document.body). Pass container / keepMounted here. keepMounted parks Backdrop+Content while closed (inert, hidden). When using keepMounted, style z-index on the Portal host yourself (Base UI). Prefer isolation: isolate on the app layout root.',
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxPortalProps',
      file: 'lightbox-portal.tsx',
      exclude: ['className', 'style', 'ref'],
    },
    attributesFrom: {
      enumName: 'LightboxPortalDataAttributes',
      file: 'lightbox-data-attributes.ts',
    },
  },
  {
    id: 'api-content',
    name: 'Content',
    description:
      'Dialog surface (role="dialog", aria-modal). Provide an accessible name via aria-label or aria-labelledby (required by the WAI-ARIA dialog pattern; the library warns in development if it is missing). Place inside Lightbox.Portal. Owns focus trap, Escape, and pull-to-dismiss. When Lightbox.Stage is mounted, gallery nav (arrows/Home/End), zoom shortcuts (⌘/+/-), pinch/ctrl+wheel zoom, and touch/wheel pull are scoped to Stage (and Zoom pan uses Stage as viewport); otherwise Content itself is the stage. Keyboard pan vs navigate depends on whether the active Zoom is above 1×.',
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxContentProps',
      file: 'lightbox-content.tsx',
      exclude: ['className', 'style', 'ref'],
    },
    attributesFrom: {
      enumName: 'LightboxContentDataAttributes',
      file: 'lightbox-data-attributes.ts',
    },
    cssVariablesFrom: {
      enumName: 'LightboxContentCssVars',
      file: 'lightbox-css-vars.ts',
    },
  },
  {
    id: 'api-stage',
    name: 'Stage',
    description:
      'Optional media interaction surface inside Content. Scopes touch and trackpad wheel pull-to-dismiss, Zoom pan viewport geometry, arrow/Home/End gallery navigation, zoom shortcuts (⌘/+/-), and pinch/ctrl+wheel zoom to the media pane. Interactive controls inside Stage keep their press (Close, Prev/Next, etc.). Place side panels / threads as siblings of Stage under Content. When omitted, Content itself is the stage.',
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxStageProps',
      file: 'lightbox-stage.tsx',
      includeInherited: ['render'],
    },
    attributesFrom: {
      enumName: 'LightboxStageDataAttributes',
      file: 'lightbox-data-attributes.ts',
    },
  },
  {
    id: 'api-backdrop',
    name: 'Backdrop',
    description:
      'Optional scrim (place inside Lightbox.Portal, typically beside Content). Click closes the lightbox. Tracks pull-to-dismiss progress.',
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxBackdropProps',
      file: 'lightbox-backdrop.tsx',
      includeInherited: ['render'],
    },
    attributesFrom: {
      enumName: 'LightboxBackdropDataAttributes',
      file: 'lightbox-data-attributes.ts',
    },
    cssVariablesFrom: {
      enumName: 'LightboxBackdropCssVars',
      file: 'lightbox-css-vars.ts',
    },
  },
  {
    id: 'api-close',
    name: 'Close',
    description: 'Button that closes the lightbox. Defaults to aria-label="Close".',
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxCloseProps',
      file: 'lightbox-close.tsx',
      includeInherited: ['render'],
    },
    attributesFrom: {
      enumName: 'LightboxCloseDataAttributes',
      file: 'lightbox-data-attributes.ts',
    },
  },
  {
    id: 'api-item',
    name: 'Item',
    description:
      'A single lightbox item. Registers captions and morph/placeholder refs. ARIA adapts automatically: it is a tabpanel wired (aria-labelledby / aria-controls) to its Lightbox.Thumbnail tab when a Lightbox.ThumbnailGroup is present, otherwise a carousel slide (role="group", aria-roledescription="slide", labelled "N of total"). Prefer nesting Lightbox.Media (sized morph + placeholder host) around the destination <img>/<video>; imageRef / morphRef remain escape hatches. Typically nested inside Slide (default) or ItemGroup (swap).',
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxItemProps',
      file: 'lightbox-item.tsx',
      includeInherited: ['render'],
    },
    attributesFrom: {
      enumName: 'LightboxItemDataAttributes',
      file: 'lightbox-data-attributes.ts',
    },
  },
  {
    id: 'api-media',
    name: 'Media',
    description:
      'Sized destination media host — morph target and placeholder canvas container. Structural props: width/height (fit-box, same idea as Next.js Image); display:grid plus a scoped <style> so direct img/video fill the box (HTML dimension attrs cannot pin intrinsic size). Cosmetics (radius, colors, object-fit) stay consumer-owned. Prefer Zoom > Media > img|video (Zoom is a size container for Media’s cqw/cqh fit-box; put resting chrome insets on Slide padding). Auto-discovers the primary <img> (or video poster) for decode / thumbnail bridging.',
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxMediaProps',
      file: 'lightbox-media.tsx',
      includeInherited: ['render'],
    },
    attributesFrom: {
      enumName: 'LightboxMediaDataAttributes',
      file: 'lightbox-data-attributes.ts',
    },
  },
  {
    id: 'api-slides',
    name: 'Slides',
    description:
      'Default layout: horizontal snap carousel wired to the active index. Exposes the WAI-ARIA carousel container (role="group", aria-roledescription="carousel") — give it a label via aria-label / aria-labelledby. Provides ItemGroup context; put Slide → Item → Zoom → Media inside. Consumer CSS sizes each Slide snap box (e.g. flex 0 0 100% for full-bleed); index geometry measures offsetLeft/offsetWidth. While the user is flinging, navigation is locked so pull-to-dismiss and zoom chrome do not fight the scroll.',
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxSlidesProps',
      file: 'lightbox-slides.tsx',
      includeInherited: ['render'],
      exclude: ['className'],
    },
    attributesFrom: {
      enumName: 'LightboxSlidesDataAttributes',
      file: 'lightbox-data-attributes.ts',
    },
  },
  {
    id: 'api-slide',
    name: 'Slide',
    description:
      'One snap-aligned slide box inside Slides. Snap alignment (`scroll-snap-align`, `scroll-snap-stop`) is built in; slide width (full-bleed, aspect-sized cards, …) is consumer CSS — set `flex` / `width` / `min-width` via className or style. Place a Lightbox.Item (and typically Zoom → Media) inside. Prefer putting resting chrome / safe-area insets as padding on Slide (not Zoom) so Item/Zoom fill the content box and zoomed media can paint into the pad under chrome.',
    extract: { kind: 'none' },
    attributesFrom: {
      enumName: 'LightboxSlideDataAttributes',
      file: 'lightbox-data-attributes.ts',
    },
  },
  {
    id: 'api-item-group',
    name: 'ItemGroup',
    description:
      'Stacked swap alternative to Slides: mounts only the active item plus preload neighbors. Exposes the WAI-ARIA carousel container (role="group", aria-roledescription="carousel") — give it a label via aria-label / aria-labelledby. Prefer Slides + Zoom for swipeable galleries.',
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxItemGroupProps',
      file: 'lightbox-item-group.tsx',
      includeInherited: ['render'],
      exclude: ['className'],
    },
    attributesFrom: {
      enumName: 'LightboxItemGroupDataAttributes',
      file: 'lightbox-data-attributes.ts',
    },
  },
  {
    id: 'api-previous',
    name: 'Previous',
    description: 'Navigate to the previous item. Disabled at the start when loop is false.',
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxPreviousProps',
      file: 'lightbox-previous.tsx',
      includeInherited: ['render'],
    },
    attributesFrom: {
      enumName: 'LightboxPreviousDataAttributes',
      file: 'lightbox-data-attributes.ts',
    },
  },
  {
    id: 'api-next',
    name: 'Next',
    description: 'Navigate to the next item. Disabled at the end when loop is false.',
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxNextProps',
      file: 'lightbox-next.tsx',
      includeInherited: ['render'],
    },
    attributesFrom: {
      enumName: 'LightboxNextDataAttributes',
      file: 'lightbox-data-attributes.ts',
    },
  },
  {
    id: 'api-counter',
    name: 'Counter',
    description: 'Shows the active position (e.g. "1 / 12") with an aria-live region.',
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxCounterProps',
      file: 'lightbox-counter.tsx',
      includeInherited: ['render'],
    },
    attributesFrom: {
      enumName: 'LightboxCounterDataAttributes',
      file: 'lightbox-data-attributes.ts',
    },
  },
  {
    id: 'api-caption',
    name: 'Caption',
    description: 'Renders the active item’s caption from the Item caption registry.',
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxCaptionProps',
      file: 'lightbox-caption.tsx',
      includeInherited: ['render'],
    },
    attributesFrom: {
      enumName: 'LightboxCaptionDataAttributes',
      file: 'lightbox-data-attributes.ts',
    },
  },
  {
    id: 'api-thumbnail-group',
    name: 'ThumbnailGroup',
    description: 'Accessible tablist of thumbnails with arrow / Home / End keyboard support.',
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxThumbnailGroupProps',
      file: 'lightbox-thumbnail-group.tsx',
      includeInherited: ['render'],
    },
    attributesFrom: {
      enumName: 'LightboxThumbnailGroupDataAttributes',
      file: 'lightbox-data-attributes.ts',
    },
  },
  {
    id: 'api-thumbnail',
    name: 'Thumbnail',
    description: 'A single thumbnail tab that activates the given index.',
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxThumbnailProps',
      file: 'lightbox-thumbnail.tsx',
      includeInherited: ['render'],
    },
    attributesFrom: {
      enumName: 'LightboxThumbnailDataAttributes',
      file: 'lightbox-data-attributes.ts',
    },
  },
  {
    id: 'api-thumbnail-strip',
    name: 'ThumbnailStrip',
    description:
      'Scroll-linked thumbnail strip root. Always centers the active thumbnail on the midline (Photos-style): owns overflow clip, measured midline track padding (from registered Thumbnail nodes — not role=tab queries), and Slides→track sync via native ScrollTimeline + WAAPI (JS scroll→transform fallback when ScrollTimeline is unavailable). Compose with ThumbnailStripTrack + Thumbnails; optional midline selection chrome is plain consumer markup (strip root is position:relative). Discrete nav (pointer thumb, keyboard, Previous/Next) goes through ThumbnailStrip (DocumentTimeline WAAPI track scrub via scrubOnSelect; element-scoped Slides view transition on pointer select via selectViewTransition — tune with --lightbox-select-vt-duration / --lightbox-select-vt-easing on Slides; optional wrapSelectCommit(commit, slides, index) to arm consumer WAAPI such as an indicator scrub before the scroll jump). Keyboard / Previous / Next keep an instant stage commit while the strip still scrubs. Flex/gap/thumb size remain consumer CSS.',
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxThumbnailStripProps',
      file: 'lightbox-thumbnail-strip.tsx',
      includeInherited: ['render'],
    },
    attributesFrom: {
      enumName: 'LightboxThumbnailStripDataAttributes',
      file: 'lightbox-data-attributes.ts',
    },
    cssVariablesFrom: {
      enumName: 'LightboxThumbnailStripCssVars',
      file: 'lightbox-css-vars.ts',
    },
  },
  {
    id: 'api-thumbnail-strip-track',
    name: 'ThumbnailStripTrack',
    description:
      'Linked tablist track for ThumbnailStrip. A ThumbnailGroup that registers as the ScrollTimeline transform target (same keyboard / ARIA). Parent ThumbnailStrip writes midline padding + travel CSS var and owns the link animation; flex, gap, and thumb sizing are consumer CSS.',
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxThumbnailStripTrackProps',
      file: 'lightbox-thumbnail-strip-track.tsx',
      includeInherited: ['render'],
    },
  },
  {
    id: 'api-zoom',
    name: 'Zoom',
    description:
      'Pinch, wheel, double-tap, and keyboard zoom/pan surface. Fills its host and is a CSS size container (`container-type: size`) for nested Media fit-box units. Does not set overflow (clipping belongs on Content / chrome so zoomed media can escape the resting box). Prefer Zoom > Media > img|video so pan/maxZoom use Media’s content box. Publishes to Root’s active-zoom bridge so ZoomIn/ZoomOut in toolbar chrome can target the active slide.',
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxZoomProps',
      file: 'lightbox-zoom.tsx',
      includeInherited: ['render'],
    },
    attributesFrom: {
      enumName: 'LightboxZoomDataAttributes',
      file: 'lightbox-data-attributes.ts',
    },
  },
  {
    id: 'api-zoom-in',
    name: 'ZoomIn',
    description: 'Increments zoom. Works inside Zoom, or as global chrome via the active-slide zoom bridge.',
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxZoomInProps',
      file: 'lightbox-zoom-in.tsx',
      includeInherited: ['render'],
    },
    attributesFrom: {
      enumName: 'LightboxZoomInDataAttributes',
      file: 'lightbox-data-attributes.ts',
    },
  },
  {
    id: 'api-zoom-out',
    name: 'ZoomOut',
    description: 'Decrements zoom. Works inside Zoom, or as global chrome via the active-slide zoom bridge.',
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxZoomOutProps',
      file: 'lightbox-zoom-out.tsx',
      includeInherited: ['render'],
    },
    attributesFrom: {
      enumName: 'LightboxZoomOutDataAttributes',
      file: 'lightbox-data-attributes.ts',
    },
  },
];

export const documentViewTransitionMeta: ApiPartMeta = {
  id: 'api-view-transition-document',
  name: 'Document (view transitions)',
  description:
    'While a view-transition morph runs, ramka sets attributes and CSS variables on <html> so you can style ::view-transition-* pseudo-elements. Cleared when the transition finishes.',
  extract: { kind: 'none' },
  attributesFrom: {
    enumName: 'LightboxDocumentDataAttributes',
    file: 'lightbox-data-attributes.ts',
  },
  cssVariablesFrom: {
    enumName: 'LightboxDocumentCssVars',
    file: 'lightbox-css-vars.ts',
  },
};

export const hooksApiMeta: ApiPartMeta[] = [
  {
    id: 'api-use-trigger-context',
    name: 'useLightboxTriggerContext',
    description:
      'Optional context from the enclosing Trigger. Use in nested wrappers (e.g. a shared <TriggerImage>) to attach imageRef / morphRef without threading the render prop.',
    extract: {
      kind: 'hook-return',
      functionName: 'useOptionalLightboxTriggerContext',
      file: 'lightbox-trigger.tsx',
    },
  },
  {
    id: 'api-use-item-context',
    name: 'useLightboxItemContext',
    description:
      'Optional context from the enclosing Item. Use in nested wrappers to attach imageRef / morphRef or read active/index. Prefer Lightbox.Media for the common morph/placeholder host.',
    extract: {
      kind: 'hook-return',
      functionName: 'useOptionalLightboxItemContext',
      file: 'lightbox-item.tsx',
    },
  },
  {
    id: 'api-use-media-context',
    name: 'useLightboxMediaContext',
    description: 'Optional context from the enclosing Media. Exposes the Media host element for advanced wrappers.',
    extract: {
      kind: 'hook-return',
      functionName: 'useOptionalLightboxMediaContext',
      file: 'lightbox-media.tsx',
    },
  },
];

export const imperativeApiMeta: ApiPartMeta[] = [
  {
    id: 'api-create-handle',
    name: 'LightboxHandle',
    description: 'Imperative handle from Lightbox.createHandle(). Pass to Root (and optional detached Triggers).',
    extract: {
      kind: 'interface-members',
      typeName: 'LightboxHandle',
      file: 'lightbox-handle.ts',
    },
  },
  {
    id: 'api-zoom-ref',
    name: 'LightboxZoomRef',
    description: 'Imperative handle from ref on Zoom.',
    extract: {
      kind: 'interface-members',
      typeName: 'LightboxZoomRef',
      file: 'lightbox-zoom.tsx',
    },
  },
];
