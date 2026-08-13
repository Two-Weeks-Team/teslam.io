import { SEATS } from "@/lib/genesis";

/**
 * The cohort, as a car.
 *
 * Five hundred seats were drawn as five hundred squares. The number was right
 * and the picture said nothing: a grid of squares is a grid of squares whether
 * it stands for seats, days or pixels, and at zero taken it read as a widget
 * that had failed to load.
 *
 * So the cohort is the thing it is a cohort of. Each seat is one cell on the
 * surface of a car, the cells are grouped into panels, and confirming a seat
 * lights the next cell — the car assembles itself, nose first, as the cohort
 * fills. Empty, it is a wireframe of a car nobody has built yet, which is a
 * truer picture of the state than five hundred grey squares.
 *
 * The shape is generated, not modelled. Nothing here is a manufacturer's
 * geometry: it is a lofted fastback silhouette built from two profile curves,
 * which is what lets it ship as maths in a few hundred bytes instead of an
 * asset, and keeps the site clear of anyone's 3D data. teslam.io is not
 * affiliated with Tesla, Inc. and its drawings should not pretend otherwise.
 */

export type Part =
  | "nose"
  | "hood"
  | "wheelFrontL"
  | "wheelFrontR"
  | "cabin"
  | "doorL"
  | "doorR"
  | "rear"
  | "wheelRearL"
  | "wheelRearR"
  | "tail";

/**
 * Assembly order, and how many of the five hundred each panel gets.
 *
 * Weighted by how much of the car a panel actually is, then ordered the way a
 * car is read — front to back — so that a cohort filling up looks like
 * something being built rather than something being shaded in. The two
 * front wheels come early because a car with no wheels does not look like a
 * car at any fill level, and the first registrants would be watching the
 * least legible version of the picture.
 */
const PLAN: Array<[Part, number]> = [
  ["nose", 26],
  ["hood", 44],
  ["wheelFrontL", 26],
  ["wheelFrontR", 26],
  ["doorL", 62],
  ["doorR", 62],
  ["cabin", 92],
  ["rear", 52],
  ["wheelRearL", 26],
  ["wheelRearR", 26],
  ["tail", 58],
];

export type Cell = {
  /** Seat ordinal, 1-based. Cell n lights when seat n is confirmed. */
  seat: number;
  part: Part;
  x: number;
  y: number;
  z: number;
  /**
   * Outward surface normal at this cell.
   *
   * Carried rather than derived in the shader because the surface is known
   * here analytically and is only guessable there. It buys the renderer a rim
   * light, which is most of what makes a field of flat billboards read as a
   * body with a shoulder line.
   */
  nx: number;
  ny: number;
  nz: number;
};

/* ── the silhouette ───────────────────────────────────────────────────── */

/** Linear ramp between two points on the profile. */
function ramp(t: number, a: number, b: number, ya: number, yb: number): number {
  const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
  // Smoothstep rather than a straight line: a fastback's transitions are the
  // whole silhouette, and straight segments meeting at angles read as a wedge.
  return ya + (yb - ya) * k * k * (3 - 2 * k);
}

/**
 * Roofline height at t, where t = 0 is the tail and t = 1 is the nose.
 *
 * The numbers are a fastback saloon in profile: a long rear glass falling from
 * a roof that peaks just behind the driver, and a short blunt nose. Read them
 * as a curve, not as measurements of anything.
 */
function roof(t: number): number {
  if (t < 0.06) return ramp(t, 0, 0.06, 0.3, 0.36);
  if (t < 0.3) return ramp(t, 0.06, 0.3, 0.36, 0.43);
  if (t < 0.52) return ramp(t, 0.3, 0.52, 0.43, 0.62);
  if (t < 0.64) return 0.62;
  if (t < 0.82) return ramp(t, 0.64, 0.82, 0.62, 0.42);
  if (t < 0.94) return ramp(t, 0.82, 0.94, 0.42, 0.37);
  return ramp(t, 0.94, 1, 0.37, 0.31);
}

/** Sill height — where the body stops and the air under the car begins. */
function sill(t: number): number {
  if (t < 0.08) return ramp(t, 0, 0.08, 0.19, 0.15);
  if (t > 0.92) return ramp(t, 0.92, 1, 0.15, 0.19);
  return 0.15;
}

/** Half-width at t. Full through the middle, tapered at both ends. */
function halfWidth(t: number): number {
  const s = 2 * t - 1;
  return 0.4 * Math.sqrt(Math.max(0, 1 - s * s * s * s));
}

/**
 * A point on the body shell at length t and angle v around the section.
 *
 * The section is a superellipse rather than a circle: a car's cross-section is
 * closer to a rounded rectangle, and a circular loft gives a smooth tube that
 * reads as a submarine.
 */
type Point = { p: [number, number, number]; n: [number, number, number] };

