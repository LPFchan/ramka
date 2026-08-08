'use client';

import * as React from 'react';

/**
 * A pane of cracked glass with specular lighting, laid over the framed
 * testimonial ("I'd rather eat glass...").
 *
 * The lighting technique is adapted from frosted-ui's Shine component
 * (https://github.com/whopio/frosted-ui): the pane's alpha channel is
 * blurred into a height map and specular glints are raised on it from a
 * distant (parallel) light, then composited back over the source.
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
 * RENDERING: the lighting runs in a WebGL fragment shader, not an SVG
 * filter. The crack geometry is rasterized ONCE per pane state (mount,
 * debounced resize, shatter) into three textures — the visible "ink"
 * layer, the under-layer shadow work, and a boosted+blurred height map —
 * and each frame the shader recomputes only the Blinn-Phong specular term
 * (the same math feSpecularLighting does) against a light-direction
 * uniform. That makes the light dynamic again: it leans toward the cursor,
 * and a redraw costs one fullscreen-quad draw call, issued only while the
 * light is actually moving. Idle cost is zero, and View Transitions
 * snapshot the canvas as a plain bitmap layer — no filter re-evaluation.
 * This also sidesteps WebKit's low-resolution rasterization of SVG filters
 * inside image documents, which made the cracks look soft on Safari.
 * If WebGL is unavailable, a static SVG-filter render is drawn to the
 * same canvas via 2D context as a fallback.
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
 * The crushed zone: dense micro-cracks within a few units of the impact,
 * where the glass pulverized. Radiating stubs plus a few tangential hops;
 * drawn as the finest hairlines and frosted over by a radial gradient.
 */
const MICRO_CRACKS = [
  '63,34 60.2,31.4',
  '63,34 61.4,37.6',
  '63,34 66.8,35.8',
  '63,34 64.9,30.2',
  '63,34 59.6,34.9',
  '63,34 66.3,31.7',
  '63,34 61.1,30.1',
  '63,34 65.7,37.1',
  '60.2,31.4 59,30.8',
  '66.8,35.8 68,36.6',
  '61.4,37.6 60.6,39',
  '64.9,30.2 65.6,28.8',
  '59.6,34.9 58.2,35.4',
];

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

/** Lighting constants, matching the SVG filter this replaced:
    feSpecularLighting surfaceScale=6 (per CSS px), constant 1.7, exp 30. */
const SURFACE_SCALE = 6;
const SPECULAR_CONSTANT = 1.7;
const SPECULAR_EXPONENT = 30;
/** Alpha boost applied before blurring into the height map. */
const ALPHA_BOOST = 6;
/** Height-map blur sigma in CSS px. */
const BLUR_SIGMA = 0.8;
/** Resting light: from the top-left (azimuth 225 in y-down coords),
    grazing low so crack ridges rake bright while the flats stay dark. */
const DEFAULT_AZIMUTH = 225;
const DEFAULT_ELEVATION = 28;

type Vec3 = [number, number, number];
type Point = { x: number; y: number };

/** Direction TO a distant light, SVG feDistantLight convention (y-down). */
function lightVector(azimuthDeg: number, elevationDeg: number): Vec3 {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  return [Math.cos(az) * Math.cos(el), Math.sin(az) * Math.cos(el), Math.sin(el)];
}

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

function warpPoints(points: string, impact: Point): string {
  return points
    .split(' ')
    .map((pair) => {
      const [x = 0, y = 0] = pair.split(',').map(Number);
      return `${warp(x, ORIGIN.x, impact.x)},${warp(y, ORIGIN.y, impact.y)}`;
    })
    .join(' ');
}

/**
 * Builds the two markup layers of the pane in the authored 0-100 space:
 *
 * - `lit`: everything that IS glass — shard fills, bright crack hairlines,
 *   hole rims, the crushed zone. Its alpha channel doubles as the height
 *   map source; its color is what the specular glints get added onto.
 * - `under`: shadow work that must never glint — crack far edges (pane
 *   thickness) and the recessed-hole shading — drawn beneath the lit layer.
 *
 * Stroke widths are given in CSS pixels and scaled here: non-scaling
 * strokes resolve against the outer (supersampled) viewport.
 */
