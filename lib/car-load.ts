import { SEATS } from "@/lib/genesis";

/**
 * The converted car, read in the browser.
 *
 * `scripts/build-car.mjs` turns a downloaded glTF into a flat buffer with no
 * parsing left to do: counts and bounds in a fixed header, then quantised
 * positions, byte normals, one material class per vertex, and u16 indices. The
 * work here is three typed-array views and one dequantisation pass.
 *
 * It is fetched, not bundled, and only when the section it belongs to comes
 * into view. A reader who never scrolls that far downloads none of it, and a
 * reader whose network drops it gets the generated car instead — the page has
 * never depended on this file arriving and must not start.
 */

export type LoadedCar = {
  positions: Float32Array;
  normals: Float32Array;
  /** 0 paint · 1 tyre · 2 alloy · 3 glass. Matches the generated mesh. */
  material: Float32Array;
  indices: Uint16Array;
  /** The seats, sampled onto this body rather than onto the generated one. */
  cells: Float32Array;
  cellNormals: Float32Array;
};

const MAGIC = 0x52414354; // "TCAR" little-endian

export function decodeCar(buffer: ArrayBuffer): LoadedCar {
  const head = new DataView(buffer);
  if (head.getUint32(0, true) !== MAGIC) throw new Error("not a TCAR buffer");

  const version = head.getUint16(4, true);
  if (version !== 1) throw new Error(`TCAR version ${version} is not readable here`);

  const vertexCount = head.getUint32(8, true);
  const triangleCount = head.getUint32(12, true);

  const lo = [head.getFloat32(16, true), head.getFloat32(20, true), head.getFloat32(24, true)];
  const hi = [head.getFloat32(28, true), head.getFloat32(32, true), head.getFloat32(36, true)];
  const span = lo.map((v, i) => Math.max(1e-6, hi[i] - v));

  let at = 40;
  const quantised = new Int16Array(buffer, at, vertexCount * 3);
  at += vertexCount * 6;
  const packedNormals = new Int8Array(buffer, at, vertexCount * 3);
  at += vertexCount * 3;
  const classes = new Uint8Array(buffer, at, vertexCount);
  at += vertexCount;
  // `Uint16Array` needs two-byte alignment and the class table can leave the
  // cursor odd, so the tail is copied rather than viewed in place.
  const indices = new Uint16Array(buffer.slice(at, at + triangleCount * 6));

  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const material = new Float32Array(vertexCount);

  for (let i = 0; i < vertexCount; i += 1) {
    for (let a = 0; a < 3; a += 1) {
      positions[i * 3 + a] = lo[a] + ((quantised[i * 3 + a] + 32_767) / 65_534) * span[a];
      normals[i * 3 + a] = packedNormals[i * 3 + a] / 127;
    }
    material[i] = classes[i];
  }

  const seats = sampleSeats(positions, normals, material, indices);

  return { positions, normals, material, indices, ...seats };
}

/**
 * Five hundred seats, on the body of the car that actually arrived.
 *
 * The generated mesh could place these analytically because it knew its own
 * surface. A downloaded one has to be sampled, and the sampling has to satisfy
 * three things the old placement gave for free.
 *
 * They must be on paint. A seat on a window or a tyre reads as a smudge, and
 * the two panels a reader looks at hardest are exactly the ones a naive
 * area-weighted sample covers most.
 *
 * They must be spread. Weighting by triangle area is what stops five hundred
 * points piling into whichever corner of the car the artist tessellated finely,
 * and that is most of the surface of most downloaded models.
 *
 * They must be ordered nose to tail, because the cohort fills that way and the
 * order is the animation.
 */