function shell(t: number, v: number, cabin: boolean): Point {
  const top = roof(t);
  const bottom = sill(t);
  const cy = (top + bottom) / 2;
  const ry = (top - bottom) / 2;
  // The greenhouse is inset from the shoulder line, which is most of what makes
  // a car look like a car from three-quarters on.
  const rz = halfWidth(t) * (cabin ? 0.78 : 1);

  const a = v * Math.PI * 2;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const p = 0.62;

  const y = cy + ry * Math.sign(s) * Math.abs(s) ** p;
  const z = rz * Math.sign(c) * Math.abs(c) ** p;

  // Outward from the section's own axis. The x term comes from how fast the
  // body tapers, so the nose and tail cells face forward rather than sideways.
  const taper = (halfWidth(Math.min(1, t + 0.02)) - halfWidth(Math.max(0, t - 0.02))) / 0.04;
  const nx = -taper * 0.35;
  const ny = ry > 0 ? (y - cy) / ry : 0;
  const nz = rz > 0 ? z / rz : 0;
  const len = Math.hypot(nx, ny, nz) || 1;

  return {
    p: [2 * t - 1, y, z],
    n: [nx / len, ny / len, nz / len],
  };
}

/**
 * A wheel: two concentric rings standing in the XY plane.
 *
 * Two rings rather than one, so a wheel reads as a wheel and not as a hoop —
 * and each ring closed exactly once. The first version advanced the angle by
 * three full turns across the cell count, which drew a spiral: from the side
 * the wheels came out as scribbles, which is the sort of thing that only shows
 * up when you look at the render.
 */
const TYRE_SHARE = 0.62;

function wheel(cx: number, side: number, count: number, index: number): Point {
  const tyreCount = Math.ceil(count * TYRE_SHARE);
  const onTyre = index < tyreCount;

  const n = onTyre ? tyreCount : count - tyreCount;
  const i = onTyre ? index : index - tyreCount;
  const r = onTyre ? 0.15 : 0.078;

  const a = (i / n) * Math.PI * 2;
  return {
    p: [cx + Math.cos(a) * r, WHEEL_Y + Math.sin(a) * r, side * 0.355],
    // A wheel face points outward along the axle. The tyre ring leans a little
    // toward its own rim so the outer ring still catches the rim light.
    n: onTyre
      ? [Math.cos(a) * 0.5, Math.sin(a) * 0.5, side * 0.7]
      : [0, 0, side],
  };
}

/** Hub height. The tyre top rises into the body, which is what an arch is. */
const WHEEL_Y = 0.15;

/* ── assembly ─────────────────────────────────────────────────────────── */

/**
 * Where each panel sits on the body, as a range of t and of section angle.
 *
 * `v` runs from 0 at the right shoulder, through 0.25 at the roof, to 0.5 at
 * the left shoulder — so a door is a band down one side and the cabin is a
 * band across the top.
 */
const BANDS: Partial<Record<Part, { t: [number, number]; v: [number, number]; cabin?: boolean }>> = {
  nose: { t: [0.95, 1], v: [0, 1] },
  hood: { t: [0.82, 0.95], v: [0.08, 0.42] },
  cabin: { t: [0.48, 0.82], v: [0.12, 0.38], cabin: true },
  // Tight bands down each flank. Widening them filled the sides evenly and
  // lost the shoulder line, which is most of what makes the shape read as a
  // body rather than as a cloud.
  doorL: { t: [0.34, 0.82], v: [0.42, 0.58] },
  doorR: { t: [0.34, 0.82], v: [-0.08, 0.08] },
  rear: { t: [0.14, 0.5], v: [0.08, 0.42] },
  tail: { t: [0, 0.16], v: [0, 1] },
};

/**
 * Deterministic scatter.
 *
 * A grid of cells on a curved surface shows its rows as moiré banding when the
 * car turns; jitter breaks that up. Seeded rather than random so the same seat
 * is the same cell on every render and between server and client — a car whose
 * panels rearrange on hydration is a car that flickers.
 */
function jitter(seed: number): number {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x) - 0.5;
}

/** The five hundred cells, in the order they light up. */
export function carCells(): Cell[] {
  const cells: Cell[] = [];
  let seat = 1;

  for (const [part, count] of PLAN) {
    for (let i = 0; i < count; i += 1) {
      let point: Point;

      if (part.startsWith("wheel")) {
        const front = part.includes("Front");
        const side = part.endsWith("L") ? 1 : -1;
        point = wheel(front ? 0.6 : -0.62, side, count, i);
      } else {
        const band = BANDS[part]!;
        // Rows across the band and columns along it, so a panel fills as a
        // panel rather than as a spray.
        const rows = Math.max(2, Math.round(Math.sqrt(count / 2)));
        const cols = Math.ceil(count / rows);
        const row = i % rows;
        const col = Math.floor(i / rows);

        const ft = (col + 0.5 + jitter(seat * 3.7) * 0.6) / cols;
        const fv = (row + 0.5 + jitter(seat * 9.1) * 0.6) / rows;

        const t = band.t[0] + (band.t[1] - band.t[0]) * Math.min(1, Math.max(0, ft));
        const v = band.v[0] + (band.v[1] - band.v[0]) * Math.min(1, Math.max(0, fv));
        point = shell(t, v, band.cabin === true);
      }

      cells.push({
        seat,
        part,
        x: point.p[0],
        y: point.p[1],
        z: point.p[2],
        nx: point.n[0],
        ny: point.n[1],
        nz: point.n[2],
      });
      seat += 1;
    }
  }

  return cells;
}

/** Guards the plan against drifting away from the cohort it represents. */
export const PLANNED_TOTAL = PLAN.reduce((sum, [, n]) => sum + n, 0);

if (PLANNED_TOTAL !== SEATS) {
  throw new Error(
    `the car is built from ${PLANNED_TOTAL} cells but the cohort has ${SEATS} seats`,
  );
}
