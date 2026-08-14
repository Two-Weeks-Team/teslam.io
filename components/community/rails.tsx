import { getContent, boardPathFor, genesisPathFor, type Locale } from "@/lib/i18n";
import { Mark } from "@/components/community/mark";
import { Odometer } from "@/components/community/odometer";
import { krw, n } from "@/lib/format";
import { krwPerDrv, dailyCapDrv } from "@/lib/economics";
import { BOARDS } from "@/lib/board";
import { regionLabel } from "@/lib/genesis";
import { modeFor, SHOWCASE, type Capabilities } from "@/lib/showcase";
import cm from "@/data/community.json";

/*
 * Busiest board and busiest region, for the bars behind the counts.
 *
 * A navigation list of names and numbers is a list you read one line at a time.
 * The same list with the counts encoded is one you take in at a glance, which
 * is what a sidebar is for.
 */
const TOP_REGION = Math.max(...cm.regions.map((r) => r.count));

/**
 * Boards, regions, rankings. The navigation a forum actually needs.
 *
 * The board list is real as soon as the board is: `counts` comes from the API,
 * so a board with four posts says four. Only when there is no board behind it
 * does the sample rail appear, and then only with the switch on.
 */
export function LeftRail({
  locale,
  counts,
  live,
}: {
  locale: Locale;
  counts: Record<string, number>;
  live: boolean;
}) {
  const t = getContent(locale).side;

  const rows = live
    ? BOARDS.map((b) => ({ id: b.id, name: b[locale], count: counts[b.id] ?? 0 }))
    : SHOWCASE
      ? cm.boards.map((b) => ({
          id: b.id,
          // `b.id` is stable, `b.name` was Korean prose in shared JSON. The
          // sample rail borrows the real vocabulary rather than carrying its
          // own untranslated copy.
          name: BOARDS.find((x) => x.id === b.id)?.[locale] ?? b.name,
          count: b.count,
        }))
      : [];

  if (rows.length === 0 && !SHOWCASE) return <aside className="rail" aria-hidden="true" />;

  const top = Math.max(1, ...rows.map((r) => r.count));

  return (
    <aside className="rail" aria-label={t.boards}>
      <nav className="card">
        <p className="card__h">
          {t.boards}
          {live ? null : <Mark locale={locale} kind="sample" />}
        </p>
        <div className="navlist">
          {rows.map((b) => (
            <a
              key={b.id}
              href={live ? `${boardPathFor(locale)}?board=${b.id}` : "#feed"}
              style={{ "--v": b.count / top } as React.CSSProperties}
            >
              <span>{b.name}</span>
              <span className="c">{n(locale, b.count)}</span>
            </a>
          ))}
        </div>
      </nav>

      {/* Registrant distribution is drawn for real by the Cohort section from
          the live API. This rail's copy is sample, so it goes with the rest of
          the sample content. */}
      {SHOWCASE ? (
        <nav className="card">
          <p className="card__h">
            {t.regions}
            <Mark locale={locale} kind="sample" />
          </p>
          <div className="navlist">
            {cm.regions.map((r) => (
              <a
                key={r.id}
                href="#cohort"
                style={{ "--v": r.count / TOP_REGION } as React.CSSProperties}
              >
                <span>{regionLabel(locale, r.id)}</span>
                <span className="c">{n(locale, r.count)}</span>
              </a>
            ))}
          </div>
        </nav>
      ) : null}

      {SHOWCASE ? (
        <nav className="card">
          <p className="card__h">
            {t.ranking}
            <Mark locale={locale} kind="sample" />
          </p>
          <div className="navlist">
            {t.rankingItems.map((x) => (
              <a key={x} href="#league">
                <span>{x}</span>
              </a>
            ))}
          </div>
        </nav>
      ) : null}
    </aside>
  );
}

