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
   * Opacity of the old morph snapshot when hard-cutting (no-crossfade path).
   * @type number
   */
  morphOldOpacity = '--lightbox-morph-old-opacity',
  /**
   * Opacity of the new morph snapshot when hard-cutting (1 on open, 0 on close).
   * @type number
   */
  morphNewOpacity = '--lightbox-morph-new-opacity',
}

export enum LightboxFilmstripCssVars {
  /**
   * End `translateX` travel for the scroll link (negative px length to center
   * the last thumb — `(count - 1) * step` when thumbs are uniform). Set on the
   * FilmstripTrack.
   * @type string
   */
  travel = '--lightbox-filmstrip-travel',
}
