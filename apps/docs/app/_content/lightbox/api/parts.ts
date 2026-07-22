import type { ApiPart } from './types';

export const lightboxApiParts: ApiPart[] = [
  {
    id: 'api-root',
    name: 'Root',
    description:
      'Groups all parts of the lightbox and owns open state, active index, view-transition morph, scroll locking, and the active-zoom bridge.',
    props: [
      {
        name: 'defaultOpen',
        type: 'boolean',
        default: 'false',
        description: 'Uncontrolled initial open state.',
      },
      {
        name: 'open',
        type: 'boolean',
        description: 'Controlled open state. When set, open/close must be driven via onOpenChange.',
      },
      {
        name: 'onOpenChange',
        type: '(open: boolean) => void',
        description: 'Called when open state changes (immediately, before enter/exit animations finish).',
      },
      {
        name: 'onOpenChangeComplete',
        type: '(open: boolean) => void',
        description:
          'Called when the open/close transition settles. Receives true after open completes, false after close completes.',
      },
      {
        name: 'defaultValue',
        type: 'number',
        default: '0',
        description: 'Uncontrolled initial active item index.',
      },
      {
        name: 'value',
        type: 'number',
        description: 'Controlled active item index.',
      },
      {
        name: 'onValueChange',
        type: '(value: number, metadata: { source: NavigationSource }) => void',
        description:
          'Called when the active index changes. metadata.source is one of trigger | keyboard | thumbnail | button | scroll.',
      },
      {
        name: 'loop',
        type: 'boolean',
        default: 'false',
        description: 'Wrap navigation at the first/last item.',
      },
      {
        name: 'viewTransition',
        type: 'boolean',
        default: 'false',
        description:
          'Enable View Transition morph between trigger and item. Falls back to a fade when unsupported, prefers-reduced-motion is set, or the device is treated as low-end.',
      },
      {
        name: 'morphTo',
        type: "'active' | 'origin' | 'closest'",
        default: "'active'",
        description:
          "Which trigger receives the close morph: the active index ('active'), the opening trigger ('origin'), or the nearest registered trigger ('closest').",
      },
      {
        name: 'awaitImageDecode',
        type: 'boolean | number',
        default: 'true',
        description:
          'How long open waits for the destination image to decode before starting the morph. true ≈ 200ms cap; false/0 skips waiting; a number is a custom ms timeout.',
      },
      {
        name: 'scrollTriggerIntoView',
        type: 'null | ScrollTriggerOption | ScrollTriggerOption[]',
        default: 'null',
        description:
          'Scroll the active trigger into view so close morphs land on-screen. Option.type is onChange | onOpenComplete | onClose; behavior is smooth | instant.',
      },
      {
        name: 'children',
        type: 'React.ReactNode',
        description: 'Lightbox parts and page content (triggers typically live as children of Root).',
      },
    ],
  },
  {
    id: 'api-trigger',
    name: 'Trigger',
    description:
      'Opens the lightbox at a given index. With viewTransition, acts as the morph source. Prefer render-prop children to attach imageRef / morphRef.',
    props: [
      {
        name: 'index',
        type: 'number',
        required: true,
        description: 'Item index this trigger opens (and navigates to).',
      },
      {
        name: 'crossfade',
        type: "'open' | 'close' | 'both'",
        description:
          'Crossfade trigger↔item snapshots during the morph. Omit for a hard-cut (same picture). Use when trigger and item differ visually.',
      },
      {
        name: 'children',
        type: 'React.ReactNode | ((state: LightboxTriggerRenderState) => React.ReactNode)',
        description:
          'Content, or a render function receiving imageRef, morphRef, open, and active. Attach imageRef to the trigger <img> for flash-free open placeholders.',
      },
      {
        name: 'render',
        type: 'React.ElementType | ReactElement',
        description: 'Base UI render prop to replace the default <button>.',
      },
    ],
    attributes: [
      {
        name: 'data-lightbox-trigger',
        description: 'Always present on the trigger element.',
      },
      {
        name: 'data-open',
        description: 'Present while the lightbox is open.',
      },
      {
        name: 'data-active',
        description: 'Present when this trigger’s index is the active item.',
      },
      {
        name: 'data-morph-target',
        description: 'Present when this trigger (or its morphRef) is the current morph source/target.',
      },
      {
        name: 'data-crossfade',
        description: 'Reflects the crossfade prop: open | close | both.',
      },
    ],
  },
  {
    id: 'api-content',
    name: 'Content',
    description:
      'Portaled dialog surface (role="dialog", aria-modal). Owns focus trap, keyboard navigation, and pull-to-dismiss.',
    props: [
      {
        name: 'container',
        type: 'Element | DocumentFragment | null',
        default: 'document.body',
        description: 'Portal container for the dialog.',
      },
      {
        name: 'pullToClose',
        type: 'boolean',
        default: 'true',
        description: 'Enable the vertical pull-to-dismiss gesture on touch devices.',
      },
      {
        name: 'children',
        type: 'React.ReactNode',
        description: 'Dialog contents (close, slides/items, chrome).',
      },
    ],
    attributes: [
      {
        name: 'data-open',
        description: 'Present while the lightbox is open.',
      },
      {
        name: 'data-pulling',
        description: 'Present while a pull-to-dismiss drag is in progress.',
      },
      {
        name: 'data-pull-dismissing',
        description: 'Present while the dismiss animation runs after crossing the threshold.',
      },
      {
        name: 'data-zooming',
        description: 'Present during an active pinch/zoom gesture (blocks pull-to-dismiss).',
      },
      {
        name: 'data-zoomed',
        description: 'Present when content zoom is greater than 1× (held through zoom-out animation).',
      },
    ],
    cssVariables: [
      {
        name: '--lightbox-pull-progress',
        type: 'number',
        description: '0 at rest → 1 at the dismiss threshold. Drive backdrop/content opacity from this.',
      },
    ],
  },
  {
    id: 'api-backdrop',
    name: 'Backdrop',
    description: 'Optional portaled scrim. Click closes the lightbox. Tracks pull-to-dismiss progress.',
    props: [
      {
        name: 'container',
        type: 'Element | DocumentFragment | null',
        default: 'document.body',
        description: 'Portal container. Pass null to render in place (no portal).',
      },
    ],
    attributes: [
      { name: 'data-open', description: 'Present while the lightbox is open.' },
      {
        name: 'data-pulling',
        description: 'Present while pull-to-dismiss is active (mirrors Content).',
      },
    ],
    cssVariables: [
      {
        name: '--lightbox-pull-progress',
        type: 'number',
        description: 'Same progress variable as Content during pull-to-dismiss.',
      },
    ],
  },
  {
    id: 'api-close',
    name: 'Close',
    description: 'Button that closes the lightbox. Defaults to aria-label="Close".',
    props: [
      {
        name: 'render',
        type: 'React.ElementType | ReactElement',
        description: 'Base UI render prop to replace the default <button>.',
      },
    ],
  },
  {
    id: 'api-item-group',
    name: 'ItemGroup',
    description:
      'Swap layout: mounts only the active item plus preload neighbors. Use for stacked (non-carousel) viewers.',
    props: [
      {
        name: 'preload',
        type: 'number',
        default: '1',
        description: 'How many adjacent items to keep mounted on each side of the active index. 0 = active only.',
      },
    ],
    attributes: [
      {
        name: 'data-active-index',
        description: 'Current active index as a string.',
      },
      {
        name: 'data-direction',
        description: 'forward or backward — last navigation direction.',
      },
    ],
  },
  {
    id: 'api-item',
    name: 'Item',
    description:
      'A single lightbox item. Registers captions and morph/placeholder refs. Prefer render-prop children with imageRef on the destination <img>.',
    props: [
      {
        name: 'index',
        type: 'number',
        required: true,
        description: 'Index of this item in the collection.',
      },
      {
        name: 'caption',
        type: 'React.ReactNode',
        description: 'Optional caption consumed by Lightbox.Caption when this item is active.',
      },
      {
        name: 'children',
        type: 'React.ReactNode | ((state: LightboxItemRenderState) => React.ReactNode)',
        description:
          'Content, or a render function with active, visible, index, imageRef, morphRef. Attach imageRef to the destination image.',
      },
    ],
    attributes: [
      { name: 'data-lightbox-item', description: 'Always present on the item element.' },
      { name: 'data-active', description: 'Present when this item is the active index.' },
      { name: 'data-index', description: 'The item index as a string.' },
      {
        name: 'data-skip-fade',
        description: 'Transient during view-transition open — suppress consumer entrance fades on the destination item.',
      },
    ],
  },
  {
    id: 'api-slides',
    name: 'Slides',
    description:
      'Horizontal snap carousel wired to the active index. Provides ItemGroup context; put Slide → Item inside.',
    props: [
      {
        name: 'preload',
        type: 'number',
        default: '1',
        description: 'Adjacent items to keep mounted on each side (same meaning as ItemGroup.preload).',
      },
    ],
    attributes: [
      { name: 'data-active-index', description: 'Current active index.' },
      { name: 'data-direction', description: 'forward or backward.' },
      { name: 'data-orientation', description: 'Always horizontal.' },
    ],
  },
  {
    id: 'api-slide',
    name: 'Slide',
    description: 'One snap-aligned slide box inside Slides. Place a Lightbox.Item (and optional Zoom) inside.',
    attributes: [{ name: 'data-lightbox-slide', description: 'Always present on the slide element.' }],
  },
  {
    id: 'api-previous',
    name: 'Previous',
    description: 'Navigate to the previous item. Disabled at the start when loop is false.',
    attributes: [{ name: 'data-disabled', description: 'Present when navigation is unavailable.' }],
  },
  {
    id: 'api-next',
    name: 'Next',
    description: 'Navigate to the next item. Disabled at the end when loop is false.',
    attributes: [{ name: 'data-disabled', description: 'Present when navigation is unavailable.' }],
  },
  {
    id: 'api-counter',
    name: 'Counter',
    description: 'Shows the active position (e.g. "1 / 12") with an aria-live region.',
    props: [
      {
        name: 'children',
        type: '(state: { current: number; total: number }) => React.ReactNode',
        description: 'Optional render function. Default formats as "current / total".',
      },
    ],
  },
  {
    id: 'api-caption',
    name: 'Caption',
    description: 'Renders the active item’s caption from the Item caption registry.',
    attributes: [
      {
        name: 'data-has-caption',
        description: 'Present when the active item has a caption.',
      },
    ],
  },
  {
    id: 'api-thumbnail-group',
    name: 'ThumbnailGroup',
    description: 'Accessible tablist of thumbnails with arrow / Home / End keyboard support.',
    attributes: [
      {
        name: 'data-focus-within',
        description: 'Present when focus is inside the group.',
      },
    ],
  },
  {
    id: 'api-thumbnail',
    name: 'Thumbnail',
    description: 'A single thumbnail tab that activates the given index.',
    props: [
      {
        name: 'index',
        type: 'number',
        required: true,
        description: 'Item index this thumbnail selects.',
      },
    ],
    attributes: [
      { name: 'data-active', description: 'Present when this thumbnail’s index is active.' },
      { name: 'data-index', description: 'The thumbnail index as a string.' },
    ],
  },
  {
    id: 'api-zoom',
    name: 'Zoom',
    description:
      'Pinch, wheel, double-tap, and keyboard zoom/pan surface. Wrap the media inside an Item (typically inside a Slide).',
    props: [
      {
        name: 'children',
        type: 'React.ReactNode | ((state: LightboxZoomState) => React.ReactNode)',
        required: true,
        description: 'Zoomable content, or a render function exposing zoom state.',
      },
      {
        name: 'minZoom',
        type: 'number',
        default: '1',
        description: 'Minimum zoom level.',
      },
      {
        name: 'maxZoom',
        type: 'number',
        description:
          'Maximum zoom. When omitted, derived from the first <img> natural size vs container (fallback 4).',
      },
      {
        name: 'zoomStep',
        type: 'number',
        default: '2',
        description: 'Multiplier for button / keyboard zoom steps.',
      },
      {
        name: 'scrollToZoom',
        type: 'boolean',
        default: 'false',
        description: 'Zoom with bare wheel/trackpad (without Ctrl/⌘).',
      },
      {
        name: 'wheelSensitivity',
        type: 'number',
        default: '100',
        description: 'Wheel/trackpad zoom sensitivity factor.',
      },
      {
        name: 'keyboardPanDistance',
        type: 'number',
        default: '50',
        description: 'Pan distance in CSS pixels per arrow-key press when zoomed.',
      },
      {
        name: 'doubleClickDelay',
        type: 'number',
        default: '300',
        description: 'Max delay in ms between clicks to count as a double-click / double-tap.',
      },
      {
        name: 'animationDuration',
        type: 'number',
        default: '300',
        description: 'Smooth zoom animation duration in ms.',
      },
      {
        name: 'onZoomChange',
        type: '(zoom: number) => void',
        description: 'Called when the zoom level changes.',
      },
    ],
    attributes: [
      { name: 'data-zoom', description: 'Present when zoom > 1.' },
      { name: 'data-dragging', description: 'Present while panning with a pointer.' },
    ],
  },
  {
    id: 'api-zoom-in',
    name: 'ZoomIn',
    description:
      'Increments zoom. Works inside Zoom, or as global chrome via the active-slide zoom bridge.',
    attributes: [{ name: 'data-disabled', description: 'Present when zoom-in is unavailable.' }],
  },
  {
    id: 'api-zoom-out',
    name: 'ZoomOut',
    description:
      'Decrements zoom. Works inside Zoom, or as global chrome via the active-slide zoom bridge.',
    attributes: [{ name: 'data-disabled', description: 'Present when zoom-out is unavailable.' }],
  },
];

