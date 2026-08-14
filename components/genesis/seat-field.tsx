"use client";

import { useEffect, useRef, useState } from "react";
import { carCells, carMesh, FRONT_AXLE_T, REAR_AXLE_T } from "@/lib/car";
import { loadCar } from "@/lib/car-load";

/**
 * The cohort, drawn as the car it is a cohort of.
 *
 * Five hundred cells sit on the surface of a generated fastback silhouette and
 * light in assembly order as seats are confirmed, so the picture of a filling
 * cohort is a car being built rather than a progress bar wearing a costume.
 *
 * Written against WebGL2 directly. A scene of five hundred instanced quads and
 * one matrix does not earn a 3D library — the library would be twenty times
 * the size of the thing it draws, and every byte of it ships to a reader who
 * came for a message board.
 *
 * The grid it replaces is still rendered, and still server-rendered. That is
 * not a leftover: it is what a crawler indexes, what a reader without
 * JavaScript sees, and what remains if WebGL is unavailable or blocked. The
 * canvas is an enhancement laid over a page that already worked.
 */

const VERT = `#version 300 es
in vec2 aCorner;
in vec3 aPos;
in vec3 aNormal;
in float aSeat;

uniform mat4 uVP;
uniform mat4 uModel;
uniform float uTaken;
uniform float uSize;
uniform float uAspect;
uniform float uFlashSeat;
uniform float uFlashAge;
uniform float uTime;
/* Qualified on both sides. Uniforms shared between stages must agree on
   precision, and relying on the stage defaults to make them agree is how this
   silently failed to link once already. */
uniform highp float uHalo;

out vec2 vCorner;
out float vLit;
out float vDepth;
out float vFlash;
out float vRim;
out float vCoc;

/** Cheap hash. Enough to make five hundred cells breathe out of step. */
float hash(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

void main() {
  vCorner = aCorner;

  /*
   * Assembly with a moving edge, not a switch.
   *
   * A seat used to light the instant its ordinal was reached, so a burst of
   * arrivals read as a row blinking on together. Easing across the last cell
   * gives the fill a leading edge — the cohort assembles rather than toggles.
   */
  vLit = clamp(uTaken - aSeat + 1.0, 0.0, 1.0);
  vFlash = (abs(aSeat - uFlashSeat) < 0.5) ? (1.0 - uFlashAge) : 0.0;

  /*
   * Idle breathing.
   *
   * Without it a cohort nobody is joining is a frozen object, and a frozen
   * object on a page that claims to be live reads as a screenshot. The offset
   * is a fraction of the cell spacing, so the silhouette never smears.
   */
  float seed = hash(aPos * 7.3);
  // Lifted clear of the body it sits on. Without the constant the seats and the
  // surface occupy the same depth and z-fighting eats half of them.
  vec3 world = aPos + aNormal * (0.016 + sin(uTime * 0.9 + seed * 6.283) * 0.007);

  vec4 clip = uVP * vec4(world, 1.0);
  vDepth = clamp((clip.w - 4.2) / 1.7, 0.0, 1.0);

  /*
   * Rim light from the cell's own surface normal.
   *
   * This is what turns a field of billboards into something with a shape: cells
   * along the roofline and the shoulders catch light while cells facing the
   * camera stay flat, and the eye reads a body instead of a cloud.
   */
  vec3 n = normalize(mat3(uModel) * aNormal);
  vRim = pow(1.0 - abs(n.z), 2.0);

  // Circle of confusion: cells off the focal plane grow and soften.
  vCoc = clamp(abs(clip.w - 5.0) * 0.45, 0.0, 1.0);

  float grow = (1.0 + vFlash * 1.8) * (1.0 + vCoc * 0.9) * uHalo;
  vec2 off = aCorner * uSize * grow * vec2(1.0 / uAspect, 1.0);
  gl_Position = clip + vec4(off * clip.w, 0.0, 0.0);
}`;

