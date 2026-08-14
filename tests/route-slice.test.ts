import { describe, expect, it } from "vitest";
import { ROUTES } from "@/lib/map/routes";

/**
 * Slicing a route at a distance.
 *
 * This is the arithmetic the map animation runs sixty times a second, and it
 * shipped with a hole in its domain: below zero it reached for the point
 * before the first one and threw `undefined is not iterable`. Nothing local
 * ever produced a negative distance, and the first click in production did —
 * `requestAnimationFrame` hands back the time the frame began, which can
 * predate the `performance.now()` captured moments earlier.
 *
 * The component now clamps, but the function is tested as total regardless. A
 * caller should not have to know it has a domain.
 */

/** The same walk the component does, kept here so the maths can be tested. */
function cumulative(points: Array<[number, number]>) {
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

function sliceTo(
  points: Array<[number, number]>,
  cum: number[],
  total: number,
  metres: number,
) {
  const along = Math.min(total, Math.max(0, metres));
  const out: Array<[number, number]> = [];
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

describe("slicing a route", () => {
  for (const route of ROUTES) {
    describe(route.id, () => {
      const { cum, total } = cumulative(route.points);

      it("survives a distance below zero", () => {
        // The exact production crash. A negative elapsed time is not a
        // hypothetical: rAF produced one on the first click.
        for (const metres of [-1, -0.0001, -1e6]) {
          expect(() => sliceTo(route.points, cum, total, metres)).not.toThrow();
          // And it must not extrapolate backwards off the start of the road,
          // which is what guarding the index alone would have allowed.
          const head = sliceTo(route.points, cum, total, metres).at(-1)!;
          expect(head).toEqual(route.points[0]);
        }
      });

      it("starts at the first point and ends at the last", () => {
        expect(sliceTo(route.points, cum, total, 0)[0]).toEqual(route.points[0]);
        const whole = sliceTo(route.points, cum, total, total);
        expect(whole).toHaveLength(route.points.length);
        expect(whole[whole.length - 1]).toEqual(route.points[route.points.length - 1]);
      });

      it("never runs past the end", () => {
        const past = sliceTo(route.points, cum, total, total * 4);
        expect(past).toHaveLength(route.points.length);
      });

      it("only grows as the distance grows", () => {
        let previous = 0;
        for (let m = 0; m <= total; m += Math.max(1, total / 40)) {
          const length = sliceTo(route.points, cum, total, m).length;
          expect(length).toBeGreaterThanOrEqual(previous);
          previous = length;
        }
      });

      it("puts the moving point on the line", () => {
        // Halfway along, the interpolated head must sit inside the route's
        // bounding box — a sign error would put the car in the sea.
        const head = sliceTo(route.points, cum, total, total / 2).at(-1)!;
        const lons = route.points.map((p) => p[0]);
        const lats = route.points.map((p) => p[1]);
        expect(head[0]).toBeGreaterThanOrEqual(Math.min(...lons));
        expect(head[0]).toBeLessThanOrEqual(Math.max(...lons));
        expect(head[1]).toBeGreaterThanOrEqual(Math.min(...lats));
        expect(head[1]).toBeLessThanOrEqual(Math.max(...lats));
      });
    });
  }
});
