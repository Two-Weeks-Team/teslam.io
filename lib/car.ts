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

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

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

/** Front and rear axle positions in t, from the published overhangs. `t` spans
 *  1 over a length that spans 2, hence the half. */
export const FRONT_AXLE_T = 1 - 841 * MM * 0.5;
export const REAR_AXLE_T = 978 * MM * 0.5;

/** 700 mm wheels, so the hub sits one radius up and the tyre tops out at two. */
const TYRE_R = 349 * MM;
const WHEEL_Y = TYRE_R;

/*
 * Where the wheel sits across the car.
 *
 * Front track 1580 mm plus a 235 mm tyre puts the outer face 907 mm off the
 * centreline, against 924 mm for the widest bodywork — so on this car the tyre
 * is very nearly flush with the arch, not tucked under it. It was set 115 mm
 * inboard of that, which buried the whole wheel inside the flank the moment the
 * underbody was closed.
 */
const WHEEL_Z = 907 * MM;
const TYRE_W = 235 * MM;

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
/*
 * The side elevation, in millimetres above the road, divided by 2347.
 *
 * Every one of these is a measurement rather than a taste. The first set was
 * eyeballed and the side view it produced was a generic saloon: the bonnet ran
 * flat and long before falling at the very tip, and the boot lid sloped away
 * into the bumper so the back read as a hatchback with a bump on it.
 *
 *   1030 mm  rear face, at the top                     t = 0
 *   1050 mm  the ducktail lip                          t = 0.025
 *   1015 mm  the boot lid, flat                        t = 0.17
 *   1420 mm  rear glass arriving at the roof           t = 0.40
 *   1443 mm  the crown, over the B-pillar              t = 0.575
 *   1020 mm  the cowl, at the windscreen base          t = 0.766
 *    900 mm  the bonnet, sloping the whole way         t = 0.90
 *    780 mm  the nose                                  t = 1
 *
 * The two glass surfaces come out at 21° and 25° from horizontal, the boot lid
 * is flat rather than falling, and the bonnet slopes continuously from the cowl
 * to a nose that is barely half the height of the roof. Those four facts are
 * the side of this car.
 */
