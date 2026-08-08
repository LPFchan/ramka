'use client';

import * as React from 'react';

/**
 * A pane of cracked glass with specular lighting, laid over the framed
 * testimonial ("I'd rather eat glass...").
 *
 * The lighting technique is adapted from frosted-ui's Shine component
 * (https://github.com/whopio/frosted-ui): the element's alpha channel is
 * blurred into a height map, feSpecularLighting raises glints on it from a
 * distant (parallel) light, and the glints are composited back over the
 * source.
 *
 * The source is a hand-drawn shatter: radial cracks from an impact point,
 * connecting rings — and the whole pane tessellated into shard polygons
 * along those cracks. Each surviving shard is a *flat* plateau of uniform
 * low alpha (flat plate = uniform normal), at a slightly different height
 * from its neighbors, so with a small blur the lighting pass produces a
 * broad sheen gliding across the faces plus thin sharp glints exactly at
 * the crack steps. Two shards have fallen out of the frame: their regions
 * get no fill at all — no tint, no sheen — just the raw matte showing
 * through and a bright exposed-edge rim that catches the light hard. The
 * hole is what makes the remaining glass read as glass.
 *
 * The pane starts intact — one flat sheet with a soft static sheen — and
 * shatters on click. The shatter is authored once around the impact point
 * (63,34); on click every coordinate is remapped through a piecewise-linear
 * warp that moves that point to the click position while pinning the pane
 * edges, so the radial cracks still run out to the borders wherever the
 * pane is struck.
 *
 * PERFORMANCE: the pane is NOT rendered as live DOM with `filter: url()`.
 * A live SVG filter on an element is re-evaluated whenever the browser
 * re-rasterizes that layer — notably every View Transition snapshot, which
 * the lightbox takes constantly. Instead the whole pane (geometry + filter)
 * is serialized into a standalone SVG data URI and set as background-image:
 * the browser rasterizes the image once per size, caches the bitmap, and
 * everything after that is plain texture compositing. The filter runs only
 * when the URI changes: mount, debounced resize, and once on shatter.
 */

/** Radial cracks running from the impact point (63,34) to the pane edges. */
const PRIMARY_CRACKS = [
  '63,34 78,22 92,14 100,9',
  '63,34 75,38 88,44 100,49',
  '63,34 70,52 76,71 80,100',
  '63,34 55,55 47,78 43,100',
  '63,34 44,42 22,50 0,55',
  '63,34 48,26 28,18 0,10',
  '63,34 66,18 70,8 72,0',
  '63,34 82,31 100,28',
  '63,34 57,44 40,64 28,84 22,100',
];

/** Shorter cracks: concentric rings near the impact and branches forking
    off the radials. Every branch starts ON a radial — a floating segment
    reads as a splinter lying on top of the pane, not a crack in it. One
    end may peter out into the field: crack tips do terminate.
    (No strays inside the fallen-out regions — there is no glass there.) */
const SECONDARY_CRACKS = [
  '70,25 73,30 71,37 66,42 58,42 53,37',
  '78,22 86,28',
  '55,30 60,24 65,22',
  '28,18 24,10',
  '76,71 84,76',
];

/** Translucent facets near the impact, where shards tilt out of plane. */
const FACETS = ['63,34 58,28 60,24', '63,34 75,38 71,37'];

/**
 * Tiny pieces near the impact that fell out of the pane: punched out of the
 * lit layer with a mask, so inside them there is no tint, no facet, no
 * crack — just bare matte and an exposed-edge rim. Upper right, two
 * adjacent blades fell out together (inner pinwheel piece plus the piece
 * beyond the ring); below the impact, one blade bounded exactly by two
 * radials and the ring, so its rim lands on existing crack lines.
 */
const FALLEN_BITS = [
  '63,34 70,25 73,30',
  '70,25 78,22 73,30',
  '63,34 66,42 58,42',
];

/**
 * Rim outlines for the holes above. Kept separate from FALLEN_BITS because
 * adjacent bits merge into one hole: the rim traces the merged outline, so
 * no edge gets drawn through the middle of a hole (a line floating inside
 * a hole reads as a stray sliver of glass).
 */
const FALLEN_BIT_RIMS = ['63,34 70,25 78,22 73,30', '63,34 66,42 58,42'];

/**
 * The pane tessellated into shards between adjacent radial cracks (each
 * polygon runs impact point -> one crack -> pane edge/corner -> next crack).
 * Surviving shards are flat plates: uniform `alpha`, each at a slightly
 * different value so neighboring faces sit at different heights and the
 * crack steps between them catch sharp glints. `fallen: true` marks pieces
 * that dropped out of the frame — they render as bare matte with only a
 * bright exposed-edge rim.
 */
type Shard = { points: string; alpha: number; fallen?: boolean };

