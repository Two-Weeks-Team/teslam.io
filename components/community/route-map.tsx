"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
// The library itself is imported on demand; its stylesheet is not, because the
// controls it renders would otherwise appear unstyled for the moment between
// the map loading and the CSS arriving.
import "maplibre-gl/dist/maplibre-gl.css";
import { ROUTES } from "@/lib/map/routes";
import { darkStyle } from "@/lib/map/style";
import { drvPerKm, krwPerDrv } from "@/lib/economics";
import { getContent, type Locale } from "@/lib/i18n";
import { krw, n } from "@/lib/format";

/**
 * A drive, on the actual roads it used.
 *
 * The region map above answers "how many people are near me". This answers a
 * different question — what the product is watching — by playing a drive along
 * real road geometry, close enough in that individual streets are visible.
 *
 * **The routes are illustrative and the page says so throughout.** teslam.io
 * does not collect coordinates: `/privacy` and the registration form both state
 * it, so no real route data exists to draw. What is real here is the arithmetic
 * beside the map — the distance is the road's true length, and the DRV it earns
 * comes from `lib/economics`, the same figures `/model` is argued from. The
 * shape of the drive is a simulation; what a drive is worth is not.
 *
 * MapLibre is loaded on demand when the section is first reached. It is by far
 * the largest dependency on the site, and a reader who never scrolls this far
 * should not pay for it.
 */

/** Metres per second along the line, sped up so a 205km drive is watchable. */
const PLAYBACK_KMH = 5_400;

