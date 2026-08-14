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
  ["nose", 24],
  ["hood", 28],
  ["wheelFrontL", 26],
  ["wheelFrontR", 26],
  ["doorL", 58],
  ["doorR", 58],
  // The greenhouse takes nearly a third of the cohort, because it is nearly a
  // third of the car and it is the part that says which car. Ninety-two cells
  // spread over that arc came out as a haze; the shape only appears once the
  // line through it is dense enough to be a line.
  ["cabin", 158],
  ["rear", 44],
  ["wheelRearL", 26],
  ["wheelRearR", 26],
  ["tail", 26],
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

/*
 * The proportions.
 *
 * The first version of this was a deliberately generic fastback, on the theory
 * that a vague car was the safe thing to draw. It was not safe, it was just
 * vague: it read as a hatchback, and a cohort of Tesla owners looking at their
 * own front page could not tell what it was. A drawing that fails to say what
 * it is has no compensating virtue.
 *
 * So these are the real proportions of the car this community drives, worked
 * out from its published dimensions and normalised so the body spans x = -1 to
 * 1. Everything else follows from these four numbers.
 *
 *   overall length   4694 mm  →  2.000   (the unit the rest is measured in)
 *   overall width    1849 mm  →  0.788
 *   overall height   1443 mm  →  0.615
 *   wheelbase        2875 mm  →  1.225
 *
 * The geometry is still generated rather than modelled — there is no
 * manufacturer's mesh in this repository and none is needed. Proportions are
 * measurements, not authorship. teslam.io remains unaffiliated with Tesla, Inc.
 * and says so in the footer of every page.
 */
const MM = 2 / 4694;

/** Front and rear axle positions in t, from the published overhangs. */
export const FRONT_AXLE_T = 1 - 841 * MM * 0.5;
export const REAR_AXLE_T = 978 * MM * 0.5;

/**
 * Roofline height at t, where t = 0 is the tail and t = 1 is the nose.
 *
 * Four things make this car recognisable from across a room, and all four are
 * in this function:
 *
 *   One arc.        Windscreen, roof and rear glass are a single sweep, not a
 *                   roof with a screen glued to each end. The crown is nearly
 *                   flat over the front seats and the two ramps meet it with
 *                   zero slope, so the whole greenhouse is one continuous line.
 *   Cab forward.    The windscreen base sits behind the front axle by about a
 *                   quarter of a metre, which is what throws the cabin forward
 *                   and shortens the bonnet to almost nothing.
 *   A low nose.     No grille to hold the leading edge up, so it dives — the
 *                   bonnet's front lip is barely half the height of the roof.
 *   A ducktail.     The boot lid rises at its trailing edge instead of falling
 *                   away. Without it the tail reads as a hatchback, which is
 *                   the single most common way to draw this car wrong.
 */
function roof(t: number): number {
  // Trailing edge, then the lip. The rise is small and it is the whole
  // difference between a saloon and a hatch.
  if (t < 0.03) return ramp(t, 0, 0.03, 0.425, 0.449);
  if (t < 0.2) return ramp(t, 0.03, 0.2, 0.449, 0.432);
  // Rear glass, long and shallow.
  if (t < 0.46) return ramp(t, 0.2, 0.46, 0.432, 0.615);
  // The crown, over the front seats.
  if (t < 0.58) return 0.615;
  // Windscreen, raked about 25° from horizontal.
  if (t < 0.78) return ramp(t, 0.58, 0.78, 0.615, 0.43);
  // Bonnet: short, and nearly level until it falls over the nose.
  if (t < 0.93) return ramp(t, 0.78, 0.93, 0.43, 0.4);
  return ramp(t, 0.93, 1, 0.4, 0.3);
}

/**
 * How far the body's lower edge lifts to clear a wheel.
 *
 * Arches were missing entirely, and a body with a flat bottom edge running
 * past two floating hoops is the other half of why the old shape did not read
 * as a car. The tyre tops out at 0.298; the arch clears it.
 */
function arch(t: number, centre: number): number {
  const half = 0.09;
  const d = Math.abs(t - centre);
  if (d >= half) return 0;
  const k = 1 - d / half;
  return 0.15 * k * k * (3 - 2 * k);
}

/**
 * Sill height — where the body stops and the air under the car begins.
 *
 * Flat along the rocker, dropping at both ends where the bumpers hang below
 * it, and lifting over each axle into an arch.
 */
function sill(t: number): number {
  const rocker = 0.166;
  let base = rocker;
  if (t < 0.08) base = ramp(t, 0, 0.08, 0.105, rocker);
  else if (t > 0.92) base = ramp(t, 0.92, 1, rocker, 0.1);
  return base + arch(t, FRONT_AXLE_T) + arch(t, REAR_AXLE_T);
}

