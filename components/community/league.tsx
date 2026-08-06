import { getContent, type Locale } from "@/lib/i18n";
import { WAITLIST_URL } from "@/lib/site";
import { n } from "@/lib/format";
import cm from "@/data/community.json";

const PODIUM = cm.leaderboard.slice(0, 3);
const REST = cm.leaderboard.slice(3);

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
    <section className="lg" id="league" aria-labelledby="lg-h">
      <div className="lg__top">
        <p className="lg__eyebrow">{t.eyebrow}</p>
        <h2 className="lg__h2" id="lg-h">
          {t.title}
        </h2>
        <p className="lg__sub">{t.sub}</p>
        <p className="lg__clock">
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
            </div>
          </article>
        ))}
      </div>

      <div className="lg__scroll">
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
                <td className="num eff">{r.eff.toFixed(2)}</td>
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
                <a href={WAITLIST_URL} rel="noopener noreferrer" target="_blank">
                  {t.yourRow}
                </a>
                <span className="hint">{t.yourRowNote}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <a className="lg__all" href="#league">
        {t.all} →
      </a>
    </section>
  );
}
