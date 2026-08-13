"use client";

import { useEffect, useRef, useState } from "react";
import { useLive } from "@/components/community/live-provider";
import { DemoTransport } from "@/components/community/demo-transport";
import { Odometer } from "@/components/community/odometer";
import { MAP_VIEWBOX, REGION_CENTRES, REGION_PATHS } from "@/lib/map/regions";
import { REGIONS, type RegionId } from "@/lib/genesis";
import { getContent, genesisPathFor, modelPathFor, type Locale } from "@/lib/i18n";

/**
 * The country, at the size the country deserves.
 *
 * The map used to be a thumbnail in a sidebar next to a list of seven numbers,
 * which is a chart of a map rather than a map. Here it is the first thing on
 * the page and it carries the argument by itself: where the cohort is, how fast
 * it is arriving, and — when the script is running — what it looks like full.
 *
 * The list of seven bars is gone. Every count it held is now on the shape it
 * belongs to, which is the whole reason for drawing real boundaries.
 */

/** How long a landing ripple stays on the map. */
const RIPPLE_MS = 2_400;

type Ripple = { id: number; region: RegionId };

export function MapHero({ locale }: { locale: Locale }) {
  const t = getContent(locale);
  const live = useLive();
  const [hover, setHover] = useState<RegionId | null>(null);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  const counts = REGIONS.map((r) => ({ ...r, count: live.byRegion[r.id] ?? 0 }));
  const peak = Math.max(1, ...counts.map((c) => c.count));
  const empty = live.taken === 0;

  /*
   * A ring per arrival, keyed so it always replays.
   *
   * Restarting a CSS animation on an element that is already animating does
   * nothing — the browser sees the same element in the same state. Mounting a
   * new node with a new key is what makes the second seat in a burst ripple at
   * all, and during the rush phase there are several per second.
   */
  useEffect(() => {
    const took = live.justTook;
    if (!took) return;
    const id = (seq.current += 1);
    setRipples((prev) => [...prev.slice(-8), { id, region: took.region as RegionId }]);

    /*
     * The removal timer is held on a ref, not cancelled by this effect's own
     * cleanup.
     *
     * Returning `clearTimeout` from here looks right and is exactly wrong: the
     * effect re-runs on every arrival, so each new seat cancelled the previous
     * ripple's removal and none of them were ever cleared. During the rush
     * phase that is several a second, and the count sat pinned at the cap
     * forever — which the probe caught as `pings: 9` even after playback had
     * stopped.
     */
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, RIPPLE_MS);
    timers.current.add(timer);
  }, [live.justTook]);

  // Only unmount cancels them.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  return (
    <section className="mh" aria-labelledby="mh-h">
      <div className="mh__grid">
        <div className="mh__say">
          <p className="mh__badge">{t.hero.badge}</p>
          <h1 className="mh__h1" id="mh-h">
            {t.hero.h1}
            <br />
            <em>{t.hero.h1b}</em>
          </h1>
          <p className="mh__sub">{t.hero.sub}</p>

          <div className="mh__btns">
            <a className="btn btn--gold" href={genesisPathFor(locale)}>
              {live.open ? t.hero.ctaPrimary : t.hero.ctaPrimaryClosed}
            </a>
            <a className="btn btn--ghost" href={modelPathFor(locale)}>
              {t.hero.ctaSecondary}
            </a>
          </div>

          <div className="mh__read">
            <Odometer value={live.taken} digits={3} />
            <span className="mh__of">/ {live.seats}</span>
            <span className="mh__cap">{t.density.title}</span>
          </div>

          <DemoTransport locale={locale} />
        </div>

        <div className="mh__stage">
          <svg
            className={empty ? "mh__map mh__map--empty" : "mh__map"}
            viewBox={MAP_VIEWBOX}
            role="img"
            aria-label={`${t.density.title}: ${counts
              .map((c) => `${locale === "ko" ? c.ko : c.en} ${c.count}`)
              .join(", ")}`}
          >
            <defs>
              {/* A blurred copy under the sharp one. On a dark ground this is
                  what separates a lit region from a merely tinted one. */}
              <filter id="mh-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="1.4" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <g className="mh__regions">
              {counts.map((r) => {
                const lit = r.count / peak;
                return (
                  <path
                    key={r.id}
                    className={`mh__rg${hover === r.id ? " is-on" : ""}`}
                    d={REGION_PATHS[r.id]}
                    style={empty ? undefined : { fillOpacity: 0.07 + lit * 0.68 }}
                    onMouseEnter={() => setHover(r.id)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(r.id)}
                    onBlur={() => setHover(null)}
                  />
                );
              })}
            </g>

            {/* Landing rings, above the shapes so they read as events on top of
                the country rather than as part of it. */}
            <g className="mh__pings" aria-hidden="true">
              {ripples.map((r) => (
                <circle
                  key={r.id}
                  className="mh__ping"
                  cx={REGION_CENTRES[r.region][0]}
                  cy={REGION_CENTRES[r.region][1]}
                  r="2"
                />
              ))}
            </g>

            <g className="mh__labels" aria-hidden="true">
              {counts.map((r) => {
                const [x, y] = REGION_CENTRES[r.id];
                return (
                  <g
                    key={r.id}
                    className={`mh__lb${hover === r.id ? " is-on" : ""}${
                      r.count > 0 ? " is-lit" : ""
                    }`}
                  >
                    <text className="mh__n" x={x} y={y} textAnchor="middle">
                      {r.count}
                    </text>
                    <text className="mh__rn" x={x} y={y + 4.6} textAnchor="middle">
                      {locale === "ko" ? r.ko : r.en}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          {empty ? <p className="mh__zero">{t.density.empty}</p> : null}
        </div>
      </div>
    </section>
  );
}