const FRAG = `#version 300 es
precision mediump float;

in vec2 vCorner;
in float vLit;
in float vDepth;
in float vFlash;
in float vRim;
in float vCoc;

uniform vec3 uLitColour;
uniform vec3 uDimColour;
uniform vec3 uRimColour;
uniform float uDimAlpha;
/* Explicitly highp: a uniform shared with the vertex stage has to match its
   precision there, and floats default to highp in a vertex shader while this
   file declares mediump for fragments. Leaving it implicit failed to link. */
uniform highp float uHalo;

out vec4 outColour;

/** Interleaved gradient noise. One dither at the end kills banding on the dark ground. */
float dither(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void main() {
  float d = length(vCorner);
  if (d > 1.0) discard;

  /*
   * Two passes make the bloom.
   *
   * The halo pass draws the same cells much larger and much fainter, so a lit
   * seat sits inside a glow rather than being a flat disc. It costs one extra
   * draw of five hundred quads — nothing — and it is the single biggest reason
   * the object stops reading as a scatter plot.
   */
  float core = pow(1.0 - smoothstep(0.0, 0.92, d), 1.3);
  float halo = pow(1.0 - smoothstep(0.0, 1.0, d), 2.6);
  float shape = uHalo > 1.5 ? halo : core;

  float near = mix(1.0, 0.72, vDepth);
  float sharp = mix(0.72, 1.0, 1.0 - vCoc);

  vec3 colour = mix(uDimColour, uLitColour, vLit);
  colour = mix(colour, uRimColour, vRim * 0.45 * (1.0 - vLit * 0.5));
  colour = mix(colour, vec3(1.0), vFlash * 0.85);

  float alpha = mix(uDimAlpha, 1.0, vLit) * shape * near * sharp
              + vFlash * 0.5 * shape;
  if (uHalo > 1.5) alpha *= 0.13;

  colour += (1.0 / 255.0) * dither(gl_FragCoord.xy) - (0.5 / 255.0);
  outColour = vec4(colour, alpha);
}`;

/*
 * The body.
 *
 * Deliberately achromatic. Every colour on this figure is doing a job already —
 * gold for a seat held, grey-blue for one free, mint on the rim — and a body
 * that competes for any of them turns a readout into a picture of a car. Kept
 * dark, lit from above, with a bright edge where it turns away: enough to say
 * unmistakably which car, quiet enough that five hundred points still read as
 * the subject.
 */
const BODY_VERT = `#version 300 es
in vec3 aPos;
in vec3 aNormal;
in float aGlass;
in float aMaterial;

uniform mat4 uVP;
uniform mat4 uModel;

out vec3 vN;
out float vDepth;
out float vGlass;
out float vHeight;
out float vMaterial;

void main() {
  vN = normalize(mat3(uModel) * aNormal);
  vGlass = aGlass;
  vMaterial = aMaterial;
  // Height above the road, for the ground bounce and the ambient gradient.
  vHeight = aPos.y;
  vec4 clip = uVP * vec4(aPos, 1.0);
  vDepth = clamp((clip.w - 4.2) / 1.7, 0.0, 1.0);
  gl_Position = clip;
}`;

