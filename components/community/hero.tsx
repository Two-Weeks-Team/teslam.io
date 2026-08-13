"use client";

import { genesisPathFor, getContent, modelPathFor, type Locale } from "@/lib/i18n";
import { n } from "@/lib/format";
import { useLive } from "@/components/community/live-provider";
import { Mark } from "@/components/community/mark";
import { SeatField } from "@/components/genesis/seat-field";

/**
 * Headline, and the Genesis call to action drawn as the cohort itself.
 *
 * The seat grid is the whole idea: 500 squares, the taken ones gold, the rest
 * empty — and one mint square blinking, which is the seat the reader would be
 * getting. A progress bar would carry the same number and none of the pull.
 *
 * The count is real. It arrives from the server in the HTML and then follows
 * the live socket, so a seat taken while someone is reading lights up under
 * their eyes rather than waiting for a reload.
 */
export function CHero({ locale }: { locale: Locale }) {
  const t = getContent(locale);
  const { seats, taken, justTook, live, open } = useLive();
  const left = seats - taken;
  /*
   * Nobody has confirmed yet.
   *
   * Worth a state of its own rather than letting the general case render it.
   * Five hundred identical dark squares under the words "taken 0" reads as a
   * widget that failed to load, which is the opposite of what an empty cohort
   * means — every seat being free is the most attractive this grid will ever
   * be, and the design has to say so out loud instead of leaving a reader to
   * infer it from a zero.
   */
  const empty = taken === 0;

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
            href={genesisPathFor(locale)}
            rel="noopener noreferrer"
            target="_blank"
          >
            {open ? t.hero.ctaPrimary : t.hero.ctaPrimaryClosed}
          </a>
          <a className="btn btn--ghost" href={modelPathFor(locale)}>
            {t.hero.ctaSecondary}
          </a>
        </div>
      </div>

      <aside className="seats" aria-labelledby="seats-h">
        <p className="seats__h" id="seats-h">
          {live ? <Mark locale={locale} kind="real" /> : null}
          {t.genesis.title}
        </p>

        {empty ? (
          <p className="seats__zero">
            <b>{t.genesis.empty}</b>
            <span>{t.genesis.emptyFirst}</span>
          </p>
        ) : null}

        <SeatField
          taken={taken}
          justSeat={justTook?.seatNo ?? null}
          label={`${t.genesis.seatGridLabel}: ${n(locale, taken)} / ${n(locale, seats)}`}
        >
          <div
            className={empty ? "seats__grid seats__grid--empty" : "seats__grid"}
            role="img"
            aria-label={`${t.genesis.seatGridLabel}: ${n(locale, taken)} / ${n(locale, seats)}`}
          >
            {Array.from({ length: seats }, (_, i) => (
              <span
                key={i}
                className={
                  justTook && i === justTook.seatNo - 1
                    ? "seat seat--on seat--new"
                    : i < taken
                      ? "seat seat--on"
                      : i === taken
                        ? "seat seat--you"
                        : "seat"
                }
              />
            ))}
          </div>
        </SeatField>

        <div className="seats__legend">
          {/* Suppressed at zero: the line above already says every seat is
              free, and "taken 0" beneath it reads as the same fact told twice
              in the more discouraging direction. */}
          {empty ? null : (
            <span className="seats__key">
              <span
                className="seats__sw"
                style={{ background: "var(--gold)" }}
                aria-hidden="true"
              />
              {t.genesis.seatTaken} {n(locale, taken)}
            </span>
          )}
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
          href={genesisPathFor(locale)}
          rel="noopener noreferrer"
          target="_blank"
        >
          {open ? t.genesis.cta : t.genesis.ctaClosed}
        </a>
        <p className="seats__note">{t.genesis.note}</p>
      </aside>
    </section>
  );
}