function sampleSeats(
  positions: Float32Array,
  normals: Float32Array,
  material: Float32Array,
  indices: Uint16Array,
): { cells: Float32Array; cellNormals: Float32Array } {
  const faces: number[] = [];
  const cumulative: number[] = [];
  let total = 0;

  for (let f = 0; f + 2 < indices.length; f += 3) {
    const a = indices[f];
    const b = indices[f + 1];
    const c = indices[f + 2];
    // Paint only.
    if (material[a] !== 0 || material[b] !== 0 || material[c] !== 0) continue;

    const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
    const bx = positions[b * 3], by = positions[b * 3 + 1], bz = positions[b * 3 + 2];
    const cx = positions[c * 3], cy = positions[c * 3 + 1], cz = positions[c * 3 + 2];

    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const area = Math.hypot(nx, ny, nz) / 2;
    if (!(area > 0)) continue;

    faces.push(f);
    total += area;
    cumulative.push(total);
  }

  const cells = new Float32Array(SEATS * 3);
  const cellNormals = new Float32Array(SEATS * 3);
  if (!faces.length) return { cells, cellNormals };

  /*
   * Stratified, not random.
   *
   * Walking the cumulative-area table at even steps with one deterministic
   * jitter gives an even scatter and the same scatter on every render — which
   * matters twice over, because a seat that moves between the server pass and
   * the client pass is a car that reshuffles itself on hydration.
   */
  let seed = 0x9e3779b9;
  const rand = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) % 100_000) / 100_000;
  };

  const picked: Array<{ p: [number, number, number]; n: [number, number, number] }> = [];

  for (let i = 0; i < SEATS; i += 1) {
    const target = ((i + rand() * 0.9) / SEATS) * total;
    let loIdx = 0;
    let hiIdx = cumulative.length - 1;
    while (loIdx < hiIdx) {
      const mid = (loIdx + hiIdx) >> 1;
      if (cumulative[mid] < target) loIdx = mid + 1;
      else hiIdx = mid;
    }

    const f = faces[loIdx];
    const a = indices[f];
    const b = indices[f + 1];
    const c = indices[f + 2];

    // Uniform inside the triangle.
    let u = rand();
    let v = rand();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    const w = 1 - u - v;

    const at = (idx: number, arr: Float32Array): [number, number, number] => [
      arr[idx * 3],
      arr[idx * 3 + 1],
      arr[idx * 3 + 2],
    ];
    const [ax, ay, az] = at(a, positions);
    const [bx, by, bz] = at(b, positions);
    const [cx, cy, cz] = at(c, positions);
    const [anx, any_, anz] = at(a, normals);
    const [bnx, bny, bnz] = at(b, normals);
    const [cnx, cny, cnz] = at(c, normals);

    const nx = anx * w + bnx * u + cnx * v;
    const ny = any_ * w + bny * u + cny * v;
    const nz = anz * w + bnz * u + cnz * v;
    const len = Math.hypot(nx, ny, nz) || 1;

    picked.push({
      p: [ax * w + bx * u + cx * v, ay * w + by * u + cy * v, az * w + bz * u + cz * v],
      n: [nx / len, ny / len, nz / len],
    });
  }

  // Nose first: the car is built from the front, which is how a cohort filling
  // up reads as assembly rather than as shading-in.
  picked.sort((p, q) => q.p[0] - p.p[0]);

  picked.forEach((cell, i) => {
    cells[i * 3] = cell.p[0];
    cells[i * 3 + 1] = cell.p[1];
    cells[i * 3 + 2] = cell.p[2];
    cellNormals[i * 3] = cell.n[0];
    cellNormals[i * 3 + 1] = cell.n[1];
    cellNormals[i * 3 + 2] = cell.n[2];
  });

  return { cells, cellNormals };
}

/** Where the converted car lives. Absent until somebody runs the build script. */
export const CAR_URL = "/car/model3.bin";

/**
 * Fetch and decode, or resolve null.
 *
 * Null is the ordinary answer, not an error: the file is optional, the
 * generated car is the fallback, and a missing asset must never take the page
 * down with it.
 */
export async function loadCar(signal?: AbortSignal): Promise<LoadedCar | null> {
  try {
    const res = await fetch(CAR_URL, { signal, cache: "force-cache" });
    if (!res.ok) return null;
    return decodeCar(await res.arrayBuffer());
  } catch {
    return null;
  }
}