export const documentViewTransitionApi: ApiPart = {
  id: 'api-view-transition-document',
  name: 'Document (view transitions)',
  description:
    'While a view-transition morph runs, ramka sets attributes and CSS variables on <html> so you can style ::view-transition-* pseudo-elements. Cleared when the transition finishes.',
  attributes: [
    {
      name: 'data-lightbox-view-transition',
      description: 'Present during a morph. Value is opening or closing.',
    },
    {
      name: 'data-lightbox-no-crossfade',
      description: 'Present for hard-cut morphs (no trigger↔item snapshot crossfade).',
    },
  ],
  cssVariables: [
    {
      name: '--lightbox-morph-border-radius-from',
      type: 'string',
      description: 'Start border-radius for the morph group clip (interpolatable px).',
    },
    {
      name: '--lightbox-morph-border-radius-to',
      type: 'string',
      description: 'End border-radius for the morph group clip.',
    },
    {
      name: '--lightbox-morph-old-opacity',
      type: 'number',
      description: 'Opacity of the old morph snapshot when hard-cutting (no-crossfade path).',
    },
    {
      name: '--lightbox-morph-new-opacity',
      type: 'number',
      description: 'Opacity of the new morph snapshot when hard-cutting (1 on open, 0 on close).',
    },
  ],
};

