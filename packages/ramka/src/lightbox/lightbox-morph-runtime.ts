/**
 * Async chunk entry for the view-transition morph engine.
 * Loaded only when a morph will actually run (`viewTransition !== false`
 * and the browser supports View Transitions).
 */

import { prewarmDynamicStyleSheets } from './lightbox-style-sheets';
import { prewarmCompositedMorphStyles } from './vt-composited-morph';
import { ensureVtStructuralStyles } from './vt-structural-styles';

export { createViewTransitionMorph } from './use-view-transition-morph';
export type { ViewTransitionMorph, ViewTransitionMorphConfig } from './use-view-transition-morph';
export { ensureVtStructuralStyles };

/**
 * Adopt every once-only sheet the morph will need (structural, composited
 * static, dynamic channels) while the page is idle. Each adoption mutates
 * `document.adoptedStyleSheets`, which WebKit answers with a full-document
 * restyle — pre-paying them here keeps that cost out of the first open's
 * capture window on large pages. All rules are attribute-gated or scoped, so
 * adopting them early is inert.
 */
export function prewarmVtStyles(): void {
  if (typeof document === 'undefined') return;
  ensureVtStructuralStyles();
  prewarmCompositedMorphStyles();
  prewarmDynamicStyleSheets();
}
