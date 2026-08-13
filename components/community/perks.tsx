"use client";

import { useState } from "react";
import { getContent, type Locale } from "@/lib/i18n";
import { Mark } from "@/components/community/mark";
import { Odometer } from "@/components/community/odometer";
import { krw, n } from "@/lib/format";
import { krwPerDrv } from "@/lib/economics";
import cm from "@/data/community.json";

/**
 * What the driving is actually for.
 *
 * The board argues the mechanism — odometer in, DRV out — and then made a
 * reader take the payoff on faith. These three answer it directly: what is
 * being chased this week, what has been earned so far, and what it converts
 * into.
 *
 * The quests and badges are sample content and are labelled as such. The
 * conversion beside the shelf is not: `krwPerDrv` is the peg from
 * `lib/economics`, the same figure `/model` is argued from, so a price here and
 * a price there cannot drift apart.
 */

/* ── quests ───────────────────────────────────────────────────────────── */

export function Quests({ locale }: { locale: Locale }) {
  const t = getContent(locale).quests;

  return (
    <section className="qb" aria-labelledby="qb-h">
      <div className="qb__head">
        <p className="qb__eyebrow">{t.eyebrow}</p>
        <h2 className="qb__h" id="qb-h">
          {t.title}
          <Mark locale={locale} kind="sample" />
        </h2>
        <p className="qb__sub">{t.sub}</p>
      </div>

      <div className="qb__grid">
        {cm.quests.map((q) => {
          const share = Math.min(1, q.have / q.need);
          const done = share >= 1;
          return (
            <article className={done ? "quest is-done" : "quest"} key={q.id}>
              <p className="quest__t">{q.title}</p>
              <p className="quest__s">{q.sub}</p>

              <div
                className="quest__ring"
                style={{ "--v": share } as React.CSSProperties}
                role="img"
                aria-label={`${q.have} / ${q.need}`}
              >
                <span className="quest__pct">{Math.round(share * 100)}%</span>
              </div>

              <p className="quest__n">
                <b>{q.have}</b>
                <span>/ {q.need}</span>
              </p>
              <p className="quest__r">
                +{n(locale, q.reward)} <span>{q.unit}</span>
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ── badges ───────────────────────────────────────────────────────────── */

export function Badges({ locale }: { locale: Locale }) {
  const t = getContent(locale).badges;
  const earned = cm.badges.filter((b) => b.got).length;

  return (
    <section className="bd" aria-labelledby="bd-h">
      <div className="bd__head">
        <p className="bd__eyebrow">{t.eyebrow}</p>
        <h2 className="bd__h" id="bd-h">
          {t.title}
          <Mark locale={locale} kind="sample" />
        </h2>
        <p className="bd__sub">
          {earned} / {cm.badges.length} · {t.sub}
        </p>
      </div>

      <div className="bd__case">
        {cm.badges.map((b) => (
          <article
            className={`badge badge--${b.tier}${b.got ? " is-got" : ""}`}
            key={b.id}
          >
            <span className="badge__disc" aria-hidden="true">
              <span className="badge__face" />
            </span>
            <p className="badge__n">{b.name}</p>
            <p className="badge__s">{b.sub}</p>
            {b.got ? (
              <p className="badge__got">{t.earned}</p>
            ) : (
              <p className="badge__left">
                {/* Locked badges show the distance left rather than a padlock:
                    a number you can close is an invitation, a padlock is a
                    wall. */}
                {typeof b.have === "number" && typeof b.need === "number"
                  ? `${b.have} / ${b.need}`
                  : t.locked}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

/* ── shop ─────────────────────────────────────────────────────────────── */

export function Shop({ locale }: { locale: Locale }) {
  const t = getContent(locale).shopcase;
  const [hover, setHover] = useState<string | null>(null);
  const balance = cm.wallet.balanceDrv;

  return (
    <section className="sc2" aria-labelledby="sc2-h">
      <div className="sc2__head">
        <p className="sc2__eyebrow">{t.eyebrow}</p>
        <h2 className="sc2__h" id="sc2-h">
          {t.title}
          <Mark locale={locale} kind="sample" />
        </h2>
        <p className="sc2__sub">{t.sub}</p>
        <p className="sc2__bal">
          <Odometer value={balance} digits={5} tone="volt" />
          <span>DRV</span>
        </p>
      </div>

      <div className="sc2__shelf">
        {cm.shop.map((s) => {
          const affordable = balance >= s.price;
          const share = Math.min(1, balance / s.price);
          return (
            <article
              className={affordable ? "item is-ok" : "item"}
              key={s.id}
              onMouseEnter={() => setHover(s.id)}
              onMouseLeave={() => setHover(null)}
            >
              {s.tag ? <span className="item__tag">{s.tag}</span> : null}
              <p className="item__n">{s.name}</p>
              <p className="item__p">
                {n(locale, s.price)}
                <span>DRV</span>
              </p>
              {/* The peg, not a guess: the same conversion `/model` uses. */}
              <p className="item__w">{krw(locale, s.price * krwPerDrv)}</p>
              <span
                className="item__bar"
                style={{ "--v": share } as React.CSSProperties}
                aria-hidden="true"
              />
              <p className="item__need">
                {affordable
                  ? t.canBuy
                  : `${t.short} ${n(locale, s.price - balance)} DRV`}
              </p>
              {hover === s.id ? <span className="item__lift" aria-hidden="true" /> : null}
            </article>
          );
        })}
      </div>

      <p className="sc2__foot">{t.foot}</p>
    </section>
  );
}
