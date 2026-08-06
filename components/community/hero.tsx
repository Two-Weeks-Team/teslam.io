import { getContent, modelPathFor, type Locale } from "@/lib/i18n";
import { WAITLIST_URL } from "@/lib/site";
import { n } from "@/lib/format";
import cm from "@/data/community.json";

const { seats, taken } = cm.genesis;

/**
 * Headline, and the Genesis call to action drawn as the cohort itself.
 *
 * The seat grid is the whole idea: 500 squares, 347 gold and taken, the rest
 * empty — and one mint square blinking, which is the seat the reader would be
 * getting. A progress bar would carry the same number and none of the pull.
 */
export function CHero({ locale }: { locale: Locale }) {
  const t = getContent(locale);
  const left = seats - taken;

  return (
    <section className="chero">
      <div className="chero__main">
        <p className="chero__badge">{t.hero.badge}</p>
        <h1 className="chero__h1">
          {t.hero.h1}
          <br />
          <em>{t.hero.h1b}</em>
        </h1>
        <p className="chero__sub">{t.hero.sub}</p>
        <div className="chero__btns">
          <a
            className="btn btn--gold"
            href={WAITLIST_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            {t.hero.ctaPrimary}
          </a>
          <a className="btn btn--ghost" href={modelPathFor(locale)}>
            {t.hero.ctaSecondary}
          </a>
        </div>
      </div>

      <aside className="seats" aria-labelledby="seats-h">
        <p className="seats__h" id="seats-h">
          {t.genesis.title}
        </p>

        <div
          className="seats__grid"
          role="img"
          aria-label={`${t.genesis.seatGridLabel}: ${n(locale, taken)} / ${n(locale, seats)}`}
        >
          {Array.from({ length: seats }, (_, i) => (
            <span
              key={i}
              className={
                i < taken ? "seat seat--on" : i === taken ? "seat seat--you" : "seat"
              }
            />
          ))}
        </div>

        <div className="seats__legend">
          <span className="seats__key">
            <span
              className="seats__sw"
              style={{ background: "var(--gold)" }}
              aria-hidden="true"
            />
            {t.genesis.seatTaken} {n(locale, taken)}
          </span>
          <span className="seats__key">
            <span
              className="seats__sw"
              style={{ background: "var(--mint)" }}
              aria-hidden="true"
            />
            {t.genesis.yours}
          </span>
          <span className="seats__key">
            <span
              className="seats__sw"
              style={{ background: "var(--ink2)" }}
              aria-hidden="true"
            />
            {t.genesis.seatLeft} {n(locale, left)}
          </span>
        </div>

        <div className="seats__perks">
          {t.genesis.perks.map((p) => (
            <p className="seats__perk" key={p}>
              {p}
            </p>
          ))}
        </div>

        <a
          className="btn btn--mint btn--block seats__cta"
          href={WAITLIST_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          {t.genesis.cta}
        </a>
        <p className="seats__note">{t.genesis.note}</p>
      </aside>
    </section>
  );
}