const ROOFLINE: Array<[number, number]> = [
  [0.0, 0.439],
  [0.025, 0.447],
  [0.17, 0.432],
  [0.4, 0.605],
  [0.575, 0.615],
  [0.766, 0.435],
  [0.9, 0.383],
  [1.0, 0.332],
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
 * The bottom edge of the body over a wheel — a circle, concentric with it.
 *
 * This was a smoothstep hump, which is tall in the middle and falls away far
 * too quickly at its base: the arch cleared the top of the tyre and then cut
 * through its shoulders, so the wheel was sliced by the bodywork on both sides.
 * A wheel arch is an arc a little larger than the wheel it covers, and saying
 * so directly is both simpler and right everywhere along it.
 *
 * Returns 0 outside the arch so the caller can take a maximum.
 */
const ARCH_R = TYRE_R * 1.16;

function arch(t: number, centre: number): number {
  // t spans 1 where x spans 2, so a distance in t is half a distance in x.
  const dx = Math.abs(t - centre) * 2;
  if (dx >= ARCH_R) return 0;
  return WHEEL_Y + Math.sqrt(ARCH_R * ARCH_R - dx * dx);
}

/**
 * Sill height — where the body stops and the air under the car begins.
 *
 * Flat along the rocker, dropping at both ends where the bumpers hang below
 * it, and lifting over each axle into an arch.
 */
function sill(t: number): number {
  /*
   * The floor, at ground clearance — not the rocker.
   *
   * This was the visible bottom edge of the flank, 390 mm up, and the loft
   * simply stopped there. That left a 390 mm slot running the length of the
   * car, and from any angle at all you could see straight under it to the far
   * pair of wheels: the figure came out with four wheels in a row at two
   * different heights, which is the single most confusing thing a drawing of a
   * car can do.
   *
   * This car has a flat floor 140 mm off the road, so the underside is closed
   * and the only openings are the arches. The rocker still reads, because the
   * ambient gradient puts the bottom of the flank in shade.
   */
  const floor = 140 * MM;
  let base = floor;
  // Approach and departure: both bumpers hang lower than the floor.
  if (t < 0.08) base = ramp(t, 0, 0.08, 0.105, floor);
  else if (t > 0.92) base = ramp(t, 0.92, 1, floor, 0.1);
  // A maximum, not a sum. Adding them made the arches interfere with the floor
  // and with each other instead of simply being cut out of it.
  return Math.max(base, arch(t, FRONT_AXLE_T), arch(t, REAR_AXLE_T));
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
  let w = 0.394 * (1 - draw * Math.abs(s) ** 2.6);

  /*
   * The corners wrap.
   *
   * A bumper is not a flat panel across the end of the car; in plan it curves
   * back from its widest point at the arches toward the centre. Without that,
   * the loft has to be closed by a disc, and a disc at the back of a car is a
   * tailgate on a van — which is exactly what the tail looked like. Closing it
   * in the plan instead means the caps have almost nothing left to cover.
   *
   * The nose wraps hard and the tail barely at all, which is the difference
   * between a prow and a boot.
   */
  w *= wrap(t, 0.84, 1, 0.78);
  w *= wrap(t, 0.13, 0, 0.38);

  /*
   * And the arches flare.
   *
   * The widest part of this car is not the doors, it is the swelling over each
   * wheel. Without it the tyres sit proud of the flanks and the car reads as a
   * hot rod; with it they sit under a shoulder, which is what an arch is for.
   */
  w += 0.008 * (bump(t, FRONT_AXLE_T, 0.13) + bump(t, REAR_AXLE_T, 0.13));

  return w;
}

/** How far the plan has closed at `t`, between `from` (open) and `to` (the end). */
function wrap(t: number, from: number, to: number, depth: number): number {
  const k = Math.min(1, Math.max(0, (t - from) / (to - from)));
  return Math.sqrt(Math.max(0, 1 - depth * k * k));
}

/** A smooth hump of unit height centred on `centre`, `half` wide. */
function bump(t: number, centre: number, half: number): number {
  const d = Math.abs(t - centre);
  if (d >= half) return 0;
  const k = 1 - d / half;
  return k * k * (3 - 2 * k);
}

/**
 * A point on the body shell at length t and angle v around the section.
 *
 * The section is a superellipse rather than a circle: a car's cross-section is
 * closer to a rounded rectangle, and a circular loft gives a smooth tube that
 * reads as a submarine.
 */
type Point = {
  p: [number, number, number];
  n: [number, number, number];
  /** 0 below the shoulder line, 1 in the glass. Carried out of the section
   *  function because that is the only place the beltline is known. */
  glass: number;
};

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
  /*
   * Where the glass is.
   *
   * Measured against the road, not against the height of whatever section
   * happens to be under it. The first version normalised the height within
   * each section, which makes the top of every section the top of the car —
   * so the boot lid and the bonnet came out as windows, and the beltline ran
   * from bumper to bumper like a racing stripe.
   *
   * A window is two facts at once: above the belt, and between the A- and
   * C-pillars. Both are needed, and both are here.
   */
  const beltY = 0.402 + 0.018 * (1 - t);
  const above = clamp01((y - beltY) / 0.035);
  const cabin = Math.min(clamp01((t - 0.2) / 0.06), clamp01((0.8 - t) / 0.06));
  const glass = above * above * (3 - 2 * above) * cabin;

  // The roof also narrows toward the back, which is most of what the plan view
  // of this car looks like: a glass teardrop sitting on a wide body.
  const rearward = clamp01((0.62 - t) / 0.42);
  const rz = halfWidth(t) * (1 - glass * (0.24 + 0.1 * rearward));

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
    glass,
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
    p: [cx + Math.cos(a) * r, WHEEL_Y + Math.sin(a) * r, side * WHEEL_Z],
    // A wheel face points outward along the axle. The tyre ring leans a little
    // toward its own rim so the outer ring still catches the rim light.
    n:
      index < tyre
        ? [Math.cos(a) * 0.5, Math.sin(a) * 0.5, side * 0.7]
        : [0, 0, side],
    glass: 0,
  };
}



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
        /*
         * L is the same side of the car everywhere.
         *
         * The door bands put `doorL` at negative z (v = 0.42..0.58 is the far
         * flank) while this put `wheelFrontL` at positive z, so one suffix
         * meant opposite sides depending on which part you asked about. The
         * body is symmetric so nothing rendered wrong, and nothing would have
         * until the first consumer used `part` to label or highlight a side.
         */
        const side = part.endsWith("L") ? -1 : 1;
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
  /** Per vertex: 0 for painted metal, 1 for glass. The window line does about
   *  half the work of making a car look like a car, and it cannot be inferred
   *  in the shader from a position. */
  glass: Float32Array;
  /**
   * Per vertex: 0 body, 1 tyre, 2 alloy.
   *
   * Separate from `glass` because glass is a gradient across the shoulder and
   * this is a choice of material. Overloading one attribute for both would
   * blend rubber into paint across the triangles where they meet.
   */
  material: Float32Array;
  indices: Uint16Array;
};

