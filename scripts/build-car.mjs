/**
 * Turn a downloaded glTF car into the compact mesh this site renders.
 *
 *   node scripts/build-car.mjs assets/model3.glb
 *
 * Writes `public/car/model3.bin` and prints what it did. Run it once, commit
 * the output, and never ship the source: a 40 MB glb with 4K textures has no
 * business in a clone, and the renderer needs positions, normals and one byte
 * of material per vertex — nothing else.
 *
 * Deliberately dependency-free. glTF 2.0 is a JSON header and a binary blob,
 * and reading the handful of accessors this needs is a page of code; pulling in
 * a loader would put a megabyte in `node_modules` to parse a file format that
 * fits on a postcard. Nothing from here reaches the browser either — the output
 * is a flat buffer the existing WebGL2 renderer uploads directly.
 *
 * Three things it does that a straight conversion would not:
 *
 *   Welds and decimates. A hundred thousand vertices is two megabytes over the
 *   wire to draw an object nine hundred pixels wide. Vertex clustering on a
 *   grid gets it to a budget without a quadric-error library, and at this size
 *   nobody can tell.
 *
 *   Classifies materials. The renderer shades paint, glass, rubber and alloy
 *   differently, and that difference is most of what makes the thing read as a
 *   car. glTF carries material names; they are matched here rather than in the
 *   shader.
 *
 *   Normalises the pose. Source models arrive at arbitrary scale, in any of
 *   three up-axes, facing any direction. The renderer expects a car two units
 *   long, sitting on y = 0, nose at +x — the same frame the generated mesh
 *   used, so the camera, the shadow and the seat placement all still work.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { simplify } from "./simplify.mjs";

/* ── glTF ─────────────────────────────────────────────────────────────── */

const COMPONENT = {
  5120: Int8Array,
  5121: Uint8Array,
  5122: Int16Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array,
};

const COUNT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

/** Split a .glb into its JSON chunk and its binary chunk. */
function readGlb(buf) {
  const magic = buf.readUInt32LE(0);
  if (magic !== 0x46546c67) throw new Error("not a .glb (bad magic)");
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < buf.length) {
    const length = buf.readUInt32LE(offset);
    const type = buf.readUInt32LE(offset + 4);
    const body = buf.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(body));
    if (type === 0x004e4942) bin = body;
    offset += 8 + length + ((4 - (length % 4)) % 4);
  }
  if (!json) throw new Error("no JSON chunk in the .glb");
  return { json, bin };
}

function readGltf(path) {
  const raw = readFileSync(path);
  if (path.endsWith(".glb")) return readGlb(raw);

  const json = JSON.parse(raw.toString("utf8"));
  // A .gltf points at its buffers; only external .bin and data: URIs are used
  // by anything that exports for the web.
  const buffers = (json.buffers ?? []).map((b) => {
    if (!b.uri) throw new Error("a .gltf buffer with no uri");
    if (b.uri.startsWith("data:")) {
      return Buffer.from(b.uri.slice(b.uri.indexOf(",") + 1), "base64");
    }
    return readFileSync(join(dirname(path), decodeURIComponent(b.uri)));
  });
  return { json, bin: buffers[0], buffers };
}

/** Read one accessor into a plain array of tuples. */
function accessor(gltf, index) {
  const acc = gltf.json.accessors[index];
  const view = gltf.json.bufferViews[acc.bufferView];
  const Type = COMPONENT[acc.componentType];
  const per = COUNT[acc.type];
  const source = (gltf.buffers ?? [gltf.bin])[view.buffer ?? 0] ?? gltf.bin;

  const start = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const stride = view.byteStride ?? per * Type.BYTES_PER_ELEMENT;

  const out = [];
  for (let i = 0; i < acc.count; i += 1) {
    const at = start + i * stride;
    const slice = new Type(
      source.buffer.slice(source.byteOffset + at, source.byteOffset + at + per * Type.BYTES_PER_ELEMENT),
    );
    out.push([...slice]);
  }
  return out;
}

/* ── material classes ─────────────────────────────────────────────────── */

/**
 * 0 paint · 1 tyre · 2 alloy · 3 glass.
 *
 * Matched on the material name because that is the only thing an exported car
 * reliably carries. The lists are generous on purpose: a model whose glass is
 * called "Windows_0" and one whose glass is called "verre" should both work,
 * and the cost of a wrong guess is a panel shaded like the wrong thing rather
 * than a crash.
 */
/*
 * Word boundaries, not substrings.
 *
 * `rim` without one matches inside "primary" — which is what this model calls
 * its body paint. Every painted panel on the car came back classed as a wheel,
 * and the radius pass downstream then decided most of it was rubber, so the
 * whole body rendered as a tyre. The lesson is not about this model: a bare
 * three-letter alternative in a regex over artist-supplied names will always
 * find a word it was not looking for.
 */