function buildLayers(
  impact: Point | null,
  scale: number,
): { lit: string; under: string } {
  const fill = (tag: 'polygon' | 'rect', attrs: string, color: string) =>
    `<${tag} ${attrs} fill="${color}"/>`;
  const stroke = (
    tag: 'polygon' | 'polyline',
    points: string,
    color: string,
    px: number,
  ) =>
    `<${tag} points="${points}" fill="none" stroke="${color}" stroke-width="${px * scale}" vector-effect="non-scaling-stroke"/>`;

  if (impact === null) {
    // The intact sheet: one flat plate, so the light plays a soft sheen
    // across the whole pane and nothing else.
    return {
      lit: fill('rect', 'width="100" height="100"', 'rgba(255,255,255,0.07)'),
      under: '',
    };
  }

  const w = (points: string) => warpPoints(points, impact);

  // Every hole in the pane: the two fallen wedges plus the merged
  // fallen-bit outlines.
  const holes = [
    ...SHARDS.filter((s) => s.fallen).map((s) => w(s.points)),
    ...FALLEN_BIT_RIMS.map(w),
  ];

  const under =
    `<defs>` +
    holes
      .map((p, i) => `<clipPath id="hole${i}"><polygon points="${p}"/></clipPath>`)
      .join('') +
    `</defs>` +
    // Recessed holes: the matte sits behind the glass plane, so it gets a
    // slight overall dim plus an inner shadow hugging the rims (clipped to
    // the hole so the shadow band never bleeds onto the glass).
    holes
      .map(
        (p, i) =>
          `<g clip-path="url(#hole${i})">` +
          fill('polygon', `points="${p}"`, 'rgba(0,0,0,0.14)') +
          `<polygon points="${p}" fill="none" stroke="rgba(0,0,0,0.32)" stroke-width="${5 * scale}" vector-effect="non-scaling-stroke"/>` +
          `</g>`,
      )
      .join('') +
    // Pane thickness: each crack's far edge is in shadow, so a dark line
    // hugs every bright hairline, offset away from the light (top-left).
    `<g transform="translate(0.18,0.18)">` +
    PRIMARY_CRACKS.map((p) => stroke('polyline', w(p), 'rgba(8,10,14,0.32)', 2.2)).join('') +
    SECONDARY_CRACKS.map((p) => stroke('polyline', w(p), 'rgba(8,10,14,0.22)', 1.3)).join('') +
    `</g>`;

  const lit =
    // The mask knocks the fallen bits out of everything painted below:
    // fills, facets, and any cracks crossing them.
    `<defs><mask id="holes" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">` +
    fill('rect', 'width="100" height="100"', '#fff') +
    FALLEN_BITS.map((p) => fill('polygon', `points="${w(p)}"`, '#000')).join('') +
    `</mask>` +
    // The crushed zone's frost: a tight core that dies off fast. Kept
    // small and steep — a wide, even gradient reads as a soft glow blob,
    // not pulverized glass; the micro-cracks carry most of the effect.
    `<radialGradient id="crush" gradientUnits="userSpaceOnUse" cx="${impact.x}" cy="${impact.y}" r="3.5">` +
    `<stop offset="0" stop-color="#fff" stop-opacity="0.18"/>` +
    `<stop offset="0.3" stop-color="#fff" stop-opacity="0.05"/>` +
    `<stop offset="1" stop-color="#fff" stop-opacity="0"/>` +
    `</radialGradient>` +
    `</defs>` +
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
    // Crushed zone: frost plus pulverized micro-cracks, right where the
    // pane was struck. Lives in the lit layer so it sparkles.
    `<circle cx="${impact.x}" cy="${impact.y}" r="3.5" fill="url(#crush)"/>` +
    MICRO_CRACKS.map((p) => stroke('polyline', w(p), 'rgba(235,240,255,0.14)', 0.5)).join('') +
    PRIMARY_CRACKS.map((p) => stroke('polyline', w(p), 'rgba(235,240,255,0.18)', 1.1)).join('') +
    SECONDARY_CRACKS.map((p) => stroke('polyline', w(p), 'rgba(235,240,255,0.12)', 0.7)).join('') +
    `</g>` +
    // Exposed edges of the fallen bits, outside the mask so they stay
    // visible around the tiny holes.
    FALLEN_BIT_RIMS.map((p) => stroke('polygon', w(p), 'rgba(245,248,255,0.35)', 0.8)).join('') +
    // The impact crater itself: a bright speck that stays lit.
    `<circle cx="${impact.x}" cy="${impact.y}" r="0.7" fill="rgba(255,255,255,0.55)"/>`;

  return { lit, under };
}

/** Wraps 0-100 layer markup in a standalone SVG document at pixel size:
    the geometry sits in a nested <svg> stretched over the outer one, and
    non-scaling strokes resolve against the outer pixel viewport. */