/** Along the length, and around each section. Enough that the crown reads as a
 *  curve and the arches as arches; far below the point where more would show. */
const LOFT_T = 96;
const LOFT_V = 40;

function pushRing(pos: number[], nor: number[], gls: number[], mat: number[], t: number): void {
  for (let j = 0; j < LOFT_V; j += 1) {
    const { p, n, glass } = shell(t, j / LOFT_V);
    pos.push(p[0], p[1], p[2]);
    nor.push(n[0], n[1], n[2]);
    gls.push(glass);
    mat.push(0);
  }
}

/** A closed wheel: a tread band and a face at each end. */
function pushWheel(
  pos: number[],
  nor: number[],
  gls: number[],
  mat: number[],
  idx: number[],
  cx: number,
  side: number,
): void {
  const N = 28;
  const zOuter = side * WHEEL_Z;
  const zInner = side * (WHEEL_Z - TYRE_W);
  const base = pos.length / 3;

  // Two rings for the tread.
  for (const z of [zOuter, zInner]) {
    for (let i = 0; i < N; i += 1) {
      const a = (i / N) * Math.PI * 2;
      pos.push(cx + Math.cos(a) * TYRE_R, WHEEL_Y + Math.sin(a) * TYRE_R, z);
      nor.push(Math.cos(a), Math.sin(a), 0);
      gls.push(0);
      mat.push(1);
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
  gls.push(0);
  mat.push(2);
  const faceStart = pos.length / 3;
  for (let i = 0; i < N; i += 1) {
    const a = (i / N) * Math.PI * 2;
    pos.push(cx + Math.cos(a) * TYRE_R * 0.9, WHEEL_Y + Math.sin(a) * TYRE_R * 0.9, zOuter);
    nor.push(0, 0, side);
    gls.push(0);
    mat.push(2);
  }
  for (let i = 0; i < N; i += 1) {
    idx.push(faceCentre, faceStart + i, faceStart + ((i + 1) % N));
  }
}

export function carMesh(): Mesh {
  const pos: number[] = [];
  const nor: number[] = [];
  const gls: number[] = [];
  const mat: number[] = [];
  const idx: number[] = [];

  // The hull, ring by ring. The ends stop just short of 0 and 1 because the
  // profile's derivative is undefined exactly there and a ring built on it
  // comes out with normals pointing nowhere.
  for (let i = 0; i < LOFT_T; i += 1) {
    pushRing(pos, nor, gls, mat, 0.002 + (i / (LOFT_T - 1)) * 0.996);
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
    gls.push(0);
    mat.push(0);
    for (let j = 0; j < LOFT_V; j += 1) {
      const a = ring * LOFT_V + j;
      const b = ring * LOFT_V + ((j + 1) % LOFT_V);
      idx.push(centre, dir > 0 ? a : b, dir > 0 ? b : a);
    }
  }

  for (const t of [FRONT_AXLE_T, REAR_AXLE_T]) {
    for (const side of [1, -1]) {
      pushWheel(pos, nor, gls, mat, idx, 2 * t - 1, side);
    }
  }

  return {
    positions: new Float32Array(pos),
    normals: new Float32Array(nor),
    glass: new Float32Array(gls),
    material: new Float32Array(mat),
    indices: new Uint16Array(idx),
  };
}
