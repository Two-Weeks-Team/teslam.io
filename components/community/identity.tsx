"use client";

import { getContent, type Locale } from "@/lib/i18n";
import { Mark } from "@/components/community/mark";
import { Odometer } from "@/components/community/odometer";
import { krwPerDrv } from "@/lib/economics";
import { krw, n } from "@/lib/format";
import cm from "@/data/community.json";

/**
 * Who you are here, what you have kept up, and how far the ladder goes.
 *
 * Harvested from alt2 (the nameplate is that whole design), alt5 (the streak
 * and the tier ladder). All three are sample content and carry the mark: the
 * board has no members yet, so there is no real nameplate to draw.
 *
 * The one figure that is not invented is the won conversion on the nameplate,
 * which uses `krwPerDrv` — the same peg `/model` argues from.
 */

export function Nameplate({ locale }: { locale: Locale }) {
  const t = getContent(locale).nameplate;
  const p = cm.nameplate;

  return (
    <section className="np" aria-labelledby="np-h">
      <div className="np__head">
        <p className="np__eyebrow">{t.eyebrow}</p>
        <h2 className="np__h" id="np-h">
          {t.title}
          <Mark locale={locale} kind="sample" />
        </h2>
        <p className="np__sub">{t.sub}</p>
      </div>

      {/* Built to look like a plate that gets screwed to something, because the
          point of it is that a person wants to show it to somebody. */}
      <article className="plate">
        <div className="plate__top">
          <p className="plate__handle">{p.handle}</p>
          <p className="plate__slot">{t.awaitingSeat}</p>
        </div>

        <p className="plate__car">
          {p.trim} · {p.region}
        </p>

        <dl className="plate__grid">
          <div>
            <dt>{t.odo}</dt>
            <dd>
              {n(locale, p.odo)}
              <span>km</span>
            </dd>
          </div>
          <div>
            <dt>{t.best}</dt>
            <dd>
              {p.bestEff.toFixed(2)}
              <span>km/kWh</span>
            </dd>
          </div>
          <div>
            <dt>{t.since}</dt>
            <dd>{p.since}</dd>
          </div>
        </dl>

        <div className="plate__drv">
          <Odometer value={p.totalDrv} digits={6} tone="gold" />
          <span className="plate__unit">DRV</span>
          <span className="plate__krw">{krw(locale, p.totalDrv * krwPerDrv)}</span>
        </div>

        <p className="plate__foot">{t.foot}</p>
      </article>
    </section>
  );
}

export function Streak({ locale }: { locale: Locale }) {
  const t = getContent(locale).streak;
  const s = cm.streak;

  return (
    <section className="stk" aria-labelledby="stk-h">
      <div className="stk__head">
        <p className="stk__eyebrow">{t.eyebrow}</p>
        <h2 className="stk__h" id="stk-h">
          {t.title}
          <Mark locale={locale} kind="sample" />
        </h2>
        <p className="stk__sub">{t.sub}</p>
      </div>

      <div
        className="stk__grid"
        role="img"
        aria-label={`${t.title}: ${s.days.filter(Boolean).length} / ${s.days.length}`}
      >
        {s.days.map((driven, i) => (
          <span
            key={i}
            className={driven ? "stk__d is-on" : "stk__d"}
            // The blanks carry the meaning. A wall of filled squares would not
            // show what keeping a streak actually costs.
            aria-hidden="true"
          />
        ))}
      </div>

      <dl className="stk__read">
        <div>
          <dt>{t.current}</dt>
          <dd className="is-mint">
            {s.current}
            <span>{t.dayUnit}</span>
          </dd>
        </div>
        <div>
          <dt>{t.best}</dt>
          <dd>
            {s.best}
            <span>{t.dayUnit}</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function Ladder({ locale }: { locale: Locale }) {
  const t = getContent(locale).ladder;
  const earned = cm.tierProgress;
  const top = cm.tiers[cm.tiers.length - 1].need;

  return (
    <section className="ld" aria-labelledby="ld-h">
      <div className="ld__head">
        <p className="ld__eyebrow">{t.eyebrow}</p>
        <h2 className="ld__h" id="ld-h">
          {t.title}
          <Mark locale={locale} kind="sample" />
        </h2>
        <p className="ld__sub">{t.sub}</p>
      </div>

      <div className="ld__rail">
        <span
          className="ld__fill"
          style={{ inlineSize: `${Math.min(100, (earned / top) * 100)}%` }}
          aria-hidden="true"
        />
        {cm.tiers.map((tier) => {
          const reached = earned >= tier.need;
          return (
            <div
              className={`ld__stop ld__stop--${tier.id}${reached ? " is-on" : ""}`}
              key={tier.id}
              style={{ insetInlineStart: `${(tier.need / top) * 100}%` }}
            >
              <span className="ld__dot" aria-hidden="true" />
              <p className="ld__n">{tier.name}</p>
              <p className="ld__need">
                {tier.need === 0 ? t.start : `${n(locale, tier.need)} DRV`}
              </p>
              <p className="ld__perk">{tier.perk}</p>
            </div>
          );
        })}
      </div>

      <p className="ld__foot">
        {t.at} <b>{n(locale, earned)} DRV</b> — {t.foot}
      </p>
    </section>
  );
}

export function Stake({ locale }: { locale: Locale }) {
  const t = getContent(locale).stake;

  return (
    <section className="stake" aria-labelledby="stake-h">
      <div className="stake__head">
        <p className="stake__eyebrow">{t.eyebrow}</p>
        <h2 className="stake__h" id="stake-h">
          {t.title}
        </h2>
        <p className="stake__sub">{t.sub}</p>
      </div>

      <ol className="stake__flow">
        {t.flow.map((step, i) => (
          <li className="stake__step" key={step.title}>
            <span className="stake__n" aria-hidden="true">
              {i + 1}
            </span>
            <p className="stake__t">{step.title}</p>
            <p className="stake__b">{step.body}</p>
          </li>
        ))}
      </ol>

      {/*
        The disclaimer is not decoration here. Neither token has been issued,
        and a section describing what one does is exactly where a reader might
        assume otherwise.
      */}
      <p className="stake__warn">{t.warn}</p>
    </section>
  );
}
