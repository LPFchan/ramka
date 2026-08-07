'use client';

import * as React from 'react';

/**
 * A pane of cracked glass with dynamic specular lighting, laid over the
 * framed testimonial ("I'd rather eat glass...").
 *
 * The lighting technique is adapted from frosted-ui's Shine component
 * (https://github.com/whopio/frosted-ui): the element's alpha channel is
 * blurred into a height map, feSpecularLighting raises glints on it from an
 * fePointLight that tracks the cursor, and the glints are composited back
 * over the source.
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
 * The pane starts intact — one flat sheet with a soft sheen following the
 * cursor — and shatters on click. The shatter is authored once around the
 * impact point (63,34); on click every coordinate is remapped through a
 * piecewise-linear warp that moves that point to the click position while
 * pinning the pane edges, so the radial cracks still run out to the
 * borders wherever the pane is struck.
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

export function BrokenGlassShine({ className }: { className?: string }) {
  const filterId = React.useId();
  const filterRef = React.useRef<SVGFilterElement>(null);
  const paneRef = React.useRef<HTMLDivElement>(null);
  const mouse = React.useRef({ x: 0, y: 0 });

  /** Impact point in viewBox (0-100) coordinates; null while intact. */
  const [impact, setImpact] = React.useState<{ x: number; y: number } | null>(
    null,
  );

  const setLightTo = React.useCallback((clientX: number, clientY: number) => {
    const pane = paneRef.current;
    const light = filterRef.current?.querySelector('fePointLight');
    if (!pane || !light) return;
    const box = pane.getBoundingClientRect();
    light.setAttribute('x', String(clientX - box.left));
    light.setAttribute('y', String(clientY - box.top));
  }, []);

  React.useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      mouse.current = { x: event.clientX, y: event.clientY };
      setLightTo(event.clientX, event.clientY);
    };
    const onScroll = () => setLightTo(mouse.current.x, mouse.current.y);

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [setLightTo]);

  const shatter = (event: React.MouseEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    // Clamp so the impact never sits on an edge, which would squash one
    // side of the pattern into nothing.
    const clamp = (v: number) => Math.min(88, Math.max(12, v));
    setImpact({
      x: clamp(((event.clientX - box.left) / box.width) * 100),
      y: clamp(((event.clientY - box.top) / box.height) * 100),
    });
    // On touch there is no pointermove trail, so put the light at the
    // impact for the first lit frame.
    setLightTo(event.clientX, event.clientY);
  };

  /** The shatter geometry, warped so the impact sits under the click. */
  const geo = React.useMemo(() => {
    if (!impact) return null;
    const w = (points: string) => warpPoints(points, impact);
    return {
      primaryCracks: PRIMARY_CRACKS.map(w),
      secondaryCracks: SECONDARY_CRACKS.map(w),
      facets: FACETS.map(w),
      fallenBits: FALLEN_BITS.map(w),
      fallenBitRims: FALLEN_BIT_RIMS.map(w),
      shards: SHARDS.map((shard) => ({ ...shard, points: w(shard.points) })),
    };
  }, [impact]);

  return (
    <div aria-hidden className={`pointer-events-none ${className ?? ''}`}>
      <svg width="0" height="0" className="absolute">
        <filter id={filterId} ref={filterRef} colorInterpolationFilters="sRGB">
          {/* Everything is drawn at low alpha, which would make both the
              height map and the clip mask nearly flat, so boost alpha first.
              (frosted-ui skips this because it lights opaque children.) */}
          <feComponentTransfer in="SourceAlpha" result="boost">
            <feFuncA type="linear" slope="6" />
          </feComponentTransfer>
          {/* Small blur: shard plateaus stay flat (glass plates), and the
              alpha steps at cracks and hole rims become thin sharp ridges.
              A big blur here reads as embossed fabric, not glass. */}
          <feGaussianBlur in="boost" stdDeviation="0.8" result="bump" />
          <feSpecularLighting
            in="bump"
            result="light"
            surfaceScale="6"
            specularConstant="1.3"
            specularExponent="30"
            lightingColor="#ffffff"
          >
            {/* Initial position rests a soft glint near the impact point;
                pointermove takes over from there. */}
            <fePointLight x="380" y="170" z="100" />
          </feSpecularLighting>
          {/* Clip glints to the pane, then add them over the source. */}
          <feComposite in="light" in2="bump" operator="in" result="glints" />
          <feComposite
            in="SourceGraphic"
            in2="glints"
            operator="arithmetic"
            k1="0"
            k2="1"
            k3="1"
            k4="0"
          />
        </filter>
      </svg>

      {/* While intact, the pane itself takes the click that breaks it; once
          broken it goes inert so the buttons underneath work again. */}
      <div
        ref={paneRef}
        onClick={geo ? undefined : shatter}
        className={`absolute inset-0 ${geo ? '' : 'pointer-events-auto cursor-pointer'}`}
        style={{ filter: `url(#${filterId})`, isolation: 'isolate' }}
      >
        <svg
          className="h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {geo === null ? (
            /* The intact sheet: one flat plate, so the light plays a soft
               sheen across the whole pane and nothing else. */
            <rect x="0" y="0" width="100" height="100" fill="rgba(255,255,255,0.07)" />
          ) : (
            <>
              <defs>
                {/* Knocks the fallen bits out of everything painted below:
                    fills, facets, and any cracks crossing them. */}
                <mask
                  id={`${filterId}-holes`}
                  maskUnits="userSpaceOnUse"
                  x="0"
                  y="0"
                  width="100"
                  height="100"
                >
                  <rect x="0" y="0" width="100" height="100" fill="#fff" />
                  {geo.fallenBits.map((points) => (
                    <polygon key={points} points={points} fill="#000" />
                  ))}
                </mask>
              </defs>

              <g mask={`url(#${filterId}-holes)`}>
                {/* Surviving glass plates: flat fills at slightly different
                    heights. Fallen pieces render nothing — bare matte. */}
                {geo.shards
                  .filter((s) => !s.fallen)
                  .map(({ points, alpha }) => (
                    <polygon
                      key={points}
                      points={points}
                      fill={`rgba(255,255,255,${alpha})`}
                    />
                  ))}
                {/* Exposed glass edges around the holes: the brightest lines
                    in the pane, they catch the light hard as it passes. */}
                {geo.shards
                  .filter((s) => s.fallen)
                  .map(({ points }) => (
                    <polygon
                      key={points}
                      points={points}
                      fill="none"
                      stroke="rgba(245,248,255,0.4)"
                      strokeWidth="1.4"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                {geo.facets.map((points) => (
                  <polygon key={points} points={points} fill="rgba(255,255,255,0.06)" />
                ))}
                {geo.primaryCracks.map((points) => (
                  <polyline
                    key={points}
                    points={points}
                    fill="none"
                    stroke="rgba(235,240,255,0.18)"
                    strokeWidth="1.1"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {geo.secondaryCracks.map((points) => (
                  <polyline
                    key={points}
                    points={points}
                    fill="none"
                    stroke="rgba(235,240,255,0.12)"
                    strokeWidth="0.7"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </g>

              {/* Exposed edges of the fallen bits, outside the mask so they
                  stay visible around the tiny holes. */}
              {geo.fallenBitRims.map((points) => (
                <polygon
                  key={points}
                  points={points}
                  fill="none"
                  stroke="rgba(245,248,255,0.35)"
                  strokeWidth="0.8"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {/* The impact crater itself: a bright speck that stays lit. */}
              <circle
                cx={impact?.x}
                cy={impact?.y}
                r="0.6"
                fill="rgba(255,255,255,0.5)"
              />
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
