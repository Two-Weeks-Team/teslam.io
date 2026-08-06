import { getContent, type Locale } from "@/lib/i18n";
import { WAITLIST_URL } from "@/lib/site";
import { krw, n } from "@/lib/format";
import { krwPerDrv, dailyCapDrv } from "@/lib/economics";
import cm from "@/data/community.json";

/** Boards, regions, rankings. The navigation a forum actually needs. */
export function LeftRail({ locale }: { locale: Locale }) {
  const t = getContent(locale).side;

  return (
    <aside className="rail" aria-label={t.boards}>
      <nav className="card">
        <p className="card__h">{t.boards}</p>
        <div className="navlist">
          {cm.boards.map((b) => (
            <a key={b.id} href="#feed">
              <span>{b.name}</span>
              <span className="c">{n(locale, b.count)}</span>
            </a>
          ))}
        </div>
      </nav>

      <nav className="card">
        <p className="card__h">{t.regions}</p>
        <div className="navlist">
          {cm.regions.map((r) => (
            <a key={r.id} href="#feed">
              <span>{r.name}</span>
              <span className="c">{n(locale, r.count)}</span>
            </a>
          ))}
        </div>
      </nav>

      <nav className="card">
        <p className="card__h">{t.ranking}</p>
        <div className="navlist">
          {t.rankingItems.map((x) => (
            <a key={x} href="#league">
              <span>{x}</span>
            </a>
          ))}
        </div>
      </nav>
    </aside>
  );
}

/**
 * The wallet.
 *
 * The balance is sample data, but what it converts to is not invented — the
 * won figure and the daily ceiling both come from `lib/economics`, so the
 * shelf prices here and the peg on `/model` cannot drift apart.
 */
export function RightRail({ locale }: { locale: Locale }) {
  const t = getContent(locale).wallet;
  const w = cm.wallet;
  const capPct = Math.min(100, (w.earnedTodayDrv / dailyCapDrv) * 100);

  return (
    <aside className="rail rail--right" aria-labelledby="wal-h">
      <div className="wal">
        <p className="wal__h" id="wal-h">
          {t.title}
        </p>
        <p className="wal__bl">{t.balance}</p>
        <p className="wal__b">
          {n(locale, w.balanceDrv)}
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
          href={WAITLIST_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          {t.connect}
        </a>
      </div>

      <section className="card">
        <p className="card__h">{t.ledgerTitle}</p>
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

      <section className="card">
        <p className="card__h">{t.shopTitle}</p>
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

      <section className="card">
        <p className="card__h">{t.tslmTitle}</p>
        <p className="shop__note">{t.tslmNote}</p>
      </section>
    </aside>
  );
}
