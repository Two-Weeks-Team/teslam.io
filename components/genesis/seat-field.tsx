"use client";

import { useEffect, useRef, useState } from "react";
import { carCells } from "@/lib/car";

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
in float aSeat;

uniform mat4 uVP;
uniform float uTaken;
uniform float uSize;
uniform float uAspect;
uniform float uFlashSeat;
uniform float uFlashAge;

out vec2 vCorner;
out float vLit;
out float vDepth;
out float vFlash;

void main() {
  vCorner = aCorner;
  // A seat lights when its ordinal has been reached. Strictly less-or-equal,
  // so seat 1 lights at a count of 1 rather than at 2.
  vLit = step(aSeat, uTaken);
  vFlash = (abs(aSeat - uFlashSeat) < 0.5) ? (1.0 - uFlashAge) : 0.0;

  vec4 clip = uVP * vec4(aPos, 1.0);
  // Depth is kept for brightness only. Fading the far side of the body is what
  // makes a rotating point cloud read as a solid.
  vDepth = clamp((clip.w - 1.7) / 1.9, 0.0, 1.0);

  // Billboard at a constant screen size: cells on the far side must stay big
  // enough to be seen as part of a surface rather than as noise.
  float grow = 1.0 + vFlash * 1.6;
  vec2 off = aCorner * uSize * grow * vec2(1.0 / uAspect, 1.0);
  gl_Position = clip + vec4(off * clip.w, 0.0, 0.0);
}`;

const FRAG = `#version 300 es
precision mediump float;

in vec2 vCorner;
in float vLit;
in float vDepth;
in float vFlash;

uniform vec3 uLitColour;
uniform vec3 uDimColour;
uniform float uDimAlpha;

out vec4 outColour;

void main() {
  float d = length(vCorner);
  if (d > 1.0) discard;

  // Soft-edged rather than square. Five hundred hard squares on a curved
  // surface alias into a moiré the moment the body turns.
  float edge = smoothstep(1.0, 0.35, d);
  // Only a light touch of depth fade. At the first setting the far side of the
  // body dropped to a third and, with the unlit cells already dim, the car had
  // no silhouette at all — the render was gold confetti on black.
  float near = mix(1.0, 0.62, vDepth);

  vec3 colour = mix(uDimColour, uLitColour, vLit);
  colour = mix(colour, vec3(1.0), vFlash * 0.85);

  float alpha = mix(uDimAlpha, 1.0, vLit) * edge * near + vFlash * 0.5 * edge;
  outColour = vec4(colour, alpha);
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
  children,
}: {
  taken: number;
  label: string;
  /** The seat confirmed a moment ago, for the burst. */
  justSeat: number | null;
  /** The server-rendered grid, shown until the canvas takes over. */
  children: React.ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [live, setLive] = useState(false);

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

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const cells = carCells();
    const positions = new Float32Array(cells.length * 3);
    const seatIds = new Float32Array(cells.length);
    cells.forEach((cell, i) => {
      positions[i * 3] = cell.x;
      positions[i * 3 + 1] = cell.y;
      positions[i * 3 + 2] = cell.z;
      seatIds[i] = cell.seat;
    });

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const corners = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const attach = (
      data: Float32Array,
      name: string,
      size: number,
      divisor: number,
    ) => {
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(loc, divisor);
    };

    attach(corners, "aCorner", 2, 0);
    attach(positions, "aPos", 3, 1);
    attach(seatIds, "aSeat", 1, 1);

    const uni = (name: string) => gl.getUniformLocation(program, name);
    const uVP = uni("uVP");
    const uTaken = uni("uTaken");
    const uSize = uni("uSize");
    const uAspect = uni("uAspect");
    const uFlashSeat = uni("uFlashSeat");
    const uFlashAge = uni("uFlashAge");
    const uDimAlpha = uni("uDimAlpha");

    // Gold for a seat held, and a cold near-black for one still free — the same
    // two colours the legend and the grid have always used.
    gl.uniform3f(uni("uLitColour"), 1.0, 0.69, 0.13);
    gl.uniform3f(uni("uDimColour"), 0.56, 0.64, 0.74);

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    // Additive: with depth off there is no draw order to get right, and the
    // overlap where the body doubles back on itself becomes a highlight
    // instead of a seam.
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
       * Oscillating between about 10° and 60° keeps the shape legible in every
       * frame and still moves.
       */
      if (!still) clock += dt;
      const spin = 0.62 + Math.sin(clock * 0.32) * 0.45;

      leanX += (aimX * 0.34 - leanX) * 0.06;
      leanY += (aimY * 0.16 - leanY) * 0.06;

      const aspect = width / Math.max(height, 1);
      const view = multiply(
        translate(0, -0.3, -2.05),
        multiply(rotateX(-0.2 + leanY), rotateY(spin + leanX)),
      );
      const vp = multiply(perspective(0.62, aspect, 0.1, 20), view);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniformMatrix4fv(uVP, false, new Float32Array(vp));
      gl.uniform1f(uTaken, takenRef.current);
      gl.uniform1f(uAspect, aspect);
      gl.uniform1f(uSize, 0.019);
      // An empty cohort has no gold to carry the shape, so the unlit cells have
      // to carry it alone and are drawn brighter. Once seats start landing the
      // ghost steps back, or the thing that has been earned stops standing out
      // against the thing that has not.
      gl.uniform1f(uDimAlpha, takenRef.current === 0 ? 0.92 : 0.62);

      const flash = flashRef.current;
      const age = flash ? (now - flash.at) / 2200 : 2;
      gl.uniform1f(uFlashSeat, flash && age < 1 ? flash.seat : -1);
      gl.uniform1f(uFlashAge, Math.min(1, age));

      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, cells.length);
      raf = requestAnimationFrame(frame);
    };

    setLive(true);
    raf = requestAnimationFrame(frame);

    return () => {
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
      {/* Hidden from assistive technology only once the canvas is carrying the
          same information under its own label. */}
      <div className="sfield__flat" aria-hidden={live || undefined}>
        {children}
      </div>
    </div>
  );
}