/**
 * A separator is anything that is not a letter — including the underscore.
 *
 * `\b` treats `_` as a word character, so `\bblack` does not match
 * "JUST_BLACK", which is precisely how an artist names the black trim on a car.
 */
const edge = (...words) => new RegExp(`(?:^|[^a-z])(${words.join("|")})`, "i");

const CLASSES = [
  [3, edge("glass", "window", "windscreen", "windshield", "verre", "vidrio", "glas")],
  [1, edge("tyre", "tire", "rubber")],
  // Everything round. Whether a given face is rubber or alloy cannot be told
  // from a name — this model calls them all `wheels.N` — so it is decided
  // later, by radius.
  [2, edge("rim", "alloy", "wheel", "hub", "caliper", "brake")],
  // Satin black plastic: bumper valances, window surrounds, mirror caps, the
  // underbody. Rendered in body paint it lifts the whole lower half of the car
  // to the colour of the roof, and a Model 3's lower half is not that colour.
  [4, edge("black", "hitam", "plastic", "chassis", "suspensi", "trim")],
]

/**
 * The cabin, which is in the file and has no business on the screen.
 *
 * A downloaded car is usually modelled inside and out. Every one of those
 * triangles is behind an opaque body panel and invisible, and they compete for
 * a budget the outside of the car needs — this model spends a fifth of itself
 * on carpet, seat leather, a dashboard and an LCD nobody will ever see.
 *
 * Worse than the cost: the seats are sampled from painted surfaces, and an
 * interior panel is a painted surface. A third of the cohort would have landed
 * inside the car, lighting up where no one could see them.
 */
const INTERIOR = /carpet|seat_?leather|lcd|button|steer|mirror_inside|dashboard|interior|belt\.|headliner/i;

function classify(name = "") {
  for (const [id, re] of CLASSES) if (re.test(name)) return id;
  return 0;
}

/* ── node transforms ──────────────────────────────────────────────────── */

const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 4; j += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += a[k * 4 + j] * b[i * 4 + k];
      out[i * 4 + j] = sum;
    }
  }
  return out;
}

function trs(node) {
  if (node.matrix) return node.matrix;
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const [qx, qy, qz, qw] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];

  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2;
  const yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;

  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

const apply = (m, [x, y, z]) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];

/** Normals ignore translation and, for uniform scale, need no inverse. */
const rotate = (m, [x, y, z]) => {
  const v = [
    m[0] * x + m[4] * y + m[8] * z,
    m[1] * x + m[5] * y + m[9] * z,
    m[2] * x + m[6] * y + m[10] * z,
  ];
  const len = Math.hypot(...v) || 1;
  return v.map((c) => c / len);
};

/* ── collect ──────────────────────────────────────────────────────────── */

let dropped = 0;

function collect(gltf) {
  const tris = [];
  const scene = gltf.json.scenes?.[gltf.json.scene ?? 0];
  const roots = scene?.nodes ?? gltf.json.nodes.map((_, i) => i);

  const walk = (index, parent) => {
    const node = gltf.json.nodes[index];
    const world = multiply(parent, trs(node));

    if (node.mesh != null) {
      for (const prim of gltf.json.meshes[node.mesh].primitives) {
        // Only triangles. A car exported with lines or points in it has
        // something in it that is not the car.
        if ((prim.mode ?? 4) !== 4) continue;
        const pos = accessor(gltf, prim.attributes.POSITION);
        const nor = prim.attributes.NORMAL != null ? accessor(gltf, prim.attributes.NORMAL) : null;
        const idx = prim.indices != null
          ? accessor(gltf, prim.indices).map((v) => v[0])
          : pos.map((_, i) => i);

        const material = gltf.json.materials?.[prim.material]?.name ?? "";
        if (INTERIOR.test(material)) {
          dropped += 1;
          continue;
        }
        const cls = classify(material);

        for (let i = 0; i + 2 < idx.length; i += 3) {
          const face = [idx[i], idx[i + 1], idx[i + 2]].map((v) => ({
            p: apply(world, pos[v]),
            n: nor ? rotate(world, nor[v]) : null,
          }));
          tris.push({ face, cls });
        }
      }
    }

    for (const child of node.children ?? []) walk(child, world);
  };

  for (const root of roots) walk(root, identity());
  return tris;
}

/* ── normalise the pose ───────────────────────────────────────────────── */

/**
 * Put the car where the renderer expects it: two units long on x, nose at +x,
 * sitting on y = 0, centred on z.
 *
 * The up-axis and the facing are inferred from the bounding box rather than
 * assumed. A car is longest along its length, shortest along its height, and
 * middling across its width — which identifies all three axes from the extents
 * alone, and is the one thing about a car model that is reliably true.
 */
