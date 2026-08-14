import { ROUTES } from "@/lib/map/routes";
import { cumulative, pointAt, type Point } from "@/lib/map/slice";

/**
 * Dozens of cars on the road at once.
 *
 * One car tracing one line reads as a diagram. A fleet moving across the whole
 * country at the same time reads as a service running — which is the thing the
 * page is actually trying to convey, and the thing a visitor is being asked to
 * join.
 *
 * Every car is a position on a real road at a given moment, derived from the
 * same road geometry the single-drive view uses. Nothing here is anybody's
 * travel history: teslam.io collects no coordinates, so these are illustrative
 * and every surface that draws them says so.
 */

export type Car = {
  id: number;
  /** Index into `ROUTES`. */
  route: number;
  /** Metres along the route at t = 0. */
  offset: number;
  /** Metres per second. */
  speed: number;
};

/** Deterministic, so the fleet looks the same on every load and in every test. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100_000) / 100_000;
  };
}

/** Cumulative distances per route, computed once. */
export const LEGS = ROUTES.map((r) => cumulative(r.points));

/**
 * How many cars share each route.
 *
 * Weighted by length so a 205km motorway carries several and a 4.6km hop
 * across Busan carries one — otherwise the short routes turn into a knot of
 * dots orbiting the same corner while the long ones look deserted.
 */
export function buildFleet(): Car[] {
  const random = seeded(0x51ee7);
  const cars: Car[] = [];
  let id = 0;

  ROUTES.forEach((route, index) => {
    const count = Math.max(2, Math.min(7, Math.round(route.km / 26) + 2));
    const { total } = LEGS[index];

    for (let i = 0; i < count; i += 1) {
      cars.push({
        id: (id += 1),
        route: index,
        // Spread along the route, then jittered: evenly spaced cars move like
        // a chain of buckets rather than like traffic.
        offset: total * ((i + random() * 0.8) / count),
        // Motorway cars move faster than the ones crossing a city. Playback is
        // compressed heavily — a real 205km drive is three hours.
        speed: (route.km > 80 ? 900 : route.km > 20 ? 520 : 240) * (0.8 + random() * 0.5),
      });
    }
  });

  return cars;
}

export const FLEET = buildFleet();

/** Where every car is at `seconds`, wrapping so the roads never empty. */
export function fleetAt(seconds: number): Array<{ car: Car; at: Point }> {
  return FLEET.map((car) => {
    const { cum, total } = LEGS[car.route];
    // Modulo, so a car that finishes reappears at the start. The alternative
    // is a map that drains as it plays.
    const along = total > 0 ? (car.offset + seconds * car.speed) % total : 0;
    return { car, at: pointAt(ROUTES[car.route].points, cum, total, along) };
  });
}
