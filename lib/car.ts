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
const ROOFLINE: Array<[number, number]> = [
  [0.0, 0.425], // the trailing edge, falling off the back
  [0.03, 0.449], // the ducktail lip — the whole difference from a hatchback
  [0.2, 0.432], // the deck
  [0.46, 0.614], // rear glass, long and shallow, arriving at the crown
  [0.58, 0.615], // the crown, over the front seats
  [0.78, 0.43], // the cowl: windscreen raked about 25° from horizontal
  [0.93, 0.4], // the bonnet, short and nearly level
  [1.0, 0.3], // and over the nose
];

/**
 * Height of the roofline at t, interpolated rather than ramped.
 *
 * This was a chain of smoothstep segments, and smoothstep arrives at every one
 * of its endpoints with zero slope. Eight segments therefore meant eight flat
 * spots, and where two of them met at different gradients the surface creased.
 * Rendered as points nobody could see it; rendered as a solid, the car had a
 * step in its shoulder and a shelf where the rear glass meets the boot.
 *
 * A monotone cubic through the same control points holds the shape between
 * them instead of flattening at each one, and cannot overshoot into a bulge
 * the profile never asked for.
 */
function roof(t: number): number {
  return monotone(ROOFLINE, t);
}

/**
 * Fritsch–Carlson monotone cubic interpolation.
 *
 * Catmull–Rom would be shorter and would overshoot: the ducktail is a 0.024
 * rise followed immediately by a fall, and an unconstrained spline answers
 * that with a hump on the boot lid. Limiting the tangents is what keeps a
 * control point a maximum rather than a suggestion.
 */
function monotone(points: Array<[number, number]>, x: number): number {
  const n = points.length;
  if (x <= points[0][0]) return points[0][1];
  if (x >= points[n - 1][0]) return points[n - 1][1];

  let i = 0;
  while (i < n - 2 && x > points[i + 1][0]) i += 1;

  const [x0, y0] = points[i];
  const [x1, y1] = points[i + 1];
  const h = x1 - x0;
  const slope = (y1 - y0) / h;

  const before = i > 0 ? (y0 - points[i - 1][1]) / (x0 - points[i - 1][0]) : slope;
  const after = i < n - 2 ? (points[i + 2][1] - y1) / (points[i + 2][0] - x1) : slope;

  // A tangent is zero wherever the curve turns, and otherwise the average of
  // the two neighbouring slopes clamped to three times the smaller — the
  // standard limit, and what stops the lip from becoming a bump.
  const limit = (a: number, b: number) =>
    a * b <= 0 ? 0 : Math.sign(a) * Math.min(Math.abs((a + b) / 2), 3 * Math.min(Math.abs(a), Math.abs(b)));

  const m0 = limit(before, slope);
  const m1 = limit(slope, after);

  const s = (x - x0) / h;
  const s2 = s * s;
  const s3 = s2 * s;
  return (
    (2 * s3 - 3 * s2 + 1) * y0 +
    (s3 - 2 * s2 + s) * h * m0 +
    (-2 * s3 + 3 * s2) * y1 +
    (s3 - s2) * h * m1
  );
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
  // Asymmetric, because a car is. The nose draws in to about four-fifths of
  // the widest section; the tail barely draws in at all, because the rear
  // track is wider than the front and the shoulders run almost to the back
  // panel. Tapering both ends equally — which is what the first version did —
  // gives a tail that points, and a car whose tail points is a boat.
  const s = 2 * t - 1;
  const draw = s >= 0 ? 0.19 : 0.07;
  return 0.394 * (1 - draw * Math.abs(s) ** 2.6);
}

/**
 * A point on the body shell at length t and angle v around the section.
 *
 * The section is a superellipse rather than a circle: a car's cross-section is
 * closer to a rounded rectangle, and a circular loft gives a smooth tube that
 * reads as a submarine.
 */
type Point = { p: [number, number, number]; n: [number, number, number] };

