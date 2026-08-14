import { describe, expect, it } from "vitest";
import { ROUTES } from "@/lib/map/routes";
import { cumulative, sliceTo } from "@/lib/map/slice";

/**
 * Slicing a route at a distance.
 *
 * This is the arithmetic the map animation runs sixty times a second, and it
 * shipped with a hole in its domain: below zero it reached for the point before
 * the first one and threw `undefined is not iterable`. Nothing local ever
 * produced a negative distance, and the first click in production did —
 * `requestAnimationFrame` hands back the time the frame began, which can
 * predate the `performance.now()` captured moments earlier.
 *
 * These call the shipped functions. The first version of this file kept its own
 * copy of the algorithm, which would have stayed green if the production clamp
 * were deleted — a test agreeing with itself, which is the exact fault the
 * crash was supposed to be pinned by. Review caught it; it deserved to.
 */

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
