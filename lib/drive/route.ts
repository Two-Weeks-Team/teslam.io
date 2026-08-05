/**
 * The hero route.
 *
 * Generated deterministically from a fixed seed so the server's static SVG and
 * the browser's animated one are the same geometry — there is no cross-fade to
 * hide a mismatch, because there is no mismatch.
 *
 * The shape is deliberately Manhattan-ish: mostly orthogonal runs with short
 * connecting diagonals. A smooth sine reads as a decorative particle
 * background; right-angle turns read as a route on a map, which is the whole
 * point of the panel.
 */

export const VIEW_W = 960;
export const VIEW_H = 280;

const SEED = 0x5eed_1a7;

/** Small deterministic LCG. Same numbers on server and client, every time. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

export type Pt = { x: number; y: number };

/**
 * A left-to-right drive across the panel. Vertical runs are bounded well
 * inside the box so the trace never touches the readout row below it.
 */
export function buildRoute(): Pt[] {
  const rand = rng(SEED);
  const padX = 46;
  const minY = 52;
  const maxY = VIEW_H - 52;

  const pts: Pt[] = [];
  let x = padX;
  let y = VIEW_H * 0.62;
  pts.push({ x, y });

  const runs = 10;
  const span = (VIEW_W - padX * 2) / runs;

  for (let i = 0; i < runs; i++) {
    // Horizontal run east.
    const dx = span * (0.7 + rand() * 0.6);
    x = Math.min(x + dx, VIEW_W - padX);
    pts.push({ x, y });

    // Then a vertical jog. The swing has to be a large fraction of the box
    // height or the trace flattens into something that reads as a line chart
    // rather than a route; the centre pull is kept weak so it still explores
    // the full height instead of hugging the middle.
    const toCentre = (VIEW_H / 2 - y) * 0.18;
    const swing = (rand() - 0.5) * 190 + toCentre;
    y = Math.max(minY, Math.min(maxY, y + swing));
    pts.push({ x, y });
  }

  // Land on the right edge so the drive reads as finished.
  pts.push({ x: VIEW_W - padX, y });
  return pts;
}

/** Path data with the corners rounded, so it looks driven rather than plotted. */
export function toPath(pts: Pt[], radius = 9): string {
  if (pts.length < 2) return "";
  const out: string[] = [`M ${round(pts[0].x)} ${round(pts[0].y)}`];

  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const next = pts[i + 1];

    const r1 = shorten(cur, prev, radius);
    const r2 = shorten(cur, next, radius);

    out.push(`L ${round(r1.x)} ${round(r1.y)}`);
    out.push(`Q ${round(cur.x)} ${round(cur.y)} ${round(r2.x)} ${round(r2.y)}`);
  }

  const last = pts[pts.length - 1];
  out.push(`L ${round(last.x)} ${round(last.y)}`);
  return out.join(" ");
}

function shorten(from: Pt, toward: Pt, by: number): Pt {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const t = Math.min(by, len / 2) / len;
  return { x: from.x + dx * t, y: from.y + dy * t };
}

function round(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Total polyline length — used to pace the readouts against the trace. */
export function routeLength(pts: Pt[]): number {
  let sum = 0;
  for (let i = 1; i < pts.length; i++) {
    sum += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return sum;
}

/** The one route this site draws. Built once, imported by both renderers. */
export const ROUTE_PTS = buildRoute();
export const ROUTE_D = toPath(ROUTE_PTS);
export const ROUTE_LEN = routeLength(ROUTE_PTS);
