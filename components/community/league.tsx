import { getContent, genesisPathFor, type Locale } from "@/lib/i18n";
import { Mark } from "@/components/community/mark";
import { n } from "@/lib/format";
import cm from "@/data/community.json";

const PODIUM = cm.leaderboard.slice(0, 3);
const REST = cm.leaderboard.slice(3);

/*
 * Scale for the efficiency bars.
 *
 * Anchored to the spread of the field rather than to zero. Every car here is
 * between 7 and 8.5 km/kWh, so a bar measured from zero would show seven
 * near-identical full bars and encode nothing — the interesting quantity is the
 * gap between drivers, which is what the eye should be able to read.
 */
const EFFS = cm.leaderboard.map((r) => r.eff);
const FLOOR = Math.min(...EFFS) - 0.25;
const CEIL = Math.max(...EFFS) + 0.1;
const share = (eff: number) => (eff - FLOOR) / (CEIL - FLOOR);

/**
 * The efficiency table, with a hole in it.
 *
 * Under the last visible row sits a gap ("134 more") and then an empty,
 * blinking row where the reader's own rank would be. The unfilled row is the
 * call to action — a leaderboard you are not on is a better argument for
 * joining than a button that says join.
 */
export function League({ locale }: { locale: Locale }) {
  const t = getContent(locale).league;
  const omitted = 134;

  return (
    <section className="league" id="league" aria-labelledby="lg-h">
      <div className="league__top">
        <p className="league__eyebrow">{t.eyebrow}</p>
        <h2 className="league__h2" id="lg-h">
          {t.title}
          <Mark locale={locale} kind="sample" />
        </h2>
        <p className="league__sub">{t.sub}</p>
        <p className="league__clock">
          {cm.season.week}
          {t.weekLabel} · {t.closesIn} {cm.season.closesInDays}
          {t.days}
        </p>
      </div>

      <div className="podium">
        {PODIUM.map((p) => (
          <article className={`pod pod--${p.rank}`} key={p.name}>
            <span className="pod__r">{p.rank}</span>
            <div>
              <p className="pod__n">
                {p.name}
                {p.genesis ? <span className="gen">GEN</span> : null}
              </p>
              <p className="pod__m">
                {p.trim} · {p.region}
              </p>
              <p className="pod__e">
                {p.eff.toFixed(2)}
                <span className="pod__eu">{t.unit}</span>
              </p>
              <span
                className="pod__bar"
                style={{ "--v": share(p.eff) } as React.CSSProperties}
                aria-hidden="true"
              />
            </div>
          </article>
        ))}
      </div>

      <div className="league__scroll">
        <table className="lgtable">
          <thead>
            <tr>
              <th scope="col">{t.cols.pos}</th>
              <th scope="col">{t.cols.driver}</th>
              <th scope="col">{t.cols.region}</th>
              <th scope="col" className="num">
                {t.cols.eff}
              </th>
              <th scope="col" className="num">
                {t.cols.km}
              </th>
              <th scope="col" className="num">
                {t.cols.drv}
              </th>
              <th scope="col" className="num">
                {t.cols.streak}
              </th>
            </tr>
          </thead>
          <tbody>
            {REST.map((r) => (
              <tr key={r.name}>
                <td className="pos">
                  {r.rank}
                  {r.delta > 0 ? <span className="up"> ▲{r.delta}</span> : null}
                  {r.delta < 0 ? (
                    <span className="down"> ▼{Math.abs(r.delta)}</span>
                  ) : null}
                </td>
                <td>
                  {r.name}
                  {r.genesis ? <span className="gen">GEN</span> : null}
                </td>
                <td>{r.region}</td>
                <td
                  className="num eff"
                  style={{ "--v": share(r.eff) } as React.CSSProperties}
                >
                  {r.eff.toFixed(2)}
                </td>
                <td className="num">{n(locale, r.km)}</td>
                <td className="num">{n(locale, r.drv)}</td>
                <td className="num">
                  {r.streak}
                  {t.dayUnit}
                </td>
              </tr>
            ))}

            <tr className="gaprow">
              <td colSpan={7}>
                ⋯ {n(locale, omitted)} {t.omitted} ⋯
              </td>
            </tr>

            <tr className="yourow">
              <td colSpan={7}>
                <a href={genesisPathFor(locale)} rel="noopener noreferrer" target="_blank">
                  {t.yourRow}
                </a>
                <span className="hint">{t.yourRowNote}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <a className="league__all" href="#league">
        {t.all} →
      </a>
    </section>
  );
}
