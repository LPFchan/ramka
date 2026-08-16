/**
 * Open-morph placeholder paint. `Lightbox.Item` owns *when* to paint and
 * restore; this module only draws the trigger thumbnail into a `<canvas>`
 * underlay on a non-replaced host (`Lightbox.Media` or an explicit `morphRef`).
 */

export interface CanvasPlaceholderArgs {
  img: HTMLImageElement;
  source: HTMLImageElement | null;
  fit: 'contain' | 'cover';
  borderRadius: string;
  objectPosition: string;
  /**
   * Non-replaced host that already owns the morph (`Lightbox.Media` or an
   * explicit Item `morphRef`). Required — we never insert into `img.parentElement`
   * or retarget the morph to a mystery wrapper (that stretched under Zoom).
   */
  host: HTMLElement;
}

/**
 * Resolve an `object-position` string into the fraction (0..1) of the free
 * space (`box - drawn`) to offset the drawn image on each axis. Mirrors CSS:
 * a single value sets the horizontal axis and centers the vertical; keywords
 * and percentages are honored, other lengths fall back to centered. Used to
 * place the canvas placeholder's letterbox rect the same way `object-position`
 * would place the live image.
 */
export function resolveObjectPosition(
  objectPosition: string,
  freeX: number,
  freeY: number,
): { x: number; y: number } {
  const axisFraction = (token: string | undefined, axis: 'x' | 'y'): number => {
    if (!token) return 0.5;
    if (token === 'center') return 0.5;
    if (token === (axis === 'x' ? 'left' : 'top')) return 0;
    if (token === (axis === 'x' ? 'right' : 'bottom')) return 1;
    if (token.endsWith('%')) {
      const pct = Number.parseFloat(token);
      return Number.isFinite(pct) ? pct / 100 : 0.5;
    }
    return 0.5;
  };
  const parts = (objectPosition || '').trim().split(/\s+/);
  return {
    x: freeX * axisFraction(parts[0], 'x'),
    y: freeY * axisFraction(parts[1] ?? 'center', 'y'),
  };
}

/**
 * Paint the trigger thumbnail into a `<canvas>` placed behind the destination
 * `<img>` as the open-morph bridge, returning a restore fn — or `null` when a
 * canvas can't be used (no 2D context, no decoded source, unresolved box) so the
 * caller falls back to the CSS-background placeholder.
 *
 * A canvas is used instead of a `background-image`/`<img>` because it's a
 * pre-rasterized bitmap: `drawImage` of the already-decoded trigger thumbnail is
 * synchronous, so unlike an async image decode (which WebKit does per-draw-size
 * and often *after* it captures the view-transition "new" snapshot) the pixels
 * are guaranteed present in the snapshot and across the VT→live handoff — no
 * blank frame, no fallback to the opaque trigger snapshot, no late letterboxing.
 */
export function tryPaintCanvasPlaceholder(args: CanvasPlaceholderArgs): (() => void) | null {
  const { img, source, fit, borderRadius, objectPosition, host } = args;
  if (!source) return null;

  // A decoded source is required to draw synchronously (the trigger is on-screen
  // and decoded, so this holds in practice; bail defensively otherwise).
  const natW = source.naturalWidth;
  const natH = source.naturalHeight;
  if (!(source.complete && natW > 0 && natH > 0)) return null;

  // Replaced elements can't host a sibling canvas — host must be Media / morphRef.
  if (host === img) return null;

  const boxW = img.clientWidth || host.clientWidth;
  const boxH = img.clientHeight || host.clientHeight;
  if (!(boxW > 0 && boxH > 0)) return null;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null;
  try {
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');
  } catch {
    return null;
  }
  if (!ctx) return null;

  const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 3);
  canvas.width = Math.max(1, Math.round(boxW * dpr));
  canvas.height = Math.max(1, Math.round(boxH * dpr));
  canvas.setAttribute('data-ramka-placeholder', '');
  const cstyle = canvas.style;
  cstyle.position = 'absolute';
  cstyle.top = '0';
  cstyle.left = '0';
  cstyle.width = '100%';
  cstyle.height = '100%';
  cstyle.zIndex = '-1'; // paint beneath the in-flow destination <img>
  cstyle.pointerEvents = 'none';

  // Letterbox rect from the trigger's intrinsic size (object-fit math).
  const scale =
    fit === 'cover' ? Math.max(boxW / natW, boxH / natH) : Math.min(boxW / natW, boxH / natH);
  const drawW = natW * scale;
  const drawH = natH * scale;
  const { x: posX, y: posY } = resolveObjectPosition(objectPosition, boxW - drawW, boxH - drawH);

  try {
    ctx.scale(dpr, dpr);
    // Cross-origin sources taint the canvas — fine here: we only paint it, never
    // read pixels back (no toDataURL/getImageData), so there's no SecurityError.
    ctx.drawImage(source, posX, posY, drawW, drawH);
  } catch {
    return null;
  }

  // Prepare the host: (1) a positioned + isolated stacking context so the
  // `z-index:-1` canvas paints ABOVE the host background but BELOW the in-flow
  // <img> (without `isolation`, a negative z-index could sink the canvas behind
  // the host's ancestors and vanish); (2) clip to the image's rounding so the
  // morph group's animated radius is clean and the handoff to the live rounded
  // <img> is seamless. All saved and restored when the bridge ends.
  const savedPosition = host.style.position;
  const savedOverflow = host.style.overflow;
  const savedRadius = host.style.borderRadius;
  const savedIsolation = host.style.isolation;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  host.style.isolation = 'isolate';
  host.style.overflow = 'hidden';
  host.style.borderRadius = borderRadius;

  host.insertBefore(canvas, host.firstChild);

  return () => {
    canvas.remove();
    host.style.position = savedPosition;
    host.style.overflow = savedOverflow;
    host.style.borderRadius = savedRadius;
    host.style.isolation = savedIsolation;
  };
}
