/**
 * Async chunk entry for the morph engines.
 *
 * Loaded only when a morph will actually run — `viewTransition !== false` and
 * either the browser supports View Transitions or the experimental FLIP engine
 * is enabled (see flip-enabled.ts). Both engines ship in this one chunk while
 * FLIP is behind a flag; if it becomes the default, the view-transition half
 * (and most of what it imports) goes away rather than being split out.
 */

export { createViewTransitionMorph } from './use-view-transition-morph';
export type { ViewTransitionMorph, ViewTransitionMorphConfig } from './use-view-transition-morph';
export { ensureVtStructuralStyles } from './vt-structural-styles';
export { createFlipMorph } from './flip-morph';
export { ensureFlipStructuralStyles } from './flip-structural-styles';
