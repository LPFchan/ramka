/**
 * Morph-group border-radius sampling.
 *
 * `resolveMorphBorderRadius` writes used px on each endpoint. Interpolating
 * those px directly is a no-op when both ends share a pixel value — stories'
 * `1.75rem` stage and a 56px `rounded-full` avatar are both 28px — so a
 * shrinking 9:16 stays a rounded rectangle until the box itself is tiny.
 *
 * Roundness (`r / min(w, h)`) is the shape the user sees: slightly rounded
 * rect → circle. Endpoints still match the measured px; only the mid-morph
 * path changes.
 *
 * The composited morph freezes the group at the destination box `(w1, h1)`
 * and scales it, so the sampled value is re-expressed as elliptical
 * `rx / ry` in that local space (same compensation as before).
 */

export type MorphRadiusCorners = [number, number, number, number];

const fmt = (n: number) => Number(n.toFixed(4));

const lerp = (a: number, b: number, q: number) => a + (b - a) * q;

/** Expand a `12px` / four-corner px list into `[tl, tr, br, bl]`. */
export function parseMorphRadiusList(value: string): MorphRadiusCorners {
  const tokens = value
    .trim()
    .split(/\s+/)
    .map((t) => Number.parseFloat(t))
    .filter((n) => Number.isFinite(n) && n >= 0);
  const [a = 0, b = a, c = a, d = b] = tokens;
  return [a, b, c, d];
}

function roundness(r: number, minSide: number): number {
  return minSide > 0 ? r / minSide : 0;
}

/**
 * Compensated `border-radius` for the frozen morph box at eased progress `q`.
 * `w`/`h` are the interpolated box at `q`.
 *
 * `w1`/`h1` are the **radius endpoint** box (where `rTo` was measured).
 * `restW`/`restH` are the box the element actually rests at — the one the
 * animated scale divides out of. They are the same box for the view-transition
 * group, which freezes at the destination, and for a FLIP *open*, whose
 * destination is also its resting box. They diverge on a FLIP *close*, where
 * the element rests at the item box but the radius travels toward the
 * trigger's; default to `w1`/`h1` so existing callers are unaffected.
 */
export function compensatedMorphRadiusAt(
  rFrom: MorphRadiusCorners,
  rTo: MorphRadiusCorners,
  q: number,
  box: {
    w0: number;
    h0: number;
    w: number;
    h: number;
    w1: number;
    h1: number;
    restW?: number;
    restH?: number;
  },
): string {
  const { w0, h0, w, h, w1, h1 } = box;
  const restW = box.restW ?? w1;
  const restH = box.restH ?? h1;
  const min0 = Math.min(w0, h0);
  const min1 = Math.min(w1, h1);
  const minQ = Math.min(w, h);
  const divW = w > 0 ? w : 1;
  const divH = h > 0 ? h : 1;

  const rUa = rFrom.map((r, c) => {
    const n = lerp(roundness(r, min0), roundness(rTo[c]!, min1), q);
    return n * minQ;
  });

  const rH = rUa.map((r) => fmt((r * restW) / divW));
  const rV = rUa.map((r) => fmt((r * restH) / divH));
  return `${rH.map((px) => `${px}px`).join(' ')} / ${rV.map((px) => `${px}px`).join(' ')}`;
}
