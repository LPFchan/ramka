/**
 * Documented CSS custom properties published by Lightbox.
 * JSDoc here is the source of truth for the docs site API tables
 * (`pnpm docs:api`). Use `@type` for the Type column. Prefer these
 * constants over string literals when reading/writing variables in
 * library code.
 */

export enum LightboxContentCssVars {
  /**
   * 0 at rest → 1 at the dismiss threshold. Drive backdrop/content opacity from this.
   * @type number
   */
  pullProgress = '--lightbox-pull-progress',
  /**
   * Duration of the pull-to-dismiss snap-back, published only while the
   * cancelled pull springs back to rest. Reference it in your transition so
   * progress-derived visuals stay in lockstep with the item's spring, e.g.
   * `transition: opacity var(--lightbox-pull-snap-duration, 300ms) var(--lightbox-pull-snap-easing, ease)`.
   * @type string
   */
  pullSnapDuration = '--lightbox-pull-snap-duration',
  /**
   * Easing of the pull-to-dismiss snap-back (a velocity-aware spring, published
   * only during the spring-back). Pair with `--lightbox-pull-snap-duration` so
   * backdrop/chrome fades match the item's snap-back exactly.
   * @type string
   */
  pullSnapEasing = '--lightbox-pull-snap-easing',
  /**
   * 0 at 1× → 1 once zoom has risen by 1× above min (e.g. 2× when min is 1).
   * Written by the active `Lightbox.Zoom` from the *visual* scale (live WAAPI
   * transform while a discrete zoom animates; React zoom otherwise). Cleared
   * when zoom returns to rest. Drive sibling dim/blur from this, e.g.
   * `filter: opacity(calc(1 - var(--lightbox-zoom-progress, 0))) blur(calc(var(--lightbox-zoom-progress, 0) * 6px))`.
   * @type number
   */
  zoomProgress = '--lightbox-zoom-progress',
}

export enum LightboxBackdropCssVars {
  /**
   * Same progress variable as Content during pull-to-dismiss.
   * @type number
   */
  pullProgress = '--lightbox-pull-progress',
  /**
   * Same snap-back duration variable as Content during pull-to-dismiss.
   * @type string
   */
  pullSnapDuration = '--lightbox-pull-snap-duration',
  /**
   * Same snap-back easing variable as Content during pull-to-dismiss.
   * @type string
   */
  pullSnapEasing = '--lightbox-pull-snap-easing',
}

export enum LightboxDocumentCssVars {
  /**
   * Start border-radius for the morph group clip (interpolatable px).
   * @type string
   */
  morphBorderRadiusFrom = '--lightbox-morph-border-radius-from',
  /**
   * End border-radius for the morph group clip.
   * @type string
   */
  morphBorderRadiusTo = '--lightbox-morph-border-radius-to',
  /**
   * Opacity of the old morph snapshot on the hard-cut path (no document crossfade).
   * @type number
   */
  morphOldOpacity = '--lightbox-morph-old-opacity',
  /**
   * Opacity of the new morph snapshot on the hard-cut path (1 on open, 0 on close).
   * @type number
   */
  morphNewOpacity = '--lightbox-morph-new-opacity',
  /**
   * Morph + root-snapshot duration from the Root's `viewTransition` timing
   * preset. WRITTEN BY THE LIBRARY in two places — do not set it yourself:
   * onto `documentElement` during a morph (read it in document-level
   * `::view-transition-*` rules, e.g. `calc(var(--lightbox-vt-duration) * 0.5)`
   * for a derived track), and always onto the Portal host, so skin open/close
   * fades inside the portal can use the preset's clock even when no morph
   * runs (non-VT browsers, reduced motion, low-end fallback), e.g.
   * `transition: opacity var(--lightbox-vt-duration, 360ms) ease-out`.
   * @type string
   */
  vtDuration = '--lightbox-vt-duration',
  /**
   * Easing for `::view-transition-group(lightbox-morph)` and the *open*
   * crossfade dissolve. Written by the library from the `viewTransition`
   * preset, like `--lightbox-vt-duration` (during a morph on
   * `documentElement`, always on the Portal host). Close dissolve uses
   * `--lightbox-vt-crossfade-close-easing` (a shorter complementary fade,
   * not the morph curve) so the item yields before the size settle.
   * @type string
   */
  vtEasing = '--lightbox-vt-easing',
  /**
   * Close trigger↔item snapshot dissolve, used while
   * `data-ramka-view-transition="closing"` and `data-ramka-crossfade` are set.
   * Modest ease-out on a shorter window that still runs old 1→0 and new 0→1 on
   * the same clock (`plus-lighter` stays opaque). Written by the library onto
   * `documentElement` during a morph — do not set it yourself.
   * @type string
   */
  vtCrossfadeCloseEasing = '--lightbox-vt-crossfade-close-easing',
  /**
   * Easing for the root snapshot cross-fade
   * (`::view-transition-old/new(root)`). Written by the library from the
   * `viewTransition` preset, like `--lightbox-vt-duration` (during a morph on
   * `documentElement`, always on the Portal host). A good default for skin
   * backdrop/content fades.
   * @type string
   */
  vtRootEasing = '--lightbox-vt-root-easing',
}

export enum LightboxThumbnailStripCssVars {
  /**
   * End `translateX` travel for the scroll link (negative px length to center
   * the last thumb — `(count - 1) * step` when thumbs are uniform). Set on the
   * ThumbnailStripTrack.
   * @type string
   */
  travel = '--lightbox-thumbnail-strip-travel',
  /**
   * Duration of the element-scoped Slides view transition on pointer thumb
   * select (`selectViewTransition`). Set on Slides (or a parent) and use from
   * `::view-transition-group(root)` — library starts the transition; CSS owns
   * the look. Default fallback in demos: `0.4s`.
   * @type string
   */
  selectVtDuration = '--lightbox-select-vt-duration',
  /**
   * Easing of the element-scoped Slides view transition on pointer thumb
   * select. Pair with `--lightbox-select-vt-duration`. Default fallback in
   * demos: `cubic-bezier(0.22, 1, 0.36, 1)`.
   * @type string
   */
  selectVtEasing = '--lightbox-select-vt-easing',
}