const BODY_FRAG = `#version 300 es
precision mediump float;

in vec3 vN;
in float vDepth;
in float vGlass;
in float vHeight;
in float vMaterial;

uniform vec3 uBody;
uniform vec3 uGlass;
uniform vec3 uEdge;
uniform vec3 uTyre;
uniform vec3 uAlloy;
uniform vec3 uTrim;

out vec4 outColour;

void main() {
  vec3 n = normalize(vN);

  // A key from above and ahead, and a weak fill from below so the underside is
  // a surface rather than a hole. Both in view space, so the light stays put
  // while the car turns under it.
  float key = max(0.0, dot(n, normalize(vec3(-0.3, 0.9, 0.45))));
  float fill = max(0.0, dot(n, normalize(vec3(0.25, -0.7, 0.3)))) * 0.22;

  // The edge that separates the car from the ground it has no ground on.
  float rim = pow(1.0 - abs(n.z), 3.0);

  /*
   * Glass is not paint with a different colour on it.
   *
   * A window is darker than the metal around it and answers a light source in
   * one tight highlight rather than a broad one, and the line where the two
   * meet is most of what tells an eye it is looking at a car rather than at a
   * loaf. So the greenhouse gets its own base, its own much sharper specular,
   * and a hard edge: the shoulder factor is remapped so the transition happens
   * over a few per cent of the section instead of fading across it.
   */
  float glass = smoothstep(0.35, 0.65, vGlass);

  // Sharp for glass, broad for paint. The half-vector against the same key.
  vec3 h = normalize(normalize(vec3(-0.3, 0.9, 0.45)) + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(0.0, dot(n, h)), mix(28.0, 140.0, glass));

  /*
   * Rubber, then the alloy.
   *
   * A tyre is the darkest and least reflective thing on a car and an alloy is
   * among the brightest. Rendering both in body paint gave two pale discs that
   * read as the largest feature of the object — which is how a car ends up
   * looking like a trolley.
   */
  float tyre = clamp(1.0 - abs(vMaterial - 1.0), 0.0, 1.0);
  float alloy = clamp(1.0 - abs(vMaterial - 2.0), 0.0, 1.0);
  // Satin black plastic — valances, window surrounds, mirror caps, underbody.
  // In body paint it lifts the whole lower half of the car to the colour of
  // the roof, and the lower half of this car is not that colour.
  float trim = clamp(1.0 - abs(vMaterial - 4.0), 0.0, 1.0);

  vec3 base = mix(uBody, uGlass, glass);
  base = mix(base, uTyre, tyre);
  base = mix(base, uAlloy, alloy);
  base = mix(base, uTrim, trim);

  float gloss = mix(mix(mix(0.62, 0.3, glass), 0.14, tyre), 0.24, trim);
  vec3 c = base * (0.3 + key * gloss + fill * (1.0 - tyre * 0.7));
  c += vec3(1.0) * spec * mix(mix(0.1, 0.42, glass), 0.02, tyre);
  c += uEdge * rim * mix(mix(0.55, 0.8, glass), 0.3, tyre);

  // A little ambient gradient so the sills sit in shade and the roof does not.
  c *= 0.78 + 0.34 * clamp(vHeight / 0.62, 0.0, 1.0);

  outColour = vec4(c * mix(1.0, 0.68, vDepth), 1.0);
}`;

/** How far the eye sits from the car, in car lengths. Shared by the camera and
 *  by the depth cues that have to agree with it. */
const EYE = 5.0;

/*
 * The ground the car has no ground on.
 *
 * A contact shadow, and nothing else — no floor, no horizon. Without it the
 * object floats, and the four wheels read as four wheels in a row rather than
 * as two pairs at different distances: the far pair hangs below the sill with
 * nothing to say why. With it the car stands on something, and the something
 * never has to be drawn.
 *
 * Two lobes rather than one ellipse. The dark is tightest under each axle,
 * because that is where a car actually touches the road.
 */
const GROUND_VERT = `#version 300 es
in vec2 aXZ;

uniform mat4 uVP;

out vec2 vXZ;

void main() {
  vXZ = aXZ;
  gl_Position = uVP * vec4(aXZ.x, 0.0, aXZ.y, 1.0);
}`;

const GROUND_FRAG = `#version 300 es
precision mediump float;

in vec2 vXZ;

uniform vec3 uShade;
uniform vec2 uAxles;

out vec4 outColour;

/** Soft elliptical falloff centred on \`c\`, with radii \`r\`. */
float lobe(vec2 p, vec2 c, vec2 r) {
  vec2 d = (p - c) / r;
  return 1.0 - smoothstep(0.0, 1.0, length(d));
}

void main() {
  // The body's own shadow, long and shallow.
  float body = lobe(vXZ, vec2(0.0, 0.0), vec2(1.04, 0.5));
  // And the contact patches, tight and dark.
  float front = lobe(vXZ, vec2(uAxles.x, 0.0), vec2(0.32, 0.44));
  float rear = lobe(vXZ, vec2(uAxles.y, 0.0), vec2(0.32, 0.44));

  outColour = vec4(uShade, clamp(body * 0.66 + max(front, rear) * 0.5, 0.0, 0.96));
}`;

/* ── matrices ─────────────────────────────────────────────────────────── */

function multiply(a: number[], b: number[]): number[] {
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

function perspective(fovY: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fovY / 2);
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) / (near - far), -1,
    0, 0, (2 * far * near) / (near - far), 0,
  ];
}

const translate = (x: number, y: number, z: number) =>
  [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];

function rotateY(a: number) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
}

function rotateX(a: number) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
}

/* ── component ────────────────────────────────────────────────────────── */

