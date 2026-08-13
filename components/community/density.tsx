"use client";

import { useState } from "react";
import { useLive } from "@/components/community/live-provider";
import { Mark } from "@/components/community/mark";
import { REGIONS, type RegionId } from "@/lib/genesis";
import { getContent, type Locale } from "@/lib/i18n";
import { n } from "@/lib/format";

/**
 * Where the cohort actually is.
 *
 * A schematic, not a projection — and that is the honest form. Registrants pick
 * a province-sized region from a list; nobody hands over a coordinate. Drawing
 * an accurate coastline would dress seven counts up as geography they are not,
 * and would need a topology file fetched at build time to say no more than
 * these seven shapes do.
 *
 * The argument it makes is the whitepaper's §10.1: a league needs faces you
 * recognise and a redemption partner needs to be somewhere you already drive,
 * so what matters to a visitor is not the national total but how many people
 * are near them.
 */

/** Seven faceted shapes, laid out so the peninsula is recognisable. */
const SHAPES: Record<RegionId, string> = {
  capital: "M20 14 L46 10 L52 26 L44 40 L22 38 L14 26 Z",
  gangwon: "M46 10 L84 14 L88 30 L74 42 L52 38 L52 26 Z",
  chungcheong: "M14 40 L44 42 L52 54 L44 66 L18 64 L10 50 Z",
  daegu: "M54 40 L86 44 L90 62 L76 72 L56 68 L48 56 Z",
  jeolla: "M14 66 L44 68 L48 84 L36 100 L18 96 L8 80 Z",
  busan: "M50 70 L76 74 L86 86 L72 100 L50 96 L44 82 Z",
  jeju: "M20 114 L38 112 L42 120 L34 126 L20 124 L16 118 Z",
};

/** Approximate centre of each shape, for the ripple and the count label. */
const CENTRES: Record<RegionId, [number, number]> = {
  capital: [33, 25],
  gangwon: [68, 26],
  chungcheong: [31, 53],
  daegu: [69, 56],
  jeolla: [28, 83],
  busan: [64, 85],
  jeju: [29, 119],
};

export function Density({ locale }: { locale: Locale }) {
  const live = useLive();
  const t = getContent(locale).density;
  const [hover, setHover] = useState<RegionId | null>(null);

  const counts = REGIONS.map((r) => ({
    ...r,
    count: live.byRegion[r.id] ?? 0,
  }));
  const peak = Math.max(1, ...counts.map((c) => c.count));

  return (
    <section className="dens" aria-labelledby="dens-h">
      <div className="dens__head">
        <h2 className="dens__h" id="dens-h">
          {t.title}
          {live.live ? <Mark locale={locale} kind="real" /> : null}
        </h2>
        <p className="dens__sub">{t.sub}</p>
      </div>

      <div className="dens__body">
        <svg
          className="dens__map"
          viewBox="0 0 100 132"
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
                  d={SHAPES[r.id]}
                  // Opacity carries density; the stroke stays constant so an
                  // empty region is still a shape rather than a hole.
                  style={{ fillOpacity: 0.08 + lit * 0.72 }}
                  onMouseEnter={() => setHover(r.id)}
                  onMouseLeave={() => setHover(null)}
                />
                {r.count > 0 ? (
                  <text
                    className="dens__num"
                    x={CENTRES[r.id][0]}
                    y={CENTRES[r.id][1]}
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

        <ul className="dens__list">
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
