"use client";

import { useState } from "react";
import { useLive } from "@/components/community/live-provider";
import { Mark } from "@/components/community/mark";
import { REGIONS, type RegionId } from "@/lib/genesis";
import { MAP_VIEWBOX, REGION_CENTRES, REGION_PATHS } from "@/lib/map/regions";
import { getContent, type Locale } from "@/lib/i18n";
import { n } from "@/lib/format";

/**
 * Where the cohort actually is.
 *
 * This was seven hand-drawn blobs, argued for as a schematic: registrants pick
 * a region from a list and never hand over a coordinate, so the drawing was
 * kept deliberately abstract. The argument was wrong in the way that matters —
 * a reader who lives in one of those regions could not find it on the picture,
 * and a map nobody can read is not more honest than a map, only less useful.
 *
 * So these are the real administrative boundaries, merged to the seven regions
 * the form asks about, generated once and committed (see
 * `scripts/build-map.mjs`). What stays true is the resolution: a region is the
 * smallest thing this can show, because a region is the smallest thing anyone
 * told us.
 *
 * The argument it makes is the whitepaper's §10.1: a league needs faces you
 * recognise and a redemption partner needs to be somewhere you already drive,
 * so what matters to a visitor is not the national total but how many people
 * are near them.
 */

export function Density({ locale }: { locale: Locale }) {
  const live = useLive();
  const t = getContent(locale).density;
  const [hover, setHover] = useState<RegionId | null>(null);

  const counts = REGIONS.map((r) => ({
    ...r,
    count: live.byRegion[r.id] ?? 0,
  }));
  const peak = Math.max(1, ...counts.map((c) => c.count));
  /*
   * No region has anyone in it yet.
   *
   * Drawn differently rather than drawn the same with zeroes in it. Seven flat
   * shapes above seven empty bars and seven zeroes is a chart of nothing, and a
   * reader cannot tell it apart from a chart that failed — so the empty case
   * gets one sentence saying what it is, and the shapes get an outline that
   * makes them read as waiting rather than as unlit.
   */
  const empty = counts.every((c) => c.count === 0);

  return (
    <section className="dens" aria-labelledby="dens-h">
      <div className="dens__head">
        <h2 className="dens__h" id="dens-h">
          {t.title}
          {live.live ? <Mark locale={locale} kind="real" /> : null}
        </h2>
        <p className="dens__sub">{t.sub}</p>
      </div>

      {empty ? (
        <p className="dens__zero">
          <b>{t.empty}</b>
          <span>{t.emptySub}</span>
        </p>
      ) : null}

      <div className="dens__body">
        <svg
          className={empty ? "dens__map dens__map--empty" : "dens__map"}
          viewBox={MAP_VIEWBOX}
          role="img"
          aria-label={`${t.title}: ${counts
            .map((c) => `${locale === "ko" ? c.ko : c.en} ${c.count}`)
            .join(", ")}`}
        >
          {counts.map((r) => {
            const lit = r.count / peak;
            const active = hover === r.id;
            const rippling = live.justTook?.region === r.id;
            return (
              <g key={r.id}>
                <path
                  className={`dens__rg${active ? " is-on" : ""}${rippling ? " is-new" : ""}`}
                  d={REGION_PATHS[r.id]}
                  // Opacity carries density; the stroke stays constant so an
                  // empty region is still a shape rather than a hole. Left
                  // unset when nothing is registered anywhere, so the empty
                  // state can be styled in the sheet — an inline value would
                  // beat any class and force an `!important` to undo it.
                  style={empty ? undefined : { fillOpacity: 0.08 + lit * 0.72 }}
                  onMouseEnter={() => setHover(r.id)}
                  onMouseLeave={() => setHover(null)}
                />
                {r.count > 0 ? (
                  <text
                    className="dens__num"
                    x={REGION_CENTRES[r.id][0]}
                    y={REGION_CENTRES[r.id][1]}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    aria-hidden="true"
                  >
                    {r.count}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>

        <ul className={empty ? "dens__list dens__list--empty" : "dens__list"}>
          {counts.map((r) => (
            <li
              key={r.id}
              className={`dens__row${hover === r.id ? " is-on" : ""}`}
              onMouseEnter={() => setHover(r.id)}
              onMouseLeave={() => setHover(null)}
            >
              <span className="dens__name">{locale === "ko" ? r.ko : r.en}</span>
              <span className="dens__bar" aria-hidden="true">
                <span style={{ width: `${(r.count / peak) * 100}%` }} />
              </span>
              <span className="dens__c">{n(locale, r.count)}</span>
            </li>
          ))}
        </ul>
      </div>

      {live.live ? null : (
        <p className="gf__err">{getContent(locale).preview.countStale}</p>
      )}
      <p className="dens__note">{t.note}</p>
    </section>
  );
}
