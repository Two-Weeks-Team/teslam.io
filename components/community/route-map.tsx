"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
// The library itself is imported on demand; its stylesheet is not, because the
// controls it renders would otherwise appear unstyled for the moment between
// the map loading and the CSS arriving.
import "maplibre-gl/dist/maplibre-gl.css";
import { ROUTES } from "@/lib/map/routes";
import { sliceTo } from "@/lib/map/slice";
import { FLEET, LEGS, fleetAt } from "@/lib/map/fleet";
import { darkStyle } from "@/lib/map/style";
import { drvPerKm, krwPerDrv } from "@/lib/economics";
import { getContent, type Locale } from "@/lib/i18n";
import { krw, n } from "@/lib/format";

/**
 * The extent of every road the fleet uses.
 *
 * Computed once from the geometry rather than typed as a centre and a zoom,
 * because a centre and a zoom are only right for the canvas they were tuned
 * against — and this panel has been three different shapes.
 */
const FLEET_BOUNDS: [[number, number], [number, number]] = (() => {
  let west = 180;
  let south = 90;
  let east = -180;
  let north = -90;
  for (const route of ROUTES) {
    for (const [lon, lat] of route.points) {
      if (lon < west) west = lon;
      if (lon > east) east = lon;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
  }
  return [
    [west, south],
    [east, north],
  ];
})();

/**
 * The fleet, on the roads it uses.
 *
 * This began as one car tracing one line, which reads as a diagram. Dozens
 * moving across the country at the same moment reads as a service running —
 * and that is the thing a visitor is being asked to join, so it is the thing
 * the page should show.
 *
 * One car is followed at a time: the readouts and the camera belong to it while
 * the rest of the fleet drives around it. Following gives the eye somewhere to
 * rest and gives the numbers something to be about.
 *
 * **The drives are illustrative and the page says so throughout.** teslam.io
 * does not collect coordinates — `/privacy` and the registration form both
 * state it — so no real route data exists to draw. What is real is the
 * arithmetic: distances are the roads' true lengths and the DRV comes from
 * `lib/economics`, the same figures `/model` is argued from. The shape of a
 * drive is a simulation; what a drive is worth is not.
 *
 * MapLibre loads on demand when the section is first reached. It is by far the
 * largest dependency on the site and a reader who never scrolls here should not
 * pay for it.
 */

export function RouteMap({ locale }: { locale: Locale }) {
  const t = getContent(locale).routes;

  const holderRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const rafRef = useRef(0);
  const originRef = useRef(0);
  const clockRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  // Whether the reader has chosen a route. Until they do, the camera stays on
  // the country: the first impression of this section should be the whole
  // fleet moving, not one road with most of the cars outside the frame.
  const [chosen, setChosen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [clock, setClock] = useState(0);

  const route = ROUTES[active];
  const legs = LEGS[active];

  /** The car whose numbers the panel shows: the first one on the active route. */
  const lead = FLEET.find((c) => c.route === active) ?? FLEET[0];
  const along = legs.total ? (lead.offset + clock * lead.speed) % legs.total : 0;

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
          /*
           * Ask about WebGL2 before building anything that needs it.
           *
           * MapLibre raises its own GPUInitializationError from inside the Map
           * constructor and fires it as an `error` event — but the handler
           * below is attached after that constructor returns, so the event has
           * nobody listening and nothing throws either. The observed result was
           * a black rectangle with no explanation on any browser without
           * WebGL2: hardware acceleration switched off, an older device, a
           * locked-down corporate build. The fallback for exactly that case was
           * already written and could never run.
           */
          const probe = document.createElement("canvas").getContext("webgl2");
          if (!probe) {
            if (!cancelled) setFailed(true);
            return;
          }
          // Release it immediately. Contexts are a scarce per-page resource and
          // this one existed only to answer a question.
          probe.getExtension("WEBGL_lose_context")?.loseContext();

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
            // Framed to include Jeju: the island is a region the form offers
            // and a route the fleet drives, so cutting it off would be a map of
            // most of the country.
            center: [127.5, 35.9],
            zoom: 5.95,
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

            map.addSource("roads", {
              type: "geojson",
              data: {
                type: "FeatureCollection",
                features: ROUTES.map((r, i) => ({
                  type: "Feature" as const,
                  properties: { i },
                  geometry: { type: "LineString" as const, coordinates: r.points },
                })),
              },
            });
            map.addSource("trace", {
              type: "geojson",
              data: {
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates: [] },
              },
            });
            map.addSource("fleet", {
              type: "geojson",
              data: { type: "FeatureCollection", features: [] },
            });

            // Every road the fleet uses, dim: the network it runs on.
            map.addLayer({
              id: "roads-line",
              type: "line",
              source: "roads",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: {
                "line-color": "#24564f",
                "line-width": ["interpolate", ["linear"], ["zoom"], 6, 1.4, 16, 6],
                "line-opacity": 0.5,
              },
            });
            // The followed car's road, brighter.
            map.addLayer({
              id: "trace-line",
              type: "line",
              source: "trace",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: {
                "line-color": "#00c2a8",
                "line-width": ["interpolate", ["linear"], ["zoom"], 6, 2.6, 16, 10],
              },
            });
            /*
             * One source, two layers, and the lead car told apart by a feature
             * property rather than by a source of its own. Keeping it in the
             * same collection means one `setData` per frame for the whole
             * fleet instead of two.
             */
            map.addLayer({
              id: "fleet-glow",
              type: "circle",
              source: "fleet",
              paint: {
                "circle-radius": [
                  "interpolate", ["linear"], ["zoom"],
                  6, ["case", ["get", "lead"], 9, 5],
                  16, ["case", ["get", "lead"], 22, 12],
                ],
                "circle-color": ["case", ["get", "lead"], "#ffb020", "#00c2a8"],
                "circle-opacity": 0.22,
                "circle-blur": 0.85,
              },
            });
            map.addLayer({
              id: "fleet-dot",
              type: "circle",
              source: "fleet",
              paint: {
                "circle-radius": [
                  "interpolate", ["linear"], ["zoom"],
                  6, ["case", ["get", "lead"], 4.4, 2.6],
                  16, ["case", ["get", "lead"], 9, 5],
                ],
                "circle-color": ["case", ["get", "lead"], "#ffb020", "#7fe6d4"],
                "circle-stroke-color": "#0b1016",
                "circle-stroke-width": ["case", ["get", "lead"], 1.6, 0.8],
              },
            });

            /*
             * Frame the country, rather than trusting a centre and a zoom.
             *
             * A fixed 5.95 was chosen against one canvas shape and the panel
             * has been every shape since: at the width it has now, a third of
             * the frame was the Sea of Japan. Fitting the actual extent of the
             * road network gets it right at any aspect, and keeps getting it
             * right when the panel changes again.
             */
            map.fitBounds(FLEET_BOUNDS, { padding: 28, duration: 0 });

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

  /** Frame the followed route when it changes. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !chosen) return;

    const lons = route.points.map((p) => p[0]);
    const lats = route.points.map((p) => p[1]);
    map.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      // Capped, so following a 4km hop across Busan does not throw the rest of
      // the fleet off the screen.
      { padding: 64, duration: 800, maxZoom: 11.5 },
    );
  }, [route, ready, chosen]);

  /** Push the fleet and the followed car's trace to the map. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    (map.getSource("fleet") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: fleetAt(clock).map(({ car, at }) => ({
        type: "Feature",
        properties: { lead: car.id === lead.id },
        geometry: { type: "Point", coordinates: at },
      })),
    });

    (map.getSource("trace") as GeoJSONSource | undefined)?.setData({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: sliceTo(route.points, legs.cum, legs.total, along),
      },
    });
  }, [clock, ready, lead, route, legs, along]);

  /* ── playback ────────────────────────────────────────────────────────── */

  const togglePlay = useCallback(() => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Advance the clock without animating. The fleet is the information;
      // the motion is only how it is delivered.
      setClock((c) => c + 240);
      return;
    }
    setPlaying(true);
  }, [playing]);

  useEffect(() => {
    if (!playing) return;

    const from = clockRef.current;
    originRef.current = performance.now();

    const step = (now: number) => {
      // Clamped: rAF reports the time the frame began, which can precede the
      // `performance.now()` captured just before it was requested.
      const next = from + Math.max(0, now - originRef.current) / 1000;
      clockRef.current = next;
      setClock(next);
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
    // The loop reads the clock from a ref rather than from state precisely so
    // it does not have to depend on it — `clock` changes every frame, and a
    // dependency would tear this down and rebuild it sixty times a second.
  }, [playing]);

  useEffect(() => {
    clockRef.current = clock;
  }, [clock]);

  /** Zoom to the followed car, close enough that the road under it is legible. */
  const closeUp = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const head = sliceTo(route.points, legs.cum, legs.total, along).at(-1);
    if (head) map.easeTo({ center: head, zoom: 16.5, duration: 900 });
  }, [route, legs, along]);

  const share = legs.total ? along / legs.total : 0;
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
            onClick={() => {
              setActive(i);
              setChosen(true);
            }}
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
          <p className="rmap__count">
            <b>{FLEET.length}</b>
            <span>{t.running}</span>
          </p>
          <p className="rmap__note">{route.note[locale]}</p>
        </div>
      </div>

      <div className="rmap__bar">
        <button className="rmap__btn" type="button" onClick={togglePlay} disabled={!ready}>
          {playing ? t.pause : t.play}
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