function normalise(tris) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const { face } of tris) {
    for (const { p } of face) {
      for (let a = 0; a < 3; a += 1) {
        if (p[a] < lo[a]) lo[a] = p[a];
        if (p[a] > hi[a]) hi[a] = p[a];
      }
    }
  }
  const size = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
  const order = [0, 1, 2].sort((a, b) => size[b] - size[a]);
  const [long, wide, tall] = order;

  const scale = 2 / size[long];
  const mid = (a) => (lo[a] + hi[a]) / 2;

  const place = ([x, y, z]) => {
    const v = [x, y, z];
    return [
      (v[long] - mid(long)) * scale,
      (v[tall] - lo[tall]) * scale,
      (v[wide] - mid(wide)) * scale,
    ];
  };
  const spin = ([x, y, z]) => {
    const v = [x, y, z];
    return [v[long], v[tall], v[wide]];
  };

  for (const { face } of tris) {
    for (const vert of face) {
      vert.p = place(vert.p);
      if (vert.n) vert.n = spin(vert.n);
    }
  }

  /*
   * Which end is the nose.
   *
   * The cabin sits behind the middle of a saloon, so the taller half is the
   * back. Measuring the mean height of each half and putting the lower one at
   * +x gets the car facing the way the camera expects without anybody having
   * to know how the artist happened to orient it.
   */
  let frontSum = 0;
  let frontN = 0;
  let backSum = 0;
  let backN = 0;
  for (const { face } of tris) {
    for (const { p } of face) {
      if (p[0] > 0) {
        frontSum += p[1];
        frontN += 1;
      } else {
        backSum += p[1];
        backN += 1;
      }
    }
  }
  if (frontN && backN && frontSum / frontN > backSum / backN) {
    for (const { face } of tris) {
      for (const vert of face) {
        vert.p = [-vert.p[0], vert.p[1], -vert.p[2]];
        if (vert.n) vert.n = [-vert.n[0], vert.n[1], -vert.n[2]];
      }
    }
  }

  return { size, order, scale };
}

/* ── tyres ────────────────────────────────────────────────────────────── */

/**
 * Split the wheels into rubber and alloy, by radius.
 *
 * No exporter agrees on what to call these — this model names all six of them
 * `wheels.N` — and the base colours live in textures, so neither the name nor
 * the material factors can tell them apart. The geometry can: a wheel is a disc
 * about its axle, the tyre is the outer band of that disc, and the face is
 * everything inside it.
 *
 * Runs after the pose is normalised, so the axle is along z and the disc lies
 * in x-y. Each wheel is found by clustering on the two signs, which is all four
 * of them and needs no threshold.
 */
