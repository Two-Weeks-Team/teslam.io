/**
 * Quadric-error edge collapse.
 *
 * Vertex clustering was here first and it could not do this job. Snapping to a
 * grid coarse enough to hit the budget puts the cells at twelve centimetres on
 * a real car, and a glass roof is thinner than that: the panel welds through
 * itself, the triangles collapse, and the render comes back with the roof torn
 * into holes. No amount of tuning fixes it, because the failure is what
 * clustering *is* — it throws away everything smaller than a cell and a car is
 * mostly made of things smaller than a cell.
 *
 * Garland–Heckbert instead. Every vertex carries the sum of the squared-distance
 * quadrics of the planes it sits on; collapsing an edge costs whatever that sum
 * says the new position is away from all of them. Flat panels collapse almost
 * free and creases do not, which is exactly the behaviour a car body wants: the
 * door skin loses triangles and the shoulder line keeps them.
 *
 * Three constraints on top of the plain algorithm, all of them things this
 * particular mesh needs:
 *
 *   Materials never merge. Glass must not weld into paint, or the window line
 *   — half of what makes the shape read as a car — smears at its edges.
 *
 *   Open boundaries are pinned. A downloaded model is a pile of separate
 *   shells, not one closed surface, and every shell edge is a silhouette
 *   somewhere. Left unweighted they melt first.
 *
 *   Collapses that flip a face are refused. Cheap by the metric, catastrophic
 *   on screen: a folded triangle shades as a black shard.
 */

/** Symmetric 4×4 as ten floats: xx xy xz xw yy yz yw zz zw ww. */
const zeroQuadric = () => new Float64Array(10);

function addPlane(q, a, b, c, d, weight = 1) {
  q[0] += a * a * weight; q[1] += a * b * weight; q[2] += a * c * weight; q[3] += a * d * weight;
  q[4] += b * b * weight; q[5] += b * c * weight; q[6] += b * d * weight;
  q[7] += c * c * weight; q[8] += c * d * weight;
  q[9] += d * d * weight;
}

function addQuadric(into, from) {
  for (let i = 0; i < 10; i += 1) into[i] += from[i];
}

/** vᵀQv — the squared distance to every plane the quadric was built from. */
function error(q, x, y, z) {
  return (
    q[0] * x * x + 2 * q[1] * x * y + 2 * q[2] * x * z + 2 * q[3] * x +
    q[4] * y * y + 2 * q[5] * y * z + 2 * q[6] * y +
    q[7] * z * z + 2 * q[8] * z +
    q[9]
  );
}

/** A tiny binary heap. Entries go stale as the mesh changes and are checked on pop. */
class Heap {
  constructor() {
    this.items = [];
  }
  push(item) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].cost <= a[i].cost) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.items;
    if (!a.length) return null;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let small = i;
        if (l < a.length && a[l].cost < a[small].cost) small = l;
        if (r < a.length && a[r].cost < a[small].cost) small = r;
        if (small === i) break;
        [a[small], a[i]] = [a[i], a[small]];
        i = small;
      }
    }
    return top;
  }
}

/**
 * @param verts  [{ p:[x,y,z], n:[x,y,z], cls }]
 * @param faces  [[i,j,k]]
 * @param target maximum faces to keep
 */