export function SeatField({
  taken,
  label,
  justSeat,
  credit,
  children,
}: {
  taken: number;
  label: string;
  /** The seat confirmed a moment ago, for the burst. */
  justSeat: number | null;
  /** Attribution for the downloaded body, shown only once it is on screen. */
  credit?: { label: string; author: string; href: string; licence: string };
  /** The server-rendered grid, shown until the canvas takes over. */
  children: React.ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [live, setLive] = useState(false);
  /** True once the downloaded body has replaced the generated one. The credit
   *  line beside the car appears with it and not before, because there is
   *  nothing to credit until then. */
  const [real, setReal] = useState(false);

  // Read by the animation loop without restarting it. Re-running the whole
  // WebGL setup every time a seat is confirmed would rebuild the buffers and
  // drop a frame at exactly the moment the reader is looking.
  const takenRef = useRef(taken);
  const flashRef = useRef<{ seat: number; at: number } | null>(null);

  // Written in an effect rather than during render: a ref assigned mid-render
  // is a side effect in a function React is allowed to run twice and throw
  // away.
  useEffect(() => {
    takenRef.current = taken;
  }, [taken]);

  useEffect(() => {
    if (justSeat != null) flashRef.current = { seat: justSeat, at: performance.now() };
  }, [justSeat]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
    });
    // No WebGL2, software-blocked, or a context that fails to compile: the grid
    // beneath stays visible and nothing here runs.
    if (!gl) return;

    /*
     * A failure here falls back to the grid, which is the right behaviour for a
     * visitor and a miserable one for whoever is editing the shader: the page
     * simply shows the old thing and says nothing. The log costs nothing at
     * runtime — it only runs when the compile has already failed — and it is
     * the difference between reading an error and guessing at GLSL.
     */
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn("seat-field: shader failed to compile\n", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const link = (vertex: string, fragment: string) => {
      const vs = compile(gl.VERTEX_SHADER, vertex);
      const fs = compile(gl.FRAGMENT_SHADER, fragment);
      if (!vs || !fs) return null;
      const p = gl.createProgram()!;
      gl.attachShader(p, vs);
      gl.attachShader(p, fs);
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.warn("seat-field: program failed to link\n", gl.getProgramInfoLog(p));
        return null;
      }
      return p;
    };

    const program = link(VERT, FRAG);
    const bodyProgram = link(BODY_VERT, BODY_FRAG);
    const groundProgram = link(GROUND_VERT, GROUND_FRAG);
    if (!program || !bodyProgram || !groundProgram) return;
    gl.useProgram(program);

    const cells = carCells();
    const positions = new Float32Array(cells.length * 3);
    const normals = new Float32Array(cells.length * 3);
    const seatIds = new Float32Array(cells.length);
    cells.forEach((cell, i) => {
      positions[i * 3] = cell.x;
      positions[i * 3 + 1] = cell.y;
      positions[i * 3 + 2] = cell.z;
      normals[i * 3] = cell.nx;
      normals[i * 3 + 1] = cell.ny;
      normals[i * 3 + 2] = cell.nz;
      seatIds[i] = cell.seat;
    });

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const corners = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const seatBuffers: Record<string, WebGLBuffer> = {};
    const attach = (
      data: Float32Array,
      name: string,
      size: number,
      divisor: number,
    ) => {
      const buffer = gl.createBuffer()!;
      seatBuffers[name] = buffer;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      const loc = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(loc, divisor);
    };

    attach(corners, "aCorner", 2, 0);
    attach(positions, "aPos", 3, 1);
    attach(normals, "aNormal", 3, 1);
    attach(seatIds, "aSeat", 1, 1);

    const uni = (name: string) => gl.getUniformLocation(program, name);
    const uVP = uni("uVP");
    const uModel = uni("uModel");
    const uTaken = uni("uTaken");
    const uSize = uni("uSize");
    const uAspect = uni("uAspect");
    const uFlashSeat = uni("uFlashSeat");
    const uFlashAge = uni("uFlashAge");
    const uDimAlpha = uni("uDimAlpha");
    const uTime = uni("uTime");
    const uHalo = uni("uHalo");

    // Gold for a seat held, a cold grey for one still free, and mint on the
    // rim — the same three the rest of the board already uses for scarce, idle
    // and live.
    gl.uniform3f(uni("uLitColour"), 1.0, 0.69, 0.13);
    gl.uniform3f(uni("uDimColour"), 0.56, 0.64, 0.74);
    gl.uniform3f(uni("uRimColour"), 0.0, 0.76, 0.66);

    /* ── the body ───────────────────────────────────────────────────────── */

    const mesh = carMesh();
    const bodyVao = gl.createVertexArray();
    gl.bindVertexArray(bodyVao);

    const bodyBuffers: Record<string, WebGLBuffer> = {};
    const meshAttrib = (data: Float32Array, name: string, size: number) => {
      const buffer = gl.createBuffer()!;
      bodyBuffers[name] = buffer;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      const loc = gl.getAttribLocation(bodyProgram, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    meshAttrib(mesh.positions, "aPos", 3);
    meshAttrib(mesh.normals, "aNormal", 3);
    meshAttrib(mesh.glass, "aGlass", 1);
    meshAttrib(mesh.material, "aMaterial", 1);

    const elements = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elements);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.DYNAMIC_DRAW);

    // Counts, not constants: the downloaded car has its own.
    let indexCount = mesh.indices.length;
    const seatCount = cells.length;

    gl.useProgram(bodyProgram);
    const bVP = gl.getUniformLocation(bodyProgram, "uVP");
    const bModel = gl.getUniformLocation(bodyProgram, "uModel");
    // Achromatic, as you asked: a graphite body, glass a shade cooler and much
    // darker, and a cool near-white on the edge. Nothing here competes with the
    // gold of a seat that has been taken.
    gl.uniform3f(gl.getUniformLocation(bodyProgram, "uBody"), 0.3, 0.33, 0.375);
    gl.uniform3f(gl.getUniformLocation(bodyProgram, "uGlass"), 0.085, 0.1, 0.125);
    gl.uniform3f(gl.getUniformLocation(bodyProgram, "uEdge"), 0.72, 0.8, 0.88);
    gl.uniform3f(gl.getUniformLocation(bodyProgram, "uTyre"), 0.055, 0.06, 0.07);
    gl.uniform3f(gl.getUniformLocation(bodyProgram, "uAlloy"), 0.42, 0.46, 0.52);
    gl.uniform3f(gl.getUniformLocation(bodyProgram, "uTrim"), 0.1, 0.11, 0.13);

    /* ── the shadow ─────────────────────────────────────────────────────── */

    const groundVao = gl.createVertexArray();
    gl.bindVertexArray(groundVao);
    const groundBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, groundBuffer);
    // One quad on the road, wide enough to hold the whole falloff.
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1.5, -0.8, 1.5, -0.8, -1.5, 0.8, -1.5, 0.8, 1.5, -0.8, 1.5, 0.8]),
      gl.STATIC_DRAW,
    );
    const groundLoc = gl.getAttribLocation(groundProgram, "aXZ");
    gl.enableVertexAttribArray(groundLoc);
    gl.vertexAttribPointer(groundLoc, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(groundProgram);
    const gVP = gl.getUniformLocation(groundProgram, "uVP");
    gl.uniform3f(gl.getUniformLocation(groundProgram, "uShade"), 0.01, 0.015, 0.02);
    gl.uniform2f(
      gl.getUniformLocation(groundProgram, "uAxles"),
      2 * FRONT_AXLE_T - 1,
      2 * REAR_AXLE_T - 1,
    );

    gl.bindVertexArray(null);
    gl.useProgram(program);

    // Depth is what makes the seats on the far side disappear behind the car,
    // and that occlusion is the only cue in the whole figure that proves the
    // object has a volume rather than being a cloud shaped like one. The cost
    // is that the point passes now have to say they are not writing depth.
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    // Additive for the points: the overlap where the body doubles back on
    // itself becomes a highlight instead of a seam.
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    let width = 0;
    let height = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (w === width && h === height) return;
      width = w;
      height = h;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    };

    // Pointer tilt, so the object answers the reader rather than only playing
    // at them. Kept small — this is a figure on a page, not a viewer.
    let aimX = 0;
    let aimY = 0;
    let leanX = 0;
    let leanY = 0;
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      aimX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      aimY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    const onLeave = () => {
      aimX = 0;
      aimY = 0;
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);

    /*
     * Swap in the real car, if there is one.
     *
     * The generated body draws immediately, so the panel is never empty and a
     * reader on a slow connection sees a car rather than a hole. When the
     * downloaded mesh arrives its vertices replace what is in the buffers and
     * the draw counts move with them; when it does not arrive — no file, a
     * failed fetch, a decoder that refuses the version — the generated one
     * simply stays, which is why this is a swap and not a dependency.
     */
    const abort = new AbortController();
    void loadCar(abort.signal).then((real) => {
      if (!real || abort.signal.aborted) return;

      const put = (buffer: WebGLBuffer | undefined, data: Float32Array) => {
        if (!buffer) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      };

      gl.bindVertexArray(bodyVao);
      put(bodyBuffers.aPos, real.positions);
      put(bodyBuffers.aNormal, real.normals);
      put(bodyBuffers.aMaterial, real.material);
      // The downloaded mesh carries a material class and no separate glass
      // gradient, so glass is derived from the class rather than interpolated
      // across the shoulder — a hard edge, which is what a window has.
      put(bodyBuffers.aGlass, real.material.map((m) => (m === 3 ? 1 : 0)));

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elements);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, real.indices, gl.STATIC_DRAW);
      indexCount = real.indices.length;

      gl.bindVertexArray(vao);
      put(seatBuffers.aPos, real.cells);
      put(seatBuffers.aNormal, real.cellNormals);

      gl.bindVertexArray(null);
      setReal(true);
    });

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let clock = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      resize();

      /*
       * A sweep around three-quarters, not a turntable.
       *
       * A full rotation spends a third of its time with the car pointing at
       * the reader, where a fastback is two feet wide and unreadable — the
       * first screenshot of this caught exactly that and showed a smudge.
       * Oscillating between about 7° and 41° keeps the shape legible in every
       * frame and still moves. The range sits nearer profile than it used to:
       * this car is recognised from the side, where the roofline is one arc
       * and the tail is a deck rather than a hatch, and a three-quarter view
       * steep enough to show the bonnet throws all of that away.
       */
      if (!still) clock += dt;
      /*
       * Negative, so the nose comes toward the reader.
       *
       * It was positive, which turns the car away and puts the camera over the
       * boot lid — the least flattering angle there is, and the one where the
       * largest flat surface on the car fills the frame. Every photograph ever
       * taken of a car for the purpose of showing what it is has been taken
       * from the front three-quarter. This is that.
       */
      const spin = -0.5 + Math.sin(clock * 0.32) * 0.34;

      leanX += (aimX * 0.34 - leanX) * 0.06;
      leanY += (aimY * 0.16 - leanY) * 0.06;

      const aspect = width / Math.max(height, 1);
      // The model rotation on its own, so the shader can turn a cell's normal
      // into view space without inverting the whole view-projection.
      // Nearer eye level than before. Looking down at a car foreshortens the
      // roofline into a plan view, and the roofline is the whole point.
      const model = multiply(rotateX(-0.16 + leanY), rotateY(spin + leanX));
      /*
       * Closer, and looking at the car rather than down at it.
       *
       * The old placement left the body filling about half the frame with the
       * rest empty sky, which costs the shape the pixels it needs: five
       * hundred points can only describe a silhouette if the silhouette is
       * large enough for the gaps between them to close. Dropping the eye
       * height as well flattens the plan view and lets the roofline read as a
       * profile, which is the view this car is recognised from.
       */
      /*
       * Far away, through a long lens.
       *
       * The camera used to sit one car-length from a two-unit car behind a 35°
       * lens, which is an extreme wide angle: the nose came out enormous, the
       * tail vanished, and the proportions this shape was rebuilt to get right
       * were destroyed on the way to the screen. Photographs of cars are taken
       * from across a car park for exactly this reason. Backing off to five and
       * a half units and narrowing to 15° keeps the object the same size in
       * frame and hands back the proportions.
       */
      const view = multiply(translate(0, -0.3, -EYE), model);
      const vp = multiply(perspective(0.21, aspect, 0.1, 40), view);

      /*
       * Depth writes back on before the clear.
       *
       * `glClear` honours the depth write mask, and the seat pass leaves it
       * false. So from the second frame onward the depth buffer was never
       * actually cleared: the body and its seats were tested against an
       * accumulation of every earlier orientation, and as the car turned it
       * clipped itself away against its own past. Invisible on frame one,
       * which is the only frame a still screenshot shows.
       */
      gl.depthMask(true);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const vpArray = new Float32Array(vp);
      const modelArray = new Float32Array(model);

      // The shadow first, on the road, under everything. Blended rather than
      // opaque, and it writes no depth: it is a darkening of the page, not a
      // surface anything can be behind.
      gl.useProgram(groundProgram);
      gl.bindVertexArray(groundVao);
      gl.depthMask(false);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniformMatrix4fv(gVP, false, vpArray);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // Then the car, opaque, writing depth. Everything after it is a seat and
      // every seat behind the body is now correctly hidden by it.
      gl.useProgram(bodyProgram);
      gl.bindVertexArray(bodyVao);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.uniformMatrix4fv(bVP, false, vpArray);
      gl.uniformMatrix4fv(bModel, false, modelArray);
      gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);

      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.enable(gl.BLEND);
      /*
       * Additive again.
       *
       * `blendFunc` is global — it belongs to neither the program nor the
       * vertex array — and the shadow pass above sets it to straight alpha. So
       * after the first frame the seats were compositing with SRC_ALPHA,
       * ONE_MINUS_SRC_ALPHA: the halo pass drew first and the core pass painted
       * over it instead of adding to it, the glow stopped accumulating, and the
       * "order does not matter" argument two comments below stopped being true.
       */
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      // Tested against the body, but not written: five hundred additive quads
      // writing depth would occlude each other and the glow would come apart.
      gl.depthMask(false);

      gl.uniformMatrix4fv(uVP, false, new Float32Array(vp));
      gl.uniformMatrix4fv(uModel, false, new Float32Array(model));
      gl.uniform1f(uTaken, takenRef.current);
      gl.uniform1f(uAspect, aspect);
      // Tuned against the section width the car actually gets. The first value
      // was set when this was a 500px sidebar panel; at full width the same
      // number drew the object as dust.
      gl.uniform1f(uSize, 0.026);
      // The same clock the sweep uses, not the wall clock. Reading
      // `performance.now()` here left the idle breathing running for a reader
      // who asked for reduced motion — the rotation stopped and the cells
      // carried on moving, which is half a setting honoured.
      gl.uniform1f(uTime, clock);
      // The body carries the shape now, so the unlit seats no longer have to.
      // They used to be drawn near-opaque on an empty cohort because there was
      // nothing else to see; over a solid car the same value is noise laid on
      // top of the thing it was standing in for.
      gl.uniform1f(uDimAlpha, takenRef.current === 0 ? 0.5 : 0.34);

      const flash = flashRef.current;
      const age = flash ? (now - flash.at) / 2200 : 2;
      gl.uniform1f(uFlashSeat, flash && age < 1 ? flash.seat : -1);
      gl.uniform1f(uFlashAge, Math.min(1, age));

      /*
       * Halo first, then core.
       *
       * Two draws of the same five hundred quads: one large and very faint for
       * the glow, one small and bright for the cell itself. Additive blending
       * makes the order irrelevant to correctness, but drawing the halo first
       * keeps the bright core on top where overlaps pile up.
       */
      gl.uniform1f(uHalo, 3.4);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, seatCount);

      gl.uniform1f(uHalo, 1.0);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, seatCount);

      raf = requestAnimationFrame(frame);
    };

    setLive(true);
    raf = requestAnimationFrame(frame);

    return () => {
      abort.abort();
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <div className={live ? "sfield sfield--live" : "sfield"}>
      <canvas
        className="sfield__gl"
        ref={canvasRef}
        role="img"
        aria-label={label}
      />
      {/* The licence requires this and it appears only when there is something
          to credit — the generated body is nobody's but ours. */}
      {real && credit ? (
        <p className="sfield__credit">
          {credit.label}{" "}
          <a href={credit.href} rel="noopener noreferrer nofollow" target="_blank">
            {credit.author}
          </a>{" "}
          <span>{credit.licence}</span>
        </p>
      ) : null}
      {/* Hidden from assistive technology only once the canvas is carrying the
          same information under its own label. */}
      <div className="sfield__flat" aria-hidden={live || undefined}>
        {children}
      </div>
    </div>
  );
}