/**
 * The wallet.
 *
 * Every figure in here is derived from odometer accrual, and no vehicle is
 * linked to an account yet — so the whole column is sample content and
 * disappears entirely when invented content is switched off. What is not
 * invented is the conversion: the won figure and the daily ceiling come from
 * `lib/economics`, so the shelf prices here and the peg on `/model` cannot
 * drift apart.
 */
export function RightRail({ locale, caps }: { locale: Locale; caps: Capabilities }) {
  const t = getContent(locale).wallet;
  const w = cm.wallet;
  const capPct = Math.min(100, (w.earnedTodayDrv / dailyCapDrv) * 100);

  const wallet = modeFor("wallet", caps);
  const shop = modeFor("shop", caps);

  // An aside that renders nothing still holds a grid column. Returning an
  // empty one keeps the three-column layout from collapsing asymmetrically.
  if (wallet === "hidden" && shop === "hidden") {
    return <aside className="rail rail--right" aria-hidden="true" />;
  }

  return (
    <aside className="rail rail--right" aria-labelledby="wal-h">
      {wallet === "hidden" ? null : (
        <>
          <div className="wal">
            <p className="wal__h" id="wal-h">
              <Mark locale={locale} kind="sample" />
              {t.title}
            </p>
            <p className="wal__bl">{t.balance}</p>
            <p className="wal__b">
              {/* The same instrument the seat counters use, so a balance reads
                  as a readout rather than as a paragraph with a big number. */}
              <Odometer value={w.balanceDrv} digits={5} tone="volt" />
              <span className="wal__bu">DRV</span>
            </p>
            <p className="wal__w">
              {t.worth} {krw(locale, w.balanceDrv * krwPerDrv)}
            </p>

            <div className="wal__cap">
              <div className="wal__caprow">
                <span>{t.todayCap}</span>
                <span>
                  {n(locale, w.earnedTodayDrv)} / {n(locale, dailyCapDrv)}
                </span>
              </div>
              <div
                className="bar"
                role="img"
                aria-label={`${t.todayCap} ${Math.round(capPct)}%`}
              >
                <div className="bar__f" style={{ inlineSize: `${capPct}%` }} />
              </div>
              <p className="wal__note">{t.capNote}</p>
            </div>

            <a
              className="btn btn--mint btn--block wal__cta"
              href={genesisPathFor(locale)}
              rel="noopener noreferrer"
              target="_blank"
            >
              {t.connect}
            </a>
          </div>

          <section className="card">
            <p className="card__h">
              {t.ledgerTitle}
              <Mark locale={locale} kind="sample" />
            </p>
            <div className="led">
              {cm.ledger.map((l) => (
                <div className="led__i" key={l.id}>
                  <div className="led__b">
                    <p className="led__t">{l.title}</p>
                    <p className="led__s">{l.sub}</p>
                  </div>
                  <div className={l.amount < 0 ? "led__a led__a--neg" : "led__a"}>
                    {l.amount > 0 ? "+" : "−"}
                    {n(locale, Math.abs(l.amount))}
                    <span className="led__u">{l.unit}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="shop__note">{t.ledgerNote}</p>
          </section>
        </>
      )}

      {shop === "hidden" ? null : (
        <section className="card">
          <p className="card__h">
            {t.shopTitle}
            <Mark locale={locale} kind="sample" />
          </p>
          <div className="shop">
            {cm.shop.map((s) => (
              <div className="shop__i" key={s.id}>
                <span className="shop__n">
                  {s.name}
                  {s.tag ? <span className="shop__tag">{s.tag}</span> : null}
                </span>
                <span className="shop__p">{n(locale, s.price)} DRV</span>
              </div>
            ))}
          </div>
          <p className="shop__note">{t.shopNote}</p>
        </section>
      )}

      {wallet === "hidden" ? null : (
        <section className="card">
          <p className="card__h">{t.tslmTitle}</p>
          <p className="shop__note">{t.tslmNote}</p>
        </section>
      )}
    </aside>
  );
}
