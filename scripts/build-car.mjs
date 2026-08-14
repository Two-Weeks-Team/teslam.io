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
const CLASSES = [
  [3, /glass|window|windscreen|windshield|verre|vidrio|glas|유리/i],
  [1, /tyre|tire|rubber|wheel_?rubber|고무|타이어/i],
  [2, /rim|alloy|wheel|hub|caliper|brake|휠/i],
];

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

/* ── decimate ─────────────────────────────────────────────────────────── */

/**
 * Vertex clustering onto a grid.
 *
 * Not a quadric-error simplifier — those are three hundred lines and a
 * dependency, and at nine hundred pixels wide nobody can see the difference.
 * Clustering snaps every vertex to a cell, averages what lands there, and drops
 * the triangles that collapse. Material class is part of the key, so glass
 * never welds into paint and a wheel never welds into the arch behind it.
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

/* ── write ────────────────────────────────────────────────────────────── */

/**
 * A flat little format, because the browser should do no parsing.
 *
 *   0   magic "TCAR"
 *   4   u16 version   6  u16 flags
 *   8   u32 vertexCount
 *   12  u32 triangleCount
 *   16  f32 bounds × 6        (lo x y z, hi x y z — the quantisation frame)
 *   40  body
 *   i16 position × 3 × vertexCount
 *   i8  normal   × 3 × vertexCount
 *   u8  class        × vertexCount
 *   u16 index    × 3 × triangleCount
 *
 * Positions are quantised into the bounding box. Sixteen bits across two units
 * is a step of sixty microns on a car that renders nine hundred pixels wide —
 * four orders of magnitude below a pixel, and it halves the vertex cost. Normals
 * are unit vectors, so a byte each is already more than the shading can show.
 *
 * Indices are u16, which caps the mesh at 65,535 vertices. That is far above
 * the budget and the encoder refuses rather than silently wrapping.
 */
function encode({ verts, tris }) {
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
  const buf = Buffer.alloc(HEADER + verts.length * (6 + 3 + 1) + tris.length * 6);

  buf.write("TCAR", 0, "ascii");
  buf.writeUInt16LE(1, 4);
  buf.writeUInt16LE(0, 6);
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
const BUDGET = 14_000;

const gltf = readGltf(resolve(source));
const tris = collect(gltf);
if (!tris.length) throw new Error("no triangles found — is this a scene with a mesh in it?");

const pose = normalise(tris);

// Walk the grid up until the result fits the budget. Clustering is cheap and
// this converges in a handful of passes.
let cells = 96;
let mesh = decimate(tris, cells);
while (mesh.tris.length > BUDGET && cells > 24) {
  cells = Math.round(cells * 0.86);
  mesh = decimate(tris, cells);
}

const out = resolve("public/car/model3.bin");
mkdirSync(dirname(out), { recursive: true });
const buf = encode(mesh);
writeFileSync(out, buf);

const byClass = [0, 0, 0, 0];
for (const v of mesh.verts) byClass[v.cls] += 1;

console.log(`source     ${basename(source)}`);
console.log(`            ${tris.length.toLocaleString()} triangles in`);
console.log(`pose       longest axis ${pose.order[0]}, up ${pose.order[2]}, scale ${pose.scale.toExponential(3)}`);
console.log(`decimated  grid ${cells} → ${mesh.tris.length.toLocaleString()} triangles, ${mesh.verts.length.toLocaleString()} vertices`);
console.log(`materials  paint ${byClass[0]}  tyre ${byClass[1]}  alloy ${byClass[2]}  glass ${byClass[3]}`);
console.log(`wrote      public/car/model3.bin  ${(buf.length / 1024).toFixed(0)} KB`);
if (byClass[3] === 0) console.warn("warning: no glass — check the material names in the source");
if (byClass[1] === 0) console.warn("warning: no tyres — check the material names in the source");