const SHARDS: Shard[] = [
  // Top wedge (between the up crack and the upper-right crack).
  { points: '63,34 66,18 70,8 72,0 100,0 100,9 92,14 78,22', alpha: 0.06 },
  // Upper right.
  { points: '63,34 78,22 92,14 100,9 100,28 82,31', alpha: 0.1 },
  // Right: fell out of the frame.
  { points: '63,34 82,31 100,28 100,49 88,44 75,38', alpha: 0, fallen: true },
  // Lower right, includes the bottom-right corner.
  { points: '63,34 75,38 88,44 100,49 100,100 80,100 76,71 70,52', alpha: 0.08 },
  // Bottom.
  { points: '63,34 70,52 76,71 80,100 43,100 47,78 55,55', alpha: 0.04 },
  // Lower left: fell out of the frame.
  {
    points: '63,34 55,55 47,78 43,100 22,100 28,84 40,64 57,44',
    alpha: 0,
    fallen: true,
  },
  // Left, includes the bottom-left corner.
  { points: '63,34 57,44 40,64 28,84 22,100 0,100 0,55 22,50 44,42', alpha: 0.09 },
  // Upper left.
  { points: '63,34 44,42 22,50 0,55 0,10 28,18 48,26', alpha: 0.05 },
  // Top left, includes the top-left corner.
  { points: '63,34 48,26 28,18 0,10 0,0 72,0 70,8 66,18', alpha: 0.07 },
];

/** Where the shatter pattern above was authored. */
const ORIGIN = { x: 63, y: 34 };

/**
 * When the click that breaks the glass lands on a link, navigation is held
 * back this long so the user sees the pane crack before the new tab steals
 * focus. 500ms: enough to register the shatter, short enough that the link
 * still feels responsive. Well within the browser's transient-activation
 * window, so the delayed open is not popup-blocked.
 */
const LINK_DELAY_MS = 500;

/**
 * Remaps one coordinate so `from` lands on `to` while 0 and 100 (the pane
 * edges) stay fixed: linear below the impact, linear above it. Cracks
 * authored to end on a border still end on that border after the warp.
 */
function warp(value: number, from: number, to: number): number {
  const mapped =
    value <= from
      ? (value * to) / from
      : to + ((value - from) * (100 - to)) / (100 - from);
  return Math.round(mapped * 100) / 100;
}

function warpPoints(points: string, impact: { x: number; y: number }): string {
  return points
    .split(' ')
    .map((pair) => {
      const [x = 0, y = 0] = pair.split(',').map(Number);
      return `${warp(x, ORIGIN.x, impact.x)},${warp(y, ORIGIN.y, impact.y)}`;
    })
    .join(' ');
}

/**
 * Serializes the pane — crack geometry plus the lighting filter — into a
 * standalone SVG document sized to the pane's CSS pixels. Pixel sizing
 * matters: the filter primitives (blur radius, light position and height)
 * are pixel quantities, so they live on the outer SVG, while the authored
 * 0-100 geometry sits in a nested <svg> stretched over it. Strokes use
 * vector-effect="non-scaling-stroke" so they stay at their authored pixel
 * widths despite the stretch. The browser rasterizes the image at device
 * resolution, so it stays crisp on retina displays.
 */
function buildPaneSvg(
  width: number,
  height: number,
  impact: { x: number; y: number } | null,
): string {
  const fill = (tag: 'polygon' | 'rect', attrs: string, color: string) =>
    `<${tag} ${attrs} fill="${color}"/>`;
  const stroke = (
    tag: 'polygon' | 'polyline',
    points: string,
    color: string,
    px: number,
  ) =>
    `<${tag} points="${points}" fill="none" stroke="${color}" stroke-width="${px}" vector-effect="non-scaling-stroke"/>`;

  let content: string;
  if (impact === null) {
    // The intact sheet: one flat plate, so the light plays a soft sheen
    // across the whole pane and nothing else.
    content = fill('rect', 'width="100" height="100"', 'rgba(255,255,255,0.07)');
  } else {
    const w = (points: string) => warpPoints(points, impact);
    content =
      // The mask knocks the fallen bits out of everything painted below:
      // fills, facets, and any cracks crossing them.
      `<defs><mask id="holes" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">` +
      fill('rect', 'width="100" height="100"', '#fff') +
      FALLEN_BITS.map((p) => fill('polygon', `points="${w(p)}"`, '#000')).join('') +
      `</mask></defs>` +
      `<g mask="url(#holes)">` +
      // Surviving glass plates: flat fills at slightly different heights.
      // Fallen pieces render nothing — bare matte.
      SHARDS.filter((s) => !s.fallen)
        .map((s) => fill('polygon', `points="${w(s.points)}"`, `rgba(255,255,255,${s.alpha})`))
        .join('') +
      // Exposed glass edges around the holes: the brightest lines in the
      // pane, they catch the light hard.
      SHARDS.filter((s) => s.fallen)
        .map((s) => stroke('polygon', w(s.points), 'rgba(245,248,255,0.4)', 1.4))
        .join('') +
      FACETS.map((p) => fill('polygon', `points="${w(p)}"`, 'rgba(255,255,255,0.06)')).join('') +
      PRIMARY_CRACKS.map((p) => stroke('polyline', w(p), 'rgba(235,240,255,0.18)', 1.1)).join('') +
      SECONDARY_CRACKS.map((p) => stroke('polyline', w(p), 'rgba(235,240,255,0.12)', 0.7)).join('') +
      `</g>` +
      // Exposed edges of the fallen bits, outside the mask so they stay
      // visible around the tiny holes.
      FALLEN_BIT_RIMS.map((p) => stroke('polygon', w(p), 'rgba(245,248,255,0.35)', 0.8)).join('') +
      // The impact crater itself: a bright speck that stays lit.
      `<circle cx="${impact.x}" cy="${impact.y}" r="0.6" fill="rgba(255,255,255,0.5)"/>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<filter id="f" color-interpolation-filters="sRGB">` +
    // Everything is drawn at low alpha, which would make both the height
    // map and the clip mask nearly flat, so boost alpha first.
    `<feComponentTransfer in="SourceAlpha" result="boost"><feFuncA type="linear" slope="6"/></feComponentTransfer>` +
    // Small blur: shard plateaus stay flat (glass plates), and the alpha
    // steps at cracks and hole rims become thin sharp ridges. A big blur
    // here reads as embossed fabric, not glass.
    `<feGaussianBlur in="boost" stdDeviation="0.8" result="bump"/>` +
    // A distant (parallel) light instead of a point light: no local hotspot
    // blob — every crack ridge angled toward the light glints uniformly
    // across the whole pane, like window light hitting beveled glass. From
    // the top-left (azimuth 225, y-down), grazing low (elevation 28) so the
    // ridges rake bright while the flats stay dark; the constant is raised
    // to compensate for the shallower angle.
    `<feSpecularLighting in="bump" result="light" surfaceScale="6" specularConstant="1.7" specularExponent="30" lighting-color="#ffffff">` +
    `<feDistantLight azimuth="225" elevation="28"/>` +
    `</feSpecularLighting>` +
    // Clip glints to the pane, then add them over the source.
    `<feComposite in="light" in2="bump" operator="in" result="glints"/>` +
    `<feComposite in="SourceGraphic" in2="glints" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/>` +
    `</filter>` +
    `<g filter="url(#f)">` +
    `<svg width="${width}" height="${height}" viewBox="0 0 100 100" preserveAspectRatio="none">` +
    content +
    `</svg>` +
    `</g>` +
    `</svg>`
  );
}

