import { SEATS } from "@/lib/genesis";

/**
 * The converted car, read in the browser.
 *
 * `scripts/build-car.mjs` turns a downloaded glTF into a flat buffer with no
 * parsing left to do: counts and bounds in a fixed header, then quantised
 * positions, byte normals, one material class per vertex, u16 indices, and the
 * five hundred seats already placed. The work here is a handful of typed-array
 * views and one dequantisation pass.
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
  /** The seats, placed on this body at build time rather than the generated one. */
  cells: Float32Array;
  cellNormals: Float32Array;
};

const MAGIC = 0x52414354; // "TCAR" little-endian

export function decodeCar(buffer: ArrayBuffer): LoadedCar {
  const head = new DataView(buffer);
  if (head.getUint32(0, true) !== MAGIC) throw new Error("not a TCAR buffer");

  const version = head.getUint16(4, true);
  if (version !== 2) throw new Error(`TCAR version ${version} is not readable here`);
  const seatCount = head.getUint16(6, true);

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

  /*
   * The seats arrive placed.
   *
   * They used to be sampled here, on load, which meant the placement could
   * only use tests cheap enough for the main thread — and the test that
   * actually matters, "is this face under another one", is a ray cast per
   * candidate against the whole mesh. `scripts/build-car.mjs` does it once at
   * build time and writes the answer down.
   */
  at += triangleCount * 6;
  const seatQ = new Int16Array(buffer.slice(at, at + seatCount * 6));
  at += seatCount * 6;
  const seatN = new Int8Array(buffer.slice(at, at + seatCount * 3));

  const cells = new Float32Array(SEATS * 3);
  const cellNormals = new Float32Array(SEATS * 3);
  const n = Math.min(SEATS, seatCount);
  for (let i = 0; i < n; i += 1) {
    for (let a = 0; a < 3; a += 1) {
      cells[i * 3 + a] = lo[a] + ((seatQ[i * 3 + a] + 32_767) / 65_534) * span[a];
      cellNormals[i * 3 + a] = seatN[i * 3 + a] / 127;
    }
  }

  return { positions, normals, material, indices, cells, cellNormals };
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
    // Ordinary caching, not `force-cache`. Forcing it skips revalidation
    // entirely, so a rebuilt car kept serving the previous one out of the disk
    // cache — which looks exactly like a conversion that changed nothing, and
    // cost an hour of staring at an unchanged render.
    const res = await fetch(CAR_URL, { signal });
    if (!res.ok) return null;
    return decodeCar(await res.arrayBuffer());
  } catch {
    return null;
  }
}
