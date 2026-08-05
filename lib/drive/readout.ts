import { ROUTE_PTS, VIEW_W, VIEW_H, type Pt } from "@/lib/drive/route";

/**
 * What the four signals read at a given point through the drive.
 *
 * Pure and deterministic: the server renders `readoutAt(1)` as a finished
 * drive, and the browser walks the same function from 0. No state crosses the
 * boundary, so there is nothing to reconcile on hydration.
 *
 * The odometer is monotonic by construction here, for the same reason it is
 * monotonic in the real verifier — it is the only signal a reward may be
 * computed from, so it must never be able to move backwards.
 */

export const BASE_ODO_KM = 42318.6;
export const SESSION_KM = 12.4;
export const DAILY_CAP_DRV = 500;
export const DRV_PER_KM = 10;

/** Central Seoul. The trace is mapped into a box a few km across. */
const ORIGIN_LAT = 37.5665;
const ORIGIN_LNG = 126.978;
const SPAN_LAT = 0.038;
const SPAN_LNG = 0.062;

export type Readout = {
  lat: number;
  lng: number;
  /** km/h, whole numbers — the cluster is not a lab instrument. */
  spd: number;
  /** Cumulative vehicle odometer, km. */
  odo: number;
  /** Distance covered in this session, km. */
  km: number;
  /** DRV accrued this session, already capped. */
  drv: number;
};

const CUM = cumulative(ROUTE_PTS);

function cumulative(pts: Pt[]): number[] {
  const out = [0];
  for (let i = 1; i < pts.length; i++) {
    out.push(out[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  return out;
}

/** Position along the polyline at progress `t` (0…1). */
export function pointAt(t: number): Pt {
  const total = CUM[CUM.length - 1];
  const target = clamp(t, 0, 1) * total;

  let i = 1;
  while (i < CUM.length - 1 && CUM[i] < target) i++;

  const segStart = CUM[i - 1];
  const segLen = CUM[i] - segStart || 1;
  const f = (target - segStart) / segLen;
  const a = ROUTE_PTS[i - 1];
  const b = ROUTE_PTS[i];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

/**
 * Speed. Two harmonics with a low floor, so the needle sits in traffic
 * occasionally instead of cruising — a constant 60 would read as a fake.
 */
function speedAt(t: number): number {
  const v = 46 + 26 * Math.sin(t * 7.1) + 14 * Math.sin(t * 17.3 + 1.2);
  return Math.max(0, Math.round(v < 8 ? 0 : v));
}

export function readoutAt(t: number): Readout {
  const p = clamp(t, 0, 1);
  const { x, y } = pointAt(p);
  const km = SESSION_KM * p;

  return {
    lat: ORIGIN_LAT + (0.5 - y / VIEW_H) * SPAN_LAT,
    lng: ORIGIN_LNG + (x / VIEW_W - 0.5) * SPAN_LNG,
    spd: speedAt(p),
    odo: BASE_ODO_KM + km,
    km,
    drv: Math.min(Math.floor(km * DRV_PER_KM), DAILY_CAP_DRV),
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Fixed-width formatting, so a ticking figure never changes width. */
export const fmt = {
  deg: (v: number) => v.toFixed(4),
  spd: (v: number) => String(Math.round(v)),
  odo: (v: number) => v.toFixed(1),
  drv: (v: number) => String(Math.round(v)),
};
