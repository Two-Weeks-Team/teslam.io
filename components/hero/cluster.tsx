"use client";

import { useEffect, useRef } from "react";
import { ROUTE_D, VIEW_W, VIEW_H } from "@/lib/drive/route";
import { readoutAt, pointAt, fmt } from "@/lib/drive/readout";
import { getModel, type Locale } from "@/lib/i18n";

/** One pass of the drive. Slow enough to read the odometer move. */
const LOOP_MS = 14_000;

/** Map grid, drawn once on the server. */
const GRID_X = Array.from({ length: 11 }, (_, i) => (VIEW_W / 11) * (i + 1));
const GRID_Y = Array.from({ length: 3 }, (_, i) => (VIEW_H / 4) * (i + 1));

/**
 * The instrument cluster.
 *
 * Rendered on the server as a *completed* drive — the whole route drawn, the
 * readouts showing the end state. That is a finished picture with no
 * JavaScript, and it is also exactly what the first client render produces, so
 * hydration has nothing to reconcile.
 *
 * Once mounted, the animation writes straight to the DOM rather than through
 * state. Six readouts ticking at 60fps would otherwise re-render this subtree
 * sixty times a second to change text nodes React does not need to diff.
 */
export function Cluster({ locale }: { locale: Locale }) {
  const t = getModel(locale).hero;

  const pathRef = useRef<SVGPathElement>(null);
  const headRef = useRef<SVGCircleElement>(null);
  const latRef = useRef<HTMLSpanElement>(null);
  const lngRef = useRef<HTMLSpanElement>(null);
  const spdRef = useRef<HTMLSpanElement>(null);
  const odoRef = useRef<HTMLSpanElement>(null);
  const drvRef = useRef<HTMLSpanElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const path = pathRef.current;
    const head = headRef.current;
    const box = boxRef.current;
    if (!path || !head || !box) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const total = path.getTotalLength();
    path.style.strokeDasharray = `${total}`;

    let raf = 0;
    let startedAt = 0;
    let running = false;

    const frame = (now: number) => {
      if (!startedAt) startedAt = now;
      const p = ((now - startedAt) % LOOP_MS) / LOOP_MS;

      path.style.strokeDashoffset = String(total * (1 - p));

      const at = path.getPointAtLength(total * p);
      head.setAttribute("cx", String(at.x));
      head.setAttribute("cy", String(at.y));

      const r = readoutAt(p);
      if (latRef.current) latRef.current.textContent = fmt.deg(r.lat);
      if (lngRef.current) lngRef.current.textContent = fmt.deg(r.lng);
      if (spdRef.current) spdRef.current.textContent = fmt.spd(r.spd);
      if (odoRef.current) odoRef.current.textContent = fmt.odo(r.odo);
      if (drvRef.current) drvRef.current.textContent = fmt.drv(r.drv);

      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running) return;
      running = true;
      startedAt = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    // A hero that has scrolled out of view should not hold a frame loop open.
    const io = new IntersectionObserver(
      ([e]) => (e.isIntersecting && !document.hidden ? start() : stop()),
      { threshold: 0 },
    );
    io.observe(box);

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // The end state: what the server renders and what the first paint shows.
  const end = readoutAt(1);
  const endPt = pointAt(1);

  return (
    <div className="cluster" ref={boxRef}>
      <div className="cluster__bar">
        <span className="cluster__state">
          <span className="cluster__led" aria-hidden="true" />
          {t.live}
        </span>
        <span>{t.vizHint}</span>
      </div>

      <div className="cluster__trace">
        {/*
          `meet`, not `slice`: the panel keeps a 24/7 aspect ratio, but the
          min-height overrides that ratio on narrow screens, and slicing there
          crops the end of the route straight off the right edge.
        */}
        <svg
          className="cluster__svg"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={t.vizLegend}
        >
          <g className="trace__grid" aria-hidden="true">
            {GRID_X.map((x) => (
              <line key={`x${x}`} x1={x} y1="0" x2={x} y2={VIEW_H} />
            ))}
            {GRID_Y.map((y) => (
              <line key={`y${y}`} x1="0" y1={y} x2={VIEW_W} y2={y} />
            ))}
          </g>

          {/* The road, unlit — so the panel is legible before anything moves. */}
          <path className="trace__ghost" d={ROUTE_D} />
          {/* The part already driven. */}
          <path className="trace__route" d={ROUTE_D} ref={pathRef} />
          <circle
            className="trace__head"
            ref={headRef}
            cx={endPt.x}
            cy={endPt.y}
            r="5"
          />
        </svg>
      </div>

      <div className="cluster__readouts">
        <Readout k="LAT" v={fmt.deg(end.lat)} vRef={latRef} unit="°N" />
        <Readout k="LNG" v={fmt.deg(end.lng)} vRef={lngRef} unit="°E" />
        <Readout k="SPD" v={fmt.spd(end.spd)} vRef={spdRef} unit="km/h" />
        <Readout k="ODO" v={fmt.odo(end.odo)} vRef={odoRef} unit="km" />
        <Readout
          k="DRV"
          v={fmt.drv(end.drv)}
          vRef={drvRef}
          unit="DRV"
          accrue
        />
      </div>

      <p className="cluster__legend">{t.vizLegend}</p>
    </div>
  );
}

function Readout({
  k,
  v,
  vRef,
  unit,
  accrue,
}: {
  k: string;
  v: string;
  vRef: React.RefObject<HTMLSpanElement | null>;
  unit: string;
  accrue?: boolean;
}) {
  return (
    <div className={accrue ? "readout readout--accrue" : "readout"}>
      <div className="readout__k">{k}</div>
      <div className="readout__v">
        <span ref={vRef}>{v}</span>
        <span className="readout__u">{unit}</span>
      </div>
    </div>
  );
}