export function simplify(verts, faces, target) {
  const n = verts.length;
  const quadrics = Array.from({ length: n }, zeroQuadric);
  const alive = new Uint8Array(n).fill(1);
  const faceAlive = new Uint8Array(faces.length).fill(1);

  // Faces touching each vertex, so a collapse only has to revisit its own
  // neighbourhood rather than the whole mesh.
  const around = Array.from({ length: n }, () => new Set());
  faces.forEach((f, fi) => f.forEach((v) => around[v].add(fi)));

  const planeOf = (f) => {
    const [a, b, c] = f.map((i) => verts[i].p);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (!(len > 1e-12)) return null;
    nx /= len; ny /= len; nz /= len;
    return [nx, ny, nz, -(nx * a[0] + ny * a[1] + nz * a[2]), len / 2];
  };

  for (const f of faces) {
    const plane = planeOf(f);
    if (!plane) continue;
    const [a, b, c, d, area] = plane;
    // Weighted by area, so a large flat panel is not out-voted by a hundred
    // slivers in a wheel arch.
    for (const v of f) addPlane(quadrics[v], a, b, c, d, area);
  }

  /*
   * Pin the open edges.
   *
   * A downloaded car is a heap of separate shells and every shell has a rim.
   * Those rims are silhouettes — the lip of an arch, the edge of a window
   * surround — and without a penalty they are the cheapest thing in the mesh to
   * delete, so they go first and the outline dissolves.
   */
  const edgeUse = new Map();
  const edgeKey = (i, j) => (i < j ? `${i},${j}` : `${j},${i}`);
  for (const f of faces) {
    for (let e = 0; e < 3; e += 1) {
      const k = edgeKey(f[e], f[(e + 1) % 3]);
      edgeUse.set(k, (edgeUse.get(k) ?? 0) + 1);
    }
  }
  for (const f of faces) {
    const plane = planeOf(f);
    if (!plane) continue;
    for (let e = 0; e < 3; e += 1) {
      const i = f[e];
      const j = f[(e + 1) % 3];
      if (edgeUse.get(edgeKey(i, j)) !== 1) continue;
      // A plane through the boundary edge, perpendicular to the face.
      const a = verts[i].p;
      const b = verts[j].p;
      const ex = b[0] - a[0], ey = b[1] - a[1], ez = b[2] - a[2];
      let px = ey * plane[2] - ez * plane[1];
      let py = ez * plane[0] - ex * plane[2];
      let pz = ex * plane[1] - ey * plane[0];
      const len = Math.hypot(px, py, pz);
      if (!(len > 1e-12)) continue;
      px /= len; py /= len; pz /= len;
      const d = -(px * a[0] + py * a[1] + pz * a[2]);
      addPlane(quadrics[i], px, py, pz, d, plane[4] * 40);
      addPlane(quadrics[j], px, py, pz, d, plane[4] * 40);
    }
  }

  /** The three candidate positions for a collapse, cheapest wins. */
  const best = (i, j) => {
    const q = zeroQuadric();
    addQuadric(q, quadrics[i]);
    addQuadric(q, quadrics[j]);
    const a = verts[i].p;
    const b = verts[j].p;
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    // Solving the 4×4 gives a slightly better point and needs a singularity
    // check on every edge; three candidates is within a hair of it and cannot
    // produce a vertex out in space when the matrix is near-singular.
    let where = a;
    let cost = error(q, a[0], a[1], a[2]);
    for (const cand of [b, mid]) {
      const c = error(q, cand[0], cand[1], cand[2]);
      if (c < cost) {
        cost = c;
        where = cand;
      }
    }
    return { cost: Math.max(0, cost), where };
  };

  const heap = new Heap();
  const version = new Int32Array(n);
  for (const [k, uses] of edgeUse) {
    void uses;
    const [i, j] = k.split(",").map(Number);
    // Materials never merge.
    if (verts[i].cls !== verts[j].cls) continue;
    const { cost, where } = best(i, j);
    heap.push({ cost, i, j, where, vi: 0, vj: 0 });
  }

  let liveFaces = faces.length;

  const wouldFlip = (i, j, where) => {
    for (const fi of around[i]) {
      if (!faceAlive[fi]) continue;
      const f = faces[fi];
      if (f.includes(j)) continue;
      const before = planeOf(f);
      if (!before) continue;
      const moved = f.map((v) => (v === i ? { p: where } : verts[v]));
      const [a, b, c] = moved.map((v) => v.p);
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz);
      if (!(len > 1e-14)) return true;
      const dot = (nx * before[0] + ny * before[1] + nz * before[2]) / len;
      if (dot < 0.1) return true;
    }
    return false;
  };

  while (liveFaces > target) {
    const top = heap.pop();
    if (!top) break;
    const { i, j, where } = top;
    if (!alive[i] || !alive[j]) continue;
    if (top.vi !== version[i] || top.vj !== version[j]) continue;
    if (wouldFlip(i, j, where) || wouldFlip(j, i, where)) continue;

    // Collapse j into i.
    verts[i].p = where;
    addQuadric(quadrics[i], quadrics[j]);
    alive[j] = 0;

    for (const fi of around[j]) {
      const f = faces[fi];
      if (!faceAlive[fi]) continue;
      if (f.includes(i)) {
        faceAlive[fi] = 0;
        liveFaces -= 1;
        continue;
      }
      for (let e = 0; e < 3; e += 1) if (f[e] === j) f[e] = i;
      around[i].add(fi);
    }
    around[j].clear();

    version[i] += 1;

    // Re-price everything still touching i.
    const neighbours = new Set();
    for (const fi of around[i]) {
      if (!faceAlive[fi]) continue;
      for (const v of faces[fi]) if (v !== i && alive[v]) neighbours.add(v);
    }
    for (const k of neighbours) {
      if (verts[i].cls !== verts[k].cls) continue;
      const { cost, where: w } = best(i, k);
      heap.push({ cost, i, j: k, where: w, vi: version[i], vj: version[k] });
    }
  }

  // Compact.
  const remap = new Int32Array(n).fill(-1);
  const outVerts = [];
  for (let v = 0; v < n; v += 1) {
    if (!alive[v]) continue;
    remap[v] = outVerts.length;
    outVerts.push(verts[v]);
  }
  const outFaces = [];
  for (let f = 0; f < faces.length; f += 1) {
    if (!faceAlive[f]) continue;
    const [a, b, c] = faces[f].map((v) => remap[v]);
    if (a < 0 || b < 0 || c < 0 || a === b || b === c || a === c) continue;
    outFaces.push([a, b, c]);
  }

  /*
   * Recompute the normals.
   *
   * The originals belonged to vertices that have moved and to faces that no
   * longer exist. Keeping them leaves the shading describing a surface the
   * geometry no longer has, which reads as dents in flat panels.
   */
  for (const v of outVerts) v.n = [0, 0, 0];
  for (const f of outFaces) {
    const [a, b, c] = f.map((i) => outVerts[i].p);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const i of f) {
      outVerts[i].n[0] += nx;
      outVerts[i].n[1] += ny;
      outVerts[i].n[2] += nz;
    }
  }
  for (const v of outVerts) {
    const len = Math.hypot(...v.n) || 1;
    v.n = v.n.map((c) => c / len);
  }

  return { verts: outVerts, tris: outFaces };
}