function splitWheels(tris) {
  const groups = new Map();
  for (const t of tris) {
    if (t.cls !== 2) continue;
    const mid = t.face.reduce(
      (acc, v) => [acc[0] + v.p[0] / 3, acc[1] + v.p[1] / 3, acc[2] + v.p[2] / 3],
      [0, 0, 0],
    );
    const key = `${mid[0] > 0 ? "f" : "r"}${mid[2] > 0 ? "l" : "r"}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ t, mid });
  }

  let tyres = 0;
  for (const members of groups.values()) {
    const cx = members.reduce((s, m) => s + m.mid[0], 0) / members.length;
    const cy = members.reduce((s, m) => s + m.mid[1], 0) / members.length;

    const radii = members
      .map((m) => Math.hypot(m.mid[0] - cx, m.mid[1] - cy))
      .sort((a, b) => a - b);
    // The 96th percentile, not the maximum: one stray face on a brake duct
    // would otherwise set the scale and leave the whole tyre classed as alloy.
    const outer = radii[Math.floor(radii.length * 0.96)] || radii[radii.length - 1];

    for (const { t, mid } of members) {
      const r = Math.hypot(mid[0] - cx, mid[1] - cy);
      if (r > outer * 0.74) {
        t.cls = 1;
        tyres += 1;
      }
    }
  }
  return tyres;
}

/**
 * Throw away the inside of the glass.
 *
 * Car glass is modelled as a solid: an outer surface and an inner one a few
 * millimetres behind it. Both survive simplification, both end up nearly
 * coincident, and the depth buffer cannot separate them — so the greenhouse
 * renders as a field of black shards with lit edges, which is z-fighting and
 * looks exactly like a mesh that has been torn.
 *
 * The inner surface is the one whose normal points back toward the car's own
 * axis. Nobody can see it through an opaque outer pane, so it goes.
 */
/**
 * Drop the back half of every coincident double shell.
 *
 * `shellGlass` fixed the greenhouse by judging each face on its own — does its
 * normal point away from the car's axis? — and that test is only confident on
 * the flanks and the roof. At the nose and the tail the outward direction is
 * almost entirely along x, where the radial test has nothing to measure, so it
 * cannot be trusted to delete anything there and the doors kept their second
 * skin: small dark shards with lit edges along every shut line, the same
 * z-fighting signature the windows had.
 *
 * This pass judges faces in *pairs* instead. Two triangles at the same place
 * with opposing normals are a double shell by construction, and deciding which
 * of the two faces outward is a comparison rather than a threshold — one of
 * them points away from the car's centre and the other points into it, and
 * that stays true at the nose, at the tail, and on the underside. The test is
 * at its most confident exactly where the single-face test is at its weakest.
 *
 * Nothing is dropped without a partner, so a single-skinned panel is never at
 * risk however it happens to be oriented.
 */
function dedupeShells(tris) {
  // Two millimetres, in the units `normalise` left behind. Shells further
  // apart than that do not z-fight — they have real thickness, and the inner
  // surface of a genuinely thick panel is somebody's design decision rather
  // than a duplicate.
  const TOL = 8e-4;

  let cx = 0, cy = 0, cz = 0, n = 0;
  for (const { face } of tris) {
    for (const v of face) {
      cx += v.p[0]; cy += v.p[1]; cz += v.p[2]; n += 1;
    }
  }
  n = Math.max(1, n);
  cx /= n; cy /= n; cz /= n;

  const meta = tris.map(({ face }) => {
    const m = [0, 0, 0];
    for (const v of face) for (let a = 0; a < 3; a += 1) m[a] += v.p[a] / 3;
    const [a, b, c] = face.map((v) => v.p);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    // How far outward this face looks, measured from the car's own centre.
    const ox = m[0] - cx, oy = m[1] - cy, oz = m[2] - cz;
    const olen = Math.hypot(ox, oy, oz) || 1;
    return { m, nrm: [nx, ny, nz], out: (nx * ox + ny * oy + nz * oz) / olen };
  });

  const cell = (v) => Math.round(v / TOL);
  const buckets = new Map();
  meta.forEach((f, i) => {
    const k = `${cell(f.m[0])},${cell(f.m[1])},${cell(f.m[2])}`;
    const at = buckets.get(k);
    if (at) at.push(i);
    else buckets.set(k, [i]);
  });

  const drop = new Uint8Array(tris.length);
  let dropped = 0;

  for (let i = 0; i < meta.length; i += 1) {
    if (drop[i]) continue;
    const f = meta[i];
    const bx = cell(f.m[0]), by = cell(f.m[1]), bz = cell(f.m[2]);
    for (let dx = -1; dx <= 1; dx += 1)
      for (let dy = -1; dy <= 1; dy += 1)
        for (let dz = -1; dz <= 1; dz += 1) {
          const near = buckets.get(`${bx + dx},${by + dy},${bz + dz}`);
          if (!near) continue;
          for (const j of near) {
            if (j <= i || drop[j] || drop[i]) continue;
            const g = meta[j];
            if (Math.hypot(g.m[0] - f.m[0], g.m[1] - f.m[1], g.m[2] - f.m[2]) > TOL) continue;
            // Back to back, not merely adjacent.
            const dot = f.nrm[0] * g.nrm[0] + f.nrm[1] * g.nrm[1] + f.nrm[2] * g.nrm[2];
            if (dot > -0.85) continue;
            const loser = f.out >= g.out ? j : i;
            drop[loser] = 1;
            dropped += 1;
          }
        }
  }

  return { kept: tris.filter((_, i) => !drop[i]), dropped };
}

function shellGlass(tris) {
  let midY = 0;
  let n = 0;
  for (const { face } of tris) {
    for (const v of face) {
      midY += v.p[1];
      n += 1;
    }
  }
  midY /= Math.max(1, n);

  let dropped = 0;
  const kept = tris.filter(({ face, cls }) => {
    if (cls !== 3) return true;
    const mid = face.reduce(
      (acc, v) => [acc[0] + v.p[0] / 3, acc[1] + v.p[1] / 3, acc[2] + v.p[2] / 3],
      [0, 0, 0],
    );
    const [a, b, c] = face.map((v) => v.p);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    const outY = mid[1] - midY;
    const outLen = Math.hypot(outY, mid[2]) || 1;
    const facing = (ny * outY + nz * mid[2]) / (len * outLen);
    if (facing < -0.05) {
      dropped += 1;
      return false;
    }
    return true;
  });
  return { kept, dropped };
}

/* ── decimate ─────────────────────────────────────────────────────────── */

/**
 * Weld exact duplicates into an indexed mesh.
 *
 * The simplifier needs to know which triangles share an edge, and a glTF export
 * arrives with every triangle carrying its own three vertices split by UV seam
 * and smoothing group. Without welding first, no two faces share anything, every
 * edge is a boundary, and the collapse has nothing to work on.
 *
 * The tolerance is a hair under a millimetre on a real car — enough to close a
 * seam, far too little to merge two surfaces that were meant to be apart.
 */
function weld(tris) {
  const key = new Map();
  const verts = [];
  const faces = [];

  for (const { face, cls } of tris) {
    const ids = face.map((vert) => {
      const k = `${cls}|${Math.round(vert.p[0] * 5000)}|${Math.round(vert.p[1] * 5000)}|${Math.round(vert.p[2] * 5000)}`;
      let id = key.get(k);
      if (id == null) {
        id = verts.length;
        key.set(k, id);
        verts.push({ p: [...vert.p], n: vert.n ? [...vert.n] : [0, 1, 0], cls });
      }
      return id;
    });
    if (ids[0] === ids[1] || ids[1] === ids[2] || ids[0] === ids[2]) continue;
    faces.push(ids);
  }
  return { verts, faces };
}

/**
 * Vertex clustering onto a grid — the fallback, no longer the main path.
 *
 * Kept because it is O(n) and cannot fail, so it is what runs when a source is
 * too large to simplify properly inside a reasonable time. Its weakness is
 * exactly why the simplifier exists: a cell coarse enough to hit the budget is
 * larger than a glass roof is thick, so the panel welds through itself and the
 * roof comes back torn into holes.
 */
function decimate(tris, cells) {
  const key = new Map();
  const verts = [];
  const out = [];

  const cell = (v, cls) =>
    `${cls}|${Math.round(((v[0] + 1) / 2) * cells)}|${Math.round((v[1] / 0.7) * cells)}|${Math.round(((v[2] + 0.5) / 1) * cells)}`;

  for (const { face, cls } of tris) {
    const ids = face.map((vert) => {
      const k = cell(vert.p, cls);
      let id = key.get(k);
      if (id == null) {
        id = verts.length;
        key.set(k, id);
        verts.push({ p: [0, 0, 0], n: [0, 0, 0], cls, n_: 0 });
      }
      const acc = verts[id];
      for (let a = 0; a < 3; a += 1) {
        acc.p[a] += vert.p[a];
        if (vert.n) acc.n[a] += vert.n[a];
      }
      acc.n_ += 1;
      return id;
    });

    // Degenerate after welding: two corners in the same cell is not a triangle.
    if (ids[0] === ids[1] || ids[1] === ids[2] || ids[0] === ids[2]) continue;
    out.push(ids);
  }

  for (const v of verts) {
    for (let a = 0; a < 3; a += 1) v.p[a] /= v.n_;
    const len = Math.hypot(...v.n) || 1;
    v.n = v.n.map((c) => c / len);
  }

  return { verts, tris: out };
}

/* ── seats ────────────────────────────────────────────────────────────── */

/**
 * Place the five hundred, here rather than in the browser.
 *
 * The reader's copy of this used to sample the mesh on load, and it could only
 * ever use tests cheap enough to run on the main thread: paint class, and a
 * normal pointing away from the car's centre. Both are necessary and together
 * they are not sufficient, because a car door has *two* outward-facing painted
 * skins — the outer one you can see and the inner one three centimetres behind
 * it — and nothing in either test can tell them apart. A third of the cohort
 * was landing on the inside of the bodywork, buried under the panel it belongs
 * to, and the only seats that survived the depth test were the ones that
 * happened to sit on a shut line where the geometry steps forward. The render
 * came back with five hundred seats tracing every door seam and leaving the
 * door skins bare.
 *
 * The test that separates them is a ray: stand on the face, walk out along its
 * own normal, and see whether any other triangle is in the way. That is
 * O(candidates × triangles) and there is no version of it that belongs on a
 * page load, but it costs a couple of seconds here, once, for everyone.
 *
 * So the seats are baked. The browser reads a list.
 */
function placeSeats(verts, tris, count) {
  const centre = [0, 0, 0];
  for (const v of verts) for (let a = 0; a < 3; a += 1) centre[a] += v.p[a] / verts.length;
  let loY = Infinity;
  let hiY = -Infinity;
  for (const v of verts) {
    if (v.p[1] < loY) loY = v.p[1];
    if (v.p[1] > hiY) hiY = v.p[1];
  }
  // Under the sill is outward-facing, painted, and under the car.
  const sill = loY + (hiY - loY) * 0.22;

  const face = tris.map((t) => {
    const [a, b, c] = t.map((i) => verts[i].p);
    const sn = [0, 1, 2].map((x) => t.reduce((acc, i) => acc + verts[i].n[x] / 3, 0));
    const sl = Math.hypot(...sn);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    const m = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    const wind = len > 0 ? [nx / len, ny / len, nz / len] : [0, 1, 0];
    const shade = sl > 0.35 ? sn.map((v) => v / sl) : wind;
    return { a, b, c, n: wind, shade, area: len / 2, m };
  });

  /*
   * A uniform grid over the triangles, so the ray only meets the ones near it.
   * Brute force is a hundred million intersection tests and about half a minute;
   * this is a second.
   */
  const CELL = 0.05;
  const key = (x, y, z) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;
  const grid = new Map();
  face.forEach((f, i) => {
    // Walk the triangle's bounding box. These are small next to a cell.
    const lo = [0, 1, 2].map((a) => Math.min(f.a[a], f.b[a], f.c[a]));
    const hi = [0, 1, 2].map((a) => Math.max(f.a[a], f.b[a], f.c[a]));
    for (let x = Math.floor(lo[0] / CELL); x <= Math.floor(hi[0] / CELL); x += 1)
      for (let y = Math.floor(lo[1] / CELL); y <= Math.floor(hi[1] / CELL); y += 1)
        for (let z = Math.floor(lo[2] / CELL); z <= Math.floor(hi[2] / CELL); z += 1) {
          const k = `${x},${y},${z}`;
          const at = grid.get(k);
          if (at) at.push(i);
          else grid.set(k, [i]);
        }
  });

  /*
   * Möller–Trumbore, front and back faces alike — a wall is a wall.
   *
   * `minT` is not an epsilon against self-intersection; that is what `skip` is
   * for. It exists because a ray leaving a *concave* patch — the inside of a
   * wheel arch, the gutter where the roof meets the glass — runs straight into
   * the triangle next door, which is a neighbour rather than a wall. Without
   * it the test called ninety-three per cent of the bodywork buried.
   */
  const hits = (o, d, maxT, skip, minT) => {
    const steps = Math.ceil(maxT / CELL) + 1;
    const seen = new Set();
    for (let s = 0; s <= steps; s += 1) {
      const t = (s / steps) * maxT;
      const near = grid.get(key(o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t));
      if (!near) continue;
      for (const i of near) {
        if (i === skip || seen.has(i)) continue;
        seen.add(i);
        const f = face[i];
        const e1 = [f.b[0] - f.a[0], f.b[1] - f.a[1], f.b[2] - f.a[2]];
        const e2 = [f.c[0] - f.a[0], f.c[1] - f.a[1], f.c[2] - f.a[2]];
        const px = d[1] * e2[2] - d[2] * e2[1];
        const py = d[2] * e2[0] - d[0] * e2[2];
        const pz = d[0] * e2[1] - d[1] * e2[0];
        const det = e1[0] * px + e1[1] * py + e1[2] * pz;
        if (Math.abs(det) < 1e-12) continue;
        const inv = 1 / det;
        const tv = [o[0] - f.a[0], o[1] - f.a[1], o[2] - f.a[2]];
        const u = (tv[0] * px + tv[1] * py + tv[2] * pz) * inv;
        if (u < 0 || u > 1) continue;
        const qx = tv[1] * e1[2] - tv[2] * e1[1];
        const qy = tv[2] * e1[0] - tv[0] * e1[2];
        const qz = tv[0] * e1[1] - tv[1] * e1[0];
        const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv;
        if (v < 0 || u + v > 1) continue;
        const hit = (e2[0] * qx + e2[1] * qy + e2[2] * qz) * inv;
        if (hit > minT && hit < maxT) return true;
      }
    }
    return false;
  };

  /*
   * How far out to look.
   *
   * Far enough to find the outer skin standing in front of an inner one — a
   * door cavity is a few centimetres, a wing maybe ten — and short enough not
   * to find the *other side of the car*, which every face on the near flank
   * would otherwise hit. Sixty centimetres in real terms.
   */
  const REACH = 0.25;

  /*
   * How close is "next door" rather than "in the way".
   *
   * A door cavity on this mesh is about three centimetres; a triangle sharing
   * an edge with this one is within one. This constant lives in the gap.
   *
   * Swept across the whole body, of 4,018 candidate faces it keeps 272 at
   * 0.0001, then 869 · 1,299 · 1,388 · 1,540 · 1,708 at 0.002 · 0.004 · 0.006
   * · 0.010 · 0.016. The curve is a cliff up to about 0.004 and a shrug after
   * it, which is the signature of a threshold that has stopped rejecting
   * neighbours and started rejecting nothing in particular. 0.006 sits just
   * past the knee, at one and a half centimetres.
   *
   * That still leaves well over half the candidates buried, and they should
   * be: a model at this detail carries door inner panels, boot lining, arch
   * liners and bay walls, all of them painted, all of them facing outward, all
   * of them under something.
   */
  const NEAR = 0.006;

  const keep = [];
  const cum = [];
  let total = 0;
  let buried = 0;
  for (let i = 0; i < face.length; i += 1) {
    const f = face[i];
    if (tris[i].some((v) => verts[v].cls !== 0)) continue;
    if (!(f.area > 0)) continue;
    if (f.m[1] < sill) continue;
    /*
     * Which way is out, and who gets to say.
     *
     * Neither normal on this mesh can be trusted alone. Of 12,012 painted
     * faces above the sill, the winding calls 4,018 outward and the shading
     * normals call 3,591 outward, and the two only agree on 2,812 — they are
     * picking out *different shells*, because a model assembled from a few
     * dozen separate pieces has a few dozen chances to get the winding
     * backwards, and a renderer that lights from the vertex normals will never
     * complain.
     *
     * So orientation is not taken from the mesh at all. A face is oriented by
     * geometry — away from the car's centre, which is a fact about where it
     * sits rather than a claim the file makes — and whether it is *visible* is
     * settled by the ray below. Flipping a normal outward cannot smuggle an
     * inner panel in: the outer skin is still standing in front of it, and the
     * ray still finds it.
     */
    const out = [f.m[0] - centre[0], f.m[1] - centre[1], f.m[2] - centre[2]];
    const oLen = Math.hypot(...out) || 1;
    const seed0 = Math.abs(f.shade[0]) + Math.abs(f.shade[1]) + Math.abs(f.shade[2]) > 0
      ? f.shade
      : f.n;
    const sign = seed0[0] * out[0] + seed0[1] * out[1] + seed0[2] * out[2] < 0 ? -1 : 1;
    const dir = [seed0[0] * sign, seed0[1] * sign, seed0[2] * sign];
    // Still reject the tangential: a face edge-on to the outward direction is
    // a shut line or a jamb, and a seat on one sits in a crack.
    if ((dir[0] * out[0] + dir[1] * out[1] + dir[2] * out[2]) / oLen < 0.2) continue;
    if (hits(f.m, dir, REACH, i, NEAR)) {
      buried += 1;
      continue;
    }
    f.dir = dir;
    keep.push(i);
    total += f.area;
    cum.push(total);
  }

  // Deterministic: the same car on the server and in the browser, every render.
  let seed = 0x9e3779b9;
  const rand = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) % 100_000) / 100_000;
  };

  const picked = [];
  for (let i = 0; i < count && keep.length; i += 1) {
    const target = ((i + rand() * 0.9) / count) * total;
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    const f = face[keep[lo]];
    let u = rand();
    let v = rand();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    const w = 1 - u - v;
    picked.push({
      p: [0, 1, 2].map((a) => f.a[a] * w + f.b[a] * u + f.c[a] * v),
      n: f.dir,
    });
  }

  // Nose first: the car assembles from the front as the cohort fills.
  picked.sort((p, q) => q.p[0] - p.p[0]);
  return { seats: picked, buried, kept: keep.length };
}

/* ── write ────────────────────────────────────────────────────────────── */

/**
 * A flat little format, because the browser should do no parsing.
 *
 *   0   magic "TCAR"
 *   4   u16 version   6  u16 seatCount
 *   8   u32 vertexCount
 *   12  u32 triangleCount
 *   16  f32 bounds × 6        (lo x y z, hi x y z — the quantisation frame)
 *   40  body
 *   i16 position × 3 × vertexCount
 *   i8  normal   × 3 × vertexCount
 *   u8  class        × vertexCount
 *   u16 index    × 3 × triangleCount
 *   i16 seat pos × 3 × seatCount
 *   i8  seat nrm × 3 × seatCount
 *
 * Positions are quantised into the bounding box. Sixteen bits across two units
 * is a step of sixty microns on a car that renders nine hundred pixels wide —
 * four orders of magnitude below a pixel, and it halves the vertex cost. Normals
 * are unit vectors, so a byte each is already more than the shading can show.
 *
 * Indices are u16, which caps the mesh at 65,535 vertices. That is far above
 * the budget and the encoder refuses rather than silently wrapping.
 */
function encode({ verts, tris, seats }) {
  if (verts.length > 65_535) throw new Error(`${verts.length} vertices — too many for u16 indices`);

  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const v of verts) {
    for (let a = 0; a < 3; a += 1) {
      if (v.p[a] < lo[a]) lo[a] = v.p[a];
      if (v.p[a] > hi[a]) hi[a] = v.p[a];
    }
  }
  const span = [0, 1, 2].map((a) => Math.max(1e-6, hi[a] - lo[a]));

  const HEADER = 40;
  const buf = Buffer.alloc(
    HEADER + verts.length * (6 + 3 + 1) + tris.length * 6 + seats.length * (6 + 3),
  );

  buf.write("TCAR", 0, "ascii");
  buf.writeUInt16LE(2, 4);
  buf.writeUInt16LE(seats.length, 6);
  // Both counts live in the fixed header so the reader can size every array
  // before it touches the body. These two were briefly written to the same
  // offset, which is a class of bug that produces a file the writer is happy
  // with and the reader cannot use.
  buf.writeUInt32LE(verts.length, 8);
  buf.writeUInt32LE(tris.length, 12);
  for (let a = 0; a < 3; a += 1) buf.writeFloatLE(lo[a], 16 + a * 4);
  for (let a = 0; a < 3; a += 1) buf.writeFloatLE(hi[a], 28 + a * 4);

  let at = HEADER;

  for (const v of verts) {
    for (let a = 0; a < 3; a += 1) {
      const q = Math.round(((v.p[a] - lo[a]) / span[a]) * 65_534) - 32_767;
      buf.writeInt16LE(Math.max(-32_767, Math.min(32_767, q)), at + a * 2);
    }
    at += 6;
  }
  for (const v of verts) {
    for (let a = 0; a < 3; a += 1) {
      buf.writeInt8(Math.max(-127, Math.min(127, Math.round(v.n[a] * 127))), at + a);
    }
    at += 3;
  }
  for (const v of verts) buf.writeUInt8(v.cls, at++);
  for (const t of tris) {
    buf.writeUInt16LE(t[0], at);
    buf.writeUInt16LE(t[1], at + 2);
    buf.writeUInt16LE(t[2], at + 4);
    at += 6;
  }
  // The seats share the body's quantisation frame, so a seat and the panel it
  // sits on round the same way and the two can never drift apart.
  for (const s of seats) {
    for (let a = 0; a < 3; a += 1) {
      const q = Math.round(((s.p[a] - lo[a]) / span[a]) * 65_534) - 32_767;
      buf.writeInt16LE(Math.max(-32_767, Math.min(32_767, q)), at + a * 2);
    }
    at += 6;
  }
  for (const s of seats) {
    for (let a = 0; a < 3; a += 1) {
      buf.writeInt8(Math.max(-127, Math.min(127, Math.round(s.n[a] * 127))), at + a);
    }
    at += 3;
  }
  return buf;
}

/* ── main ─────────────────────────────────────────────────────────────── */

const source = process.argv[2];
if (!source) {
  console.error("usage: node scripts/build-car.mjs <model.glb|model.gltf>");
  process.exit(1);
}

/**
 * Triangle budget.
 *
 * The panel is about nine hundred CSS pixels wide, so at two device pixels per
 * CSS pixel the car covers roughly 1,800 across. Fourteen thousand triangles
 * over that is a triangle every few pixels; past it the wire cost buys nothing
 * anybody can see, and this is an asset a reader downloads before they have
 * decided whether they care.
 */
const BUDGET = 26_000;

/** The cohort. One number, shared with `lib/genesis.ts` by being the same number. */
const SEATS = 500;

const gltf = readGltf(resolve(source));
const tris = collect(gltf);
if (!tris.length) throw new Error("no triangles found — is this a scene with a mesh in it?");

const pose = normalise(tris);
const tyreFaces = splitWheels(tris);
// Reassign rather than splicing in place: `push(...half a million)` puts every
// element on the call stack as an argument and throws.
const glazing = shellGlass(tris);
const shells = dedupeShells(glazing.kept);
const body = shells.kept;

/*
 * Weld, then collapse edges by quadric error.
 *
 * Clustering runs first only as a pre-pass on very large sources: a million
 * triangles through a priority queue is minutes, and knocking the count down
 * on a fine grid first costs almost nothing in quality because the cells are
 * still far smaller than any feature.
 */
let raw = body;
if (body.length > 260_000) {
  const pre = decimate(body, 220);
  raw = pre.tris.map((ids) => ({
    face: ids.map((i) => ({ p: pre.verts[i].p, n: pre.verts[i].n })),
    cls: pre.verts[ids[0]].cls,
  }));
  console.log(`prepass    clustered ${body.length.toLocaleString()} → ${raw.length.toLocaleString()} before collapse`);
}

const welded = weld(raw);
console.log(`welded     ${welded.verts.length.toLocaleString()} vertices, ${welded.faces.length.toLocaleString()} faces`);

const mesh = simplify(welded.verts, welded.faces, BUDGET);
const cells = "qem";

const seating = placeSeats(mesh.verts, mesh.tris, SEATS);

const out = resolve("public/car/model3.bin");
mkdirSync(dirname(out), { recursive: true });
const buf = encode({ ...mesh, seats: seating.seats });
writeFileSync(out, buf);

const byClass = [0, 0, 0, 0];
for (const v of mesh.verts) byClass[v.cls] += 1;

console.log(`seats      ${seating.seats.length} placed on ${seating.kept.toLocaleString()} visible faces, ${seating.buried.toLocaleString()} buried faces skipped`);
console.log(`source     ${basename(source)}`);
console.log(`            ${tris.length.toLocaleString()} triangles in`);
console.log(`pose       longest axis ${pose.order[0]}, up ${pose.order[2]}, scale ${pose.scale.toExponential(3)}`);
console.log(`cabin      ${dropped} interior primitives dropped`);
console.log(`wheels     ${tyreFaces.toLocaleString()} faces reclassified as rubber by radius`);
console.log(`glazing    ${glazing.dropped.toLocaleString()} inward-facing glass faces dropped`);
console.log(`shells     ${shells.dropped.toLocaleString()} back-to-back duplicate faces dropped`);
console.log(`simplified ${cells} → ${mesh.tris.length.toLocaleString()} triangles, ${mesh.verts.length.toLocaleString()} vertices`);
console.log(`materials  paint ${byClass[0]}  tyre ${byClass[1]}  alloy ${byClass[2]}  glass ${byClass[3]}`);
console.log(`wrote      public/car/model3.bin  ${(buf.length / 1024).toFixed(0)} KB`);
if (byClass[3] === 0) console.warn("warning: no glass — check the material names in the source");
if (byClass[1] === 0) console.warn("warning: no tyres — check the material names in the source");
