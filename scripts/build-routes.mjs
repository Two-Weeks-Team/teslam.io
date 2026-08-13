#!/usr/bin/env node
/**
 * Generate the drive routes the map animates.
 *
 *   node scripts/build-routes.mjs > lib/map/routes.ts
 *
 * The routes are road geometry from OSRM, not lines drawn between two points.
 * That distinction is the entire feature: the map zooms until individual roads
 * are visible, and a hand-plotted polyline would visibly sit in a field next to
 * the motorway it claims to be. Snapping to the real network is what makes the
 * close zoom worth having.
 *
 * Run once; the output is committed. Nothing calls a routing service at build
 * or at runtime — a page that needs a third party's API to draw its own content
 * is a page that is sometimes blank.
 *
 * IMPORTANT: these are illustrative drives, not anybody's travel history.
 * teslam.io does not collect coordinates (see `/privacy`), so there is no real
 * route data to draw and this file must never be presented as one. The UI
 * labels it as a simulation.
 *
 * Routing: OSRM public demo (router.project-osrm.org), OpenStreetMap data, ODbL.
 */

/** Origin → destination pairs, chosen to be drives Korean owners actually make. */
const TRIPS = [
  {
    id: "seoul-gangneung",
    ko: "서울 → 강릉",
    en: "Seoul → Gangneung",
    note: { ko: "영동고속도로", en: "Yeongdong Expressway" },
    from: [127.0276, 37.4979],
    to: [128.8961, 37.7519],
  },
  {
    id: "pangyo-giheung",
    ko: "판교 → 기흥",
    en: "Pangyo → Giheung",
    note: { ko: "경부고속도로 · 슈퍼차저", en: "Gyeongbu Expressway · Supercharger" },
    from: [127.1119, 37.3947],
    to: [127.1157, 37.2751],
  },
  {
    id: "busan-coast",
    ko: "해운대 → 광안리",
    en: "Haeundae → Gwangalli",
    note: { ko: "광안대교", en: "Gwangan Bridge" },
    from: [129.1603, 35.1587],
    to: [129.1188, 35.1532],
  },
  {
    id: "jeju-coast",
    ko: "제주시 → 성산",
    en: "Jeju City → Seongsan",
    note: { ko: "일주동로", en: "Coastal road" },
    from: [126.5219, 33.5097],
    to: [126.9269, 33.4589],
  },
];

const OSRM = "https://router.project-osrm.org/route/v1/driving";

/** Douglas–Peucker on lon/lat, tolerance in degrees. */
function simplify(points, tolerance) {
  if (points.length < 3) return points;

  let maxDist = 0;
  let index = 0;
  const [ax, ay] = points[0];
  const [bx, by] = points[points.length - 1];
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;

  for (let i = 1; i < points.length - 1; i += 1) {
    const [px, py] = points[i];
    const dist = Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist <= tolerance) return [points[0], points[points.length - 1]];
  return [
    ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(index), tolerance),
  ];
}

const routes = [];

for (const trip of TRIPS) {
  const url =
    `${OSRM}/${trip.from.join(",")};${trip.to.join(",")}` +
    "?overview=full&geometries=geojson";
  const res = await fetch(url);
  const body = await res.json();
  if (body.code !== "Ok") throw new Error(`${trip.id}: ${body.code}`);

  const route = body.routes[0];

  /*
   * ~1e-4 degrees is around 10 metres at this latitude — under a lane width,
   * so the line still sits on the carriageway at the closest zoom the map
   * allows, while dropping most of the 2,780 points a full motorway returns.
   */
  const points = simplify(route.geometry.coordinates, 1e-4).map(([lon, lat]) => [
    Math.round(lon * 1e5) / 1e5,
    Math.round(lat * 1e5) / 1e5,
  ]);

  routes.push({
    ...trip,
    points,
    km: Math.round(route.distance / 100) / 10,
    minutes: Math.round(route.duration / 60),
  });
}

const body = routes
  .map(
    (r) => `  {
    id: ${JSON.stringify(r.id)},
    label: { ko: ${JSON.stringify(r.ko)}, en: ${JSON.stringify(r.en)} },
    note: { ko: ${JSON.stringify(r.note.ko)}, en: ${JSON.stringify(r.note.en)} },
    km: ${r.km},
    minutes: ${r.minutes},
    points: ${JSON.stringify(r.points)},
  },`,
  )
  .join("\n");

process.stdout.write(`/**
 * Illustrative drive routes, snapped to the real road network.
 *
 * Generated — do not edit by hand:
 *
 *   node scripts/build-routes.mjs > lib/map/routes.ts
 *
 * Geometry from OSRM over OpenStreetMap data (ODbL), simplified to about ten
 * metres so the line still sits on the carriageway at the closest zoom.
 *
 * These are NOT anybody's travel history. teslam.io does not collect
 * coordinates — \`/privacy\` and the registration form both say so — which means
 * there is no real route data in existence to draw. Every surface that renders
 * these must label them as a simulation, and \`tests/routes.test.ts\` asserts
 * that the labelling copy exists.
 */

export type Route = {
  id: string;
  label: { ko: string; en: string };
  note: { ko: string; en: string };
  km: number;
  minutes: number;
  /** [lon, lat] pairs along the road. */
  points: Array<[number, number]>;
};

export const ROUTES: Route[] = [
${body}
];
`);