export function RouteMap({ locale }: { locale: Locale }) {
  const t = getContent(locale).routes;

  const holderRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const rafRef = useRef(0);
  const startedRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [travelled, setTravelled] = useState(0);

  const route = ROUTES[active];

  /* ── cumulative distance, so playback moves at a speed rather than an index ──
   *
   * Stepping one point per frame would race through the dense curves and crawl
   * down the straight motorway sections, because the simplifier leaves points
   * where the road bends and removes them where it does not.
   */
  const legs = useMemo(() => {
    const cum = [0];
    let total = 0;
    for (let i = 1; i < route.points.length; i += 1) {
      const [ax, ay] = route.points[i - 1];
      const [bx, by] = route.points[i];
      // Good enough for pacing: degrees scaled to metres at Korea's latitude.
      const dx = (bx - ax) * 88_800;
      const dy = (by - ay) * 111_000;
      total += Math.hypot(dx, dy);
      cum.push(total);
    }
    return { cum, total };
  }, [route]);

  /** The path up to `metres`, with the final point interpolated. */
  const sliceTo = useCallback(
    (metres: number): Array<[number, number]> => {
      const { cum } = legs;
      /*
       * Clamped to the route.
       *
       * Below zero the loop reached for the point before the first one and
       * threw; guarding that index instead only moved the fault, because a
       * negative distance then interpolated *backwards* and put the car off
       * the end of the road. Clamping is the answer to both, and makes the
       * function total — a caller should not have to know it has a domain.
       */
      const along = Math.min(legs.total, Math.max(0, metres));
      const out: Array<[number, number]> = [];
      for (let i = 0; i < route.points.length; i += 1) {
        if (cum[i] <= along) out.push(route.points[i]);
        else {
          const span = cum[i] - cum[i - 1];
          const k = span > 0 ? (along - cum[i - 1]) / span : 0;
          const [ax, ay] = route.points[i - 1];
          const [bx, by] = route.points[i];
          out.push([ax + (bx - ax) * k, ay + (by - ay) * k]);
          break;
        }
      }
      return out.length ? out : [route.points[0]];
    },
    [route, legs],
  );

  /* ── the map ─────────────────────────────────────────────────────────── */

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;

    let cancelled = false;
    let map: MapLibreMap | null = null;

    const observer = new IntersectionObserver(
      async (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();

        try {
          const maplibre = await import("maplibre-gl");
          if (cancelled) return;

          /*
           * Point the tile-parsing worker at a static copy of itself.
           *
           * MapLibre builds that worker from a URL relative to its own bundle,
           * which Turbopack does not emit — the request 404s to an HTML error
           * page and the browser rejects it for its MIME type. The map still
           * draws its canvas and its controls and then loads no tiles at all,
           * with no error event to say why. `scripts/copy-map-worker.mjs`
           * publishes the file this points at.
           */
          maplibre.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

          map = new maplibre.Map({
            container: holder,
            style: darkStyle(),
            center: [127.6, 36.4],
            zoom: 6.1,
            // Roads are the point, so the ceiling is well past the zoom where
            // individual streets resolve.
            maxZoom: 18,
            attributionControl: { compact: true },
            // A map inside a scrolling page should not swallow the scroll.
            scrollZoom: false,
            cooperativeGestures: true,
          });
          map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
          mapRef.current = map;

          map.on("load", () => {
            if (cancelled || !map) return;
            map.addSource("route", {
              type: "geojson",
              data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } },
            });
            map.addSource("done", {
              type: "geojson",
              data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } },
            });
            map.addSource("car", {
              type: "geojson",
              data: { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [0, 0] } },
            });

            // The whole route, dim: where the drive is going.
            map.addLayer({
              id: "route-line",
              type: "line",
              source: "route",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: {
                "line-color": "#2f6f66",
                "line-width": ["interpolate", ["linear"], ["zoom"], 6, 2, 16, 8],
                "line-opacity": 0.55,
              },
            });
            // The part already driven, bright: where it has been.
            map.addLayer({
              id: "done-line",
              type: "line",
              source: "done",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: {
                "line-color": "#00c2a8",
                "line-width": ["interpolate", ["linear"], ["zoom"], 6, 3, 16, 11],
              },
            });
            map.addLayer({
              id: "car-glow",
              type: "circle",
              source: "car",
              paint: {
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 9, 16, 22],
                "circle-color": "#ffb020",
                "circle-opacity": 0.22,
                "circle-blur": 0.8,
              },
            });
            map.addLayer({
              id: "car-dot",
              type: "circle",
              source: "car",
              paint: {
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 4, 16, 8],
                "circle-color": "#ffb020",
                "circle-stroke-color": "#0b1016",
                "circle-stroke-width": 1.5,
              },
            });

            setReady(true);
          });

          map.on("error", () => setFailed(true));
        } catch {
          // No WebGL, a blocked CDN, or an offline tile host. The section keeps
          // its text and says the map could not load rather than leaving a
          // grey rectangle.
          if (!cancelled) setFailed(true);
        }
      },
      { rootMargin: "300px" },
    );

    observer.observe(holder);

    return () => {
      cancelled = true;
      observer.disconnect();
      cancelAnimationFrame(rafRef.current);
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  /** Draw the selected route and frame it. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    (map.getSource("route") as GeoJSONSource | undefined)?.setData({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: route.points },
    });

    const lons = route.points.map((p) => p[0]);
    const lats = route.points.map((p) => p[1]);
    map.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      { padding: 56, duration: 700 },
    );

    setTravelled(0);
    setPlaying(false);
  }, [route, ready]);

  /** Push the travelled portion and the car to the map. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const path = sliceTo(travelled);
    (map.getSource("done") as GeoJSONSource | undefined)?.setData({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: path },
    });
    (map.getSource("car") as GeoJSONSource | undefined)?.setData({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: path[path.length - 1] },
    });
  }, [travelled, sliceTo, ready]);

  /* ── playback ────────────────────────────────────────────────────────── */

  /*
   * Reduced motion is decided here, at the press, rather than inside the
   * animation effect. Handling it in the effect meant the effect's only job on
   * that path was to set state and immediately undo itself, which is both a
   * lint error and a description of a loop that should never have started.
   *
   * The drive still plays out — it simply arrives finished. The information is
   * the route; the motion is only how it is delivered.
   */
  const togglePlay = useCallback(() => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTravelled(legs.total);
      return;
    }
    setPlaying(true);
  }, [playing, legs.total]);

  useEffect(() => {
    if (!playing) return;

    const from = travelled >= legs.total ? 0 : travelled;
    startedRef.current = performance.now();
    const metresPerMs = (PLAYBACK_KMH * 1000) / 3_600_000;

    const step = (now: number) => {
      /*
       * Clamped at zero.
       *
       * `requestAnimationFrame` hands the callback the time the *frame* began,
       * which can be a fraction of a millisecond earlier than the
       * `performance.now()` captured just before the frame was requested. The
       * elapsed time then comes out negative, the travelled distance with it,
       * and the path slice reaches for the point before the first one.
       *
       * It never reproduced locally and threw on the first click in
       * production, which is the shape of every timing bug: the machine that
       * finds it is the one you are not testing on.
       */
      const at = Math.max(0, from + (now - startedRef.current) * metresPerMs);
      if (at >= legs.total) {
        setTravelled(legs.total);
        setPlaying(false);
        return;
      }
      setTravelled(at);
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
    // `travelled` is deliberately not a dependency: it changes every frame, and
    // depending on it would tear the loop down and rebuild it sixty times a
    // second.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, legs]);

  /** Zoom to the car, close enough that the road under it is legible. */
  const closeUp = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const path = sliceTo(travelled);
    map.easeTo({ center: path[path.length - 1], zoom: 16.5, duration: 900 });
  }, [sliceTo, travelled]);

  const share = legs.total ? travelled / legs.total : 0;
  const drivenKm = route.km * share;
  const earnedDrv = drivenKm * drvPerKm;

  return (
    <section className="rmap" aria-labelledby="rmap-h">
      <div className="rmap__head">
        <p className="rmap__eyebrow">{t.eyebrow}</p>
        <h2 className="rmap__h" id="rmap-h">
          {t.title}
        </h2>
        <p className="rmap__sub">{t.sub}</p>
      </div>

      <div className="rmap__pick" role="tablist" aria-label={t.title}>
        {ROUTES.map((r, i) => (
          <button
            key={r.id}
            className={i === active ? "rmap__chip is-on" : "rmap__chip"}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
          >
            <span>{r.label[locale]}</span>
            <span className="rmap__chipkm">{r.km}km</span>
          </button>
        ))}
      </div>

      <div className="rmap__stage">
        <div className="rmap__canvas" ref={holderRef} />
        {failed ? <p className="rmap__fail">{t.failed}</p> : null}

        <div className="rmap__hud">
          <p className="rmap__flag">{t.flag}</p>
          <p className="rmap__note">{route.note[locale]}</p>
        </div>
      </div>

      <div className="rmap__bar">
        <button
          className="rmap__btn"
          type="button"
          onClick={togglePlay}
          disabled={!ready}
        >
          {playing ? t.pause : share >= 1 ? t.again : t.play}
        </button>
        <button
          className="rmap__btn rmap__btn--ghost"
          type="button"
          onClick={closeUp}
          disabled={!ready}
        >
          {t.closeUp}
        </button>

        <div className="rmap__track" aria-hidden="true">
          <span className="rmap__fill" style={{ transform: `scaleX(${share})` }} />
        </div>

        <dl className="rmap__read">
          <div>
            <dt>{t.distance}</dt>
            <dd>
              {drivenKm.toFixed(1)}
              <span>/ {route.km}km</span>
            </dd>
          </div>
          <div>
            <dt>{t.earned}</dt>
            <dd className="is-gold">
              {n(locale, Math.round(earnedDrv))}
              <span>DRV</span>
            </dd>
          </div>
          <div>
            <dt>{t.worth}</dt>
            <dd>{krw(locale, earnedDrv * krwPerDrv)}</dd>
          </div>
        </dl>
      </div>

      <p className="rmap__foot">{t.foot}</p>
    </section>
  );
}
