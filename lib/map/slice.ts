/**
 * Walking a route by distance.
 *
 * Extracted from the map component so the tests can exercise *this* code. The
 * first version of the regression test kept its own copy of the arithmetic,
 * which meant it would have stayed green if the production clamp were deleted —
 * the same fault as a mirror that only ever agrees with itself, and the thing
 * the crash below was supposed to be pinned by.
 */

export type Point = [number, number];

/**
 * Cumulative distance along the route, in metres.
 *
 * Degrees scaled to metres at Korea's latitude. It only has to be good enough
 * to pace an animation evenly: stepping one array index per frame would race
 * through the dense curves and crawl down the straight motorway, because the
 * simplifier leaves points where the road bends and removes them where it does
 * not.
 */
export function cumulative(points: Point[]): { cum: number[]; total: number } {
  const cum = [0];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    total += Math.hypot((bx - ax) * 88_800, (by - ay) * 111_000);
    cum.push(total);
  }
  return { cum, total };
}

/**
 * The path up to `metres`, with the final point interpolated.
 *
 * Clamped to the route, and that clamp is the whole point of this function
 * existing separately. Playing a drive threw `undefined is not iterable` in
 * production and never once locally: `requestAnimationFrame` hands back the
 * time the frame *began*, which can precede the `performance.now()` captured
 * just before the frame was requested, so the elapsed time — and the distance
 * derived from it — came out negative and this reached for `points[-1]`.
 *
 * Guarding that index alone would only have moved the fault, because a negative
 * distance then interpolates backwards and puts the car off the end of the
 * road. Clamping answers both and makes the function total: a caller should not
 * have to know it has a domain.
 */
export function sliceTo(
  points: Point[],
  cum: number[],
  total: number,
  metres: number,
): Point[] {
  const along = Math.min(total, Math.max(0, metres));
  const out: Point[] = [];

  for (let i = 0; i < points.length; i += 1) {
    if (cum[i] <= along) out.push(points[i]);
    else {
      const span = cum[i] - cum[i - 1];
      const k = span > 0 ? (along - cum[i - 1]) / span : 0;
      const [ax, ay] = points[i - 1];
      const [bx, by] = points[i];
      out.push([ax + (bx - ax) * k, ay + (by - ay) * k]);
      break;
    }
  }

  return out.length ? out : [points[0]];
}
