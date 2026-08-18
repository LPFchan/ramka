/**
 * Async chunk entry for the view-transition morph engine.
 * Loaded only when a morph will actually run (`viewTransition !== false`
 * and the browser supports View Transitions).
 */

export { createViewTransitionMorph } from './use-view-transition-morph';
export type { ViewTransitionMorph, ViewTransitionMorphConfig } from './use-view-transition-morph';
export { ensureVtStructuralStyles } from './vt-structural-styles';