export function BrokenGlassShine({ className }: { className?: string }) {
  const paneRef = React.useRef<HTMLDivElement>(null);

  /** Impact point in viewBox (0-100) coordinates; null while intact. */
  const [impact, setImpact] = React.useState<{ x: number; y: number } | null>(
    null,
  );

  /** Pane size in CSS pixels; the rasterization target. */
  const [size, setSize] = React.useState<{ width: number; height: number } | null>(
    null,
  );

  // Measure the pane and re-measure on resize. Debounced: every new size
  // means one fresh rasterization of the background SVG, so don't churn
  // through intermediate sizes mid-drag.
  React.useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;

    let timer = 0;
    const measure = () =>
      setSize((prev) => {
        const width = pane.clientWidth;
        const height = pane.clientHeight;
        return prev && prev.width === width && prev.height === height
          ? prev
          : { width, height };
      });

    measure();
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(measure, 150);
    });
    observer.observe(pane);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  // While intact, listen for clicks on the host element (the frame that
  // contains this overlay) rather than on the overlay itself. The overlay
  // stays pointer-events-none the whole time, so the buttons underneath
  // always work; a click on a button both follows the link and cracks the
  // pane around it. (The overlay is pointer-events-none, so clicks on the
  // frame's content bubble to the frame without ever touching it.)
  React.useEffect(() => {
    if (impact) return;
    const pane = paneRef.current;
    const host = pane?.parentElement;
    if (!pane || !host) return;

    const shatter = (event: MouseEvent) => {
      const box = pane.getBoundingClientRect();
      // Clamp so the impact never sits on an edge, which would squash one
      // side of the pattern into nothing.
      const clamp = (v: number) => Math.min(88, Math.max(12, v));
      setImpact({
        x: clamp(((event.clientX - box.left) / box.width) * 100),
        y: clamp(((event.clientY - box.top) / box.height) * 100),
      });

      // If this click was on a link, hold the navigation briefly so the
      // shatter is seen before a new tab takes over. Modified clicks
      // (cmd/ctrl/shift, middle button) open in the background anyway, so
      // they pass through untouched.
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>('a[href]')
          : null;
      const plainClick =
        event.button === 0 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey;
      if (link && host.contains(link) && plainClick) {
        event.preventDefault();
        const { href } = link;
        window.setTimeout(() => {
          window.open(href, '_blank', 'noopener,noreferrer');
        }, LINK_DELAY_MS);
      }
    };

    host.addEventListener('click', shatter);
    return () => host.removeEventListener('click', shatter);
  }, [impact]);

  const backgroundImage = React.useMemo(() => {
    if (!size) return undefined;
    const svg = buildPaneSvg(size.width, size.height, impact);
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }, [size, impact]);

  return (
    <div
      ref={paneRef}
      aria-hidden
      className={`pointer-events-none ${className ?? ''}`}
      style={{ backgroundImage, backgroundSize: '100% 100%' }}
    />
  );
}
