#!/usr/bin/env node
/**
 * Generate the region outlines the density map draws.
 *
 *   node scripts/build-map.mjs <skorea-provinces-geo.json>  > lib/map/regions.ts
 *
 * The map used to be seven hand-drawn blobs. They were defensible as a
 * schematic and indefensible as a picture of Korea: a reader who lives in one
 * of those regions could not find it. This turns the real administrative
 * boundaries into the same seven shapes, so the drawing is a map and the
 * schematic argument is retired.
 *
 * Source: github.com/southkorea/southkorea-maps (KOSTAT 2018, public data).
 * Run once; the output is committed. Nothing fetches at build or at runtime —
 * a page that needs the network to draw its own country is a page that
 * sometimes does not.
 */
import { readFileSync } from "node:fs";

/** Province codes, grouped into the seven regions `lib/genesis.ts` defines. */
const REGIONS = {
  capital: ["11", "23", "31"], // 서울 · 인천 · 경기
  gangwon: ["32"],
  chungcheong: ["25", "29", "33", "34"], // 대전 · 세종 · 충북 · 충남
  daegu: ["22", "37"], // 대구 · 경북
  jeolla: ["24", "35", "36"], // 광주 · 전북 · 전남
  busan: ["21", "26", "38"], // 부산 · 울산 · 경남
  jeju: ["39"],
};

const geo = JSON.parse(readFileSync(process.argv[2], "utf8"));

/* ── projection ───────────────────────────────────────────────────────── */

// Equirectangular with a cosine correction at Korea's latitude. A full Mercator
// would buy nothing across five degrees of latitude and would stretch the north
// against the south for no reason a reader could see.
const LAT0 = (36 * Math.PI) / 180;
const project = ([lon, lat]) => [lon * Math.cos(LAT0), lat];

/* ── simplification ───────────────────────────────────────────────────── */

/**
 * Douglas–Peucker.
 *
 * The raw boundaries are 7.5MB. Uncompressed they would be the largest thing
 * on the page by an order of magnitude, to draw a shape 300 pixels wide — so
 * the ring is thinned until the error is smaller than a pixel at the size it
 * is actually rendered.
 */
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

/**
 * Simplify a closed ring.
 *
 * Douglas–Peucker measures every point against the line from the first to the
 * last, and on a closed ring those are the same point — the baseline has no
 * length, every distance degenerates, and the whole coastline collapses to two
 * points. Gangwon came out of the first run as a single straight line.
 *
 * Splitting at the point furthest from the start gives two open chains with
 * real baselines, which is the shape the algorithm is actually defined for.
 */
function simplifyRing(ring, tolerance) {
  const open = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice(0, -1)
      : ring;
  if (open.length < 4) return open;

  let far = 0;
  let farDist = -1;
  for (let i = 1; i < open.length; i += 1) {
    const d = Math.hypot(open[i][0] - open[0][0], open[i][1] - open[0][1]);
    if (d > farDist) {
      farDist = d;
      far = i;
    }
  }

  const front = simplify(open.slice(0, far + 1), tolerance);
  const back = simplify([...open.slice(far), open[0]], tolerance);
  return [...front.slice(0, -1), ...back.slice(0, -1)];
}

/** Rough ring area, for dropping islands too small to survive as a mark. */
const area = (ring) => {
  let a = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2);
};

/* ── collect ──────────────────────────────────────────────────────────── */

/** Every outer ring of a feature, whatever its geometry type. */
function rings(geometry) {
  if (geometry.type === "Polygon") return [geometry.coordinates[0]];
  if (geometry.type === "MultiPolygon") return geometry.coordinates.map((p) => p[0]);
  throw new Error(`unhandled geometry ${geometry.type}`);
}

const byRegion = new Map(Object.keys(REGIONS).map((id) => [id, []]));

for (const feature of geo.features) {
  const code = feature.properties.code;
  const region = Object.entries(REGIONS).find(([, codes]) => codes.includes(code));
  if (!region) throw new Error(`province ${code} belongs to no region`);
  byRegion.get(region[0]).push(...rings(feature.geometry).map((r) => r.map(project)));
}

/* ── fit ──────────────────────────────────────────────────────────────── */

const all = [...byRegion.values()].flat().flat();
const xs = all.map((p) => p[0]);
const ys = all.map((p) => p[1]);
const minX = Math.min(...xs);
const maxX = Math.max(...xs);
const minY = Math.min(...ys);
const maxY = Math.max(...ys);

// Fitted to a 100-unit tall box, north up: SVG's y grows downward and latitude
// does not.
const H = 100;
const scale = H / (maxY - minY);
const W = Math.round((maxX - minX) * scale * 100) / 100;

const toBox = ([x, y]) => [(x - minX) * scale, (maxY - y) * scale];

/* ── emit ─────────────────────────────────────────────────────────────── */

// One decimal is a tenth of a unit on a 100-unit box — below a pixel at any
// size this is drawn, and it halves the file against two.
const round = (n) => Math.round(n * 10) / 10;

const paths = {};
const centres = {};

for (const [id, regionRings] of byRegion) {
  const kept = regionRings
    .map((ring) => ring.map(toBox))
    // 0.35 square units: an island smaller than this renders as a speck that
    // reads as a stray mark rather than as land.
    .filter((ring) => area(ring) > 0.35)
    .map((ring) => simplifyRing(ring, 0.14))
    // A ring thinned below three points is not a shape.
    .filter((ring) => ring.length >= 3);

  paths[id] = kept
    .map(
      (ring) =>
        `M${ring.map(([x, y]) => `${round(x)} ${round(y)}`).join("L")}Z`,
    )
    .join("");

  // The count sits on the mainland body, so the anchor comes from the largest
  // ring only. Averaging every ring would drag Gyeongbuk's label out to sea
  // toward Ulleungdo.
  const main = kept.reduce((a, b) => (area(b) > area(a) ? b : a));
  const cx = main.reduce((s, p) => s + p[0], 0) / main.length;
  const cy = main.reduce((s, p) => s + p[1], 0) / main.length;
  centres[id] = [round(cx), round(cy)];
}

const body = Object.entries(paths)
  .map(([id, d]) => `  ${id}: "${d}",`)
  .join("\n");

const centreBody = Object.entries(centres)
  .map(([id, [x, y]]) => `  ${id}: [${x}, ${y}],`)
  .join("\n");

process.stdout.write(`/**
 * South Korea, by the seven regions registration asks about.
 *
 * Generated — do not edit by hand:
 *
 *   node scripts/build-map.mjs <skorea-provinces-2018-geo.json> > lib/map/regions.ts
 *
 * Boundaries are KOSTAT 2018 via github.com/southkorea/southkorea-maps,
 * merged to the region groups in \`lib/genesis.ts\`, projected
 * equirectangular with a cosine correction at 36°N, and simplified to a
 * tolerance below one rendered pixel. Committed rather than fetched: a map
 * that needs the network to draw is a map that is sometimes missing.
 */

/** viewBox for the paths below. North is up. */
export const MAP_VIEWBOX = "0 0 ${W} ${H}";

export const REGION_PATHS: Record<string, string> = {
${body}
};

/** Where a region's count sits: the centroid of its largest landmass. */
export const REGION_CENTRES: Record<string, [number, number]> = {
${centreBody}
};
`);
