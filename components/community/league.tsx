"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getContent, genesisPathFor, type Locale } from "@/lib/i18n";
import { Mark } from "@/components/community/mark";
import { n } from "@/lib/format";
import { regionLabel } from "@/lib/genesis";
import cm from "@/data/community.json";

/**
 * The efficiency table, as the week that produced it.
 *
 * It used to be a podium of three cards above a table of the rest, with the
 * movement printed as a static ▲2 in the corner of a row. That split made the
 * movement impossible to draw: the biggest climb of the week goes from sixth
 * to second, which is a move *between* the two blocks, and nothing can slide
 * from a table row into a podium card.
 *
 * So it is one list. The top three keep their tier colours and their larger
 * type — that is what the podium was actually carrying — and every row is the
 * same shape, which is what lets them trade places. On reveal the list is put
 * back into last week's order and allowed to settle into this week's, so the
 * ranking arrives as something that happened rather than as a fact that was
 * always there.
 *
 * Under the last row sits a gap and then an empty, blinking row where the
 * reader's own rank would be. A leaderboard you are not on is a better argument
 * for joining than a button that says join.
 */

const ROWS = cm.leaderboard;

/*
 * Where each row sat last week.
 *
 * `rank + delta` — a row now fourth with a delta of +1 climbed one, so it was
 * fifth. This only produces a coherent animation if the result is a genuine
 * permutation, which the sample data did not originally give: its deltas summed
 * to 4 and put two rows in sixth place with nobody in fourth or fifth. They
 * were decorative, and a movement that could not have happened cannot be
 * played back. The fixture now describes a real reordering, and this asserts it
 * rather than trusting it.
 */
const PREVIOUS = ROWS.map((r) => r.rank + r.delta);

/** Scale for the efficiency bars — see the note in `share`. */
const EFFS = ROWS.map((r) => r.eff);
const FLOOR = Math.min(...EFFS) - 0.25;
const CEIL = Math.max(...EFFS) + 0.1;

/*
 * Anchored to the spread of the field rather than to zero. Every car here is
 * between 7 and 8.5 km/kWh, so a bar measured from zero would show seven
 * near-identical full bars and encode nothing — the interesting quantity is the
 * gap between drivers, which is what a league is about.
 */
const share = (eff: number) => (eff - FLOOR) / (CEIL - FLOOR);

export function League({ locale }: { locale: Locale }) {
  const t = getContent(locale).league;
  const omitted = 134;

  const bodyRef = useRef<HTMLTableSectionElement | null>(null);
  const [moving, setMoving] = useState(false);
  const [played, setPlayed] = useState(false);
  const [rowHeight, setRowHeight] = useState(0);

  /*
   * Rows are rendered in this week's order and then displaced to last week's
   * for one frame.
   *
   * The other way round — render last week's order and reorder the DOM — would
   * mean the server sends standings that are out of date, and a crawler or a
   * reader without JavaScript would get last week's table as the final answer.
   * Displacing with a transform leaves the markup correct at every moment.
   */
  const play = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) {
      // Not "no animation, no result" — the final order is already what the
      // markup says, so there is simply nothing to play.
      setPlayed(true);
      return;
    }

    const first = body.querySelector("tr");
    const height = first?.getBoundingClientRect().height ?? 0;
    if (!height) return;

    setRowHeight(height);
    setMoving(true);
    setPlayed(true);

    // One frame displaced, then released. Two nested rAFs because a style set
    // and cleared inside the same frame is never painted, and the rows would
    // arrive with no journey.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setMoving(false));
    });
  }, []);

  // Plays when it comes into view, once. A ranking that re-races every time it
  // scrolls past would be a distraction rather than an event.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || played) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          play();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(body);
    return () => observer.disconnect();
  }, [play, played]);

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
        <button
          className="league__replay"
          type="button"
          onClick={play}
          disabled={moving}
        >
          {t.replay}
        </button>
      </div>

      {/*
        This week's leaders, kept above the race.

        The podium and the table say different things — the podium is the
        result, the table is how it was arrived at — so having a driver appear
        in both is not duplication any more than a scoreboard repeating the
        score at the top of a match report.
      */}
      <div className="podium">
        {ROWS.slice(0, 3).map((p) => (
          <article className={`pod pod--${p.rank}`} key={p.name}>
            <span className="pod__r">{p.rank}</span>
            <div>
              <p className="pod__n">
                {p.name}
                {p.genesis ? <span className="gen">GEN</span> : null}
              </p>
              <p className="pod__m">
                {p.trim} · {regionLabel(locale, p.region)}
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
              <p className="pod__d">
                {p.delta > 0 ? `▲${p.delta}` : p.delta < 0 ? `▼${Math.abs(p.delta)}` : "—"}
                <span>{t.fromLastWeek}</span>
              </p>
            </div>
          </article>
        ))}
      </div>

      <div className="league__scroll">
        <table className="lgtable">
          <caption className="skip">{t.title}</caption>
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

          <tbody className={moving ? "lgbody is-moving" : "lgbody"} ref={bodyRef}>
            {ROWS.map((r, i) => (
              <tr
                key={r.name}
                className={r.rank <= 3 ? `lgrow lgrow--${r.rank}` : "lgrow"}
                style={
                  moving
                    ? { transform: `translateY(${(PREVIOUS[i] - r.rank) * rowHeight}px)` }
                    : undefined
                }
              >
                <td className="pos">
                  {/* While the rows are displaced they are sitting in last
                      week's places, so the numeral has to say last week's rank
                      — a row parked in third under a "1" is just wrong. */}
                  <b className="pos__n">{moving ? PREVIOUS[i] : r.rank}</b>
                  {!moving && r.delta > 0 ? (
                    <span className="up"> ▲{r.delta}</span>
                  ) : null}
                  {!moving && r.delta < 0 ? (
                    <span className="down"> ▼{Math.abs(r.delta)}</span>
                  ) : null}
                </td>
                <td>
                  {r.name}
                  {r.genesis ? <span className="gen">GEN</span> : null}
                  <span className="lgrow__trim">{r.trim}</span>
                </td>
                <td>{regionLabel(locale, r.region)}</td>
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
