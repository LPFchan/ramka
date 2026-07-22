import type { AttrRow, CssVarRow } from './types';

/**
 * Hand-authored API chrome for the Lightbox docs page.
 * Prop/member rows are generated from package TypeScript — see `generated.ts`
 * and `scripts/generate-lightbox-api.ts`.
 */

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
  attributes?: AttrRow[];
  cssVariables?: CssVarRow[];
};

export const lightboxApiMeta: ApiPartMeta[] = [
  {
    id: 'api-root',
    name: 'Root',
    description:
      'Groups all parts of the lightbox and owns open state, active index, view-transition morph, scroll locking, and the active-zoom bridge.',
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
      'Opens the lightbox at a given index. With viewTransition, acts as the morph source. Prefer render-prop children to attach imageRef / morphRef.',
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxTriggerProps',
      file: 'lightbox-trigger.tsx',
      includeInherited: ['render'],
    },
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
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxContentProps',
      file: 'lightbox-content.tsx',
      exclude: ['className', 'style', 'ref'],
    },
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
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxBackdropProps',
      file: 'lightbox-backdrop.tsx',
      includeInherited: ['render'],
    },
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
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxCloseProps',
      file: 'lightbox-close.tsx',
      includeInherited: ['render'],
    },
  },
  {
    id: 'api-item-group',
    name: 'ItemGroup',
    description:
      'Swap layout: mounts only the active item plus preload neighbors. Use for stacked (non-carousel) viewers.',
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxItemGroupProps',
      file: 'lightbox-item-group.tsx',
      includeInherited: ['render'],
      exclude: ['className'],
    },
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
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxItemProps',
      file: 'lightbox-item.tsx',
      includeInherited: ['render'],
    },
    attributes: [
      { name: 'data-lightbox-item', description: 'Always present on the item element.' },
      { name: 'data-active', description: 'Present when this item is the active index.' },
      { name: 'data-index', description: 'The item index as a string.' },
      {
        name: 'data-skip-fade',
        description:
          'Transient during view-transition open — suppress consumer entrance fades on the destination item.',
      },
    ],
  },
  {
    id: 'api-slides',
    name: 'Slides',
    description:
      'Horizontal snap carousel wired to the active index. Provides ItemGroup context; put Slide → Item inside.',
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxSlidesProps',
      file: 'lightbox-slides.tsx',
      includeInherited: ['render'],
      exclude: ['className'],
    },
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
    extract: { kind: 'none' },
    attributes: [{ name: 'data-lightbox-slide', description: 'Always present on the slide element.' }],
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
    attributes: [{ name: 'data-disabled', description: 'Present when navigation is unavailable.' }],
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
    attributes: [{ name: 'data-disabled', description: 'Present when navigation is unavailable.' }],
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
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxThumbnailGroupProps',
      file: 'lightbox-thumbnail-group.tsx',
      includeInherited: ['render'],
    },
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
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxThumbnailProps',
      file: 'lightbox-thumbnail.tsx',
      includeInherited: ['render'],
    },
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
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxZoomProps',
      file: 'lightbox-zoom.tsx',
      includeInherited: ['render'],
    },
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
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxZoomInProps',
      file: 'lightbox-zoom-in.tsx',
      includeInherited: ['render'],
    },
    attributes: [{ name: 'data-disabled', description: 'Present when zoom-in is unavailable.' }],
  },
  {
    id: 'api-zoom-out',
    name: 'ZoomOut',
    description:
      'Decrements zoom. Works inside Zoom, or as global chrome via the active-slide zoom bridge.',
    extract: {
      kind: 'interface-props',
      typeName: 'LightboxZoomOutProps',
      file: 'lightbox-zoom-out.tsx',
      includeInherited: ['render'],
    },
    attributes: [{ name: 'data-disabled', description: 'Present when zoom-out is unavailable.' }],
  },
];

export const documentViewTransitionMeta: ApiPartMeta = {
  id: 'api-view-transition-document',
  name: 'Document (view transitions)',
  description:
    'While a view-transition morph runs, ramka sets attributes and CSS variables on <html> so you can style ::view-transition-* pseudo-elements. Cleared when the transition finishes.',
  extract: { kind: 'none' },
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
      'Optional context from the enclosing Item. Use in nested wrappers to attach imageRef / morphRef or read active/index.',
    extract: {
      kind: 'hook-return',
      functionName: 'useOptionalLightboxItemContext',
      file: 'lightbox-item.tsx',
    },
  },
];

export const imperativeApiMeta: ApiPartMeta[] = [
  {
    id: 'api-root-ref',
    name: 'LightboxRootRef',
    description: 'Imperative handle from ref on Root.',
    extract: {
      kind: 'interface-members',
      typeName: 'LightboxRootRef',
      file: 'lightbox-root.tsx',
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