function layerSvg(inner: string, width: number, height: number): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<svg width="${width}" height="${height}" viewBox="0 0 100 100" preserveAspectRatio="none">${inner}</svg>` +
    `</svg>`
  );
}

/**
 * No-WebGL fallback: the full pane with the lighting baked in as an SVG
 * filter (the pre-WebGL implementation), rendered once with a static light.
 */
function buildStaticPaneSvg(
  width: number,
  height: number,
  impact: Point | null,
  scale: number,
): string {
  const { lit, under } = buildLayers(impact, scale);
  const nested = (inner: string) =>
    `<svg width="${width}" height="${height}" viewBox="0 0 100 100" preserveAspectRatio="none">${inner}</svg>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<filter id="f" color-interpolation-filters="sRGB">` +
    `<feComponentTransfer in="SourceAlpha" result="boost"><feFuncA type="linear" slope="${ALPHA_BOOST}"/></feComponentTransfer>` +
    `<feGaussianBlur in="boost" stdDeviation="${BLUR_SIGMA * scale}" result="bump"/>` +
    `<feSpecularLighting in="bump" result="light" surfaceScale="${SURFACE_SCALE * scale}" specularConstant="${SPECULAR_CONSTANT}" specularExponent="${SPECULAR_EXPONENT}" lighting-color="#ffffff">` +
    `<feDistantLight azimuth="${DEFAULT_AZIMUTH}" elevation="${DEFAULT_ELEVATION}"/>` +
    `</feSpecularLighting>` +
    `<feComposite in="light" in2="bump" operator="in" result="glints"/>` +
    `<feComposite in="SourceGraphic" in2="glints" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/>` +
    `</filter>` +
    (under ? nested(under) : '') +
    `<g filter="url(#f)">` +
    nested(lit) +
    `</g>` +
    `</svg>`
  );
}

function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  });
}

/**
 * Turns the lit layer's alpha channel into the height map: boost (the
 * geometry is authored at low alpha, which would make the map nearly
 * flat), then a small separable gaussian blur so shard plateaus stay flat
 * while the alpha steps at cracks become thin sharp ridges.
 *
 * Out-of-bounds samples are transparent, like an SVG filter region: the
 * height ramps down at the pane borders, which is what makes the pane
 * edges catch a rim of light.
 */
function buildHeightMap(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  sigma: number,
): Uint8Array {
  const count = width * height;
  const boosted = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    boosted[i] = Math.min(255, rgba[i * 4 + 3]! * ALPHA_BOOST);
  }

  const radius = Math.max(1, Math.round(sigma * 3));
  const weights = new Float32Array(radius + 1);
  let total = 0;
  for (let k = 0; k <= radius; k++) {
    weights[k] = Math.exp(-(k * k) / (2 * sigma * sigma));
    total += k === 0 ? weights[k]! : 2 * weights[k]!;
  }
  for (let k = 0; k <= radius; k++) weights[k]! /= total;

  const horizontal = new Float32Array(count);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let acc = boosted[row + x]! * weights[0]!;
      for (let k = 1; k <= radius; k++) {
        if (x - k >= 0) acc += boosted[row + x - k]! * weights[k]!;
        if (x + k < width) acc += boosted[row + x + k]! * weights[k]!;
      }
      horizontal[row + x] = acc;
    }
  }

  const out = new Uint8Array(count);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let acc = horizontal[y * width + x]! * weights[0]!;
      for (let k = 1; k <= radius; k++) {
        if (y - k >= 0) acc += horizontal[(y - k) * width + x]! * weights[k]!;
        if (y + k < height) acc += horizontal[(y + k) * width + x]! * weights[k]!;
      }
      out[y * width + x] = acc;
    }
  }
  return out;
}

const VERTEX_SHADER = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  // v runs top-down so texture space matches SVG's y-down coordinates.
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

/**
 * The feSpecularLighting / feComposite chain, reimplemented per-fragment:
 * normal from the height map's gradient, Blinn-Phong specular against the
 * light-direction uniform, glints clipped to the bump alpha and added over
 * the lit layer, the whole thing source-over the under layer. All textures
 * are premultiplied; the canvas composites premultiplied output.
 */
const FRAGMENT_SHADER = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uLit;
uniform sampler2D uUnder;
uniform sampler2D uHeight;
uniform vec2 uTexel;
uniform vec3 uLight;
uniform float uSurface;
void main() {
  float hl = texture2D(uHeight, vUv - vec2(uTexel.x, 0.0)).r;
  float hr = texture2D(uHeight, vUv + vec2(uTexel.x, 0.0)).r;
  float hu = texture2D(uHeight, vUv - vec2(0.0, uTexel.y)).r;
  float hd = texture2D(uHeight, vUv + vec2(0.0, uTexel.y)).r;
  float h  = texture2D(uHeight, vUv).r;

  vec3 normal = normalize(vec3(
    -uSurface * (hr - hl) * 0.5,
    -uSurface * (hd - hu) * 0.5,
    1.0
  ));
  vec3 halfway = normalize(uLight + vec3(0.0, 0.0, 1.0));
  float spec = ${SPECULAR_CONSTANT.toFixed(2)} *
    pow(max(dot(normal, halfway), 0.0), ${SPECULAR_EXPONENT.toFixed(1)});
  spec = min(spec, 1.0);

  vec4 src = texture2D(uLit, vUv);
  vec4 lit = clamp(src + vec4(spec) * h, 0.0, 1.0);
  vec4 under = texture2D(uUnder, vUv);
  gl_FragColor = lit + under * (1.0 - lit.a);
}`;

