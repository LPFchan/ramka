/**
 * Base UI `useRender` serializes unmapped state keys as
 * `data-${key.toLowerCase()}` — so `morphTarget` becomes `data-morphtarget`,
 * `maxZoom` becomes `data-maxzoom`, etc. Every camelCase (or internal) state
 * key must either map to a documented hyphenated attribute or be suppressed
 * with {@link ignoreStateAttribute}.
 */

/** Suppress Base UI’s default `data-${key.toLowerCase()}` serialization. */
export function ignoreStateAttribute(_value: unknown): null {
  return null;
}
