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
}

export enum LightboxBackdropCssVars {
  /**
   * Same progress variable as Content during pull-to-dismiss.
   * @type number
   */
  pullProgress = '--lightbox-pull-progress',
}

export enum LightboxMediaCssVars {
  /**
   * Horizontal inset subtracted from `100cqw` in Media’s fit-box width calc.
   * @type length
   */
  fitInsetX = '--lightbox-fit-inset-x',
  /**
   * Vertical inset subtracted from `100cqh` in Media’s fit-box width calc.
   * @type length
   */
  fitInsetY = '--lightbox-fit-inset-y',
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