export const hooksApi: ApiPart[] = [
  {
    id: 'api-use-trigger-context',
    name: 'useLightboxTriggerContext',
    description:
      'Optional context from the enclosing Trigger. Use in nested wrappers (e.g. a shared <TriggerImage>) to attach imageRef / morphRef without threading the render prop.',
    props: [
      {
        name: '(return)',
        type: 'LightboxTriggerRenderState | null',
        description: '{ imageRef, morphRef, open, active }, or null outside a Trigger.',
      },
    ],
  },
  {
    id: 'api-use-item-context',
    name: 'useLightboxItemContext',
    description:
      'Optional context from the enclosing Item. Use in nested wrappers to attach imageRef / morphRef or read active/index.',
    props: [
      {
        name: '(return)',
        type: 'LightboxItemContextValue | null',
        description: '{ index, active, imageRef, morphRef }, or null outside an Item.',
      },
    ],
  },
];

export const imperativeApi: ApiPart[] = [
  {
    id: 'api-root-ref',
    name: 'LightboxRootRef',
    description: 'Imperative handle from ref on Root.',
    props: [
      {
        name: 'open',
        type: '(index?: number) => void',
        description:
          'Open the lightbox. Optional index sets the active item. Without a click origin there is no trigger-element morph.',
      },
      {
        name: 'close',
        type: '() => void',
        description: 'Close the lightbox.',
      },
      {
        name: 'goTo',
        type: '(index: number) => void',
        description: 'Navigate to an index (source: button).',
      },
    ],
  },
  {
    id: 'api-zoom-ref',
    name: 'LightboxZoomRef',
    description: 'Imperative handle from ref on Zoom.',
    props: [
      { name: 'zoom', type: 'number', description: 'Current zoom level (read-only field on the handle).' },
      { name: 'maxZoom', type: 'number', description: 'Resolved maximum zoom.' },
      { name: 'offsetX', type: 'number', description: 'Current pan X.' },
      { name: 'offsetY', type: 'number', description: 'Current pan Y.' },
      { name: 'zoomIn', type: '() => void', description: 'Step zoom in by zoomStep.' },
      { name: 'zoomOut', type: '() => void', description: 'Step zoom out by zoomStep.' },
      {
        name: 'zoomTo',
        type: '(target: number, options?: { rapid?: boolean; dx?: number; dy?: number }) => void',
        description: 'Zoom to an absolute level, optionally recentering.',
      },
      {
        name: 'reset',
        type: '(rapid?: boolean) => void',
        description: 'Reset zoom and pan to the resting state.',
      },
    ],
  },
];