type Renderer = {
  gl: WebGLRenderingContext;
  render: (light: Vec3) => void;
  /** Uploads new pane textures and updates the viewport. */
  setScene: (
    lit: TexImageSource,
    under: TexImageSource | null,
    heightMap: Uint8Array,
    width: number,
    height: number,
    surfaceScale: number,
  ) => void;
  dispose: () => void;
};

function createRenderer(canvas: HTMLCanvasElement): Renderer | null {
  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
  });
  if (!gl) return null;

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const makeTexture = (unit: number) => {
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  };
  const litTexture = makeTexture(0);
  const underTexture = makeTexture(1);
  const heightTexture = makeTexture(2);

  gl.uniform1i(gl.getUniformLocation(program, 'uLit'), 0);
  gl.uniform1i(gl.getUniformLocation(program, 'uUnder'), 1);
  gl.uniform1i(gl.getUniformLocation(program, 'uHeight'), 2);
  const uTexel = gl.getUniformLocation(program, 'uTexel');
  const uLight = gl.getUniformLocation(program, 'uLight');
  const uSurface = gl.getUniformLocation(program, 'uSurface');

  gl.disable(gl.BLEND);
  gl.clearColor(0, 0, 0, 0);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  let ready = false;

  return {
    gl,
    setScene(lit, under, heightMap, width, height, surfaceScale) {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, litTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, lit);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, underTexture);
      if (under) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, under);
      } else {
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(
          gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
          new Uint8Array([0, 0, 0, 0]),
        );
      }

      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, heightTexture);
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.LUMINANCE, width, height, 0,
        gl.LUMINANCE, gl.UNSIGNED_BYTE, heightMap,
      );

      gl.viewport(0, 0, width, height);
      gl.uniform2f(uTexel, 1 / width, 1 / height);
      gl.uniform1f(uSurface, surfaceScale);
      ready = true;
    },
    render(light) {
      if (!ready) return;
      gl.uniform3f(uLight, light[0], light[1], light[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose() {
      gl.deleteTexture(litTexture);
      gl.deleteTexture(underTexture);
      gl.deleteTexture(heightTexture);
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
    },
  };
}

export function BrokenGlassShine({ className }: { className?: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const rendererRef = React.useRef<Renderer | null>(null);
  const rendererFailedRef = React.useRef(false);

  /** Impact point in viewBox (0-100) coordinates; null while intact. */
  const [impact, setImpact] = React.useState<Point | null>(null);

  /** Pane size in CSS pixels; the rasterization target. */
  const [size, setSize] = React.useState<{ width: number; height: number } | null>(
    null,
  );

  // Light state lives in refs: it changes every pointer frame and must not
  // re-render React. `current` eases toward `target` in a rAF loop that
  // only runs while they differ.
  const lightRef = React.useRef({
    current: lightVector(DEFAULT_AZIMUTH, DEFAULT_ELEVATION),
    pointer: null as Point | null,
    raf: 0,
  });

  // Measure the pane and re-measure on resize. Debounced: every new size
  // means one fresh rasterization of the pane textures, so don't churn
  // through intermediate sizes mid-drag.
  React.useEffect(() => {
    const pane = canvasRef.current;
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
    const pane = canvasRef.current;
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

      // A blink of white as the pane lets go: breaking glass is an event,
      // not a state change. Barely-there — it should register as a flicker
      // of light, not a camera flash. Skipped under reduced motion.
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        pane.animate(
          [
            { backgroundColor: 'rgba(255,255,255,0.12)' },
            { backgroundColor: 'rgba(255,255,255,0)' },
          ],
          { duration: 110, easing: 'ease-out' },
        );
      }

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

  // Rebuild the pane textures whenever its state changes: rasterize the
  // lit and under layers, derive the height map, hand everything to the
  // renderer, and draw once with the current light.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size) return;

    // Supersample at the device ratio (capped at 2x: past that the extra
    // detail buys nothing visible).
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(size.width * scale);
    const height = Math.round(size.height * scale);
    if (!width || !height) return;

    let cancelled = false;

    const run = async () => {
      if (!rendererRef.current && !rendererFailedRef.current) {
        rendererRef.current = createRenderer(canvas);
        if (!rendererRef.current) rendererFailedRef.current = true;
      }
      const renderer = rendererRef.current;

      if (!renderer) {
        // Fallback: static SVG-filter render drawn via 2D context.
        const image = await loadSvgImage(
          buildStaticPaneSvg(width, height, impact, scale),
        );
        if (cancelled) return;
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.drawImage(image, 0, 0);
        return;
      }

      const { lit, under } = buildLayers(impact, scale);
      const [litImage, underImage] = await Promise.all([
        loadSvgImage(layerSvg(lit, width, height)),
        under ? loadSvgImage(layerSvg(under, width, height)) : null,
      ]);
      if (cancelled) return;

      // Rasterize through a scratch canvas: a 1:1 draw at the exact pixel
      // size, so every engine samples the same detail (WebKit rasterizes
      // SVG images at low resolution when any scaling is involved).
      const scratch = document.createElement('canvas');
      scratch.width = width;
      scratch.height = height;
      const ctx = scratch.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(litImage, 0, 0);
      const heightMap = buildHeightMap(
        ctx.getImageData(0, 0, width, height).data,
        width,
        height,
        BLUR_SIGMA * scale,
      );

      canvas.width = width;
      canvas.height = height;

      let underSource: TexImageSource | null = null;
      const litSource = scratch;
      if (underImage) {
        const underScratch = document.createElement('canvas');
        underScratch.width = width;
        underScratch.height = height;
        underScratch.getContext('2d')?.drawImage(underImage, 0, 0);
        underSource = underScratch;
      }

      renderer.setScene(
        litSource,
        underSource,
        heightMap,
        width,
        height,
        SURFACE_SCALE * scale,
      );
      renderer.render(lightRef.current.current);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [size, impact]);

  // Dynamic light: the direction eases toward the cursor, so glints sweep
  // across the crack ridges as the pointer moves — a distant light steered
  // by the pointer, not a point light, so there is never a hotspot blob.
  // Each step is one cheap draw call, and the loop stops as soon as the
  // light settles. Mouse-only, and skipped under reduced motion.
  React.useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const state = lightRef.current;

    const targetLight = (): Vec3 => {
      if (!state.pointer) return lightVector(DEFAULT_AZIMUTH, DEFAULT_ELEVATION);
      const box = canvas.getBoundingClientRect();
      const dx = state.pointer.x - (box.left + box.width / 2);
      const dy = state.pointer.y - (box.top + box.height / 2);
      const azimuth = (Math.atan2(dy, dx) * 180) / Math.PI;
      // Elevation rises as the cursor closes in on the pane: nearly-grazing
      // light from far away, a higher, softer angle up close. Capped well
      // below overhead — at high elevations the flat plates blow out.
      const reach = Math.hypot(window.innerWidth, window.innerHeight) / 2;
      const proximity = 1 - Math.min(1, Math.hypot(dx, dy) / reach);
      const elevation = 22 + 20 * proximity;
      return lightVector(azimuth, elevation);
    };

    const step = () => {
      const target = targetLight();
      const current = state.current;
      const eased: Vec3 = [
        current[0] + (target[0] - current[0]) * 0.14,
        current[1] + (target[1] - current[1]) * 0.14,
        current[2] + (target[2] - current[2]) * 0.14,
      ];
      const length = Math.hypot(eased[0], eased[1], eased[2]) || 1;
      state.current = [eased[0] / length, eased[1] / length, eased[2] / length];
      rendererRef.current?.render(state.current);

      const settled =
        Math.abs(target[0] - state.current[0]) < 0.001 &&
        Math.abs(target[1] - state.current[1]) < 0.001 &&
        Math.abs(target[2] - state.current[2]) < 0.001;
      state.raf = settled ? 0 : requestAnimationFrame(step);
    };

    const kick = () => {
      if (!state.raf) state.raf = requestAnimationFrame(step);
    };
    const onMove = (event: PointerEvent) => {
      state.pointer = { x: event.clientX, y: event.clientY };
      kick();
    };
    const onLeave = () => {
      state.pointer = null;
      kick();
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      if (state.raf) cancelAnimationFrame(state.raf);
      state.raf = 0;
    };
  }, []);

  // Tear the renderer down with the component.
  React.useEffect(
    () => () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    },
    [],
  );

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none ${className ?? ''}`}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