function shell(t: number, v: number): Point {
  const top = roof(t);
  const bottom = sill(t);
  const cy = (top + bottom) / 2;
  const ry = (top - bottom) / 2;

  const a = v * Math.PI * 2;
  const c = Math.cos(a);
  const s = Math.sin(a);

  /*
   * Three exponents, not one.
   *
   * A single superellipse exponent gives a section that is equally round
   * everywhere, and lofting it produced a body that read as a tube with wheels
   * bolted on. A car's section is none of those things in the same way: the
   * floor is flat, the flanks stand up, and only the roof is properly round.
   * Lower exponents are squarer.
   */
  const roofRound = 0.55;
  const floorFlat = 0.24;
  const flankFlat = 0.34;

  const y = cy + ry * Math.sign(s) * Math.abs(s) ** (s >= 0 ? roofRound : floorFlat);

  /*
   * Above the beltline the section draws in, and that taper is the greenhouse.
   *
   * It used to be a flag on the panel: cells in the cabin band got a narrower
   * section than cells in the door band directly below them. That is fine when
   * cells are all there is and wrong the moment a surface exists, because the
   * cells and the surface then disagree about where the car is and the points
   * float off the body. Making it a function of height instead means anything
   * that asks this function for a point gets the same car.
   */
  const h = ry > 0 ? (y - bottom) / (2 * ry) : 0;
  const k = Math.min(1, Math.max(0, (h - 0.55) / 0.45));
  const rz = halfWidth(t) * (1 - 0.26 * k * k * (3 - 2 * k));

  const z = rz * Math.sign(c) * Math.abs(c) ** flankFlat;

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
  { t: [number, number]; v: [number, number]; rows?: number }
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
  cabin: { t: [0.22, 0.78], v: [0.17, 0.33], rows: 5 },
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
        point = shell(t, v);
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

/* ── the body, as a surface ───────────────────────────────────────────── */

/**
 * The same car, as a solid.
 *
 * Five hundred points cannot describe a particular car. That was not a matter
 * of getting the proportions right — they are right now, measured — but of
 * resolution: a point cloud resolves into a shape only where the points are
 * dense enough to form a line, and five hundred of them spread over a whole
 * body form one line along the roof and a haze everywhere else. Photographs of
 * four attempts say so.
 *
 * So the body is drawn as a surface and the five hundred stay what they are:
 * the seats, sitting on it, lighting as they are taken. The surface is lofted
 * from the same profile functions the cells use — not a second model of the
 * car, the same car — so a cell and the panel under it cannot disagree.
 *
 * Two things follow that the points alone could never do. The silhouette
 * becomes a filled region instead of an implied one, and the depth buffer
 * hides the seats on the far side, which is what finally makes the object read
 * as having a volume rather than as a cloud shaped like one.
 *
 * Still generated, still no manufacturer's mesh in the repository: this is the
 * same few hundred bytes of arithmetic, evaluated on a finer grid.
 */
export type Mesh = {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint16Array;
};

/** Along the length, and around each section. Enough that the crown reads as a
 *  curve and the arches as arches; far below the point where more would show. */
const LOFT_T = 96;
const LOFT_V = 40;

function pushRing(
  pos: number[],
  nor: number[],
  t: number,
): void {
  for (let j = 0; j < LOFT_V; j += 1) {
    const { p, n } = shell(t, j / LOFT_V);
    pos.push(p[0], p[1], p[2]);
    nor.push(n[0], n[1], n[2]);
  }
}

/** A closed wheel: a tread band and a face at each end. */
function pushWheel(
  pos: number[],
  nor: number[],
  idx: number[],
  cx: number,
  side: number,
): void {
  const N = 28;
  const zOuter = side * 0.362;
  const zInner = side * 0.28;
  const base = pos.length / 3;

  // Two rings for the tread.
  for (const z of [zOuter, zInner]) {
    for (let i = 0; i < N; i += 1) {
      const a = (i / N) * Math.PI * 2;
      pos.push(cx + Math.cos(a) * TYRE_R, WHEEL_Y + Math.sin(a) * TYRE_R, z);
      nor.push(Math.cos(a), Math.sin(a), 0);
    }
  }
  for (let i = 0; i < N; i += 1) {
    const a = base + i;
    const b = base + ((i + 1) % N);
    const c = a + N;
    const d = b + N;
    idx.push(a, b, c, b, d, c);
  }

  // The outer face, as a fan. This is the disc that reads as a wheel rather
  // than as a hoop, and it is the only part of a wheel anybody looks at.
  const faceCentre = pos.length / 3;
  pos.push(cx, WHEEL_Y, zOuter);
  nor.push(0, 0, side);
  const faceStart = pos.length / 3;
  for (let i = 0; i < N; i += 1) {
    const a = (i / N) * Math.PI * 2;
    pos.push(cx + Math.cos(a) * TYRE_R * 0.9, WHEEL_Y + Math.sin(a) * TYRE_R * 0.9, zOuter);
    nor.push(0, 0, side);
  }
  for (let i = 0; i < N; i += 1) {
    idx.push(faceCentre, faceStart + i, faceStart + ((i + 1) % N));
  }
}

export function carMesh(): Mesh {
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];

  // The hull, ring by ring. The ends stop just short of 0 and 1 because the
  // profile's derivative is undefined exactly there and a ring built on it
  // comes out with normals pointing nowhere.
  for (let i = 0; i < LOFT_T; i += 1) {
    pushRing(pos, nor, 0.002 + (i / (LOFT_T - 1)) * 0.996);
  }
  for (let i = 0; i < LOFT_T - 1; i += 1) {
    for (let j = 0; j < LOFT_V; j += 1) {
      const a = i * LOFT_V + j;
      const b = i * LOFT_V + ((j + 1) % LOFT_V);
      const c = a + LOFT_V;
      const d = b + LOFT_V;
      idx.push(a, b, c, b, d, c);
    }
  }

  // Caps, so the nose and the tail are faces rather than holes. The body no
  // longer tapers to a point at either end, which is correct for a car and
  // means both ends need closing.
  for (const [ring, t, dir] of [
    [0, 0.002, -1],
    [LOFT_T - 1, 0.998, 1],
  ] as const) {
    const centre = pos.length / 3;
    const top = roof(t);
    const bottom = sill(t);
    pos.push(2 * t - 1, (top + bottom) / 2, 0);
    nor.push(dir, 0, 0);
    for (let j = 0; j < LOFT_V; j += 1) {
      const a = ring * LOFT_V + j;
      const b = ring * LOFT_V + ((j + 1) % LOFT_V);
      idx.push(centre, dir > 0 ? a : b, dir > 0 ? b : a);
    }
  }

  for (const t of [FRONT_AXLE_T, REAR_AXLE_T]) {
    for (const side of [1, -1]) {
      pushWheel(pos, nor, idx, 2 * t - 1, side);
    }
  }

  return {
    positions: new Float32Array(pos),
    normals: new Float32Array(nor),
    indices: new Uint16Array(idx),
  };
}