/**
 * Half-width at t.
 *
 * Widest at the shoulders and tapered toward both ends, but never to a point:
 * the old curve went to zero at the nose and the tail, which is a boat. The
 * nose of this car is still about four-fifths of its widest section.
 */
function halfWidth(t: number): number {
  const s = 2 * t - 1;
  return 0.394 * (1 - 0.19 * Math.abs(s) ** 3.2);
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
  // a car look like a car from three-quarters on. This one is a single pane of
  // glass from the windscreen header to the rear screen, so it is wide for a
  // greenhouse — narrow it further and the roof stops reading as glass.
  const rz = halfWidth(t) * (cabin ? 0.74 : 1);

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
const TYRE_SHARE = 0.54;
const RIM_SHARE = 0.35;

function wheel(cx: number, side: number, count: number, index: number): Point {
  const tyre = Math.round(count * TYRE_SHARE);
  const rim = Math.round(count * RIM_SHARE);

  // Three radii rather than two. A pair of concentric hoops reads as a hoop;
  // what makes a wheel is the dark gap between the tyre and a face that is
  // filled in toward its middle, so the third group closes the centre.
  let n: number;
  let i: number;
  let r: number;
  if (index < tyre) {
    n = tyre;
    i = index;
    r = TYRE_R;
  } else if (index < tyre + rim) {
    n = rim;
    i = index - tyre;
    r = TYRE_R * 0.63;
  } else {
    n = count - tyre - rim;
    i = index - tyre - rim;
    r = TYRE_R * 0.26;
  }

  // Offset each ring's start so the three do not line up into spokes, which
  // would read as a ship's wheel.
  const a = ((i + 0.37 * (index < tyre ? 0 : 1)) / Math.max(1, n)) * Math.PI * 2;
  return {
    p: [cx + Math.cos(a) * r, WHEEL_Y + Math.sin(a) * r, side * 0.362],
    // A wheel face points outward along the axle. The tyre ring leans a little
    // toward its own rim so the outer ring still catches the rim light.
    n:
      index < tyre
        ? [Math.cos(a) * 0.5, Math.sin(a) * 0.5, side * 0.7]
        : [0, 0, side],
  };
}

/** Hub height, and the tyre that reaches up into the arch. 700mm diameter. */
const TYRE_R = 349 * MM;
const WHEEL_Y = TYRE_R;

/* ── assembly ─────────────────────────────────────────────────────────── */

/**
 * Where each panel sits on the body, as a range of t and of section angle.
 *
 * `v` runs from 0 at the right shoulder, through 0.25 at the roof, to 0.5 at
 * the left shoulder — so a door is a band down one side and the cabin is a
 * band across the top.
 */
const BANDS: Partial<Record<
  Part,
  { t: [number, number]; v: [number, number]; cabin?: boolean; rows?: number }
>> = {
  // `rows` is forced on the two end caps. The default splits a panel into
  // roughly equal rows and columns, which for a band that wraps the whole
  // section gives three samples around the ring — an end that reads as a
  // scatter rather than as a face. Around the ring is the dimension that
  // matters here, so it gets the samples.
  nose: { t: [0.9, 1], v: [0, 1], rows: 8 },
  // Almost nothing. That is the point — the bonnet on this car is a lid over a
  // boot, and drawing it long is drawing a different car.
  hood: { t: [0.78, 0.9], v: [0.08, 0.42] },
  /*
   * The greenhouse, as one band from the windscreen base to the rear screen.
   * Splitting it into a roof and two screens is what produced a silhouette
   * with a bump on it instead of a single arc.
   *
   * Narrow in v and forced to five rows, which is the whole trick: the same
   * cells spread nine deep across the roof came out as a haze, and gathered
   * into five long runs along the crown they draw the arc as a line. A point
   * cloud reads as a shape when its edges are lines, not when its surface is
   * evenly sampled.
   */
  cabin: { t: [0.22, 0.78], v: [0.17, 0.33], cabin: true, rows: 5 },
  // Tight bands down each flank. Widening them filled the sides evenly and
  // lost the shoulder line, which is most of what makes the shape read as a
  // body rather than as a cloud.
  doorL: { t: [0.24, 0.8], v: [0.42, 0.58] },
  doorR: { t: [0.24, 0.8], v: [-0.08, 0.08] },
  rear: { t: [0.06, 0.24], v: [0.08, 0.42] },
  tail: { t: [0, 0.06], v: [0, 1], rows: 9 },
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
        point = wheel(2 * (front ? FRONT_AXLE_T : REAR_AXLE_T) - 1, side, count, i);
      } else {
        const band = BANDS[part]!;
        // Rows across the band and columns along it, so a panel fills as a
        // panel rather than as a spray.
        const rows = band.rows ?? Math.max(2, Math.round(Math.sqrt(count / 2)));
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
